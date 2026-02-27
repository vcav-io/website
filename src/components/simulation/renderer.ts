// Simulation renderer — all DOM manipulation lives here.
// Receives callbacks from the engine, updates the DOM.

import type {
  PhaseId,
  ChatMessage,
  ProtocolCard,
  ProtocolLine,
} from './types.ts';

interface PanelElements {
  left: HTMLElement;
  centre: HTMLElement;
  right: HTMLElement;
  leftMessages: HTMLElement;
  rightMessages: HTMLElement;
  vaultEvents: HTMLElement;
  progressBar: HTMLElement;
  progressTime: HTMLElement;
  signalOverlay: HTMLElement;
  timeline?: HTMLElement;
}

type ActiveBubbles = Map<string, HTMLElement>;

export class SimulationRenderer {
  private els: PanelElements;
  private activeBubbles: ActiveBubbles = new Map();
  private pendingTimers: Set<ReturnType<typeof setTimeout>> = new Set();
  private timelineBubbles: Set<string> = new Set();

  constructor(els: PanelElements) {
    this.els = els;
    // Event delegation for tap-to-expand on mobile timeline
    if (els.timeline) {
      els.timeline.addEventListener('click', (e) => {
        const header = (e.target as HTMLElement).closest('.tl-card__header');
        if (header) {
          const card = header.parentElement;
          if (card) card.classList.toggle('tl-card--expanded');
        }
      });
    }
  }

  private _setTimeout(fn: () => void, ms: number) {
    const id = setTimeout(() => {
      this.pendingTimers.delete(id);
      fn();
    }, ms);
    this.pendingTimers.add(id);
  }

  // ── Phase transitions ─────────────────────────────────────────────────────

  onPhaseChange(phase: PhaseId) {
    const { left, centre, right } = this.els;

    if (phase === 'pre-session') {
      left.classList.remove('panel--dim');
      right.classList.remove('panel--dim');
      centre.classList.add('panel--dim');
    } else if (phase === 'protocol') {
      left.classList.add('panel--dim');
      right.classList.add('panel--dim');
      centre.classList.remove('panel--dim');
    } else if (phase === 'post-session') {
      left.classList.remove('panel--dim');
      right.classList.remove('panel--dim');
      centre.classList.add('panel--dim');
    }

    // Timeline: phase separator
    if (this.els.timeline) {
      this._appendPhaseSeparator(phase);
    }
  }

  private _appendPhaseSeparator(phase: PhaseId) {
    const tl = this.els.timeline!;
    const sep = document.createElement('div');
    sep.className = 'tl-phase-separator';
    const labels: Record<PhaseId, string> = {
      'pre-session': 'Pre-Session',
      'protocol': 'Protocol Execution',
      'post-session': 'Post-Session',
    };
    sep.textContent = labels[phase];
    tl.appendChild(sep);
    tl.scrollTop = tl.scrollHeight;
  }

  // ── Chat messages ─────────────────────────────────────────────────────────

  onChatMessage(msg: ChatMessage, charIndex: number, _totalChars: number) {
    const key = this._bubbleKey(msg);
    let bubble = this.activeBubbles.get(key);

    if (!bubble) {
      bubble = this._createBubble(msg);
      const container = msg.panel === 'left' ? this.els.leftMessages : this.els.rightMessages;
      container.appendChild(bubble);
      this.activeBubbles.set(key, bubble);
    }

    const textEl = bubble.querySelector('.chat-bubble__text') as HTMLElement;
    if (textEl) {
      textEl.textContent = msg.text.slice(0, charIndex + 1);
      textEl.classList.add('typing');
    }

    // Auto-scroll
    const container = msg.panel === 'left' ? this.els.leftMessages : this.els.rightMessages;
    container.scrollTop = container.scrollHeight;

    // Timeline: show "typing..." placeholder on first character
    if (charIndex === 0 && this.els.timeline && !this.timelineBubbles.has(key)) {
      this.timelineBubbles.add(key);
      this._appendTimelineChat(msg, true);
    }
  }

  onChatMessageComplete(msg: ChatMessage) {
    const key = this._bubbleKey(msg);
    const bubble = this.activeBubbles.get(key);
    if (bubble) {
      const textEl = bubble.querySelector('.chat-bubble__text') as HTMLElement;
      if (textEl) textEl.classList.remove('typing');
    }

    // Timeline: text is already fully shown; just remove typing cursor
    if (this.els.timeline) {
      const tlBubble = this.els.timeline.querySelector(`[data-tl-key="${key}"]`);
      if (tlBubble) {
        const textEl = tlBubble.querySelector('.tl-chat__text') as HTMLElement;
        if (textEl) textEl.classList.remove('tl-chat__text--typing');
      }
    }
  }

