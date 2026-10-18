// Plan row #313 / observer #132: the open-loop revisit cadence is a value this root was created with, not a
// build-wide constant. Rule 8 asks that an open loop be "re-surfaced on a schedule" and Rule 92 that a cadence
// be "adjustable per session"; neither names a literal day. These tests hold both sides of every decision the
// per-root interval introduces: a short root really is due sooner, a default root really is not, the bounds
// refuse, a root written before the field reads as the default, and the value survives compaction and reopen.
import { expect, it } from 'vitest';
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { createJournalWorker, dueObligationWork, loopRevisitMs, obligationSchedule, openPreviewJournal,
  LOOP_REVISIT_MS, LOOP_REVISIT_MAX_MS, LOOP_REVISIT_MIN_MS, validLoopRevisitMs } from './journal-test-worker.js';
import { loopHealth } from './obligations.js';
import { spawnAsync } from './spawn-async.js';
import { OFFLINE_STORAGE_KEY, successiveWorld } from './successive-fixture.js';

const key = new Uint8Array(32).fill(53);
const origin = () => realpathSync(mkdtempSync(join(tmpdir(), 'preview-loop-cadence-')));
const T0 = 1790000000000, MINUTE = 60_000;
const INVOICE = 'Can you check the invoice question?';
const LATER = 'I will look into the invoice question later today.';
/** The base this branch was cut from: the build that has no per-root interval (origin/cint-L32 head). */
const BASE_COMMIT = '4addcb06';

const genesis = (loopRevisitMs?: number) => ({ kind: 'genesis' as const, bot: '12345678', chat: '7654321',
  operator: '7654321', grant: 'grant:preview', configurationDigest: 'sha256:offline', expires: 9999999999999,
  maxCalls: 400, maxReplies: 200, maxTurns: 200, maxBytes: 8000, cursor: 0,
  ...(loopRevisitMs === undefined ? {} : { loopRevisitMs }) });

/** One root with one open agent-owned loop: the shape whose next scheduled step the cadence decides. */
function world(root: string, revisit?: number) {
  const path = join(root, 'journal.encrypted');
  const journal = openPreviewJournal(path, key, genesis(revisit));
  const clock = { now: T0 };
  const worked: string[] = [], sent: string[] = [];
  const worker = createJournalWorker(journal, { now: () => clock.now, stopped: () => false, timeZone: 'UTC',
    prepareModel: input => input.context,
    model: async input => {
      if (input.id.startsWith('obligation:')) { worked.push(input.id);
        return JSON.stringify({ outcome: 'report', report: 'The invoice is for 120 dollars.' }); }
      if (input.id.startsWith('summary:')) return JSON.stringify({ summary: 'Earlier turns.', people: [], commitments: [], closed: [] });
      return JSON.stringify({ reply: LATER, memory: [], openLoops: [{ kind: 'deferral', quote: LATER, waitsOn: 'nothing' }] });
    },
    send: async input => { sent.push(input.text); return sent.length; },
    checkOutbound: () => {} });
  const say = async (text: string) => {
    worker.intake([{ update_id: 1, message: { chat: { id: 7654321, type: 'private' }, from: { id: 7654321 }, text,
      date: Math.floor(clock.now / 1000) } }]);
    await worker.drain(); await worker.summarizeIfNeeded();
  };
  return { journal, worker, clock, say, path, worked, sent };
}

