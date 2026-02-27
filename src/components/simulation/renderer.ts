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
}

type ActiveBubbles = Map<string, HTMLElement>;

export class SimulationRenderer {
  private els: PanelElements;
  private activeBubbles: ActiveBubbles = new Map();

  constructor(els: PanelElements) {
    this.els = els;
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
  }

  onChatMessageComplete(msg: ChatMessage) {
    const key = this._bubbleKey(msg);
    const bubble = this.activeBubbles.get(key);
    if (bubble) {
      const textEl = bubble.querySelector('.chat-bubble__text') as HTMLElement;
      if (textEl) textEl.classList.remove('typing');
    }
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
      setTimeout(() => {
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
      setTimeout(() => {
        vaultScroll.scrollTop = vaultScroll.scrollHeight;
      }, 100);
    }
  }

  private _buildCard(card: ProtocolCard): HTMLElement {
    const el = document.createElement('div');
    el.className = `vault-card${card.isError ? ' vault-card--error' : ''}`;
    el.setAttribute('data-step', card.id);

    // Step label + title
    const header = document.createElement('div');
    header.className = 'vault-card__header';

    const stepTag = document.createElement('span');
    stepTag.className = 'vault-card__step-tag';
    stepTag.textContent = card.stepLabel;

    const title = document.createElement('span');
    title.className = 'vault-card__title';
    title.textContent = card.title;

    header.appendChild(stepTag);
    header.appendChild(title);
    el.appendChild(header);

    // Lines
    if (card.lines.length > 0) {
      const body = document.createElement('div');
      body.className = 'vault-card__body';
      for (const line of card.lines) {
        body.appendChild(this._buildLine(line));
      }
      el.appendChild(body);
    }

    // Status line
    if (card.statusLine) {
      const status = document.createElement('div');
      status.className = `vault-card__status ${card.statusLine.ok ? 'vault-card__status--ok' : 'vault-card__status--error'}`;
      const icon = card.statusLine.ok ? '✓' : '✗';
      status.textContent = `${icon} ${card.statusLine.text}`;
      el.appendChild(status);

      if (card.statusLine.note) {
        const note = document.createElement('div');
        note.className = 'vault-card__note';
        note.textContent = card.statusLine.note;
        el.appendChild(note);
      }
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
    const overlay = this.els.signalOverlay;
    // Clear previous content safely
    while (overlay.firstChild) {
      overlay.removeChild(overlay.firstChild);
    }

    // Centre signal block
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
    setTimeout(() => {
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

    const totalSec = Math.ceil(totalMs / 1000);
    const elapsed = Math.floor(elapsedMs / 1000);
    const remaining = Math.max(0, totalSec - elapsed);
    this.els.progressTime.textContent = `${remaining}s`;
  }

  // ── Complete ──────────────────────────────────────────────────────────────

  onComplete() {
    this.els.progressBar.style.width = '100%';
    this.els.progressTime.textContent = '0s';
  }

  // ── Reset ─────────────────────────────────────────────────────────────────

  reset() {
    this.activeBubbles.clear();

    // Clear containers safely
    const clearEl = (el: HTMLElement) => {
      while (el.firstChild) el.removeChild(el.firstChild);
    };
    clearEl(this.els.leftMessages);
    clearEl(this.els.rightMessages);
    clearEl(this.els.vaultEvents);
    clearEl(this.els.signalOverlay);

    this.els.signalOverlay.classList.remove('signal-overlay--visible');
    this.els.progressBar.style.width = '0%';
    this.els.progressTime.textContent = '';
    this.els.left.classList.remove('panel--dim', 'panel--error-flash');
    this.els.centre.classList.remove('panel--dim', 'panel--error-flash');
    this.els.right.classList.remove('panel--dim', 'panel--error-flash');
    this.onPhaseChange('pre-session');
  }
}
