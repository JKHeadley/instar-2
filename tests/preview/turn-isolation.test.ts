import { expect, it, vi } from 'vitest';
import { mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createJournalWorker, openPreviewJournal } from './journal-test-worker.js';
import { untilStopped } from './live-sentinels.js';
import { statusAnswer } from './status-command.js';
import type { PreviewPorts } from './journal.js';
const at = 1794574944000;
function world(forum = false) {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'turn-isolation-baseline-')));
  const journal = openPreviewJournal(join(root, 'journal'), new Uint8Array(32).fill(57), {
    kind: 'genesis', bot: '12345678', chat: forum ? '-7654321' : '7654321', operator: '7654321', ...(forum ? { forum: true } : {}), grant: 'offline',
    configurationDigest: 'sha256:offline', expires: 9999999999999, maxCalls: 100, maxReplies: 100,
    maxTurns: 100, maxBytes: 409600, cursor: 0 });
  return { journal, root, path: join(root, 'journal'), key: new Uint8Array(32).fill(57), close() { journal.close(); rmSync(root, { recursive: true, force: true }); } };
}
it('a preparation exception must let the next queued conversation answer in the same drain', async () => {
  const f = world(true); let prepared = 0; const answered: string[] = [];
  try {
    const worker = createJournalWorker(f.journal, { now: () => at, stopped: () => false, groupDisclosure: async () => true,
      preparePacket: prepare => { if (++prepared === 1) throw Error('injected preparation failure'); return prepare(); },
      model: async input => { answered.push(input.id); return '{"reply":"Answered normally.","memory":[]}'; },
      send: async () => 1, checkOutbound: () => {} });
    worker.intake([1, 2].map(n => ({ update_id: n, message: { message_thread_id: n + 10, text: 'Check access.',
      from: { id: 7654321 }, chat: { id: -7654321, type: 'supergroup', is_forum: true }, is_topic_message: true } })));
    let failure: unknown;
    try { await worker.drain(); } catch (error) { failure = error; }
    console.log(JSON.stringify({ case: 'preparation', failure: failure instanceof Error ? failure.message : null,
      answered, retained: f.journal.view.order.map(t => ({ id: t.id, reserved: t.reserved, sent: t.sent ?? null })) }));
    expect(f.journal.view.order.map(turn => turn.thread)).toEqual([11, 12]);
    expect(f.journal.view.order[0]!.attempt!.state).toBe('exception');
    expect(f.journal.view.order[0]!.deliveryNotice?.sent).toBe(1);
    expect(answered).toContain('telegram:12345678:update:2');
    expect(failure).toBeUndefined();
  } finally { f.close(); }
});
it('a refused housekeeping record must not escape the runner minimal boundary', async () => {
  const f = world();
  try {
    const step = () => f.journal.append({ kind: 'session-work', record: {
      type: 'SessionWorkCall', schemaVersion: 1, edge: 'missing-session', ordinal: 1, at }, at });
    let failure: unknown;
    const logs: string[] = [];
    const worker = createJournalWorker(f.journal, defaults({ isolationLog: line => logs.push(line) }));
    try { await untilStopped(() => worker.housekeeping('session-maintenance', step), () => false); } catch (error) { failure = error; }
    console.log(JSON.stringify({ case: 'housekeeping', failure: failure instanceof Error ? failure.message : null,
      calls: f.journal.view.calls, intact: f.journal.view.stop === null }));
    expect(failure).toBeUndefined();
    expect(logs).toEqual(['turn-isolation session-maintenance exception']);
    expect(f.journal.view.operatorEvents.some(row => row.detail === 'housekeeping session-maintenance: exception')).toBe(true);
    worker.intake([update(1)]); await worker.drain();
    expect(f.journal.view.order[0]?.sent).toBe(1);
  } finally { f.close(); }
});

function update(n: number) { return { update_id: n, message: { text: 'Check access.',
  from: { id: 7654321 }, chat: { id: 7654321, type: 'private' } } }; }
const defaults = (extra: Partial<PreviewPorts> = {}): PreviewPorts => ({ now: () => at, stopped: () => false,
  model: async () => '{"reply":"Answered normally.","memory":[]}', send: async () => 1,
  checkOutbound: () => {}, isolationLog: () => {}, ...extra });
