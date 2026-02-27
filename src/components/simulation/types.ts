// Simulation type definitions

export type PanelId = 'left' | 'centre' | 'right';
export type MessageSender = 'user' | 'bot';
export type PhaseId = 'pre-session' | 'protocol' | 'post-session';

export interface ChatMessage {
  panel: 'left' | 'right';
  sender: MessageSender;
  name: string;
  text: string;
  /** delay in ms from start of phase */
  delayMs: number;
}

export interface ProtocolCard {
  id: string;
  /** Step number label, e.g. "Step 1" */
  stepLabel: string;
  title: string;
  /** Lines of monospace content */
  lines: ProtocolLine[];
  /** Optional status line shown at the bottom of the card */
  statusLine?: StatusLine;
  /** Sub-cards rendered inside this step */
  subCards?: ProtocolSubCard[];
  /** Whether this card uses a red flash error style */
  isError?: boolean;
  /** delay in ms from start of phase */
  delayMs: number;
}

export interface ProtocolSubCard {
  lines: ProtocolLine[];
  delayMs: number;
}

export type ProtocolLineKind =
  | 'key-value'
  | 'heading'
  | 'blank'
  | 'comment'
  | 'status-ok'
  | 'status-error'
  | 'bullet'
  | 'json';

export interface ProtocolLine {
  kind: ProtocolLineKind;
  text: string;
  /** Secondary text (for key-value pairs, the value part) */
  value?: string;
  /** Inline comment after value */
  comment?: string;
}

export interface StatusLine {
  ok: boolean;
  text: string;
  /** Optional dimmer note beneath the status */
  note?: string;
}

export interface SignalFlowEvent {
  /** delay in ms from start of phase */
  delayMs: number;
  json: string;
}

export type ScenarioEvent =
  | { type: 'chat'; event: ChatMessage }
  | { type: 'protocol-card'; event: ProtocolCard }
  | { type: 'signal-flow'; event: SignalFlowEvent }
  | { type: 'phase-transition'; event: PhaseTransition };

export interface PhaseTransition {
  phase: PhaseId;
  /** delay in ms from scenario start */
  delayMs: number;
}

export interface Scenario {
  id: string;
  title: string;
  /** Total estimated duration in ms */
  totalDurationMs: number;
  events: ScenarioEvent[];
}

export interface PlaybackState {
  phase: 'idle' | 'playing' | 'paused' | 'complete';
  currentPhase: PhaseId;
  elapsedMs: number;
  totalDurationMs: number;
}

export interface EngineCallbacks {
  onPhaseChange: (phase: PhaseId) => void;
  onChatMessage: (msg: ChatMessage, charIndex: number, totalChars: number) => void;
  onChatMessageComplete: (msg: ChatMessage) => void;
  onProtocolCard: (card: ProtocolCard) => void;
  onProtocolSubCard: (card: ProtocolCard, subCard: ProtocolSubCard) => void;
  onSignalFlow: (json: string) => void;
  onProgress: (elapsedMs: number, totalMs: number) => void;
  onComplete: () => void;
}
