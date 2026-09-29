import { expect, it } from 'vitest';
import { mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createJournalWorker, openPreviewJournal, retrospectiveCases } from './journal.js';
import { RETRO_FAILURE_BACKOFF_MS, RETRO_MIN_INTERVAL_MS, disciplineSource, eligibleCases } from './retrospective.js';

// Real-model-shaped fixtures for the retrospective review under the frozen18 conversation framing, whose
// system prompt asks for a plain-text conclusion and offers reason.value as the only JSON slot. Offline stubs
// always return the review JSON; these pin what happens when the real model does not.
const key = new Uint8Array(32).fill(23);
const start = Date.UTC(2026, 8, 26, 17);
const genesis = { kind: 'genesis' as const, bot: '12345678', chat: '7654321', operator: '7654321',
  grant: 'grant:preview', configurationDigest: 'sha256:offline', expires: Date.UTC(2027, 0, 1),
  maxCalls: 80, maxReplies: 80, maxTurns: 80, maxBytes: 32768, cursor: 0 };
const update = (id: number, text: string, at = start) => ({ update_id: id,
  message: { chat: { id: 7654321, type: 'private' }, from: { id: 7654321 }, date: Math.floor(at / 1000) + id, text } });

function world(model: () => unknown, review: () => string) {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'retro-live-')));
  const journal = openPreviewJournal(join(root, 'journal.encrypted'), key, genesis);
  let now = start, next = 1;
  const worker = createJournalWorker(journal, { now: () => now, stopped: () => false, timeZone: 'America/Los_Angeles',
    sources: () => [disciplineSource(journal.view)],
    model: async (input: { id: string }) => input.id.startsWith('summary:')
      ? JSON.stringify({ summary: 'The operator chatted.', people: [], memory: [], commitments: [], questions: [] })
      : model() as string,
    send: async () => 7, checkOutbound: () => {},
    retrospect: async () => ({ state: 'complete' as const, value: review(),
      usage: { inputTokens: 100, outputTokens: 50, charge: null, inputComplete: true as const } }) });
  return { journal, worker, advance: (ms: number) => { now += ms; }, at: () => now,
    converse: async (texts: string[]) => { worker.intake(texts.map(text => update(next++, text, now))); await worker.drain(); },
    done: () => { try { journal.close(); } catch { /* closed */ } rmSync(root, { recursive: true, force: true }); } };
}
const tenMessages = Array.from({ length: 10 }, (_, index) => `question ${String(index + 1)}`);

it('fails a plain-text review answer honestly, keeps every case owed, and waits the failure backoff before retrying', async () => {
  const w = world(() => 'Noted.', () => 'I reviewed the recent conversation and found nothing that needs changing.');
  try {
    await w.converse(tenMessages);
    const owedBefore = eligibleCases(w.journal.view, retrospectiveCases(w.journal.view), w.at()).map(item => item.id);
    await w.worker.retrospect('sha256:config-a');
    const pass = w.journal.view.retroPasses.at(-1)!;
    expect(pass.state).toBe('failed');
    expect(pass.reason).toBe('answer was not JSON');
    expect(pass.result).toBeUndefined();
    const owedAfter = eligibleCases(w.journal.view, retrospectiveCases(w.journal.view), w.at()).map(item => item.id);
    expect(owedAfter).toEqual(expect.arrayContaining(owedBefore));
    // Not retried at the ordinary interval, only after the failure backoff.
    w.advance(RETRO_MIN_INTERVAL_MS);
    await w.worker.retrospect('sha256:config-a');
    expect(w.journal.view.retroPasses).toHaveLength(1);
    w.advance(RETRO_FAILURE_BACKOFF_MS);
    await w.worker.retrospect('sha256:config-a');
    expect(w.journal.view.retroPasses).toHaveLength(2);
  } finally { w.done(); }
});

it('keeps a reason slot that carries declaration JSON verbatim as the stated reason, and it reaches the review unparsed', async () => {
  // The frozen18 live shape: a plain-text conclusion and the declarations in reason.value, which the runner stringifies.
  const declared = JSON.stringify({ basis: 'steeping guidance', memory: [{ quote: 'green tea for three minutes', mode: 'remember' }] });
  const w = world(() => ({ state: 'complete', text: 'About three minutes at 80 °C.', reason: declared,
    usage: { inputTokens: 1, outputTokens: 1, charge: null } }), () => 'not reviewed');
  try {
    await w.converse(['How long should I steep green tea?']);
    const turn = w.journal.view.order[0]!;
    expect(turn.answer).toBe('About three minutes at 80 °C.');
    expect(turn.answerReason).toBe(declared);
    // The declaration inside the reason is not read as memory (the frozen18 gap is unchanged here).
    expect(w.journal.view.memory).toHaveLength(0);
    const decision = retrospectiveCases(w.journal.view).find(item => item.id === `answer:${turn.id}`)!;
    expect(decision.reason).toBe(declared);
  } finally { w.done(); }
});
