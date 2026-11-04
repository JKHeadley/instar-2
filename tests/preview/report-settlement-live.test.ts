import { expect, it } from 'vitest';
import { mkdtempSync, readFileSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createJournalWorker, openPreviewJournal, pendingReports, type JournalRecord } from './journal-test-worker.js';
import { prepareJournalEnvelope } from './journal-envelope.js';
import { readAnswer } from './answer-reading.js';

const captured = JSON.parse(readFileSync(new URL('./fixtures/report-settlement-46040806-2026-11-04.json', import.meta.url), 'utf8')) as {
  request: string; commitment: { in: 'message'; source: string; quote: string; owner: 'agent'; waitsOn: 'nothing' };
  acknowledgement: { text: string; loops: { kind: 'judgment'; quote: string; waitsOn: 'nothing' }[] };
  reports: string[]; completion: { id: string; work: string; state: 'complete'; evidence: string }[];
  answers: string[]; deliveredReply: string; repairReplay: { output: string };
};
const keys = ['commitment:1', 'commitment:2'];
const decode = (raw: string) => {
  const result = readAnswer(raw, { wrapped: 'accept', evidence: ['telegram:8993213212:update:46040806'] });
  if (!result.ok) throw Error('captured answer unreadable');
  return result.value;
};

async function replay(mode: 'selected' | 'omitted' | 'old-retry' | 'one-selected' | 'unknown' | 'trimmed' | 'verbatim' | 'revision', verbatimRevision = false, revisionKeepsResult = false) {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'report-settlement-'))), path = join(root, 'journal');
  const key = new Uint8Array(32).fill(47);
  let now = 1793779584482, later = false, attempts = 0;
  let journal = openPreviewJournal(path, key, { kind: 'genesis', bot: '8993213212', chat: '7812716706', operator: '7812716706',
    grant: 'offline', configurationDigest: 'sha256:offline', expires: 9999999999999,
    maxCalls: 100, maxReplies: 100, maxTurns: 100, maxBytes: 409600, cursor: 0, loopRevisitMs: 900000 });
  const revisedText = revisionKeepsResult ? `The priorities are below.\n\n${captured.reports[0]}` : 'The priorities are below.';
  const sent: string[] = [], retryPackets: string[] = [];
  const worker = createJournalWorker(journal, { now: () => now, stopped: () => false,
    prepareModel: input => mode === 'revision' ? prepareJournalEnvelope(input, 'claude-opus-5-5', 'offline', now) : input.context,
    model: async input => {
      if (!later) return JSON.stringify({ reply: mode === 'revision' ? captured.commitment.quote : captured.acknowledgement.text,
        memory: [], dated: [], openLoops: mode === 'revision' ? [{ kind: 'judgment', quote: captured.commitment.quote, waitsOn: 'nothing' }] : captured.acknowledgement.loops });
      if (input.id.startsWith('summary:')) return JSON.stringify({ summary: 'The planning result remains owed.', people: [], commitments: [], closed: [] });
      attempts++;
      if (mode === 'old-retry') return decode(captured.answers[Math.min(attempts - 1, 1)]!);
      if (mode === 'omitted') return JSON.stringify({ reply: 'Hi! What can I help you with?', memory: [], dated: [], selectedReports: [] });
      if (attempts === 1) return decode(captured.answers[0]!);
      retryPackets.push(input.context);
      if (mode === 'selected' || mode === 'unknown' || mode === 'trimmed') return decode(captured.repairReplay.output);
      return JSON.stringify({ reply: mode === 'verbatim' || verbatimRevision ? captured.reports[0] : 'Here is the planning answer.',
        memory: [], dated: [], selectedReports: mode === 'one-selected' ? [keys[0]] : keys, fulfilled: [] });
    },
    ...(mode === 'revision' ? { replyCheck: {
      elapsedMs: () => 0,
      jev: async () => ({ latencyMs: 1, value: { model: 'jev-1.13.0', answers: { raw_path: { type: 'noul', noul: later ? 0.9 : 0.01 } } } }),
      escalate: async (_text, _id, _prompt, _rules, _deadline, operation) => ({
        verdict: operation === 'revision' ? 'pass' as const : 'violation' as const,
        ruleIds: operation === 'revision' ? [] : ['raw_path' as const], confidence: null, latencyMs: 1 }),
      revise: async () => ({ state: 'complete' as const, text: revisedText,
        dispositions: [{ objection: 'raw_path', decision: 'accept' as const, reason: 'Revised the introduction.' }] }),
    } } : {}),
    ...(mode === 'trimmed' ? { replyCheck: {
      elapsedMs: () => 0,
      jev: async () => ({ latencyMs: 1, value: { model: 'jev-1.13.0', answers: { defers_work: { type: 'noul', noul: 0.95 } } } }),
      escalate: async () => ({ verdict: 'violation' as const, ruleIds: ['defers_work' as const], confidence: null, latencyMs: 1,
        reason: `The unrecorded deferral is "I'll keep doing that for any lists we make for the week."`, findings: [{ rule: 'defers_work' as const, verdict: 'violation' as const,
          reason: `The unrecorded deferral is "I'll keep doing that for any lists we make for the week."`, quote: captured.reports[0]! }] }),
    } } : {}),
    checkOutbound: () => {}, send: async input => {
      sent.push(input.expectedText);
      if (later && mode === 'unknown') throw Error('transport outcome unknown');
      return sent.length;
    } });
  try {
    worker.intake([{ update_id: 46040805, message: { chat: { id: 7812716706, type: 'private' }, from: { id: 7812716706 }, text: captured.request } }]);
    const source = journal.view.order[0]!.id;
    // Captured request commitment before its reply loop; unrelated id 0 is a synthetic waiting placeholder.
    journal.append({ kind: 'summary-reserve', through: 46040805, maxInputTokens: 32000, maxOutputTokens: 2048, at: now });
    journal.append({ kind: 'summary', through: 46040805, state: 'complete', text: 'A deferred planning answer is owed.',
      commitments: [{ in: 'message', source, quote: 'Please do not answer this one now.', owner: 'agent', waitsOn: 'operator' },
        { ...captured.commitment, source }], faithfulness: { path: 'exact', verdict: 'pass', score: null }, at: now });
    await worker.drain();
    expect(journal.view.commitments).toHaveLength(3);
    expect(journal.view.commitments.slice(1).every(item => item.agentPromise === undefined)).toBe(true);
    now += 900001;
    for (const [index, obligation] of keys.entries()) {
      const slot = 1793779584482 + 900000;
      journal.append({ kind: 'obligation-start', obligation, slot, maxInputTokens: 32000, maxOutputTokens: 2048, at: now } as JournalRecord);
      journal.append({ kind: 'obligation-result', obligation, slot, outcome: 'report', report: captured.reports[index],
        completion: captured.completion, at: now } as JournalRecord);
    }
    expect(pendingReports(journal.view)).toHaveLength(2);
    later = true; sent.length = 0;
    worker.intake([{ update_id: 46040806, message: { chat: { id: 7812716706, type: 'private' }, from: { id: 7812716706 }, text: 'hi' } }]);
    await worker.drain();
    await worker.drain(); // No second dispatch after success or unknown.
    const turn = journal.view.order.at(-1)!;
    const result = { sent, attempts, retryPackets, turn, waiting: pendingReports(journal.view).map(r => r.key),
      closed: [...journal.view.closed.keys()], work: structuredClone(journal.view.obligationWork) };
    journal.close(); journal = openPreviewJournal(path, key, undefined, undefined, true);
    expect(journal.view.obligationWork).toEqual(result.work);
    expect([...journal.view.closed.keys()]).toEqual(result.closed);
    return result;
  } finally { journal.close(); rmSync(root, { recursive: true, force: true }); }
}