  private _appendTimelineChat(msg: ChatMessage, isTyping: boolean) {
    const tl = this.els.timeline!;
    const key = this._bubbleKey(msg);
    const el = document.createElement('div');
    el.className = `tl-chat tl-chat--${msg.panel} tl-chat--${msg.sender}`;
    el.setAttribute('data-tl-key', key);

    const name = document.createElement('span');
    name.className = 'tl-chat__name';
    name.textContent = msg.name;
    el.appendChild(name);

    const text = document.createElement('span');
    text.className = 'tl-chat__text';
    if (isTyping) {
      // Show full text immediately with fade-in (no "typing..." placeholder)
      text.textContent = msg.text;
      el.classList.add('tl-chat--fade-in');
    } else {
      text.textContent = msg.text;
    }
    el.appendChild(text);

    tl.appendChild(el);
    tl.scrollTop = tl.scrollHeight;
  }

  private _bubbleKey(msg: ChatMessage): string {
    return `${msg.panel}-${msg.delayMs}`;
  }

  private _createBubble(msg: ChatMessage): HTMLElement {
    const wrap = document.createElement('div');
    wrap.className = `chat-message chat-message--${msg.sender}`;

    const name = document.createElement('span');
    name.className = 'chat-message__name';
    name.textContent = msg.name;

    const bubble = document.createElement('div');
    bubble.className = `chat-bubble chat-bubble--${msg.sender}`;

    const text = document.createElement('span');
    text.className = 'chat-bubble__text';
    bubble.appendChild(text);

    wrap.appendChild(name);
    wrap.appendChild(bubble);

    // Animate in
    wrap.style.opacity = '0';
    wrap.style.transform = 'translateY(8px)';
    requestAnimationFrame(() => {
      wrap.style.transition = 'opacity 200ms ease, transform 200ms ease';
      wrap.style.opacity = '1';
      wrap.style.transform = 'translateY(0)';
    });

    return wrap;
  }

  // ── Protocol cards ────────────────────────────────────────────────────────

  onProtocolCard(card: ProtocolCard) {
    const container = this.els.vaultEvents;

    // For error cards: flash red border on panel
    if (card.isError) {
      this.els.centre.classList.add('panel--error-flash');
      this._setTimeout(() => {
        this.els.centre.classList.remove('panel--error-flash');
      }, 600);
    }

    const el = this._buildCard(card);
    container.appendChild(el);

    // Animate in
    el.style.opacity = '0';
    el.style.transform = 'translateY(12px)';
    requestAnimationFrame(() => {
      el.style.transition = 'opacity 350ms var(--ease-out), transform 350ms var(--ease-out)';
      el.style.opacity = '1';
      el.style.transform = 'translateY(0)';
    });

    // Auto-scroll vault panel
    const vaultScroll = container.parentElement;
    if (vaultScroll) {
      this._setTimeout(() => {
        vaultScroll.scrollTop = vaultScroll.scrollHeight;
      }, 100);
    }

    // Timeline: append collapsed card
    if (this.els.timeline) {
      this._appendTimelineCard(card);
    }
  }

  private _appendTimelineCard(card: ProtocolCard) {
    const tl = this.els.timeline!;
    const el = document.createElement('div');
    el.className = `tl-card${card.isError ? ' tl-card--error' : ''}`;

    // Header (always visible, clickable to expand)
    const header = document.createElement('div');
    header.className = 'tl-card__header';

    const tag = document.createElement('span');
    tag.className = 'tl-card__tag';
    tag.textContent = card.stepLabel;

    const title = document.createElement('span');
    title.className = 'tl-card__title';
    title.textContent = card.title;

    const chevron = document.createElement('span');
    chevron.className = 'tl-card__chevron';
    chevron.textContent = '\u25b8';

    header.appendChild(tag);
    header.appendChild(title);
    header.appendChild(chevron);
    el.appendChild(header);

    // Status line (always visible if present)
    if (card.statusLine) {
      const status = document.createElement('div');
      status.className = `tl-card__status ${card.statusLine.ok ? 'tl-card__status--ok' : 'tl-card__status--error'}`;
      const icon = card.statusLine.ok ? '\u2713' : '\u2717';
      status.textContent = `${icon} ${card.statusLine.text}`;
      el.appendChild(status);
    }

    // Body (hidden by default, shown on expand)
    if (card.lines.length > 0) {
      const body = document.createElement('div');
      body.className = 'tl-card__body';
      for (const line of card.lines) {
        body.appendChild(this._buildLine(line));
      }
      el.appendChild(body);
    }

    tl.appendChild(el);
    tl.scrollTop = tl.scrollHeight;
  }

