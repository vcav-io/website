// Mediation Triage Scenario — pure structured data
// All chat text, protocol events, and timing live here.
// The engine and renderer are generic.

import type { Scenario, ScenarioEvent } from './types.ts';

// ─── Consistent fake hashes ────────────────────────────────────────────────
const H = {
  proposalId:        'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f07890',
  contractHash:      '9c8d7e6f5a4b3c2d1e0f9a8b7c6d5e4f3a2b1c0d9e8f7a6b5c4d3e2f1a009876',
  admitTokenId:      'f0e1d2c3b4a59687f8e9d0c1b2a394857065f4e3d2c1b0a9f8e7d6c5b4a31234',
  modelProfileHash:  'e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d42345',
  promptProgramHash: 'd4c3b2a1f0e9d8c7b6a5f4e3d2c1b0a9f8e7d6c5b4a3f2e1d0c9b8a7f6e57890',
  guardianPolicy:    'c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b27890',
  runtimeHash:       '4b3a2c1d0e9f8a7b6c5d4e3f2a1b0c9d8e7f6a5b4c3d2e1f0a9b8c7d6e5ef01',
  sessionId:         '7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6ef12',
  aliceEncInput:     'b4a3c2d1e0f9a8b7c6d5e4f3a2b1c0d9e8f7a6b5c4d3e2f1d0c9b8a7f6e59876',
  bobEncInput:       '8f7e6d5c4b3a2c1d0e9f8a7b6c5d4e3f2a1b0c9d8e7f6a5b4c3d2e1f0a94321',
  aliceIdentKey:     '3a8fc4e1',
  aliceIdentKeyFull: '3a8fc4e1b5d2a9f3c7e4b1d8a2f9c5e3b7d4a1f8c2e9b5d3a7f4c1e8b2d9a5f3c4e1',
  bobIdentKey:       '7d2ba9f3',
  bobIdentKeyFull:   '7d2ba9f3c5e1b8d4a2f7c3e9b5d1a8f4c2e7b3d9a5f1c8e4b2d6a3f9c5e2b17d9f3',
  receiptSig:        '8f9e0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c73c4d',
  alicePropSig:      'a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9',
};

// ─── Timing (ms) ────────────────────────────────────────────────────────────
// Phase 1: 0 – 36000 ms  (Alice chat ~9s + AliceBot ~4s + Bob chat ~7s + BobBot ~4s + gaps)
// Phase 2: 36000 – 66000 ms  (protocol steps)
// Phase 3: 66000 – 75000 ms  (post-session chat)

const T = {
  // Phase 1
  p1Start: 0,
  aliceTypingStart: 500,
  aliceBotStart: 12000,
  bobTypingStart: 18000,
  bobBotStart: 29000,

  // Phase 2 — centre panel activates
  p2Start: 36000,
  step1: 36500,
  step2: 40000,
  step3: 43000,
  step4: 46000,
  step5a: 49000,
  step5b: 51500,
  step5c: 53000,
  step5d: 54500,
  step5e: 58000,
  step6: 61000,
  step7: 64000,

  // Phase 3
  p3Start: 66000,
  alicePostStart: 66500,
  bobPostStart: 71000,
};

const TOTAL_DURATION_MS = 76000;

// ─── Helper ─────────────────────────────────────────────────────────────────
function kv(text: string, value: string, comment?: string) {
  return { kind: 'key-value' as const, text, value, comment };
}
function heading(text: string) {
  return { kind: 'heading' as const, text };
}
function blank() {
  return { kind: 'blank' as const, text: '' };
}
function comment(text: string) {
  return { kind: 'comment' as const, text };
}
function statusOk(text: string) {
  return { kind: 'status-ok' as const, text };
}
function statusErr(text: string) {
  return { kind: 'status-error' as const, text };
}
function bullet(text: string) {
  return { kind: 'bullet' as const, text };
}

