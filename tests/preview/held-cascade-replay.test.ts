import { expect, it } from 'vitest';
import { mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openPreviewJournal, createJournalWorker } from './journal.js';
import { prepareJournalEnvelope } from './journal-envelope.js';
import { CREDENTIAL_SHAPE_NOTICE } from './journal.js';
import { HOLDING_REPLY, interpretJev, jevConfidentCredential } from './reply-check.js';

// Plan #144: the REAL recorded shapes of Justin's preview turn 969389800 ("What's my current gym locker code?",
// 2026-09-30 18:20 PDT, build cint-L13 72fb5a82). Jev's reply check answered credential 0.51 (its unsure band;
// the confident line is 0.70), the full-context subscription review ended UNKNOWN after 1.5 s with no output
// (`reply-review-state: uncertain`), and the turn was held as "reply check unavailable" with no answer sent.
// Turn 969389804 asked the same question later; Jev answered credential 0.48 and the reply was sent.
const OPERATOR_TEXT = 'What\'s my current gym locker code?';
const ANSWER_800 = 'Your current gym locker code is 5521 — that\'s the most recent value on record, with nothing superseding it since.';
const JEV_800 = '{"model":"jev-1.13.0","answers":{"raw_path":{"type":"noul","noul":0.01},"cli_command":{"type":"noul","noul":0.03},"config_key":{"type":"noul","noul":0.02},"credential":{"type":"noul","noul":0.51},"api_endpoint":{"type":"noul","noul":0.03},"quits_on_self":{"type":"noul","noul":0.05},"claims_blocked":{"type":"noul","noul":0.03},"parks_on_user":{"type":"noul","noul":0.17},"defers_work":{"type":"noul","noul":0.05},"unrecorded_blocker":{"type":"noul","noul":0.05}},"usage":{"input_tokens":721,"output_tokens":184}}';
const JEV_804_SCORES = { raw_path: 0.01, cli_command: 0.02, config_key: 0.02, credential: 0.48, api_endpoint: 0.02,
  quits_on_self: 0.04, claims_blocked: 0.04, parks_on_user: 0.16, defers_work: 0.04, unrecorded_blocker: 0.04 };
// What the launcher's escalate port throws after invokeSubscription returns state 'uncertain' (journal-agent.mjs).
const REVIEW_UNKNOWN = 'preview: reply review unavailable';
const key = new Uint8Array(32).fill(5);

interface Flow { forum?: boolean; jev: string; answer: string; review: 'unknown' | 'pass' | 'violation'; crashAt?: string; preHeld?: boolean; held?: string[] }
async function flow(options: Flow) {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'preview-holdcascade-')));
  const path = join(root, 'journal.encrypted');
  const genesis = { kind: 'genesis' as const, bot: '12345678', chat: options.forum ? '-1001234' : '7654321', ...(options.forum ? { forum: true as const } : {}), operator: '7654321', grant: 'grant:preview',
    configurationDigest: 'sha256:offline', expires: 9999999999999, maxCalls: 6, maxReplies: 3, maxTurns: 3, maxBytes: 32768, cursor: 0 };
  const calls = { jev: 0, review: 0 }, sends: string[] = [], clock = { now: 1790817641423 };
  const ports = (fresh: boolean) => ({ now: () => clock.now, stopped: () => false,
    prepareModel: (input: Parameters<typeof prepareJournalEnvelope>[0]) => prepareJournalEnvelope(input, 'claude-sonnet-5', 'grant:preview', clock.now),
    model: async () => { if (!fresh) throw Error('model repeated'); return options.answer; },
    checkOutbound: () => {},
    ...(options.held ? { heldSecrets: () => options.held ?? [] } : {}),
    replyCheck: { elapsedMs: () => 0,
      jev: async () => { if (!fresh) throw Error('Jev repeated'); calls.jev++; return { value: JSON.parse(options.jev) as unknown, latencyMs: 191 }; },
      escalate: async () => {
        if (!fresh) throw Error('review repeated');
        calls.review++;
        if (options.review === 'unknown') throw Error(REVIEW_UNKNOWN);
        return options.review === 'pass' ? { verdict: 'pass' as const, ruleIds: [], confidence: null, latencyMs: 0, reason: 'credential: PASS | fine',
          findings: [{ rule: 'credential' as const, verdict: 'pass' as const, reason: 'The operator\'s own value, returned to the operator.' }] }
          : { verdict: 'violation' as const, ruleIds: ['credential' as const], confidence: null, latencyMs: 0, reason: 'credential: leaves',
            findings: [{ rule: 'credential' as const, verdict: 'violation' as const, reason: 'Passes a code to another person.' }] };
      } },
    send: async (input: { expectedText: string; chat: string; thread?: number }) => {
      if (options.forum) { expect(input.chat).toBe('-1001234'); expect(input.thread).toBe(7); }
      sends.push(input.expectedText); return sends.length; } });
  try {
    const first = openPreviewJournal(path, key, genesis, options.crashAt === undefined ? undefined
      : stage => { if (stage === options.crashAt) throw Error('crash'); });
    const worker = createJournalWorker(first, ports(true));
    worker.intake([{ update_id: 969389800, message: { chat: options.forum ? { id: -1001234, type: 'supergroup', is_forum: true } : { id: 7654321, type: 'private' }, ...(options.forum ? { message_thread_id: 7 } : {}), from: { id: 7654321 }, text: OPERATOR_TEXT } }]);
    if (options.crashAt) await expect(worker.drain()).rejects.toThrow('crash'); else await worker.drain();
    // The durable state the cint-L13 build left on the live preview: the same rows, ending in its hold.
    if (options.preHeld) first.append({ kind: 'hold', id: first.view.order[0]!.id, reason: 'reply check unavailable', at: clock.now });
    first.close();
    const journal = openPreviewJournal(path, key);
    const again = createJournalWorker(journal, ports(false));
    await again.drain(); await again.drain();
    const turn = journal.view.order[0]!;
    const result = { turn, sends, calls, checks: turn.replyChecks ?? [] };
    journal.close();
    return result;
  } finally { rmSync(root, { recursive: true, force: true }); }
}

