// Simulation engine — generic playback state machine
// Handles timing, play/pause/reset. Has no DOM knowledge.

import type {
  Scenario,
  ScenarioEvent,
  PlaybackState,
  PhaseId,
  EngineCallbacks,
  ChatMessage,
  ProtocolCard,
} from './types.ts';

const WORD_SPEED_MS = 80;    // ms per word
const WORD_JITTER_MS = 20;   // ± jitter

interface ScheduledEvent {
  fireAtMs: number;
  event: ScenarioEvent;
  fired: boolean;
}

interface ActiveTyping {
  msg: ChatMessage;
  text: string;
  charIndex: number;
  wordEnds: number[];
  wordIndex: number;
  intervalId: ReturnType<typeof setInterval> | null;
}

export class SimulationEngine {
  private scenario: Scenario;
  private callbacks: EngineCallbacks;

  private state: PlaybackState;
  private startTimeMs: number | null = null;
  private pausedAtMs: number = 0;
  private rafId: number | null = null;
  private scheduled: ScheduledEvent[] = [];
  private activeTypings: Map<string, ActiveTyping> = new Map();
  private microPauseStartMs: number | null = null;
  private microPauseDurationMs: number = 800;

  constructor(scenario: Scenario, callbacks: EngineCallbacks) {
    this.scenario = scenario;
    this.callbacks = callbacks;
    this.state = {
      phase: 'idle',
      currentPhase: 'pre-session',
      elapsedMs: 0,
      totalDurationMs: scenario.totalDurationMs,
    };
    this._buildSchedule();
  }

  private _buildSchedule() {
    this.scheduled = this.scenario.events.map((ev) => {
      let fireAt = 0;
      if (ev.type === 'phase-transition') fireAt = ev.event.delayMs;
      else if (ev.type === 'chat') fireAt = ev.event.delayMs;
      else if (ev.type === 'protocol-card') fireAt = ev.event.delayMs;
      else if (ev.type === 'signal-flow') fireAt = ev.event.delayMs;
      return { fireAtMs: fireAt, event: ev, fired: false };
    });
    // Sort ascending
    this.scheduled.sort((a, b) => a.fireAtMs - b.fireAtMs);
  }

  getState(): PlaybackState {
    return { ...this.state };
  }

  play() {
    if (this.state.phase === 'complete') return;
    if (this.state.phase === 'playing') return;

    if (this.state.phase === 'idle') {
      this.startTimeMs = performance.now();
      this.pausedAtMs = 0;
    } else if (this.state.phase === 'paused') {
      // Resume: adjust startTime so elapsed continues from where we paused
      this.startTimeMs = performance.now() - this.pausedAtMs;
    }

    this.state.phase = 'playing';
    this._resumeTypings();
    this._tick();
  }

  pause() {
    if (this.state.phase !== 'playing') return;
    this.state.phase = 'paused';
    this.pausedAtMs = this._elapsed();
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    // Pause active typings
    this.activeTypings.forEach((typing) => {
      if (typing.intervalId) {
        clearInterval(typing.intervalId);
        typing.intervalId = null;
      }
    });
  }

  reset() {
    // Cancel everything
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    this.activeTypings.forEach((typing) => {
      if (typing.intervalId) clearInterval(typing.intervalId);
    });
    this.activeTypings.clear();

    this.startTimeMs = null;
    this.pausedAtMs = 0;
    this.microPauseStartMs = null;
    this.state = {
      phase: 'idle',
      currentPhase: 'pre-session',
      elapsedMs: 0,
      totalDurationMs: this.scenario.totalDurationMs,
    };
    this.scheduled.forEach((s) => (s.fired = false));
  }

  private _elapsed(): number {
    if (this.startTimeMs === null) return 0;
    return performance.now() - this.startTimeMs;
  }