it('brings a root\'s scheduled work due on that root\'s own interval, and no sooner', async () => {
  // Both sides, on both roots: the 15-minute root is due at 15 minutes and not at 14; the default root is not
  // due at either, and still needs its 24 hours. The same journal shape and the same clock arithmetic.
  for (const [minutes, revisit] of [[15, 15 * MINUTE], [undefined, undefined]] as const) {
    const root = origin();
    try {
      const w = world(root, revisit);
      await w.say(INVOICE);
      expect(w.journal.view.commitments).toMatchObject([{ in: 'reply', quote: LATER, owner: 'agent', waitsOn: 'nothing' }]);
      const expected = minutes === undefined ? LOOP_REVISIT_MS : minutes * MINUTE;
      expect(loopRevisitMs(w.journal.view)).toBe(expected);
      const source = w.journal.view.turns.get(w.journal.view.commitments[0]!.source)!;
      expect(obligationSchedule(w.journal.view)).toMatchObject([{ key: 'commitment:0', slot: source.at + expected }]);
      // One minute before its own interval nothing is due and the scheduled tick makes no model call.
      const calls = w.journal.view.calls;
      w.clock.now = source.at + expected - MINUTE;
      expect(dueObligationWork(w.journal.view, w.clock.now)).toEqual([]);
      expect(await w.worker.workObligations()).toBe(false);
      expect(w.journal.view.calls).toBe(calls);
      // At fifteen minutes the short root's step is due; the default root's is not, for another day.
      w.clock.now = source.at + 15 * MINUTE;
      expect(dueObligationWork(w.journal.view, w.clock.now).length).toBe(minutes === undefined ? 0 : 1);
      // Past its own interval, with no inbound message at all, the step is due and the tick consumes it.
      w.clock.now = source.at + expected + MINUTE;
      expect(dueObligationWork(w.journal.view, w.clock.now)).toMatchObject([{ key: 'commitment:0' }]);
      expect(await w.worker.workObligations()).toBe(true);
      expect(w.worked).toHaveLength(1);
      expect(w.worked[0]).toContain('obligation:commitment:0');
      expect(w.journal.view.calls).toBe(calls + 1);
      // And the next step after that result is one interval later again, not one day.
      expect(obligationSchedule(w.journal.view)).toMatchObject([{ key: 'commitment:0', awaitingDelivery: true }]);
      expect(loopHealth(w.journal.view, w.clock.now).revisitMinutes).toBe(expected / MINUTE);
      w.journal.close();
    } finally { rmSync(root, { recursive: true, force: true }); }
  }
}, 60_000);

const LOCKER = 'Please remember that my gym locker code is 4417.';
const filler = (i: number) => `ordinary turn ${String(i)}: the garden, errands and plans ${'x'.repeat(40)}`;

/** The same root, but the summary step declares the remembered line as an agent-owned commitment, as the
 * live step does. A summary is the state in which Rule 8's packet half decides: before one, every open loop
 * rides every packet anyway, so the cadence changes nothing there. */
function summaryWorld(root: string, revisit?: number) {
  const journal = openPreviewJournal(join(root, 'journal.encrypted'), key, genesis(revisit));
  const clock = { now: T0 };
  const worker = createJournalWorker(journal, { now: () => clock.now, stopped: () => false, timeZone: 'UTC',
    prepareModel: input => input.context,
    model: async input => {
      if (input.id.startsWith('summary:')) {
        const packet = JSON.parse(input.context) as { history: { user: string }[] };
        return JSON.stringify({ summary: 'Earlier turns covered a locker code and plans.', people: [], closed: [],
          commitments: packet.history.filter(turn => /remember/iu.test(turn.user))
            .map(turn => ({ in: 'message', quote: turn.user, waitsOn: 'nothing' })) });
      }
      return JSON.stringify({ reply: 'Noted.', memory: [] });
    },
    send: async () => 1, checkOutbound: () => {} });
  let next = 1;
  const say = async (text: string) => {
    worker.intake([{ update_id: next++, message: { chat: { id: 7654321, type: 'private' }, from: { id: 7654321 }, text,
      date: Math.floor(clock.now / 1000) } }]);
    await worker.drain(); await worker.summarizeIfNeeded();
  };
  return { journal, worker, clock, say };
}

it('resurfaces an open loop into an unrelated turn on that root\'s own interval (Rule 8)', async () => {
  // Both sides over the same two hours of unrelated conversation: the fifteen-minute root brings the loop
  // back inside that window, the default root does not, because its own interval has not passed.
  for (const revisit of [15 * MINUTE, undefined]) {
    const root = origin();
    try {
      const w = summaryWorld(root, revisit);
      await w.say(LOCKER);
      for (let i = 0; !w.journal.view.summaries.length && i < 60; i++) { w.clock.now += MINUTE; await w.say(filler(i)); }
      expect(w.journal.view.summaries.length).toBeGreaterThan(0);
      const locker = w.journal.view.commitments.findIndex(note => note.quote === LOCKER);
      expect(locker).toBeGreaterThanOrEqual(0);
      const openedAt = w.journal.view.turns.get(w.journal.view.commitments[locker]!.source)!.at;
      // An hour of unrelated turns, keeping the conversation alive: well past fifteen minutes, nowhere near a day.
      for (let i = 0; i < 6; i++) { w.clock.now += 10 * MINUTE; await w.say(`Weather note ${String(i)}: sunny.`); }
      expect(w.clock.now - openedAt).toBeLessThan(LOOP_REVISIT_MS);
      const carried = w.journal.view.order.filter(turn => turn.grounding?.commitments.includes(locker));
      if (revisit === undefined) {
        expect(carried).toEqual([]);
        expect(loopHealth(w.journal.view, w.clock.now).revisitDue).toBe(0);
      } else {
        expect(carried.length).toBeGreaterThanOrEqual(1);
        expect(carried[0]!.reservedAt! - openedAt).toBeGreaterThanOrEqual(revisit);
        expect(carried[0]!.reservedAt! - openedAt).toBeLessThan(LOOP_REVISIT_MS);
      }
      w.journal.close();
    } finally { rmSync(root, { recursive: true, force: true }); }
  }
}, 120_000);

