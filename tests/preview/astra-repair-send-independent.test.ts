import { expect, it } from 'vitest';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createJournalWorker, openPreviewJournal, pendingReports, dueObligationWork } from './journal-test-worker.js';

const capture = JSON.parse(readFileSync(new URL('./fixtures/t1-verified-answer-20261027.json', import.meta.url), 'utf8'));
const split = capture.answer.indexOf('\n\nFollow-up on "');
const current = capture.answer.slice(0, split);
const tail = capture.answer.slice(split);
const subject = tail.slice('\n\nFollow-up on "'.length, tail.indexOf('\": '));
const stale = tail.slice(tail.indexOf('\": ') + 3);
const objection = 'These claims lack current installation evidence.';

it.each(['selected-unknown', 'rejection-unknown', 'rejection-before-intent'])(
  'T1 independent restart and send boundary: %s', async mode => {
    const root = mkdtempSync(join(tmpdir(), 'astra-t1-send-'));
    const path = join(root, 'journal');
    const key = new Uint8Array(32).fill(77);
    let now = 1793160000000, paused = false, sends = 0;
    let journal = openPreviewJournal(path, key, { kind: 'genesis', bot: '12345678', chat: '7654321', operator: '7654321',
      grant: 'offline', configurationDigest: 'sha256:offline', expires: 9999999999999,
      maxCalls: 100, maxReplies: 100, maxTurns: 100, maxBytes: 409600, cursor: 0, loopRevisitMs: 600000 });
    const report = mode === 'selected-unknown' ? 'The verified label is Home.' : stale;
    let answer = JSON.stringify({ reply: subject, openLoops: [{ kind: 'deferral', quote: subject, waitsOn: 'nothing' }] });
    const make = () => createJournalWorker(journal, { now: () => now, stopped: () => paused,
      prepareModel: input => input.context,
      model: async input => input.id.startsWith('obligation:') ? JSON.stringify({ outcome: 'report', report }) : answer,
      checkOutbound: () => {
        if (mode === 'rejection-before-intent' && journal.view.order.at(-1)?.answerRejectedReports) paused = true;
      },
      send: async input => {
        sends++;
        if (journal.view.order.length === 2 && input.target?.startsWith('reply:') && mode !== 'rejection-before-intent')
          return { kind: 'unknown' as const, reason: 'receipt lost after dispatch' };
        return sends;
      } });
    let worker = make();
    async function say(id: number, text: string) {
      worker.intake([{ update_id: id, message: { chat: { id: 7654321, type: 'private' }, from: { id: 7654321 }, text } }]);
      await worker.drain();
    }
    try {
      await say(1, subject);
      now += 601000;
      expect(await worker.workObligations()).toBe(true);
      answer = JSON.stringify({ reply: current, ...(mode === 'selected-unknown' ? { selectedReports: ['commitment:0'] }
        : { rejectedReports: [{ key: 'commitment:0', objection }] }) });
      if (mode === 'rejection-before-intent') await expect(say(2, capture.prompt)).rejects.toThrow('preview stopped');
      else await say(2, capture.prompt);
      const turn = journal.view.order.at(-1)!;
      if (mode === 'rejection-before-intent') {
        expect(turn.answerRejectedReports).toMatchObject([{ key: 'commitment:0', text: stale, objection }]);
        expect(turn.intent).toBeUndefined();
        expect(journal.view.obligationWork['commitment:0']?.withheld).toBeUndefined();
      }
      journal.close(); journal = openPreviewJournal(path, key);
      if (mode === 'selected-unknown') {
        expect(journal.view.obligationWork['commitment:0']?.report).toMatchObject({ text: report, boundTo: turn.id });
        expect(journal.view.obligationWork['commitment:0']?.report?.delivered).toBeUndefined();
        expect(pendingReports(journal.view)).toHaveLength(0);
        const before = sends;
        worker = make(); await worker.drain(); expect(sends).toBe(before);
        answer = JSON.stringify({ reply: 'The earlier delivery is uncertain.', rejectedReports: [{ key: 'commitment:0', objection }] });
        await say(3, 'Recheck the old result.');
        expect(journal.view.order.at(-1)?.answerRejectedReports).toBeUndefined();
        expect(journal.view.obligationWork['commitment:0']?.withheld).toBeUndefined();
        expect(journal.view.obligationWork['commitment:0']?.report?.delivered).toBeUndefined();
        now += 86400000;
        expect(dueObligationWork(journal.view, now)).toHaveLength(0);
      } else {
        paused = false;
        // Fresh worker after the crash boundary: the durable rejection supplies rework without another model decision.
        worker = createJournalWorker(journal, { now: () => now, stopped: () => false, prepareModel: input => input.context,
          model: async () => { throw Error('unexpected repeated answer'); }, checkOutbound: () => {}, send: async () => ++sends });
        await worker.drain();
        expect(journal.view.obligationWork['commitment:0']?.withheld).toMatchObject({ text: stale, objection });
        expect(journal.view.obligationWork['commitment:0']?.report).toBeUndefined();
        now += 86400000;
        expect(dueObligationWork(journal.view, now).map(item => item.key)).toContain('commitment:0');
      }
      console.log('ASTRA send boundary passed', mode);
    } finally { journal.close(); rmSync(root, { recursive: true, force: true }); }
  });
