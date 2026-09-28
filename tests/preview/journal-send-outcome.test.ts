// Rules 42 and 89: a live send consumes the journal's signed intent and settles as exactly
// one of accepted, refused or unknown; infrastructure notices never speak as the agent.
import { expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createJournalWorker, openPreviewJournal, sendOutcomeCounts, MODEL_FAILURE_REPLY } from './journal-test-worker.js';
import { outboundSigner, settleSendOutcome, type SendOutcome } from './outbound-provenance.js';
import { classifyTelegramSend } from './telegram-send-outcome.mjs';

const key = new Uint8Array(32).fill(7);
const genesis = { kind: 'genesis' as const, bot: '12345678', chat: '7654321', operator: '7654321', grant: 'grant:preview',
  configurationDigest: 'sha256:offline', expires: 9999999999999, maxCalls: 100, maxReplies: 100, maxTurns: 100,
  maxBytes: 262144, cursor: 0 };
const update = (id: number, text = `question ${id}`) => ({ update_id: id,
  message: { chat: { id: 7654321, type: 'private' }, from: { id: 7654321 }, text } });
const root = () => realpathSync(mkdtempSync(join(tmpdir(), 'preview-send-outcome-')));

function world(dir: string, send: (input: { target?: string; provenance?: unknown }) => number | null | SendOutcome) {
  const journal = openPreviewJournal(join(dir, 'journal.encrypted'), key, genesis);
  const seen: { target?: string; provenance?: unknown }[] = [], contexts: string[] = [];
  const worker = createJournalWorker(journal, { now: () => 1000, stopped: () => false,
    model: async (input: { context: string }) => { contexts.push(input.context); return 'an answer'; }, checkOutbound: () => {},
    send: async input => { seen.push(input); return send(input); } });
  return { journal, worker, seen, contexts };
}
/** The real launcher's read-only operator views over the same root. */
const launcher = (dir: string, command: 'status' | 'inspect') => {
  const run = spawnSync(process.execPath, ['--no-warnings', '--loader', './scripts/slice-ts-loader.mjs', 'tests/preview/journal-agent.mjs',
    command, '--root', dir], { cwd: process.cwd(), encoding: 'utf8', timeout: 30000,
    env: { ...process.env, INSTAR_SECRET_PREVIEW_STORAGE_KEY: Buffer.from(key).toString('hex') } });
  expect(run.status, run.stderr).toBe(0);
  return JSON.parse(run.stdout);
};