it('admits an interval only inside its bounds, at the journal and at the launcher', () => {
  expect(LOOP_REVISIT_MIN_MS).toBe(10 * MINUTE);
  expect(LOOP_REVISIT_MAX_MS).toBe(LOOP_REVISIT_MS);
  // The predicate, both sides of each edge.
  for (const value of [LOOP_REVISIT_MIN_MS, LOOP_REVISIT_MAX_MS, 15 * MINUTE]) expect(validLoopRevisitMs(value)).toBe(true);
  for (const value of [LOOP_REVISIT_MIN_MS - 1, LOOP_REVISIT_MAX_MS + 1, 0, -15 * MINUTE, 15 * MINUTE + 0.5, NaN, Infinity,
    '900000', null, undefined]) expect(validLoopRevisitMs(value)).toBe(false);
  // And the journal itself refuses the out-of-range genesis, with a reason that names the bounds, writing nothing.
  for (const value of [LOOP_REVISIT_MIN_MS - 1, LOOP_REVISIT_MAX_MS + 1, 15 * MINUTE + 0.5]) {
    const root = origin();
    try {
      expect(() => openPreviewJournal(join(root, 'journal.encrypted'), key, genesis(value)))
        .toThrow(`revisit interval outside ${String(LOOP_REVISIT_MIN_MS)}..${String(LOOP_REVISIT_MAX_MS)} ms`);
    } finally { rmSync(root, { recursive: true, force: true }); }
  }
  // The admitted edges really open: a root at each bound is created and reads back that interval.
  for (const value of [LOOP_REVISIT_MIN_MS, LOOP_REVISIT_MAX_MS]) {
    const root = origin();
    try {
      const journal = openPreviewJournal(join(root, 'journal.encrypted'), key, genesis(value));
      expect(loopRevisitMs(journal.view)).toBe(value);
      journal.close();
    } finally { rmSync(root, { recursive: true, force: true }); }
  }
});