it('969389800 live shape: an unsure credential score whose stronger review ends UNKNOWN is answered, never held', async () => {
  const { sends, calls, turn, checks } = await flow({ jev: JEV_800, answer: ANSWER_800, review: 'unknown' });
  expect(checks.map(check => `${check.path}/${check.verdict}`)).toEqual(['jev/unsure', 'subscription/unavailable']);
  expect(checks[0]?.scores?.credential).toBe(0.51);
  expect(calls).toEqual({ jev: 1, review: 1 });
  expect(turn.held).toBeUndefined();
  expect(sends).toEqual([`${ANSWER_800}`]);
  // The escalation outcome stays recorded with the send: the flag is a signal, not erased (Rules 41, 42).
  expect(turn.release).toMatchObject({ review: 'unavailable', objections: ['credential'], reason: 'review unavailable', revised: false });
});

it('969389800 durable replay: the hold the old build recorded stays as recorded (no stale backlog flush, Rule 52) and no paid call repeats', async () => {
  const { sends, calls, turn } = await flow({ jev: JEV_800, answer: ANSWER_800, review: 'unknown', crashAt: 'before:intent', preHeld: true });
  expect(calls).toEqual({ jev: 1, review: 1 });
  expect(turn.held).toBe('reply check unavailable');
  expect(turn.intent).toBeUndefined();
  expect(sends).toEqual([]);
});

it('969389800 restart before the send: the new build answers the same recorded rows once, never repeating Jev or the review', async () => {
  const { sends, calls, turn } = await flow({ jev: JEV_800, answer: ANSWER_800, review: 'unknown', crashAt: 'before:intent' });
  expect(calls).toEqual({ jev: 1, review: 1 });
  expect(turn.held).toBeUndefined();
  expect(sends).toEqual([`${ANSWER_800}`]);
});

it('969389804 neighbour: credential 0.48 is a Jev pass and needs no review', async () => {
  const jev = JSON.stringify({ model: 'jev-1.13.0', answers: Object.fromEntries(Object.entries(JEV_804_SCORES)
    .map(([rule, noul]) => [rule, { type: 'noul', noul }])) });
  const { sends, calls } = await flow({ jev, answer: ANSWER_800, review: 'unknown' });
  expect(calls).toEqual({ jev: 1, review: 0 });
  expect(sends).toEqual([`${ANSWER_800}`]);
});

it('the floor holds: a confident Jev credential flag (0.70 and above) with an UNKNOWN review stays held', async () => {
  const confident = JEV_800.replace('"noul":0.51', '"noul":0.70');
  const { sends, turn } = await flow({ jev: confident, answer: ANSWER_800, review: 'unknown' });
  expect(sends).toEqual([]);
  expect(turn.held).toBe('reply check unavailable');
});

