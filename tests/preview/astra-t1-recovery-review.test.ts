import { expect, it } from 'vitest';
import { mkdtempSync, readFileSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createJournalWorker, openPreviewJournal, READY_RESULT, dueObligationWork } from './journal-test-worker.js';
import { loopHealth } from './obligations.js';

// Exact delivered T1 bytes, copied read-only from the desk's isolated baseline, update 46040732,
// message 2697, build 9e04f28e. Only the surrounding journal setup and subsequent selections are synthetic.
const capture = JSON.parse(readFileSync(new URL('./fixtures/t1-verified-answer-20261027.json', import.meta.url), 'utf8'));
const split = capture.answer.indexOf('\n\nFollow-up on "');
const current = capture.answer.slice(0, split) as string;
const tail = capture.answer.slice(split) as string;
const subject = tail.slice('\n\nFollow-up on "'.length, tail.indexOf('\": '));
const stale = tail.slice(tail.indexOf('\": ') + 3);
const key = new Uint8Array(32).fill(82);

it.each([undefined, [], ['commitment:99'], 'commitment:0', [0]].map(value => [value]))(
  'T1: an old report cannot append without a current, offered selection (%j)', async selectedReports => {
    await replay(selectedReports, false);
  });
it('a current selection delivers supported owed work once, with a receipt across reopen', async () => {
  await replay(['commitment:0'], true);
});

const shapes = JSON.parse(readFileSync(new URL('./fixtures/retrospective-duty-followup-train-1-2026-10-08.json', import.meta.url), 'utf8')).otherShapes as { kind: string; id: string; raw: string }[];
it.each(shapes)('recorded $kind $id does not authorize an old appendix', async shape => {
  await replay(undefined, false, shape.raw);
});

it('an omitted report cannot be selected and never prevents the current answer under byte pressure', async () => {
  await replay(['commitment:0'], false, undefined, true);
});

const objection = 'These capability claims have no current installation evidence.';
it('explicit rejection of the captured unsupported report corrects and delivers through owned work', async () => {
  await replay(undefined, false, undefined, false, [{ key: 'commitment:0', objection }]);
});
it.each([null, 'commitment:0', [{}], [{ key: 'commitment:99', objection }],
  [{ key: 'commitment:0', objection: '' }], [{ key: 'commitment:0', objection: 'x'.repeat(1001) }],
  [{ key: 'commitment:0', objection }, { key: 'commitment:0', objection }]].map(value => [value]))('malformed or unoffered rejection preserves the report: %j', async rejection => {
  await replay(undefined, false, undefined, false, rejection);
});
it('overflow is not an explicit rejection', async () => {
  await replay(undefined, false, undefined, true, [{ key: 'commitment:0', objection }]);
});
it('conflicting selection and rejection does not rework the report', async () => {
  await replay(['commitment:0'], false, undefined, false, [{ key: 'commitment:0', objection }]);
});

