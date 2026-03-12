import type { Scenario, ScenarioEvent } from './types.ts';

const H = {
  unboundedReferenceId: 'free-text-reference-thread',
  boundedInviteId: '6d145cb0a2d94fd88ec7c9dd5b8db5a7',
  boundedContractHash: 'b3f8701f4c2c79c1b7b60c393d8f52ac8f58c6bc590c90bfca20ed3c676fd9e1',
  boundedPolicyHash: '1945a8f655a4389326f2ddf8d33c21f4294cf07b4b8f39b6f1c53a5a47d3be13',
  boundedSchemaHash: 'df90f721c98eb09a5a835638de2dbff6f5f6b2ce31e5bc366628548f6998a7be',
  boundedReceiptId: 'receipt-ref-71a0a54c',
};

function kv(text: string, value: string, comment?: string) {
  return { kind: 'key-value' as const, text, value, comment };
}

function heading(text: string) {
  return { kind: 'heading' as const, text };
}

function blank() {
  return { kind: 'blank' as const, text: '' };
}

function bullet(text: string) {
  return { kind: 'bullet' as const, text };
}

const unboundedEvents: ScenarioEvent[] = [
  { type: 'phase-transition', event: { phase: 'pre-session', delayMs: 0 } },
  {
    type: 'chat',
    event: {
      panel: 'left',
      sender: 'user',
      name: 'Maya',
      text: 'I am considering Priya for an operations role. Please ask her former manager for a candid reference. I need the hiring signal, not every private detail.',
      delayMs: 500,
    },
  },
  {
    type: 'chat',
    event: {
      panel: 'left',
      sender: 'bot',
      name: 'MayaBot',
      text: 'I will ask directly for context and judgment.',
      delayMs: 3200,
    },
  },
  {
    type: 'chat',
    event: {
      panel: 'right',
      sender: 'user',
      name: 'Elias',
      text: 'Give a fair reference, but do not get into Priya’s stress leave or the accommodation dispute unless it is absolutely necessary.',
      delayMs: 6200,
    },
  },
  {
    type: 'chat',
    event: {
      panel: 'right',
      sender: 'bot',
      name: 'EliasBot',
      text: 'Understood. I will explain the context so they have the full picture.',
      delayMs: 9300,
    },
  },
  { type: 'phase-transition', event: { phase: 'protocol', delayMs: 11600 } },
  {
    type: 'protocol-card',
    event: {
      id: 'free-step-1',
      stepLabel: 'Mode A',
      title: 'Direct Agent Handoff',
      lines: [
        heading('FREE-TEXT EXCHANGE'),
        blank(),
        kv('reference_thread:', H.unboundedReferenceId),
        bullet('No contract agreed before context crosses'),
        bullet('Open-ended prompt asks for a candid explanation'),
        bullet('No schema limits what the reply can carry'),
      ],
      statusLine: {
        ok: true,
        text: 'Conversation opened',
      },
      delayMs: 12200,
    },
  },
  {
    type: 'protocol-card',
    event: {
      id: 'free-step-2',
      stepLabel: 'Mode A',
      title: 'Open-Ended Reference Reply',
      lines: [
        heading('REPLY CONTENT'),
        blank(),
        bullet('Performance signal mixed with private explanation'),
        bullet('Sensitive facts become part of the hiring exchange'),
        bullet('Requester learns far more than the intended hiring signal'),
      ],
      statusLine: {
        ok: false,
        text: 'No bounded disclosure rule applied',
      },
      isError: true,
      delayMs: 15000,
    },
  },
  {
    type: 'signal-flow',
    event: {
      delayMs: 17200,
      json: `{\n  "reference_reply": "Priya was strong, but after a stress-related leave she struggled for a quarter and became entangled in an accommodations dispute with one teammate. I would rehire her, but I probably should not be putting all of this in writing."\n}`,
    },
  },
  { type: 'phase-transition', event: { phase: 'post-session', delayMs: 19400 } },
  {
    type: 'chat',
    event: {
      panel: 'left',
      sender: 'bot',
      name: 'MayaBot',
      text: 'I got the candid answer. Priya was strong, but there was a stress-related leave and a dispute around accommodations.',
      delayMs: 19900,
    },
  },
  {
    type: 'chat',
    event: {
      panel: 'right',
      sender: 'bot',
      name: 'EliasBot',
      text: 'I shared more of the private story than the request really required.',
      delayMs: 22000,
    },
  },
];