it('parks after three interrupted attempts across real reopen; serves later turn and status', async () => {
  const f = world(); let journal = f.journal;
  try {
    createJournalWorker(journal, defaults()).intake([update(1)]);
    const id = journal.view.order[0]!.id;
    for (let n = 1; n <= 3; n++) {
      journal.append({ kind: 'turn-attempt', id, attempt: n, state: 'started', at });
      journal.close(); journal = openPreviewJournal(f.path, f.key);
      const worker = createJournalWorker(journal, defaults());
      expect(journal.view.order[0]!.attempt).toEqual({ number: n, state: 'interrupted', failures: n });
      if (n === 3) {
        worker.intake([update(2)]); await worker.drain();
        expect(journal.view.order[0]!.reserved).toBe(false);
        expect(journal.view.order[0]!.parked).toBe('interrupted');
        expect(journal.view.order[1]!.sent).toBe(1);
        expect(statusAnswer(journal.view, at, 'UTC')).toContain('Parked failed requests: 1 (interrupted)');
      }
    }
    journal.compact(); expect(journal.compacted).toBe(true);
    journal.close(); journal = openPreviewJournal(f.path, f.key);
    await createJournalWorker(journal, defaults()).drain();
    expect(journal.view.order[0]!.attempt!.number).toBe(3);
  } finally { journal.close(); f.close(); }
});
it('three failed preparations park durably, with one failure notice and a later new request answering', async () => {
  const f = world(); const sent: string[] = [], logs: string[] = [];
  try {
    const worker = createJournalWorker(f.journal, defaults({
      preparePacket: () => { throw Error('private text must never be logged'); },
      send: async input => { sent.push(input.text); return sent.length; }, isolationLog: line => logs.push(line) }));
    worker.intake([update(1)]);
    for (let n = 0; n < 5; n++) await worker.drain();
    expect(f.journal.view.order[0]!.attempt).toEqual({ number: 3, state: 'exception', failures: 3 });
    expect(sent).toEqual(["I couldn't complete this request because an internal step failed; you can ask again."]);
    expect(logs).toHaveLength(3); expect(logs.join(' ')).not.toContain('private');
    const restarted = createJournalWorker(f.journal, defaults());
    restarted.intake([update(2)]); await restarted.drain();
    expect(f.journal.view.order[1]!.sent).toBe(1);
  } finally { f.close(); }
});
it('failure after reservation preserves unknown outcome and never repeats the effect or adds a failure notice', async () => {
  const f = world(); let calls = 0;
  try {
    const append = f.journal.append;
    f.journal.append = row => { if (row.kind === 'answer') throw Error('refused answer record'); return append(row); };
    const worker = createJournalWorker(f.journal, defaults({ model: async () => { calls++; return '{"reply":"Answer.","memory":[]}'; } }));
    worker.intake([update(1)]); await worker.drain();
    expect(f.journal.view.order[0]!.reserved).toBe(true);
    expect(f.journal.view.order[0]!.attempt!.failures).toBe(1);
    f.journal.append = append;
    await createJournalWorker(f.journal, defaults({ model: async () => { calls++; return 'bad'; } })).drain();
    expect(calls).toBe(1); expect(f.journal.view.order[0]!.deliveryNotice).toBeUndefined();
  } finally { f.close(); }
});
it('a refused failure fact escapes but the durable start counts on reopen', async () => {
  const f = world();
  try {
    const append = f.journal.append;
    f.journal.append = row => { if (row.kind === 'turn-attempt' && row.state === 'exception') throw Error('disk refused'); return append(row); };
    const worker = createJournalWorker(f.journal, defaults({ preparePacket: () => { throw Error('poison'); } }));
    worker.intake([update(1)]); await expect(worker.drain()).rejects.toThrow('attempt record failed');
    expect(f.journal.view.order[0]!.attempt!.state).toBe('started');
    f.journal.close();
    const replay = openPreviewJournal(f.path, f.key);
    try { createJournalWorker(replay, defaults()); expect(replay.view.order[0]!.attempt!.failures).toBe(1); }
    finally { replay.close(); }
  } finally { f.close(); }
});
it('legacy marker-free journal replays without new projected fields or writes from read-only workers', () => {
  const f = world();
  try {
    createJournalWorker(f.journal, defaults()).intake([update(1)]);
    const before = JSON.stringify(f.journal.view.order); f.journal.close();
    const replay = openPreviewJournal(f.path, f.key, undefined, undefined, true);
    try { createJournalWorker(replay, defaults()); expect(JSON.stringify(replay.view.order)).toBe(before); }
    finally { replay.close(); }
  } finally { f.close(); }
});