  private _tick() {
    if (this.state.phase !== 'playing') return;

    // Micro-pause: freeze elapsed time during error display
    if (this.microPauseStartMs !== null) {
      const frozenMs = performance.now() - this.microPauseStartMs;
      if (frozenMs < this.microPauseDurationMs) {
        // Still paused — keep ticking but don't advance elapsed
        this.rafId = requestAnimationFrame(() => this._tick());
        return;
      }
      // Micro-pause over — adjust startTimeMs by actual frozen duration
      // (robust to throttling / background tabs)
      this.startTimeMs! += frozenMs;
      this.microPauseStartMs = null;
    }

    const elapsed = this._elapsed();
    this.state.elapsedMs = elapsed;

    // Fire due events
    for (const s of this.scheduled) {
      if (!s.fired && s.fireAtMs <= elapsed) {
        s.fired = true;
        this._fireEvent(s.event);
      }
    }

    // Report progress
    this.callbacks.onProgress(elapsed, this.scenario.totalDurationMs);

    // Check completion
    if (elapsed >= this.scenario.totalDurationMs) {
      this.state.phase = 'complete';
      this.callbacks.onComplete();
      return;
    }

    this.rafId = requestAnimationFrame(() => this._tick());
  }

  private _fireEvent(ev: ScenarioEvent) {
    switch (ev.type) {
      case 'phase-transition':
        this.state.currentPhase = ev.event.phase;
        this.callbacks.onPhaseChange(ev.event.phase);
        break;

      case 'chat':
        this._startTyping(ev.event);
        break;

      case 'protocol-card':
        this.callbacks.onProtocolCard(ev.event);
        if (ev.event.isError) {
          this.microPauseStartMs = performance.now();
        }
        break;

      case 'signal-flow':
        this.callbacks.onSignalFlow(ev.event.json);
        break;
    }
  }

  private _resumeTypings() {
    this.activeTypings.forEach((typing, key) => {
      if (typing.intervalId === null) {
        this._scheduleTypingTick(key, typing);
      }
    });
  }

  private _scheduleTypingTick(key: string, typing: ActiveTyping) {
    const totalChars = typing.text.length;
    const tick = () => {
      if (this.state.phase !== 'playing') return;
      const t = this.activeTypings.get(key);
      if (!t) return;

      // Jump to next word boundary
      t.charIndex = t.wordEnds[t.wordIndex++];
      this.callbacks.onChatMessage(t.msg, t.charIndex, totalChars);

      if (t.charIndex >= totalChars - 1) {
        t.intervalId = null;
        this.activeTypings.delete(key);
        this.callbacks.onChatMessageComplete(t.msg);
        return;
      }

      const jitter = Math.floor(Math.random() * WORD_JITTER_MS * 2) - WORD_JITTER_MS;
      t.intervalId = setTimeout(tick, WORD_SPEED_MS + jitter) as unknown as ReturnType<typeof setInterval>;
    };
    typing.intervalId = setTimeout(tick, WORD_SPEED_MS) as unknown as ReturnType<typeof setInterval>;
  }

  private _computeWordEnds(text: string): number[] {
    const ends: number[] = [];
    for (let i = 0; i < text.length; i++) {
      if (text[i] === ' ' || i === text.length - 1) {
        ends.push(i);
      }
    }
    return ends;
  }

  private _startTyping(msg: ChatMessage) {
    const key = `${msg.panel}-${msg.delayMs}`;
    const totalChars = msg.text.length;
    const wordEnds = this._computeWordEnds(msg.text);

    // Notify first word immediately so the bubble appears
    const firstEnd = wordEnds[0];
    this.callbacks.onChatMessage(msg, firstEnd, totalChars);

    if (wordEnds.length <= 1) {
      // Single-word message — complete immediately
      this.callbacks.onChatMessageComplete(msg);
      return;
    }

    const typing: ActiveTyping = {
      msg,
      text: msg.text,
      charIndex: firstEnd,
      wordEnds,
      wordIndex: 1,
      intervalId: null,
    };
    this.activeTypings.set(key, typing);
    this._scheduleTypingTick(key, typing);
  }
}