const boundedEvents: ScenarioEvent[] = [
  { type: 'phase-transition', event: { phase: 'pre-session', delayMs: 0 } },
  {
    type: 'chat',
    event: {
      panel: 'left',
      sender: 'user',
      name: 'Maya',
      text: 'I am considering Priya for an operations role. Please get me the hiring signal, not the private story.',
      delayMs: 500,
    },
  },
  {
    type: 'chat',
    event: {
      panel: 'left',
      sender: 'bot',
      name: 'MayaBot',
      text: 'I will open a bounded reference check so only the agreed signal can cross.',
      delayMs: 3200,
    },
  },
  {
    type: 'chat',
    event: {
      panel: 'right',
      sender: 'user',
      name: 'Elias',
      text: 'Participate, but keep the private context inside the session. I only want to return the agreed reference signal.',
      delayMs: 6200,
    },
  },
  {
    type: 'chat',
    event: {
      panel: 'right',
      sender: 'bot',
      name: 'EliasBot',
      text: 'Understood. I will answer under a bounded contract.',
      delayMs: 9200,
    },
  },
  { type: 'phase-transition', event: { phase: 'protocol', delayMs: 11600 } },
  {
    type: 'protocol-card',
    event: {
      id: 'bounded-step-1',
      stepLabel: 'Step 1',
      title: 'Contract Parameters',
      cardClass: 'vault-card--contract',
      lines: [
        heading('REFERENCE CHECK CONTRACT'),
        blank(),
        kv('purpose_code:', 'REFERENCE_CHECK'),
        kv('output_schema:', 'employment_reference_signal_v1'),
        kv('schema_hash:', `${H.boundedSchemaHash.slice(0, 8)}...${H.boundedSchemaHash.slice(-4)}`),
        kv('policy_hash:', `${H.boundedPolicyHash.slice(0, 8)}...${H.boundedPolicyHash.slice(-4)}`),
        kv('contract_hash:', `${H.boundedContractHash.slice(0, 8)}...${H.boundedContractHash.slice(-4)}`),
      ],
      statusLine: {
        ok: true,
        text: 'Both agents bound the same output terms',
      },
      delayMs: 12300,
    },
  },
  {
    type: 'protocol-card',
    event: {
      id: 'bounded-step-2',
      stepLabel: 'Step 2',
      title: 'Relay Enforcement',
      cardClass: 'vault-card--policy',
      lines: [
        heading('BOUNDED CHANNEL'),
        blank(),
        bullet('Output must match the agreed reference schema'),
        bullet('No free-text explanation field is allowed to leave the session'),
        bullet('Only the bounded hiring signal can cross the boundary'),
      ],
      statusLine: {
        ok: true,
        text: 'Schema and policy admitted',
      },
      delayMs: 14700,
    },
  },
  {
    type: 'protocol-card',
    event: {
      id: 'bounded-step-3',
      stepLabel: 'Step 3',
      title: 'Receipt Issued',
      lines: [
        heading('RECEIPT'),
        blank(),
        kv('receipt_id:', H.boundedReceiptId),
        kv('contract_hash:', `${H.boundedContractHash.slice(0, 8)}...${H.boundedContractHash.slice(-4)}`),
        kv('schema_hash:', `${H.boundedSchemaHash.slice(0, 8)}...${H.boundedSchemaHash.slice(-4)}`),
        kv('policy_hash:', `${H.boundedPolicyHash.slice(0, 8)}...${H.boundedPolicyHash.slice(-4)}`),
      ],
      statusLine: {
        ok: true,
        text: 'Bounded execution proved after the fact',
      },
      delayMs: 17300,
    },
  },
  {
    type: 'signal-flow',
    event: {
      delayMs: 19600,
      json: `{\n  "performance_signal": "STRONG",\n  "rehire_signal": "YES",\n  "integrity_flag": "CLEAR",\n  "confidence_bucket": "HIGH"\n}`,
    },
  },
  { type: 'phase-transition', event: { phase: 'post-session', delayMs: 21600 } },
  {
    type: 'chat',
    event: {
      panel: 'left',
      sender: 'bot',
      name: 'MayaBot',
      text: 'The bounded result is strong performance, rehirable, with no integrity concern. The private story did not cross.',
      delayMs: 22100,
    },
  },
  {
    type: 'chat',
    event: {
      panel: 'right',
      sender: 'bot',
      name: 'EliasBot',
      text: 'I answered the hiring question without turning a private management history into gossip.',
      delayMs: 24300,
    },
  },
];

export const unboundedEmploymentReferenceScenario: Scenario = {
  id: 'employment-reference-unbounded',
  title: 'Employment reference — unbounded',
  totalDurationMs: 24500,
  events: unboundedEvents,
};

export const boundedEmploymentReferenceScenario: Scenario = {
  id: 'employment-reference-bounded',
  title: 'Employment reference — bounded',
  totalDurationMs: 26800,
  events: boundedEvents,
};
