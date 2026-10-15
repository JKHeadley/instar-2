import { expect, it } from 'vitest';
import { mkdtempSync, readFileSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createJournalWorker, openPreviewJournal, type PreviewPorts } from './journal-test-worker.js';
import { prepareJournalEnvelope } from './journal-envelope.js';
import { parseReplyRevision, replyRevisionQuestion } from './reply-check.js';

// Recorded answer/revision bytes, update 715676157, delivered message 7234. Metadata and
// review decisions below are synthetic protocol responses, not claimed as captured model output.
const fixture = JSON.parse(readFileSync(new URL('./fixtures/rule10-a5a-revision-2026-10-14.json', import.meta.url), 'utf8')) as {
  originalProposed: string; revisedDelivered: string };
const original = fixture.originalProposed, revised = fixture.revisedDelivered;
const key = new Uint8Array(32).fill(73), now = 1790000000000;
async function replay(text: string, metadata: { promises?: unknown; fulfills?: unknown }, crash = false, seed = false, rejectRevision = false) {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'revision-promises-')));
  const path = join(root, 'journal.encrypted'), sends: string[] = [];
  let revisions = 0;
  try {
    const journal = openPreviewJournal(path, key, { kind: 'genesis', bot: '12345678', chat: '7654321',
      operator: '7654321', grant: 'grant:preview', configurationDigest: 'sha256:offline', expires: 9999999999999,
      maxCalls: 20, maxReplies: 10, maxTurns: 10, maxBytes: 32768, cursor: 0 },
    crash ? stage => { if (stage === 'after:reply-revision') throw Error('crash'); } : undefined);
    const ports: PreviewPorts = { now: () => now, stopped: () => false,
      prepareModel: input => prepareJournalEnvelope(input, 'claude-sonnet-5', 'grant:preview', now),
      model: async () => JSON.stringify({ reply: original, promises: [{ quote: original }], memory: [] }),
      checkOutbound: () => {}, send: async input => { sends.push(input.expectedText); return 7234; },
      replyCheck: { elapsedMs: () => 0,
        jev: async () => ({ value: { model: 'jev-1.13.0', answers: Object.fromEntries([
          'raw_path', 'cli_command', 'config_key', 'credential', 'api_endpoint', 'quits_on_self',
          'claims_blocked', 'parks_on_user', 'defers_work', 'unrecorded_blocker',
        ].map(rule => [rule, { type: 'noul', noul: rule === 'defers_work' ? 0.9 : 0.01 }])) }, latencyMs: 0 }),
        escalate: async (_text, _id, _prompt, _rules, _deadline, operation) => operation === 'revision'
          ? rejectRevision ? { verdict: 'violation', ruleIds: ['credential'], confidence: null, latencyMs: 0 }
            : { verdict: 'pass', ruleIds: [], confidence: null, latencyMs: 0 }
          : { verdict: 'violation', ruleIds: ['defers_work'], confidence: null, latencyMs: 0,
            findings: [{ rule: 'defers_work', verdict: 'violation', reason: 'Answer the current request.' }] },
        revise: async () => { revisions++;
          return { state: 'complete', ...parseReplyRevision(JSON.stringify({ reply: text, ...metadata,
            dispositions: { defers_work: { decision: 'accept' } } }), ['defers_work']) }; } } };
    if (seed) {
      const { replyCheck: _review, ...initialPorts } = ports;
      const initial = createJournalWorker(journal, initialPorts);
      initial.intake([{ update_id: 715676156, message: { chat: { id: 7654321, type: 'private' },
        from: { id: 7654321 }, text: 'First request.' } }]);
      await initial.drain();
      expect(journal.view.commitments).toHaveLength(1);
    }
    const worker = createJournalWorker(journal, ports);
    worker.intake([{ update_id: 715676157, message: { chat: { id: 7654321, type: 'private' },
      from: { id: 7654321 }, text: 'Please answer the request.' } }]);
    if (crash) await expect(worker.drain()).rejects.toThrow('crash'); else await worker.drain();
    journal.close();
    const reopened = openPreviewJournal(path, key);
    try {
      const resumed = createJournalWorker(reopened, ports);
      await resumed.drain(); await resumed.drain();
      return { sends, revisions, commitments: reopened.view.commitments, closed: reopened.view.closed, turn: reopened.view.order.at(-1)! };
    } finally { reopened.close(); }
  } finally { rmSync(root, { recursive: true, force: true }); }
}

it.each([false, true])('records the delivered revision quote, including restart=%s', async crash => {
  const result = await replay(revised, { promises: [{ quote: revised }], fulfills: [] }, crash);
  expect(result.sends).toEqual([revised]);
  expect(result.revisions).toBe(1);
  expect(result.turn.release?.revised).toBe(true);
  expect(result.commitments).toMatchObject([{ quote: revised, in: 'reply',
    agentPromise: { owner: 'agent', waitsOn: 'next-relevant-reply' } }]);
  expect(result.turn.sent).toBe(7234);
});

it('keeps an unchanged promise and the legacy revision metadata shape', async () => {
  for (const metadata of [{ promises: [{ quote: original }] }, {}]) {
    const result = await replay(original, metadata);
    expect(result.sends).toEqual([original]);
    expect(result.commitments).toMatchObject([{ quote: original }]);
  }
});

it('does not invent a commitment from a revised non-promise, altered quote, or unsupported old quote', async () => {
  for (const [text, promises] of [
    [revised.slice(0, 3), []],
    [revised, [{ quote: original }]],
    [revised, [{ quote: revised + revised }]],
    [revised, []],
    [revised, null],
  ] as const) {
    const result = await replay(text, { promises });
    expect(result.sends).toEqual([text]);
    expect(result.commitments).toEqual([]);
  }
});

it('retains final-text metadata through both supported revision parser envelopes', () => {
  for (const reply of [revised, { answer: revised }]) {
    expect(parseReplyRevision(JSON.stringify({ reply, promises: [{ quote: revised }], fulfills: [{ id: 0, quote: revised }] }), []))
      .toMatchObject({ text: revised, promises: [{ quote: revised }], fulfills: [{ id: 0, quote: revised }] });
  }
  expect(replyRevisionQuestion(['defers_work'])).toContain('verbatim excerpts of the final reply');
});

it('fulfills only an existing supported promise with a verbatim final-revision quote', async () => {
  const valid = await replay(revised, { promises: [], fulfills: [{ id: 0, quote: revised }] }, true, true);
  expect(valid.sends).toEqual([original, revised]);
  expect(valid.closed.has(0)).toBe(true);
  expect(valid.commitments).toHaveLength(1);
  for (const fulfills of [[{ id: 99, quote: revised }], [{ id: 0, quote: original }]]) {
    const refused = await replay(revised, { promises: [], fulfills }, false, true);
    expect(refused.closed.has(0)).toBe(false);
    expect(refused.commitments).toHaveLength(1);
  }
});

it('does not adopt declarations from a rejected revision', async () => {
  const result = await replay(revised, { promises: [{ quote: revised }], fulfills: [] }, false, false, true);
  expect(result.sends).toHaveLength(1);
  expect(result.sends).not.toContain(original);
  expect(result.sends).not.toContain(revised);
  expect(result.turn.heldReview).toBeDefined();
  expect(result.commitments).toEqual([]);
});