  private _buildCard(card: ProtocolCard): HTMLElement {
    const el = document.createElement('div');
    const cls = card.isError ? ' vault-card--error' : card.statusLine?.ok ? ' vault-card--success' : '';
    el.className = `vault-card${cls}`;
    el.setAttribute('data-step', card.id);

    // Error cards auto-expand
    if (card.isError) el.classList.add('vault-card--expanded');

    // Step label + title + chevron
    const header = document.createElement('div');
    header.className = 'vault-card__header';
    header.addEventListener('click', () => el.classList.toggle('vault-card--expanded'));

    const stepTag = document.createElement('span');
    stepTag.className = 'vault-card__step-tag';
    stepTag.textContent = card.stepLabel;

    const title = document.createElement('span');
    title.className = 'vault-card__title';
    title.textContent = card.title;

    const chevron = document.createElement('span');
    chevron.className = 'vault-card__chevron';
    chevron.textContent = '\u25b8';

    header.appendChild(stepTag);
    header.appendChild(title);
    header.appendChild(chevron);
    el.appendChild(header);

    // Status line — visible when collapsed
    if (card.statusLine) {
      const status = document.createElement('div');
      status.className = `vault-card__status ${card.statusLine.ok ? 'vault-card__status--ok' : 'vault-card__status--error'}`;
      const icon = card.statusLine.ok ? '\u2713' : '\u2717';
      status.textContent = `${icon} ${card.statusLine.text}`;
      el.appendChild(status);

      if (card.statusLine.note) {
        const note = document.createElement('div');
        note.className = 'vault-card__note';
        note.textContent = card.statusLine.note;
        el.appendChild(note);
      }
    }

    // Lines — hidden behind expand
    if (card.lines.length > 0) {
      const body = document.createElement('div');
      body.className = 'vault-card__body';
      for (const line of card.lines) {
        body.appendChild(this._buildLine(line));
      }
      el.appendChild(body);
    }

    return el;
  }

  private _buildLine(line: ProtocolLine): HTMLElement {
    const el = document.createElement('div');
    el.className = `vault-line vault-line--${line.kind}`;

    if (line.kind === 'key-value') {
      const key = document.createElement('span');
      key.className = 'vault-line__key';
      key.textContent = line.text;

      const value = document.createElement('span');
      value.className = 'vault-line__value';
      value.textContent = line.value ?? '';

      el.appendChild(key);
      el.appendChild(value);

      if (line.comment) {
        const cmt = document.createElement('span');
        cmt.className = 'vault-line__comment';
        cmt.textContent = '  ' + line.comment;
        el.appendChild(cmt);
      }
    } else if (line.kind === 'bullet') {
      el.textContent = '\u25b8 ' + line.text;
    } else if (line.kind === 'blank') {
      el.textContent = '\u00a0';
    } else {
      el.textContent = line.text;
    }

    return el;
  }

  // ── Signal flow ───────────────────────────────────────────────────────────