it('keeps a definite refusal distinct from UNKNOWN and from delivery, through the journal, replay and status', async () => {
  const dir = root();
  try {
    const first = world(dir, () => ({ kind: 'refused', reason: 'telegram 403: Forbidden: bot was blocked by the user' }));
    first.worker.intake([update(1)]); await first.worker.drain();
    const turn = first.journal.view.order[0]!;
    expect(turn.intent).toBeDefined();
    expect(turn.sent).toBeUndefined();
    expect(sendOutcomeCounts(first.journal.view)).toMatchObject({ accepted: 0, refused: 1, unknown: 0,
      lastRefusal: { target: `reply:${turn.id}`, outcome: 'refused' } });
    first.journal.close();
    // Replay keeps the refusal, and a refused intent is never redispatched.
    const second = world(dir, () => 9);
    await second.worker.drain();
    expect(second.seen).toHaveLength(0);
    expect(sendOutcomeCounts(second.journal.view)).toMatchObject({ refused: 1, unknown: 0 });
    second.journal.close();
    // Every operator view reads the same recorded refusal: inspect and status through the real launcher.
    expect(launcher(dir, 'inspect').reply).toMatchObject({ update: 1, outcome: 'send-refused', refusal: 'telegram 403: Forbidden: bot was blocked by the user' });
    expect(launcher(dir, 'status')).toMatchObject({ unknownSends: 0, sendOutcomes: { refused: 1, unknown: 0 } });
    // The neighbouring case: an unknown dispatch stays UNKNOWN, not refused.
    const unknown = world(dir, () => ({ kind: 'unknown', reason: 'transport timeout' }));
    unknown.worker.intake([update(2)]); await unknown.worker.drain();
    expect(sendOutcomeCounts(unknown.journal.view)).toMatchObject({ accepted: 0, refused: 1, unknown: 1 });
    expect(unknown.journal.view.sendOutcomes.map(item => item.outcome)).toEqual(['refused', 'unknown']);
    // The next turn's history labels the earlier answer as refused, never as delivery UNKNOWN.
    const history = JSON.parse(unknown.contexts.at(-1)!).history as { outcome?: string }[];
    expect(history[0]?.outcome).toBe('refused, not delivered (telegram 403: Forbidden: bot was blocked by the user)');
    unknown.journal.close();
    expect(launcher(dir, 'inspect').reply).toMatchObject({ update: 2, outcome: 'send-unknown' });
    expect(launcher(dir, 'inspect').reply.refusal).toBeUndefined();
    expect(launcher(dir, 'status')).toMatchObject({ unknownSends: 1, sendOutcomes: { refused: 1, unknown: 1 } });
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

it('signs every outbound intent automatically and the send consumes that exact signed subject', async () => {
  const dir = root();
  try {
    const w = world(dir, input => {
      const signer = outboundSigner(key, genesis.bot);
      const turn = w.journal.view.order[0]!;
      // The send port receives the durable intent's own signature over the exact bytes it sends.
      expect(signer.verify(input.provenance, { target: `reply:${turn.id}`, chat: genesis.chat, body: turn.intentBody! })).toBe(true);
      expect(signer.verify(input.provenance, { target: `reply:${turn.id}`, chat: genesis.chat, body: `${turn.intentBody!} altered` })).toBe(false);
      return 5;
    });
    w.worker.intake([update(1)]); await w.worker.drain();
    expect(w.journal.view.order[0]?.sent).toBe(5);
    expect(w.journal.view.speakers).toEqual({ agent: 1, infrastructure: 0 });
    // A forged provenance is refused at the durable write boundary.
    w.worker.intake([update(2)]);
    const other = outboundSigner(new Uint8Array(32).fill(9), genesis.bot);
    const forged = other.sign('agent', { target: 'reply:x', chat: genesis.chat, body: 'x' });
    expect(() => w.journal.append({ kind: 'intent', id: w.journal.view.order[1]!.id, text: 'x', body: 'x', chat: genesis.chat,
      update: 2, grant: genesis.grant, provenance: forged, at: 1000 })).toThrow('outbound provenance refused');
    w.journal.close();
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

it('labels a runner notice as infrastructure speech, never as the agent', async () => {
  const dir = root();
  try {
    const journal = openPreviewJournal(join(dir, 'journal.encrypted'), key, genesis);
    const worker = createJournalWorker(journal, { now: () => 1000, stopped: () => false, checkOutbound: () => {},
      model: async () => ({ state: 'rejected' as const, failureClass: 'rejected' as const }), send: async () => 3 });
    worker.intake([update(1)]); await worker.drain();
    expect(journal.view.order[0]?.intent).toBe(`PREVIEW — ${MODEL_FAILURE_REPLY}`);
    expect(journal.view.speakers).toEqual({ agent: 0, infrastructure: 1 });
    journal.close();
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

it('classifies Telegram replies: 4xx ok:false refuses, transport or 5xx is unknown, only an exact receipt is accepted', () => {
  const expected = { chat: '7', expectedText: 'hi' };
  const body = (value: unknown) => JSON.stringify(value);
  expect(classifyTelegramSend({ kind: 'response', status: 400, bytes: body({ ok: false, description: 'Bad Request: chat not found' }) }, expected))
    .toEqual({ kind: 'refused', reason: 'telegram 400: Bad Request: chat not found' });
  expect(classifyTelegramSend({ kind: 'response', status: 502, bytes: 'gateway' }, expected)).toMatchObject({ kind: 'unknown' });
  expect(classifyTelegramSend({ kind: 'uncertain', limitation: 'timeout' }, expected)).toEqual({ kind: 'unknown', reason: 'transport timeout' });
  expect(classifyTelegramSend({ kind: 'response', status: 200, bytes: body({ ok: true, result: { message_id: 4, chat: { id: 7 }, text: 'hi' } }) }, expected))
    .toEqual({ kind: 'accepted', message: 4 });
  expect(classifyTelegramSend({ kind: 'response', status: 200, bytes: body({ ok: true, result: { message_id: 4, chat: { id: 8 }, text: 'hi' } }) }, expected))
    .toMatchObject({ kind: 'unknown' });
  expect(settleSendOutcome(null)).toEqual({ kind: 'unknown', reason: 'no receipt' });
  expect(settleSendOutcome(7)).toEqual({ kind: 'accepted', message: 7 });
});
