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

const TYPING_SPEED_MS = 30;   // ms per character
const TYPING_JITTER_MS = 10;  // ± jitter

interface ScheduledEvent {
  fireAtMs: number;
  event: ScenarioEvent;
  fired: boolean;
}

interface ActiveTyping {
  msg: ChatMessage;
  text: string;
  charIndex: number;
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
        break;

      case 'signal-flow':
        this.callbacks.onSignalFlow(ev.event.json);
        break;
    }
  }

  private _startTyping(msg: ChatMessage) {
    const key = `${msg.panel}-${msg.delayMs}`;
    const totalChars = msg.text.length;

    // Notify character 0 immediately so the bubble appears
    this.callbacks.onChatMessage(msg, 0, totalChars);

    let charIndex = 1;
    const tick = () => {
      if (this.state.phase !== 'playing') return;

      const typing = this.activeTypings.get(key);
      if (!typing) return;

      this.callbacks.onChatMessage(msg, charIndex, totalChars);
      charIndex++;

      if (charIndex >= totalChars) {
        clearInterval(typing.intervalId!);
        typing.intervalId = null;
        this.activeTypings.delete(key);
        this.callbacks.onChatMessageComplete(msg);
        return;
      }

      // Reschedule with jitter
      const jitter = Math.floor(Math.random() * TYPING_JITTER_MS * 2) - TYPING_JITTER_MS;
      typing.intervalId = setTimeout(tick, TYPING_SPEED_MS + jitter) as unknown as ReturnType<typeof setInterval>;
    };

    const typing: ActiveTyping = {
      msg,
      text: msg.text,
      charIndex: 1,
      intervalId: setTimeout(tick, TYPING_SPEED_MS) as unknown as ReturnType<typeof setInterval>,
    };
    this.activeTypings.set(key, typing);
  }
}