  onSignalFlow(json: string) {
    // Timeline: signal block
    if (this.els.timeline) {
      const tl = this.els.timeline;
      const el = document.createElement('div');
      el.className = 'tl-signal';

      const label = document.createElement('div');
      label.className = 'tl-signal__label';
      label.textContent = 'Step 7 \u2014 Output Signal';
      el.appendChild(label);

      const pre = document.createElement('pre');
      pre.className = 'tl-signal__json';
      pre.textContent = json;
      el.appendChild(pre);

      tl.appendChild(el);
      tl.scrollTop = tl.scrollHeight;
    }

    // Add signal as a vault card in the step sequence (visible when overlay is dismissed)
    const card = document.createElement('div');
    card.className = 'vault-card vault-card--signal vault-card--expanded';
    card.setAttribute('data-step', 'step-7');

    const cardHeader = document.createElement('div');
    cardHeader.className = 'vault-card__header';
    cardHeader.addEventListener('click', () => card.classList.toggle('vault-card--expanded'));

    const stepTag = document.createElement('span');
    stepTag.className = 'vault-card__step-tag';
    stepTag.textContent = 'Step 7';

    const cardTitle = document.createElement('span');
    cardTitle.className = 'vault-card__title';
    cardTitle.textContent = 'Output Signal';

    const chevron = document.createElement('span');
    chevron.className = 'vault-card__chevron';
    chevron.textContent = '\u25b8';

    cardHeader.append(stepTag, cardTitle, chevron);
    card.appendChild(cardHeader);

    const cardBody = document.createElement('div');
    cardBody.className = 'vault-card__body';
    const cardPre = document.createElement('pre');
    cardPre.className = 'signal-block__json';
    cardPre.textContent = json;
    cardBody.appendChild(cardPre);
    card.appendChild(cardBody);

    this.els.vaultEvents.appendChild(card);

    // Signal overlay — dramatic reveal, dismissable
    const overlay = this.els.signalOverlay;
    while (overlay.firstChild) {
      overlay.removeChild(overlay.firstChild);
    }

    const closeBtn = document.createElement('button');
    closeBtn.className = 'signal-overlay__close';
    closeBtn.setAttribute('aria-label', 'Close signal overlay');
    closeBtn.textContent = '\u2715';
    closeBtn.addEventListener('click', () => {
      overlay.classList.remove('signal-overlay--visible');
      this.els.centre.classList.remove('panel--dim');
    });
    overlay.appendChild(closeBtn);

    const centre = document.createElement('div');
    centre.className = 'signal-block signal-block--centre';

    const label = document.createElement('div');
    label.className = 'signal-block__label';
    label.textContent = 'Step 7 — Output Signal';
    centre.appendChild(label);

    const pre = document.createElement('pre');
    pre.className = 'signal-block__json';
    pre.textContent = json;
    centre.appendChild(pre);

    overlay.appendChild(centre);
    overlay.classList.add('signal-overlay--visible');

    // After a short delay, animate copies flowing to left and right panels
    this._setTimeout(() => {
      const leftCopy = document.createElement('div');
      leftCopy.className = 'signal-block signal-block--left';
      const leftPre = document.createElement('pre');
      leftPre.className = 'signal-block__json';
      leftPre.textContent = json;
      leftCopy.appendChild(leftPre);
      overlay.appendChild(leftCopy);

      const rightCopy = document.createElement('div');
      rightCopy.className = 'signal-block signal-block--right';
      const rightPre = document.createElement('pre');
      rightPre.className = 'signal-block__json';
      rightPre.textContent = json;
      rightCopy.appendChild(rightPre);
      overlay.appendChild(rightCopy);

      // Trigger CSS animation
      requestAnimationFrame(() => {
        leftCopy.classList.add('signal-block--animate-left');
        rightCopy.classList.add('signal-block--animate-right');
      });
    }, 800);
  }

  // ── Progress ──────────────────────────────────────────────────────────────

  onProgress(elapsedMs: number, totalMs: number) {
    const pct = Math.min(100, (elapsedMs / totalMs) * 100);
    this.els.progressBar.style.width = `${pct}%`;

    const total = Math.ceil(totalMs / 1000);
    const elapsed = Math.min(Math.floor(elapsedMs / 1000), total);
    this.els.progressTime.textContent = `${elapsed}s / ${total}s`;
  }

  // ── Complete ──────────────────────────────────────────────────────────────

  onComplete() {
    this.els.progressBar.style.width = '100%';
  }

  // ── Reset ─────────────────────────────────────────────────────────────────

  reset() {
    this.activeBubbles.clear();
    this.timelineBubbles.clear();
    this.pendingTimers.forEach((id) => clearTimeout(id));
    this.pendingTimers.clear();

    // Clear containers safely
    const clearEl = (el: HTMLElement) => {
      while (el.firstChild) el.removeChild(el.firstChild);
    };
    clearEl(this.els.leftMessages);
    clearEl(this.els.rightMessages);
    clearEl(this.els.vaultEvents);
    clearEl(this.els.signalOverlay);

    // Clear timeline (event delegation listener stays on container)
    if (this.els.timeline) {
      clearEl(this.els.timeline);
    }

    this.els.signalOverlay.classList.remove('signal-overlay--visible');
    this.els.progressBar.style.width = '0%';
    this.els.progressTime.textContent = '';
    this.els.left.classList.remove('panel--dim', 'panel--error-flash');
    this.els.centre.classList.remove('panel--dim', 'panel--error-flash');
    this.els.right.classList.remove('panel--dim', 'panel--error-flash');
    this.onPhaseChange('pre-session');
  }
}
