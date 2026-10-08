/** Plan 636: real failed declarations from the October 4 group-A journals.
 * Original model bytes drive the new retry path. The fulfillment response is another recorded
 * successful answer; the date repair is explicitly synthetic. Neither proves future model compliance. */
import { expect, it } from 'vitest';
import { mkdtempSync, readFileSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readAnswer } from './answer-reading.js';
import { createJournalWorker, openPreviewJournal } from './journal-test-worker.js';

const fixture = JSON.parse(readFileSync(new URL('./fixtures/flap-a-declarations-2026-10-04.json', import.meta.url), 'utf8')) as {
  rows: { row: { kind: string; id: string; text?: string; output?: string; outcome?: string; at: number } }[] };
const row = (id: number, kind: string) => fixture.rows.find(x => x.row.id.endsWith(`:${id}`) && x.row.kind === kind)!.row;
const output = (id: number) => {
  const reading = readAnswer(row(id, 'model-call').output!, { wrapped: 'accept' });
  if (!reading.ok) throw Error(reading.defect);
  return reading.value;
};
const key = new Uint8Array(32).fill(36);
const genesis = { kind: 'genesis' as const, bot: '8994258214', chat: '7812716706', operator: '7812716706',
  grant: 'grant:preview', configurationDigest: 'sha256:offline', expires: Date.UTC(2027, 0, 1),
  maxCalls: 400, maxReplies: 200, maxTurns: 200, maxBytes: 409600, cursor: 0 };
const update = (id: number) => ({ update_id: id, message: { chat: { id: 7812716706, type: 'private' },
  from: { id: 7812716706 }, text: row(id, 'intake').text!, date: Math.floor(row(id, 'intake').at / 1000) } });

async function run(id: number, second?: string | 'uncertain', options: {
  cap?: boolean; stop?: boolean; seed?: boolean; sendUnknown?: boolean; initial?: string;
} = {}) {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'flap-a-declaration-')));
  const path = join(root, 'journal.encrypted');
  const journal = openPreviewJournal(path, key, { ...genesis, ...(options.cap ? { maxCalls: options.seed ? 2 : 1 } : {}) });
  const inputs: { context: string; id: string }[] = [], sent: string[] = [];
  let stopped = false, attempts = 0;
  const worker = createJournalWorker(journal, { now: () => row(id, 'intake').at, stopped: () => stopped,
    prepareModel: input => input.context,
    model: async input => {
      if (options.seed && input.id.endsWith(':715674118')) return output(715674118);
      inputs.push(input); attempts++;
      if (options.stop) stopped = true;
      if (attempts === 1) return { state: 'complete' as const, text: options.initial ?? output(id), usage: { inputTokens: 10, outputTokens: 5, charge: null } };
      if (attempts > 2) throw Error('retry exceeded its bound');
      if (second === 'uncertain') {
        expect(row(715673614, 'model-call').outcome).toBe('uncertain');
        return { state: 'uncertain' as const }; // the recorded call had no output to parse
      }
      return second ?? output(id);
    }, send: async input => { sent.push(input.text); return options.sendUnknown && input.update === id ? null : 123; }, checkOutbound: () => {} });
  if (options.seed) { worker.intake([update(715674118)]); await worker.drain(); }
  worker.intake([update(id)]);
  if (options.stop) await expect(worker.drain()).rejects.toThrow('preview stopped');
  else await worker.drain();
  return { journal, inputs, sent, turn: journal.view.order.at(-1)!,
    reopen: () => { journal.close(); return openPreviewJournal(path, key, undefined, undefined, true); },
    close: () => { journal.close(); rmSync(root, { recursive: true, force: true }); } };
}

it('715674119: the recorded old-promise citation triggers a precise re-ask; a new-reply citation closes only after send', async () => {
  const r = await run(715674119, output(6232374), { seed: true }); // real passing A5b response, offered promise id 0
  try {
    expect(r.inputs).toHaveLength(2);
    expect(JSON.parse(r.inputs[1]!.context).formatReminder).toContain('not the old promise');
    expect(r.turn.answerRetried).toBe(true);
    expect(r.turn.intentFulfills).toEqual([0]);
    expect(r.journal.view.closed.has(0)).toBe(true);
    expect(r.sent).toHaveLength(2); // seed promise and one answer, never the invalid candidate
    const replay = r.reopen();
    try { expect(replay.view.closed.has(0)).toBe(true); expect(replay.view.calls).toBe(3); } finally { replay.close(); }
  } finally { r.close(); }
});