async function replay(selectedReports: unknown, supported: boolean, recordedRaw?: string, omitReports = false, rejectedReports?: unknown) {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 't1-verified-answer-')));
  const path = join(root, 'journal.encrypted');
  const clock = { now: 1793160000000 }, sent: string[] = [], packets: string[] = [];
  const journal = openPreviewJournal(path, key, { kind: 'genesis', bot: '12345678', chat: '7654321',
    operator: '7654321', grant: 'offline', configurationDigest: 'sha256:offline', expires: 9999999999999,
    maxCalls: 100, maxReplies: 100, maxTurns: 100, maxBytes: 409600, cursor: 0, loopRevisitMs: 600000 });
  const report = supported ? 'The requested label is Home.' : stale;
  let answer = JSON.stringify({ reply: subject, memory: [], openLoops: [{ kind: 'deferral', quote: subject, waitsOn: 'nothing' }] });
  const worker = createJournalWorker(journal, { now: () => clock.now, stopped: () => false,
    prepareModel: input => {
      if (omitReports && JSON.parse(input.context).pendingReports) throw Error('preview: complete prompt overflow');
      return input.context;
    },
    model: async input => {
      if (input.id.startsWith('obligation:')) return JSON.stringify({ outcome: 'report', report });
      packets.push(input.context); return answer;
    }, checkOutbound: () => {}, send: async input => { sent.push(input.expectedText); return sent.length; } });
  const say = async (update: number, text: string) => {
    worker.intake([{ update_id: update, message: { chat: { id: 7654321, type: 'private' }, from: { id: 7654321 },
      text, date: Math.floor(clock.now / 1000) } }]);
    await worker.drain();
  };
  try {
    await say(46040731, supported ? 'Find the label in my notes and tell me later.' : subject);
    clock.now += 601000;
    for (let n = 0; n < 10 && await worker.workObligations(); n++) { /* foreground bounded work */ }
    expect(loopHealth(journal.view, clock.now).awaitingDelivery).toBe(1);
    const reply = supported ? 'The notes identify Home as the label.' : current;
    answer = recordedRaw ?? JSON.stringify({ reply, memory: [], ...(selectedReports === undefined ? {} : { selectedReports }), ...(rejectedReports === undefined ? {} : { rejectedReports }) });
    const rejected = rejectedReports !== undefined && !omitReports && Array.isArray(rejectedReports)
      && rejectedReports.length === 1 && rejectedReports[0]?.key === 'commitment:0'
      && rejectedReports[0]?.objection === 'These capability claims have no current installation evidence.'
      && !Array.isArray(selectedReports);
    await say(capture.sourceUpdate, capture.prompt);
    const packet = packets.at(-1)!;
    if (omitReports) {
      expect(JSON.parse(packet).pendingReports).toBeUndefined();
      expect(JSON.parse(packet).pendingReportsOmitted).toBe(1);
    } else expect(packet).toContain(JSON.stringify(report).slice(1, -1));
    expect(packet).toContain(READY_RESULT);
    if (!omitReports) expect(packet).toContain('prior answer or follow-up is not proof');
    const turn = journal.view.order.at(-1)!;
    const expected = supported ? `${reply}\n\nFollow-up on "${subject}": ${report}` : current;
    if (recordedRaw === undefined) expect(turn.answer).toBe(expected);
    else expect(sent.slice(1).join()).not.toContain(stale);
    if (recordedRaw === undefined) expect(sent.slice(1).map(part => part.replace(/^\(\d+\/\d+\) — /u, '').replace(/ \(\d+\/\d+\)$/u, '')).join('\n\n')).toBe(expected.replace(/\[([^\]]+)\]\([^)]+\)/gu, '$1'));
    expect(turn.answerReports ?? []).toEqual(supported ? ['commitment:0'] : []);
    expect(loopHealth(journal.view, clock.now).awaitingDelivery).toBe(supported || rejected ? 0 : 1);
    if (rejected) {
      expect(journal.view.obligationWork['commitment:0']?.withheld?.text).toBe(stale);
      clock.now += 86400000;
      expect(dueObligationWork(journal.view, clock.now).map(item => item.key)).toContain('commitment:0');
      journal.close();
      const recheck = openPreviewJournal(path, key);
      expect(recheck.view.obligationWork['commitment:0']?.withheld?.text).toBe(stale);
      recheck.close();
      // Replay the durable state with a fresh worker after restart, then use the normal send receipt.
      const recovered = openPreviewJournal(path, key);
      const fixed = 'The current evidence establishes research and shell access, not superior continuity.';
      const resumed = createJournalWorker(recovered, { now: () => clock.now, stopped: () => false,
        prepareModel: input => input.context, checkOutbound: () => {},
        model: async input => {
          if (input.id.startsWith('obligation:')) {
            expect(JSON.parse(input.context).withheld).toMatchObject({ report: stale,
              objection: 'These capability claims have no current installation evidence.' });
            return JSON.stringify({ outcome: 'report', report: fixed });
          }
          return JSON.stringify({ reply: 'Here is the corrected result.', selectedReports: ['commitment:0'] });
        }, send: async input => { sent.push(input.expectedText); return sent.length; } });
      expect(await resumed.workObligations()).toBe(true);
      expect(recovered.view.obligationWork['commitment:0']?.report?.delivered).toBeUndefined();
      const before = sent.length;
      resumed.intake([{ update_id: capture.sourceUpdate + 1, message: { chat: { id: 7654321, type: 'private' },
        from: { id: 7654321 }, text: 'Give me the corrected result.' } }]);
      await resumed.drain();
      expect(sent.slice(before).join()).toContain(fixed);
      expect(recovered.view.obligationWork['commitment:0']?.report?.delivered).toBe(recovered.view.order.at(-1)!.id);
      const count = sent.length;
      await resumed.drain(); expect(sent).toHaveLength(count);
      recovered.close();
      const final = openPreviewJournal(path, key);
      expect(final.view.obligationWork['commitment:0']?.report?.text).toBe(fixed);
      expect(final.view.obligationWork['commitment:0']?.report?.delivered).toBeDefined();
      final.close();
      console.log('ASTRA recovery: explicit rejection -> persisted objection -> due work -> corrected report -> receipt -> reopen');
      return;
    }
    expect(journal.view.obligationWork['commitment:0']?.withheld).toBeUndefined();
    const deliveredCount = sent.length;
    await worker.drain();
    expect(sent).toHaveLength(deliveredCount);
    journal.close();
    const reopened = openPreviewJournal(path, key);
    expect(reopened.view.obligationWork['commitment:0']?.report?.delivered).toBe(supported ? turn.id : undefined);
    expect(reopened.view.obligationWork['commitment:0']?.report?.text).toBe(report);
    reopened.close();
  } finally { journal.close(); rmSync(root, { recursive: true, force: true }); }
}