it('replays both captured proposals: neither reply loop nor request is an agent promise', async () => {
  const result = await replay('old-retry');
  expect(result.turn.answerRejected).toEqual({ fulfills: 1 });
  expect(result.turn.intent).toBe(captured.deliveredReply);
  expect(result.turn.answerReports).toBeUndefined();
  expect(result.waiting).toEqual(keys);
});

it.each(['selected', 'verbatim'] as const)('binds two explicitly selected reports to one exact result and one receipt (%s)', async mode => {
  const result = await replay(mode);
  expect(result.attempts).toBe(2);
  expect(result.sent).toHaveLength(1);
  expect(result.turn.intent!.split(captured.reports[0]!).length - 1).toBe(1);
  expect(result.retryPackets[0]).toContain('identical report text is included only once');
  expect(result.turn.answerReports).toEqual(keys);
  expect(result.waiting).toEqual([]);
  expect(result.closed).toEqual([1, 2]);
  for (const key of keys) expect(result.work[key]!.report).toMatchObject({ boundTo: result.turn.id, delivered: result.turn.id });
});

it('a greeting without the result leaves both results waiting', async () => {
  const result = await replay('omitted');
  expect(result.sent).toHaveLength(1);
  expect(result.waiting).toEqual(keys);
  expect(result.closed).toEqual([]);
});

it('identical bytes never select the other obligation implicitly', async () => {
  const result = await replay('one-selected');
  expect(result.closed).toEqual([1]);
  expect(result.waiting).toEqual([keys[1]]);
});

it('an unknown receipt binds both reports without closing or sending either again', async () => {
  const result = await replay('unknown');
  expect(result.sent.filter(text => text.includes(captured.reports[0]!))).toHaveLength(1);
  expect(result.closed).toEqual([]);
  for (const key of keys) {
    expect(result.work[key]!.report!.boundTo).toBe(result.turn.id);
    expect(result.work[key]!.report!.delivered).toBeUndefined();
  }
});

it('review removal of the exact result cannot settle either report', async () => {
  const result = await replay('trimmed');
  expect(result.closed).toEqual([]);
  for (const key of keys) expect(result.work[key]!.report?.delivered).toBeUndefined();
});

// Synthetic neighbor: two different declarations can have the same displayed subject as well as result.
it.each([[false, false], [true, false], [false, true], [true, true]])('a revision carries an identical result once while settling both selected identities (verbatim draft: %s, revision: %s)', async (verbatim, keepsResult) => {
  const result = await replay('revision', verbatim, keepsResult);
  expect(result.turn.revision?.text).toBe(keepsResult ? `The priorities are below.\n\n${captured.reports[0]}` : 'The priorities are below.');
  expect(result.sent).toHaveLength(1);
  expect(result.turn.answerReports).toEqual(keys);
  expect(result.waiting).toEqual([]);
  expect(result.turn.intent!.split(captured.reports[0]!).length - 1).toBe(1);
  expect(result.closed).toEqual([1, 2]);
  for (const key of keys) expect(result.work[key]!.report).toMatchObject({ boundTo: result.turn.id, delivered: result.turn.id });
});