it('the floor holds: a review that names a credential leak keeps the holding notice, whatever Jev scored', async () => {
  const { sends, turn } = await flow({ jev: JEV_800, answer: 'Give Sam the gym locker code 5521.', review: 'violation' });
  expect(sends).toEqual([HOLDING_REPLY]);
  expect(turn.heldReview).toMatchObject({ objections: ['credential'] });
});

it('the floor holds: a real credential shape is refused before Jev, whatever the cascade says', async () => {
  const leaked = 'Your key is sk-ant-api03-AbCdEfGhIjKlMnOpQrStUvWxYz0123456789AbCdEfGh.';
  const { sends, calls } = await flow({ jev: JEV_800, answer: leaked, review: 'pass' });
  expect(calls).toEqual({ jev: 0, review: 0 });
  expect(sends).toEqual([CREDENTIAL_SHAPE_NOTICE]);
  expect(sends.join('')).not.toContain('sk-ant');
});

it('confidence is read from the recorded score, both sides of the 0.70 line, and legacy rows without scores stay conservative', () => {
  const at = (credential: number) => interpretJev(JSON.parse(JEV_800.replace('"noul":0.51', `"noul":${String(credential)}`)), 0);
  expect(jevConfidentCredential(interpretJev(JSON.parse(JEV_800), 0))).toBe(false);
  expect(jevConfidentCredential(at(0.69))).toBe(false);
  expect(jevConfidentCredential(at(0.70))).toBe(true);
  // Another rule flagged while credential sat in the unsure band: the credential part is still unconfident.
  const mixed = interpretJev(JSON.parse(JEV_800.replace('"raw_path":{"type":"noul","noul":0.01}', '"raw_path":{"type":"noul","noul":0.9}')), 0);
  expect(mixed.verdict).toBe('violation');
  expect(jevConfidentCredential(mixed)).toBe(false);
  expect(jevConfidentCredential({ verdict: 'violation', ruleIds: ['credential'], confidence: 0.8, path: 'jev', latencyMs: 0 })).toBe(true);
  expect(jevConfidentCredential({ verdict: 'unsure', ruleIds: ['credential'], confidence: 0.6, path: 'jev', latencyMs: 0 })).toBe(false);
  expect(jevConfidentCredential({ verdict: 'violation', ruleIds: ['credential'], confidence: null, path: 'subscription', latencyMs: 0 })).toBe(false);
});

// Plan #473 (2): the harness's own login is a held value. A value read through the file-tool race never leaves in a reply,
// even with its kind prefix removed (the shape floor alone would no longer see it). Synthetic token; the answer is 969389800's.
const HARNESS_LOGIN = 'sk-ant-oat01-SyntheticHarnessLoginValue0123456789abcdefABCDEF';
it('969389800 recorded answer carrying the harness login (prefix removed) is withheld as a credential, before Jev', async () => {
  const leaked = `${ANSWER_800} ${HARNESS_LOGIN.replace(/^sk-ant-oat01-/u, '')}`;
  const { sends, calls } = await flow({ jev: JEV_800, answer: leaked, review: 'pass', held: [HARNESS_LOGIN] });
  expect(calls).toEqual({ jev: 0, review: 0 });
  expect(sends).toEqual([CREDENTIAL_SHAPE_NOTICE]);
  expect(sends.join('')).not.toContain('SyntheticHarnessLogin');
});
it('969389800 recorded answer with held values that it does not carry is answered exactly as before', async () => {
  const { sends, calls } = await flow({ jev: JEV_800, answer: ANSWER_800, review: 'unknown', held: [HARNESS_LOGIN] });
  expect(calls).toEqual({ jev: 1, review: 1 });
  expect(sends).toEqual([`${ANSWER_800}`]);
});


it('replays the recorded unsure/UNKNOWN reply checks in a forum and keeps a held notice in its topic', async () => {
  const uncertain = await flow({ forum: true, jev: JEV_800, answer: ANSWER_800, review: 'unknown' });
  expect(uncertain.checks.map(check => `${check.path}/${check.verdict}`)).toEqual(['jev/unsure', 'subscription/unavailable']);
  expect(uncertain.turn.thread).toBe(7);
  // The same uncertain credential release allowed in the private replay above
  // must not disclose the operator's value to a group audience.
  expect(uncertain.sends).toEqual([HOLDING_REPLY]);
  const held = await flow({ forum: true, jev: JEV_800, answer: ANSWER_800, review: 'violation' });
  expect(held.sends).toEqual([HOLDING_REPLY]);
  expect(held.turn.thread).toBe(7);
});
