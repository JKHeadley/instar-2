/** Plan 636, Rule 29: B-proofroom-20261006-174539's due turn 715674580.0009766
 * was delivered after a format re-ask with no writer in its final packet. Replay the
 * two recorded requested-action:0 outputs through the real reader and worker. */
import { expect, it } from 'vitest';
import { mkdtempSync, readFileSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createJournalWorker, openPreviewJournal, type CallOutcome } from './journal-test-worker.js';
import { prepareJournalEnvelope } from './journal-envelope.js';
import { readAnswer } from './answer-reading.js';

const fixture = JSON.parse(readFileSync(new URL('./fixtures/x5-malformed-live-2026-10-06.json', import.meta.url), 'utf8')) as {
  cases: { root: string; id: string; attempt: number; output: string }[] };
const outputs = fixture.cases.filter(row => row.root === 'proofroom1-q-20261006-174418' && row.id === 'requested-action:0')
  .sort((a, b) => a.attempt - b.attempt).map(row => row.output);
const lost = JSON.parse(readFileSync(new URL('./fixtures/lostanswer-live-2026-10-02.json', import.meta.url), 'utf8')) as {
  lostFirstCall: { callOutcomes: (CallOutcome & { id: string; role: string; at: number })[] } };
const key = new Uint8Array(32).fill(36);
const start = Date.UTC(2026, 9, 6, 17);
const question = 'Remind me today at 10:01 am to take a short walk';

for (const principal of ['operator', 'scheduler'] as const) for (const recovery of ['declaration', 'format', 'timeout'] as const) {
  it(`${principal} writer survives ${recovery} and journal reopen`, async () => {
    expect(outputs).toHaveLength(2);
    expect(readAnswer(outputs[0]!)).toMatchObject({ ok: false });
    expect(readAnswer(outputs[1]!)).toMatchObject({ ok: true });
    const root = realpathSync(mkdtempSync(join(tmpdir(), 'retry-writer-'))), path = join(root, 'journal.encrypted');
    const journal = openPreviewJournal(path, key, { kind: 'genesis', bot: '12345678', chat: '7654321', operator: '7654321',
      grant: 'grant:preview', configurationDigest: 'sha256:offline', expires: start + 86400000,
      maxCalls: 10, maxReplies: 5, maxTurns: 5, maxBytes: 131072, cursor: 0 });
    let now = start, calls = 0, sends = 0;
    const writers: unknown[] = [];
    const worker = createJournalWorker(journal, { now: () => now, stopped: () => false, timeZone: 'America/Los_Angeles',
      toolRoute: () => calls === 0,
      prepareModel: input => {
        const prepared = prepareJournalEnvelope(input, 'claude-sonnet-5', 'grant:preview', now, 262144);
        if (principal === 'operator' || input.id.startsWith('requested-action:')) {
          const envelope = JSON.parse(prepared) as { messages: { role: string; content: string }[] };
          writers.push((JSON.parse(envelope.messages.find(row => row.role === 'context')!.content) as { bindings: { writer?: unknown } }).bindings.writer);
        }
        return prepared;
      },
      model: async input => {
        if (principal === 'scheduler' && !input.id.startsWith('requested-action:')) return JSON.stringify({ reply: 'Okay.',
          memory: [], dated: [{ quote: question, when: 'today at 10:01 am', remind: true }] });
        calls++;
        if (recovery === 'timeout' && calls === 1) {
          const { id: _id, role: _role, at: _at, ...outcome } = lost.lostFirstCall.callOutcomes[0]!;
          journal.append({ kind: 'call-outcome', id: input.id, role: 'model', outcome, at: now });
          return { state: 'uncertain' as const };
        }
        const reading = readAnswer(outputs[recovery === 'format' && calls === 1 ? 0 : 1]!);
        return reading.ok ? { state: 'complete' as const, text: reading.value, usage: { inputTokens: null, outputTokens: null, charge: null } }
          : { state: 'complete' as const, failureClass: 'malformed' as const, defect: reading.defect };
      }, checkOutbound: () => {}, send: async () => ++sends });
    try {
      worker.intake([{ update_id: 1, message: { chat: { id: 7654321, type: 'private' }, from: { id: 7654321 },
        text: question, date: start / 1000 } }]);
      await worker.drain();
      if (principal === 'scheduler') { now += 60000; await worker.sendRequested(); }
      const expected = principal === 'operator' ? { id: '7654321', kind: 'person', adapter: 'telegram-bot-api' }
        : { id: 'preview-scheduler:12345678', kind: 'system', adapter: 'preview-scheduler' };
      // The recorded parseable output fulfills promise 0, absent in this replay's packet.
      // It gets one declaration re-ask unless the malformed-format retry already used it.
      expect(calls).toBe(recovery === 'timeout' ? 3 : 2);
      // Due packets have no tool capability reroute; the timeout reuses the original envelope.
      expect(writers).toHaveLength(principal === 'scheduler' && recovery === 'timeout' ? calls - 1 : calls);
      for (const writer of writers) expect(writer).toEqual(expected);
      const turn = journal.view.order.at(-1)!;
      expect(turn.answerRetried).toBe(true);
      expect(journal.view.closed.has(0)).toBe(false);
      expect(turn.answerReplaced === true).toBe(recovery === 'timeout');
      expect(sends).toBe(principal === 'operator' ? 1 : 2);
      journal.close();
      const reopened = openPreviewJournal(path, key);
      try {
        const envelope = JSON.parse(reopened.view.order.at(-1)!.prompt!) as { messages: { role: string; content: string }[] };
        expect(JSON.parse(envelope.messages.find(row => row.role === 'context')!.content).bindings.writer).toEqual(expected);
        let repeats = 0;
        const resumed = createJournalWorker(reopened, { now: () => now, stopped: () => false,
          model: async () => { repeats++; throw Error('already settled'); }, send: async () => { repeats++; return 9; }, checkOutbound: () => {} });
        await resumed.drain(); await resumed.sendRequested();
        expect(repeats).toBe(0);
      } finally { reopened.close(); }
    } finally { journal.close(); rmSync(root, { recursive: true, force: true }); }
  });
}