it('sets the interval at genesis from the launch option, and lets no later launch move it', () => {
  const world = successiveWorld();
  const env = { ...process.env, INSTAR_SECRET_PREVIEW_STORAGE_KEY: Buffer.from(OFFLINE_STORAGE_KEY).toString('hex'),
    INSTAR_SECRET_PREVIEW_TELEGRAM_BOT_TOKEN: '12345678:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
    INSTAR_PREVIEW_TEST_TELEGRAM_ENDPOINT: 'http://127.0.0.1:9',
    INSTAR_CONVERSATION_OWNERS: join(world.directory, 'owners') };
  const launch = (root: string, minutes?: string) => spawnSync(process.execPath,
    ['--no-warnings', '--loader', './scripts/slice-ts-loader.mjs', 'tests/preview/journal-agent.mjs', 'run',
      '--root', root, '--bot-id', '1001', '--chat-id', '2002', '--operator-sender-id', '2002',
      '--grant-reference', 'grant:cadence', '--configuration-digest', 'sha256:recorded',
      '--expires-at', '9999999999999', '--max-calls', '4', '--max-replies', '4', '--max-turns', '4',
      ...(minutes === undefined ? [] : ['--loop-revisit-minutes', minutes])],
    { cwd: process.cwd(), encoding: 'utf8', timeout: 30000, env });
  const refusals = (root: string) => readFileSync(join(root, 'runs.jsonl'), 'utf8').split('\n').filter(Boolean)
    .map(line => JSON.parse(line) as { refused?: string }).flatMap(row => row.refused ? [row.refused] : []);

  // An out-of-bounds or non-integer option refuses the launch and creates no root.
  for (const bad of ['9', '1441', '15.5', 'fifteen', '-15']) {
    const root = join(world.directory, `bad-${bad}`);
    const run = launch(root, bad);
    expect(run.status, run.stderr).toBe(1);
    expect(spawnSync('test', ['-e', join(root, 'journal.encrypted')]).status).not.toBe(0);
  }
  // An admitted option reaches genesis; the launch still ends at its withheld Telegram port, so the genesis
  // is what the journal keeps. A second launch repeating the same value is accepted on that ground.
  const root = join(world.directory, 'cadence-root');
  expect(launch(root, '15').status).toBe(1);
  const opened = openPreviewJournal(join(root, 'journal.encrypted'), OFFLINE_STORAGE_KEY, undefined, undefined, true);
  expect(opened.view.genesis.loopRevisitMs).toBe(15 * MINUTE);
  expect(loopRevisitMs(opened.view)).toBe(15 * MINUTE);
  opened.close();
  expect(refusals(root)).not.toContain('preview: loop-revisit-minutes differs from journal');
  expect(launch(root, '15').status).toBe(1);
  expect(refusals(root)).not.toContain('preview: loop-revisit-minutes differs from journal');
  // A different value is refused by name: there is no writer for the interval but genesis.
  expect(launch(root, '30').status).toBe(1);
  expect(refusals(root)).toContain('preview: loop-revisit-minutes differs from journal');
  // And a root created without the option keeps the default, which a later launch may not raise either.
  const plain = join(world.directory, 'plain-root');
  expect(launch(plain).status).toBe(1);
  const plainJournal = openPreviewJournal(join(plain, 'journal.encrypted'), OFFLINE_STORAGE_KEY, undefined, undefined, true);
  expect(plainJournal.view.genesis.loopRevisitMs).toBeUndefined();
  expect(loopRevisitMs(plainJournal.view)).toBe(LOOP_REVISIT_MS);
  plainJournal.close();
  expect(launch(plain, '15').status).toBe(1);
  expect(refusals(plain)).toContain('preview: loop-revisit-minutes differs from journal');
}, 120_000);

