import { expect, it } from 'vitest';
import { mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { awayDigest, awayDigestSource } from './away-digest.js';
import { createJournalWorker, openPreviewJournal, raiseJournalCaps, UNKNOWN_ANSWER_NOTICE } from './journal.js';
import { prepareJournalEnvelope } from './journal-envelope.js';
import type { RunLog } from './self-state.js';

const key = new Uint8Array(32).fill(9);
const HOUR = 3_600_000;
const start = 1_790_000_000_000;
const genesis = { kind: 'genesis' as const, bot: '123', chat: '456', operator: '456', grant: 'grant',
  configurationDigest: 'sha256:test', expires: start + 100 * HOUR, maxCalls: 8, maxReplies: 8,
  maxTurns: 8, maxBytes: 32768, cursor: 0 };
const raw = (update: number, text: string) => JSON.stringify({ update_id: update,
  message: { chat: { id: 456, type: 'private' }, from: { id: 456 }, text } });
const desk = (body: string, modifiedAt: number) => ({ id: 'desk-status', text: `label and clock\nLast updated.\n${body}`,
  provenance: { status: 'current', modifiedAt } });
const prompt = (source: ReturnType<typeof desk>) => JSON.stringify({ messages: [
  { role: 'context', content: JSON.stringify({ packet: { sources: [source] } }) }] });
const runs: RunLog = { launches: [], unreadable: 0 };

it('uses the prior verified message as the gap anchor and stays absent at or below three hours', () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'away-digest-')));
  try {
    const journal = openPreviewJournal(join(root, 'journal.encrypted'), key, genesis);
    journal.append({ kind: 'intake', id: 'first', update: 1, text: 'hello', raw: raw(1, 'hello'), accepted: true, cursor: 2, at: start });
    journal.append({ kind: 'intake', id: 'second', update: 2, text: 'again', raw: raw(2, 'again'), accepted: true, cursor: 3, at: start + 3 * HOUR });
    expect(awayDigest(journal.view, runs, start + 3 * HOUR, journal.view.order[0]!, [])).toBeNull();
    expect(awayDigest(journal.view, runs, start + 3 * HOUR, journal.view.order[1]!, [])).toBeNull();
    journal.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
});

it('replays a bounded digest of runs, holds, lost answers, unknown effects, raised caps and desk changes', () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'away-digest-')));
  const path = join(root, 'journal.encrypted');
  try {
    const journal = openPreviewJournal(path, key, genesis);
    const oldDesk = desk('Lane A: building.\nLane B: ready.', start);
    journal.append({ kind: 'intake', id: 'first', update: 1, text: 'hello', raw: raw(1, 'hello'), accepted: true, cursor: 2, at: start });
    journal.append({ kind: 'reserve', id: 'first', prompt: prompt(oldDesk), at: start + 1 });
    journal.append({ kind: 'answer', id: 'first', text: 'hello', at: start + 2 });
    raiseJournalCaps(journal, { maxCalls: 9, maxReplies: 9, maxTurns: 9, authority: 'Justin', at: start + HOUR });
    journal.append({ kind: 'intake', id: 'second', update: 2, text: 'back', raw: raw(2, 'back'), accepted: true,
      cursor: 3, at: start + 4 * HOUR });
    journal.append({ kind: 'hold', id: 'second', reason: 'call cap', at: start + 4 * HOUR + 1 });
    journal.append({ kind: 'reserve', id: 'second', at: start + 4 * HOUR + 2 });
    journal.append({ kind: 'model-uncertain', id: 'second', state: 'uncertain', at: start + 4 * HOUR + 3 });
    journal.append({ kind: 'notice', id: 'second', noticeClass: 'unknown-answer', at: start + 4 * HOUR + 4 });
    journal.append({ kind: 'intent', id: 'second', text: `PREVIEW — ${UNKNOWN_ANSWER_NOTICE}`,
      chat: genesis.chat, update: 2, grant: genesis.grant, at: start + 4 * HOUR + 5 });
    const now = start + 4 * HOUR + 10;
    const newDesk = desk('Lane A: ready.\nLane B: ready.', start + 2 * HOUR);
    const log: RunLog = { launches: [{ at: start + HOUR, exit: start + 2 * HOUR, reason: 'cycle limit' },
      { at: start + 3 * HOUR }], unreadable: 0 };
    const digest = awayDigest(journal.view, log, now, journal.view.order[1]!, [newDesk])!;
    expect(digest).toContain('4h gap');
    expect(digest).toContain('2 launch(es), 1 recorded end(s)');
    expect(digest).toContain('1 hold(s) (call cap)');
    expect(digest).toContain('1 lost-answer notice(s)');
    expect(digest).toContain('1 unknown answer call(s), 0 unknown summary call(s), 1 unknown send(s)');
    expect(digest).toContain('Caps raised 1 time(s)');
    expect(digest).toContain('Lane A: ready.');
    expect(digest).not.toContain('Lane B: ready.');
    expect(digest.length).toBeLessThanOrEqual(640);
    expect(awayDigestSource(digest).text).toContain('grants no authority');
    journal.close();
    const recovered = openPreviewJournal(path, key);
    expect(awayDigest(recovered.view, log, now, recovered.view.order[1]!, [newDesk])).toBe(digest);
    recovered.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
});