it('715674175: the recorded capitalized operator quote triggers the same bounded re-ask; an exact citation schedules', async () => {
  const value = JSON.parse(output(715674175)) as { dated: { quote: string }[] };
  const repaired = JSON.stringify({ ...value, dated: value.dated.map(x => ({ ...x, quote: x.quote.replace(/^Remind/u, 'remind') })) });
  const r = await run(715674175, repaired);
  try {
    expect(r.inputs).toHaveLength(2);
    expect(JSON.parse(r.inputs[1]!.context).formatReminder).toContain('including case');
    expect(r.journal.view.dated).toHaveLength(1);
    expect(r.journal.view.dated[0]).toMatchObject({ day: '2026-10-04', time: '23:56', remind: true });
    expect(r.sent).toHaveLength(1);
    expect(r.sent[0]).not.toContain('could not verify');
  } finally { r.close(); }
});

it('715674172: both real flat outputs with raw newlines are already readable; the actual promise records without retry', async () => {
  const r = await run(715674172);
  try { expect(r.inputs).toHaveLength(1); expect(r.journal.view.commitments[0]?.agentPromise).toBeDefined(); }
  finally { r.close(); }
  for (const entry of fixture.rows.filter(x => x.row.id.endsWith(':715674172') && x.row.kind === 'model-call'))
    expect(readAnswer(entry.row.output!, { wrapped: 'accept' })).toMatchObject({ ok: true });
});

it.each([6232373, 6232376])('passing recorded declaration %s remains a single call', async id => {
  const r = await run(id);
  try {
    expect(r.inputs).toHaveLength(1);
    expect(r.turn.answerRetried).toBeUndefined();
    if (id === 6232373) expect(r.journal.view.commitments[0]?.agentPromise).toBeDefined();
    else expect(r.journal.view.dated[0]).toMatchObject({ time: '01:31', remind: true });
  } finally { r.close(); }
});

it('a repeated real invalid fulfillment never closes the promise and cannot re-ask a third time', async () => {
  const r = await run(715674119, undefined, { seed: true });
  try { expect(r.inputs).toHaveLength(2); expect(r.journal.view.closed.has(0)).toBe(false);
    expect(r.journal.view.rejectedObligations).toBe(1); expect(r.turn.intentFulfills).toEqual([]); }
  finally { r.close(); }
});

it('a repeated real invalid date remains refused, with no scheduled reminder', async () => {
  const r = await run(715674175);
  try { expect(r.inputs).toHaveLength(2); expect(r.journal.view.dated).toEqual([]);
    expect(r.sent[0]).toContain('could not verify the date'); }
  finally { r.close(); }
});

it.each(['cap', 'stop'] as const)('the %s floor prevents a declaration retry', async floor => {
  const r = await run(715674119, undefined, { seed: true, [floor]: true });
  try { expect(r.inputs).toHaveLength(1); expect(r.journal.view.closed.has(0)).toBe(false);
    expect(r.turn.answerRetried).toBeUndefined(); }
  finally { r.close(); }
});

it('an uncertain replacement stays unknown and closes no promise', async () => {
  const r = await run(715674119, 'uncertain', { seed: true });
  try { expect(r.inputs).toHaveLength(2); expect(r.journal.view.closed.has(0)).toBe(false);
    expect(r.turn.answer).toBeUndefined(); expect(r.journal.view.calls).toBe(3); }
  finally { r.close(); }
});

it('a malformed promise gets one repair opportunity, while a valid recorded promise needs none', async () => {
  const valid = JSON.parse(output(6232373)) as { reply: string; promises: { quote: string }[] };
  const r = await run(6232373, output(6232373), { initial: JSON.stringify({ ...valid, promises: [{ quote: 'not in the reply' }] }) });
  try { expect(r.inputs).toHaveLength(2); expect(JSON.parse(r.inputs[1]!.context).formatReminder).toContain('promises must quote');
    expect(r.journal.view.commitments[0]?.agentPromise).toBeDefined(); }
  finally { r.close(); }
});

it('a repaired fulfillment whose send stays unknown never closes the promise or duplicates the send', async () => {
  const r = await run(715674119, output(6232374), { seed: true, sendUnknown: true });
  try { expect(r.inputs).toHaveLength(2); expect(r.sent).toHaveLength(2); expect(r.journal.view.closed.has(0)).toBe(false);
    const reopened = r.reopen();
    try { expect(reopened.view.closed.has(0)).toBe(false); expect(reopened.view.order.at(-1)?.sent).toBeUndefined(); }
    finally { reopened.close(); }
  } finally { r.close(); }
});