it('carries the interval through a compaction snapshot and a reopen', async () => {
  const root = origin();
  try {
    // A small compaction threshold so this root really compacts, then reopens from its own snapshot.
    const path = join(root, 'journal.encrypted');
    const journal = openPreviewJournal(path, key, genesis(15 * MINUTE), undefined, false, 4096);
    const clock = { now: T0 };
    const worker = createJournalWorker(journal, { now: () => clock.now, stopped: () => false, timeZone: 'UTC',
      prepareModel: input => input.context,
      model: async input => input.id.startsWith('summary:')
        ? JSON.stringify({ summary: 'Earlier turns covered errands and plans.', people: [], commitments: [], closed: [] })
        : JSON.stringify({ reply: 'Noted.', memory: [] }),
      send: async () => 1, checkOutbound: () => {} });
    for (let i = 0; i < 40 && !journal.compacted; i++) {
      clock.now += MINUTE;
      worker.intake([{ update_id: i + 1, message: { chat: { id: 7654321, type: 'private' }, from: { id: 7654321 },
        text: `ordinary turn ${String(i)}: errands and plans ${'x'.repeat(200)}`, date: Math.floor(clock.now / 1000) } }]);
      await worker.drain(); await worker.summarizeIfNeeded();
    }
    expect(journal.compacted).toBe(true);
    expect(loopRevisitMs(journal.view)).toBe(15 * MINUTE);
    journal.close();
    // The reopen restores from the snapshot (its genesis is compared byte for byte) and keeps the interval.
    const reopened = openPreviewJournal(path, key, undefined, undefined, false, 4096);
    expect(reopened.compacted).toBe(true);
    expect(reopened.view.genesis.loopRevisitMs).toBe(15 * MINUTE);
    expect(loopRevisitMs(reopened.view)).toBe(15 * MINUTE);
    expect(loopHealth(reopened.view, clock.now).revisitMinutes).toBe(15);
    reopened.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
}, 60_000);

it('reads a root written before the field as the 24-hour default, unchanged', async () => {
  // Written by the base build itself, so "an existing root is untouched" is not an argument about key
  // absence but a journal this branch did not write. The fixture refuses to run on a build that knows the field.
  const temp = realpathSync(mkdtempSync(join(tmpdir(), 'preview-loop-cadence-base-')));
  try {
    const checkout = join(temp, 'base'), seed = join(temp, 'seed');
    mkdirSync(checkout); mkdirSync(seed);
    const archived = await spawnAsync('git', ['archive', '--format=tar', BASE_COMMIT], { cwd: process.cwd() });
    expect(archived.status, archived.stderr).toBe(0);
    const unpacked = await spawnAsync('tar', ['-xf', '-', '-C', checkout], { input: archived.stdoutBytes });
    expect(unpacked.status, unpacked.stderr).toBe(0);
    symlinkSync(realpathSync(join(process.cwd(), 'node_modules')), join(checkout, 'node_modules'), 'dir');
    const written = await spawnAsync(process.execPath, ['--no-warnings', '--loader', './scripts/slice-ts-loader.mjs',
      join(process.cwd(), 'tests/preview/loop-cadence-fixture.mjs'), checkout, seed],
    { cwd: checkout, encoding: 'utf8', timeout: 60000 });
    expect(written.status, written.stderr).toBe(0);
    // This branch reads it: no interval recorded, so the default, and the schedule the base build computed.
    const read = openPreviewJournal(join(seed, 'journal.encrypted'), new Uint8Array(32).fill(53), undefined, undefined, true);
    expect(read.view.genesis.loopRevisitMs).toBeUndefined();
    expect(loopRevisitMs(read.view)).toBe(LOOP_REVISIT_MS);
    expect(read.view.commitments).toMatchObject([{ in: 'reply', quote: LATER, owner: 'agent', waitsOn: 'nothing' }]);
    const source = read.view.turns.get(read.view.commitments[0]!.source)!;
    expect(obligationSchedule(read.view)).toMatchObject([{ key: 'commitment:0', slot: source.at + LOOP_REVISIT_MS }]);
    expect(dueObligationWork(read.view, source.at + LOOP_REVISIT_MS - MINUTE)).toEqual([]);
    expect(dueObligationWork(read.view, source.at + LOOP_REVISIT_MS)).toMatchObject([{ key: 'commitment:0' }]);
    expect(loopHealth(read.view, source.at).revisitMinutes).toBe(24 * 60);
    read.close();
    // The same journal read by the base build itself: the identical schedule, so nothing moved for it.
    writeFileSync(join(temp, 'probe.mjs'), `import { pathToFileURL } from 'node:url';
const base = await import(pathToFileURL(${JSON.stringify(join(checkout, 'tests/preview/journal.ts'))}).href);
const journal = base.openPreviewJournal(${JSON.stringify(join(seed, 'journal.encrypted'))},
  new Uint8Array(32).fill(53), undefined, undefined, true);
process.stdout.write(JSON.stringify(base.obligationSchedule(journal.view)));
journal.close();
`);
    const probe = await spawnAsync(process.execPath, ['--no-warnings', '--loader', './scripts/slice-ts-loader.mjs',
      join(temp, 'probe.mjs')], { cwd: checkout, encoding: 'utf8', timeout: 60000 });
    expect(probe.status, probe.stderr).toBe(0);
    expect(JSON.parse(probe.stdout)).toMatchObject([{ key: 'commitment:0', slot: source.at + LOOP_REVISIT_MS }]);
  } finally { rmSync(temp, { recursive: true, force: true }); }
}, 180_000);

it('leaves every other duration that shared the day-long constant where it was', () => {
  // The interval is the only thing this change moves. These three share the same number and are deliberately
  // untouched: a stop challenge's life, the window a stale runner row is still listed in, and the quiet gap
  // that makes a message a resumption. Group D's second half depends on none of them — it waits only for the
  // revisit of one open loop with no inbound message.
  const source = readFileSync(join(process.cwd(), 'tests/preview/journal.ts'), 'utf8');
  expect(source).toContain('export const STOP_CHALLENGE_MS = 86_400_000;');
  expect(source).toContain('export const CONCURRENT_WORK_WINDOW_MS = 24 * 3_600_000;');
  expect(source).toContain('elapsed >= 86_400_000');
  // And the default itself is still a day: a root that names no interval is exactly where it was.
  expect(LOOP_REVISIT_MS).toBe(24 * 3_600_000);
  // No use of the constant is left in the scheduling or due computations: those read the root's value.
  const scheduling = source.slice(source.indexOf('export function obligationSchedule'));
  expect(scheduling.slice(0, scheduling.indexOf('export const dueObligationWork'))).not.toContain('LOOP_REVISIT_MS');
  const obligations = readFileSync(join(process.cwd(), 'tests/preview/obligations.ts'), 'utf8');
  expect(obligations).not.toContain('LOOP_REVISIT_MS');
});