it('labels an unavailable prior desk snapshot and never treats a missing report as a known change', () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'away-digest-')));
  try {
    const journal = openPreviewJournal(join(root, 'journal.encrypted'), key, genesis);
    journal.append({ kind: 'intake', id: 'first', update: 1, text: 'hello', raw: raw(1, 'hello'), accepted: true, cursor: 2, at: start });
    journal.append({ kind: 'intake', id: 'second', update: 2, text: 'back', raw: raw(2, 'back'), accepted: true,
      cursor: 3, at: start + 4 * HOUR });
    const current = journal.view.order[1]!;
    expect(awayDigest(journal.view, runs, start + 4 * HOUR, current, [])).toContain('No recorded changes');
    expect(awayDigest(journal.view, runs, start + 4 * HOUR, current,
      [desk('Lane A: ready.', start + HOUR)])).toContain('earlier snapshot unavailable');
    journal.append({ kind: 'reserve', id: 'first', prompt: prompt(desk('Lane A: ready.\nLane B: ready.', start)), at: start + 1 });
    journal.append({ kind: 'reserve', id: 'second', at: start + 4 * HOUR + 1 });
    const uncertain = awayDigest(journal.view, runs, start + 4 * HOUR + 2, current,
      [desk('Lane A: ready.', start + HOUR)])!;
    expect(uncertain).toContain('2 unknown answer call(s)');
    expect(uncertain).toContain('1 line(s) removed');
    expect(awayDigest(journal.view, runs, start + 4 * HOUR + 2, current,
      [{ id: 'desk-status', text: 'missing', provenance: { status: 'missing' } }])).toContain('changes cannot be checked');
    journal.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
});

it('places the digest only in the after-gap model packet, using the durable earlier prompt for desk comparison', async () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'away-digest-')));
  try {
    const journal = openPreviewJournal(join(root, 'journal.encrypted'), key, genesis);
    let now = start, currentDesk = desk('Lane A: building.', start);
    const packets: { sources: { id: string; text: string }[] }[] = [];
    const worker = createJournalWorker(journal, { now: () => now, stopped: () => false,
      sources: turn => {
        const sources = [currentDesk];
        const digest = turn && awayDigest(journal.view, runs, now, turn, sources);
        return digest ? [...sources, awayDigestSource(digest)] : sources;
      },
      prepareModel: input => prepareJournalEnvelope(input, 'test-model', genesis.grant, now, genesis.maxBytes),
      model: async input => { packets.push(JSON.parse(input.context)); return 'okay'; },
      send: async () => 1, checkOutbound: () => {} });
    worker.intake([{ update_id: 1, message: { chat: { id: 456, type: 'private' }, from: { id: 456 }, text: 'hello' } }]);
    await worker.drain();
    expect(packets[0]!.sources.some(source => source.id === 'away-digest')).toBe(false);
    now += 4 * HOUR;
    currentDesk = desk('Lane A: ready.', now - HOUR);
    worker.intake([{ update_id: 2, message: { chat: { id: 456, type: 'private' }, from: { id: 456 }, text: 'back' } }]);
    await worker.drain();
    expect(packets[1]!.sources.find(source => source.id === 'away-digest')?.text).toContain('Lane A: ready.');
    journal.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
});