it('a checkpoint exhaustion with an unfittable floor fails only that turn', async () => {
  const f = world(); let ticks = 0;
  const clock = vi.spyOn(performance, 'now').mockImplementation(() => ticks += 6000);
  try {
    const worker = createJournalWorker(f.journal, defaults({ prepareModel: () => { throw Error('unavailable'); } }));
    worker.intake([update(1)]); await worker.drain();
    expect(f.journal.view.order[0]!.attempt!.state).toBe('preparation-bound');
    expect(f.journal.view.order[0]!.reserved).toBe(false);
    expect(f.journal.view.order[0]!.deliveryNotice?.sent).toBe(1);
  } finally { clock.mockRestore(); f.close(); }
});
it('batch candidate preparation failure is attributed to that candidate and leaves the lead answer intact', async () => {
  const f = world(); let prepared = 0;
  try {
    const worker = createJournalWorker(f.journal, defaults({ prepareModel: input => JSON.stringify(input),
      preparePacket: prepare => { if (++prepared === 2) throw Error('candidate failure'); return prepare(); },
      modelBatch: async () => { throw Error('batch should contain only the lead'); } }));
    worker.intake([update(1), update(2)]); await worker.drain();
    expect(f.journal.view.order[0]!.sent).toBe(1);
    expect(f.journal.view.order[0]!.attempt!.failures).toBe(0);
    expect(f.journal.view.order[1]!.attempt!.failures).toBe(1);
    expect(f.journal.view.order[1]!.deliveryNotice?.sent).toBe(1);
  } finally { f.close(); }
});
it('housekeeping failure append itself propagates rather than swallowing lost evidence', async () => {
  const f = world();
  try {
    const append = f.journal.append;
    f.journal.append = row => { if (row.kind === 'housekeeping-failed') throw Error('failure fact refused'); return append(row); };
    const worker = createJournalWorker(f.journal, defaults());
    await expect(worker.housekeeping('minimal', () => { throw Error('original refusal'); })).rejects.toThrow('failure fact refused');
  } finally { f.close(); }
});

it('the actual minimal entry point contains a refused housekeeping record', async () => {
  const f = world(); const logs: string[] = [];
  try {
    const worker = createJournalWorker(f.journal, defaults({ isolationLog: line => logs.push(line),
      stopped: () => { f.journal.append({ kind: 'session-work', record: {
        type: 'SessionWorkCall', schemaVersion: 1, edge: 'missing-session', ordinal: 1, at }, at }); return false; } }));
    await expect(worker.minimal()).resolves.toBeUndefined();
    expect(logs).toContain('turn-isolation minimal exception');
    expect(f.journal.view.operatorEvents.some(row => row.detail === 'housekeeping minimal: exception')).toBe(true);
  } finally { f.close(); }
});

it('a failed stop turn still reaches the minimal stop confirmation', async () => {
  const f = world();
  try {
    const append = f.journal.append;
    f.journal.append = row => { if (row.kind === 'status-answer') throw Error('refused stop answer'); return append(row); };
    const worker = createJournalWorker(f.journal, defaults());
    worker.intake([{ ...update(1), message: { ...update(1).message, text: '/stop' } }]);
    await worker.drain(); await worker.minimal();
    expect(f.journal.view.order[0]!.limited).toBeDefined();
    expect(f.journal.view.order[0]!.deliveryNotice).toBeUndefined();
    expect(f.journal.view.order[0]!.limitedSent).toBe(1);
  } finally { f.close(); }
});

it('an unknown failure notice is not repeated after compaction and restart', async () => {
  const f = world(); let sends = 0;
  const ports = defaults({ preparePacket: () => { throw Error('poison'); }, send: async () => { sends++; return null; } });
  try {
    const worker = createJournalWorker(f.journal, ports);
    worker.intake([update(1)]); await worker.drain(); f.journal.compact(); f.journal.close();
    const reopened = openPreviewJournal(f.path, f.key);
    try { const next = createJournalWorker(reopened, ports); await next.drain(); await next.drain(); expect(sends).toBe(1); }
    finally { reopened.close(); }
  } finally { f.close(); }
});