// ─── Events ─────────────────────────────────────────────────────────────────
const events: ScenarioEvent[] = [

  // ── Phase 1: Pre-Session ──────────────────────────────────────────────────
  {
    type: 'phase-transition',
    event: { phase: 'pre-session', delayMs: T.p1Start },
  },

  // Alice types her message
  {
    type: 'chat',
    event: {
      panel: 'left',
      sender: 'user',
      name: 'Alice',
      text: "I need to resolve a contract dispute with my counterparty. My position: I completed the software deliverables on time, but the scope expanded significantly beyond the original agreement. I'm open to negotiating compensation for the additional work, but I don't want to disclose my minimum acceptable amount. Find out if there's room for alignment.",
      delayMs: T.aliceTypingStart,
    },
  },

  // AliceBot responds
  {
    type: 'chat',
    event: {
      panel: 'left',
      sender: 'bot',
      name: 'AliceBot',
      text: "Understood. I'll initiate a vault session under the mediation-triage contract. This will produce a bounded compatibility signal — not a resolution or recommendation. The vault will assess where your positions align and diverge. Your minimum acceptable amount won't be disclosed. Only the structured signal will be shared.",
      delayMs: T.aliceBotStart,
    },
  },

  // Bob types
  {
    type: 'chat',
    event: {
      panel: 'right',
      sender: 'user',
      name: 'Bob',
      text: "I've got a dispute with a contractor over scope and payment. My view: the original spec was clear, and some of what they're calling scope creep was actually correcting deficiencies. That said, I've already budgeted for a reasonable settlement — I don't want that figure disclosed. See if there's any basis for agreement.",
      delayMs: T.bobTypingStart,
    },
  },

  // BobBot responds
  {
    type: 'chat',
    event: {
      panel: 'right',
      sender: 'bot',
      name: 'BobBot',
      text: "Understood. I'll join the vault session under the same mediation-triage contract. The output will be a compatibility signal indicating alignment and divergence — no details of your budgeted settlement will be shared. Only the structured signal emerges from the vault.",
      delayMs: T.bobBotStart,
    },
  },

  // ── Phase 2: Protocol Flow ────────────────────────────────────────────────
  {
    type: 'phase-transition',
    event: { phase: 'protocol', delayMs: T.p2Start },
  },

  // Step 1 — Discovery
  {
    type: 'protocol-card',
    event: {
      id: 'step-1',
      stepLabel: 'Step 1',
      title: 'Discovery — Agent Descriptors',
      lines: [
        { kind: 'key-value', text: 'AliceBot', value: '', comment: 'BobBot' },
        kv('agent_id:', 'alicebot-prod-7', 'agent_id:  bobbot-prod-3'),
        kv('identity_key:', 'ed25519', 'identity_key: ed25519'),
        kv('', `  ${H.aliceIdentKey}...c4e1`, `  ${H.bobIdentKey}...a9f3`),
        kv('purpose:', 'MEDIATION', 'purpose:  MEDIATION'),
        kv('lane:', 'API_MEDIATED', 'lane:     API_MEDIATED'),
      ],
      statusLine: {
        ok: true,
        text: 'Signatures verified (VCAV-DESCRIPTOR-V1)',
      },
      delayMs: T.step1,
    },
  },

  // Step 2 — Proposal
  {
    type: 'protocol-card',
    event: {
      id: 'step-2',
      stepLabel: 'Step 2',
      title: 'Proposal',
      lines: [
        heading('PROPOSE'),
        blank(),
        kv('proposal_id:', `${H.proposalId.slice(0, 8)}...${H.proposalId.slice(-4)}`),
        kv('from:', 'alicebot-prod-7'),
        kv('to:', 'bobbot-prod-3'),
        kv('purpose_code:', 'MEDIATION'),
        kv('lane_id:', 'API_MEDIATED'),
        kv('model_profile:', 'mediation-triage-v1'),
        kv('  hash:', `${H.modelProfileHash.slice(0, 8)}...${H.modelProfileHash.slice(-4)}`),
        kv('output_schema:', 'mediation_compat_signal_v1'),
        kv('contract ref:', `${H.contractHash.slice(0, 8)}...${H.contractHash.slice(-4)}`),
      ],
      statusLine: {
        ok: true,
        text: `→ Proposal sent   sig: ${H.alicePropSig.slice(0, 8)}...${H.alicePropSig.slice(-4)}`,
      },
      delayMs: T.step2,
    },
  },

  // Step 3 — Admission
  {
    type: 'protocol-card',
    event: {
      id: 'step-3',
      stepLabel: 'Step 3',
      title: 'Admission',
      lines: [
        heading('ADMIT'),
        blank(),
        kv('proposal_id:', `${H.proposalId.slice(0, 8)}...${H.proposalId.slice(-4)}`, '← echoed'),
        kv('outcome:', 'ADMIT'),
        kv('contract_hash:', `${H.contractHash.slice(0, 8)}...${H.contractHash.slice(-4)}`, '← same contract'),
        kv('admit_token_id:', `${H.admitTokenId.slice(0, 8)}...${H.admitTokenId.slice(-4)}`, '← one-time token'),
        kv('model_profile:', `${H.modelProfileHash.slice(0, 8)}...${H.modelProfileHash.slice(-4)}`, '← confirmed'),
        kv('lane_id:', 'API_MEDIATED'),
      ],
      statusLine: {
        ok: true,
        text: 'Admission granted',
        note: 'DENY would be constant-shape — no reason field',
      },
      delayMs: T.step3,
    },
  },

  // Step 4 — Commitment
  {
    type: 'protocol-card',
    event: {
      id: 'step-4',
      stepLabel: 'Step 4',
      title: 'Commitment',
      lines: [
        heading('COMMIT (AliceBot)'),
        kv('admit_token:', `${H.admitTokenId.slice(0, 8)}...${H.admitTokenId.slice(-4)}`),
        kv('encrypted_input:', `${H.aliceEncInput.slice(0, 8)}...${H.aliceEncInput.slice(-4)}`),
        comment('← encrypted with XChaCha20-Poly1305'),
        comment('← AAD binds to contract hash'),
        blank(),
        heading('COMMIT (BobBot)'),
        kv('admit_token:', `${H.admitTokenId.slice(0, 8)}...${H.admitTokenId.slice(-4)}`),
        kv('encrypted_input:', `${H.bobEncInput.slice(0, 8)}...${H.bobEncInput.slice(-4)}`),
      ],
      statusLine: {
        ok: true,
        text: 'Both inputs committed',
      },
      delayMs: T.step4,
    },
  },

  // Step 5a — Model profile verification
  {
    type: 'protocol-card',
    event: {
      id: 'step-5a',
      stepLabel: 'Step 5',
      title: 'Relay Execution',
      lines: [
        bullet('Verifying model profile...'),
        kv('  profile:', 'mediation-triage-v1'),
        kv('  hash:', `${H.modelProfileHash.slice(0, 8)}...${H.modelProfileHash.slice(-4)}`, '✓ matches consent'),
        kv('  runtime:', `${H.runtimeHash.slice(0, 8)}...${H.runtimeHash.slice(-4)}`, '(relay build SHA)'),
      ],
      delayMs: T.step5a,
    },
  },

  // Step 5b — Prompt assembly
  {
    type: 'protocol-card',
    event: {
      id: 'step-5b',
      stepLabel: 'Step 5',
      title: 'Relay Execution',
      lines: [
        bullet('Assembling prompt...'),
        kv('  PromptProgram:', `${H.promptProgramHash.slice(0, 8)}...${H.promptProgramHash.slice(-4)}`),
        statusOk('  template hash verified'),
      ],
      delayMs: T.step5b,
    },
  },

  // Step 5c — LLM call
  {
    type: 'protocol-card',
    event: {
      id: 'step-5c',
      stepLabel: 'Step 5',
      title: 'Relay Execution',
      lines: [
        bullet('Calling LLM...'),
        kv('  provider:', 'anthropic'),
        kv('  model:', 'claude-sonnet-4-6'),
      ],
      delayMs: T.step5c,
    },
  },

  // Step 5d — OUTPUT REJECTED
  {
    type: 'protocol-card',
    event: {
      id: 'step-5d',
      stepLabel: 'Step 5',
      title: 'OUTPUT REJECTED — schema violation',
      isError: true,
      lines: [
        heading('LLM returned:'),
        { kind: 'json', text: '"Based on the positions provided, there appears to be' },
        { kind: 'json', text: ' partial alignment on timeline expectations. I recommend' },
        { kind: 'json', text: ' both parties consider a mediated discussion about..."' },
        blank(),
        statusErr('Expected: structured JSON signal'),
        statusErr('Received: natural language recommendation'),
        blank(),
        comment('Illustrative: demonstrates mechanical schema enforcement'),
      ],
      delayMs: T.step5d,
    },
  },

  // Step 5e — Re-run and guardian rules
  {
    type: 'protocol-card',
    event: {
      id: 'step-5e',
      stepLabel: 'Step 5',
      title: 'Relay Execution',
      lines: [
        bullet('Re-running...'),
        statusOk('Schema validation: ✓ PASS'),
        blank(),
        bullet('Guardian rules:'),
        kv('  GATE    digit_currency', '→ checking string values...'),
        statusOk('  GATE    digit_currency  → ✓ no digits or currency symbols'),
        kv('  ADVISORY entropy_log', '→ 18 bits (within budget)'),
      ],
      statusLine: {
        ok: true,
        text: 'Relay execution complete',
      },
      delayMs: T.step5e,
    },
  },

  // Step 6 — Receipt
  {
    type: 'protocol-card',
    event: {
      id: 'step-6',
      stepLabel: 'Step 6',
      title: 'Receipt',
      lines: [
        heading('RECEIPT'),
        blank(),
        kv('session_id:', `${H.sessionId.slice(0, 8)}...${H.sessionId.slice(-4)}`),
        kv('contract_hash:', `${H.contractHash.slice(0, 8)}...${H.contractHash.slice(-4)}`),
        kv('guardian_policy:', `${H.guardianPolicy.slice(0, 8)}...${H.guardianPolicy.slice(-4)}`),
        kv('prompt_template:', `${H.promptProgramHash.slice(0, 8)}...${H.promptProgramHash.slice(-4)}`),
        kv('model_identity:', 'anthropic / claude-sonnet-4-6'),
        kv('model_profile_hash:', `${H.modelProfileHash.slice(0, 8)}...${H.modelProfileHash.slice(-4)}`),
        kv('runtime_hash:', `${H.runtimeHash.slice(0, 8)}...${H.runtimeHash.slice(-4)}`),
        kv('participants:', '[alicebot-prod-7, bobbot-prod-3]'),
        kv('execution_lane:', 'API_MEDIATED'),
        kv('output_entropy:', '18 bits'),
        kv('status:', 'COMPLETED'),
        blank(),
        kv('Ed25519 signature:', `${H.receiptSig.slice(0, 8)}...${H.receiptSig.slice(-4)}`, '(VCAV-RECEIPT-V1)'),
      ],
      delayMs: T.step6,
    },
  },

  // Step 7 — Signal flow
  {
    type: 'signal-flow',
    event: {
      delayMs: T.step7,
      json: JSON.stringify({
        compatibility_signal: 'PARTIAL_ALIGNMENT',
        friction_band: 'HIGH',
        aligned_dimensions: ['timeline', 'scope'],
        divergent_dimensions: ['liability', 'compensation'],
        escalation_required: true,
      }, null, 2),
    },
  },

  // ── Phase 3: Post-Session ─────────────────────────────────────────────────
  {
    type: 'phase-transition',
    event: { phase: 'post-session', delayMs: T.p3Start },
  },

  // AliceBot post-session
  {
    type: 'chat',
    event: {
      panel: 'left',
      sender: 'bot',
      name: 'AliceBot',
      text: "The vault session is complete. Here's what the compatibility signal shows: your positions on timeline and scope are aligned — both sides agree on the project completion window and the work that was delivered. However, there's significant divergence on liability and compensation. The signal indicates escalation is needed. I'd recommend engaging a human mediator specifically for the liability and compensation points.",
      delayMs: T.alicePostStart,
    },
  },

  // BobBot post-session
  {
    type: 'chat',
    event: {
      panel: 'right',
      sender: 'bot',
      name: 'BobBot',
      text: "Session complete. The compatibility signal indicates partial alignment. You and the contractor agree on timeline and scope — the project timeline and deliverables aren't in dispute. The divergence is on liability and compensation, which is where your positions differ most. The signal recommends escalation. A human mediator focused on those two specific issues would be the logical next step.",
      delayMs: T.bobPostStart,
    },
  },
];

export const mediationTriageScenario: Scenario = {
  id: 'mediation-triage',
  title: 'Mediation Triage',
  totalDurationMs: TOTAL_DURATION_MS,
  events,
};
