import { execFileSync, spawn, type ChildProcess } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, expect, it } from 'vitest';
import { liveWorker, stalled, looping } from '../assembly/conversation-recovery-fixture.js';
// @ts-expect-error Physical host boundary is JavaScript.
import { createHostWorktreeRecovery, queryWorktreeHost } from '../../scripts/host-worktree-recovery.mjs';
import { createJournalWorktreeIntake } from './worktree-recovery-intake.js';
import { createJournalWorker, openPreviewJournal, previewTestContext } from './journal-test-worker.js';
const shipped = readFileSync(new URL('./journal-agent.mjs', import.meta.url), 'utf8');

const roots: string[] = [], children: ChildProcess[] = [];
afterEach(() => { for (const child of children.splice(0)) if (child.exitCode === null) child.kill('SIGTERM');
  for (const path of roots.splice(0)) rmSync(path, { recursive: true, force: true }); });

async function setup(dirty = true) {
  const directory = realpathSync(mkdtempSync(join(tmpdir(), 'host-worktree-'))); roots.push(directory);
  const checkout = join(directory, 'checkout'); mkdirSync(checkout);
  const git = (...args: string[]) => execFileSync('git', ['-C', checkout, ...args], { encoding: 'utf8' });
  git('init', '--quiet'); writeFileSync(join(checkout, 'base'), 'base'); git('add', 'base');
  git('-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.test', 'commit', '--quiet', '-m', 'base');
  const captured = readFileSync(new URL('./fixtures/retrospective-duty-followup-train-1-2026-10-08.json', import.meta.url), 'utf8');
  if (dirty) writeFileSync(join(checkout, 'retained-work.json'), captured);
  let now = 1000, stopped = false, missingUid = false, partial = false, unknownSource = false;
  let snapshot: unknown = null;
  const watchEvents: { change?: () => void; error?: () => void } = {};
  const journalPath = join(directory, 'journal.encrypted'), key = new Uint8Array(32).fill(31);
  const open = () => openPreviewJournal(journalPath, key, { kind: 'genesis', bot: '12345678', chat: '7654321', operator: '7654321',
    grant: 'grant:preview', configurationDigest: 'sha256:offline', expires: 9999999999999,
    maxCalls: 20, maxReplies: 20, maxTurns: 30, maxBytes: 1048576, cursor: 0 });
  let journal = open();
  const worker = () => createJournalWorker(journal, { now: () => now, stopped: () => stopped,
    model: async input => {
      if (input.question.includes(checkout)) {
        const recovered = JSON.parse(readFileSync(join(checkout, 'retained-work.json'), 'utf8')) as { otherShapes: { kind: string; id: string; raw: string }[] };
        expect(recovered.otherShapes.map(row => row.kind)).toEqual(['summary-writer', 'summary-uncertain', 'jev-undecided', 'jev-unsure', 'reply-review', 'delivered-reply', 'empty-reply-in-recorded-context']);
        expect(recovered.otherShapes.at(-1)!.raw).toBe('');
      }
      return JSON.stringify({ reply: 'The retained work is available for reconciliation.', memory: [] });
    }, checkOutbound: () => {}, send: async () => 900 });
  await worker().intake([{ update_id: 1, message: { message_id: 1, chat: { id: 7654321, type: 'private' }, from: { id: 7654321 }, text: 'Continue my checkout work.' } }]);
  const source = journal.view.order[0]!.id;
  const child = spawn(process.execPath, ['-e', 'process.stdin.resume()'], { cwd: checkout, stdio: ['pipe', 'ignore', 'ignore'] });
  children.push(child); await new Promise<void>(resolve => child.once('spawn', resolve));
  const route = { channel: 'host-worktree-observer', sender: 'm', identityEpoch: 'conversation' };
  const config = {
    scope: directory, identity: { machine: 'm', hardwareProfile: 'fixture' }, now: () => now, monotonic: () => now,
    stopped: () => stopped, workerUid: () => missingUid ? null : process.getuid!(),
    store: { load: () => snapshot, save: (next: unknown) => { snapshot = structuredClone(next); } }, route,
    intake: (sourceFor: (path: string) => string | null) => createJournalWorktreeIntake({ journal, context: previewTestContext,
      route, machine: 'm', now: () => now, stopped: () => stopped, sourceFor, checkText: () => {} }),
    // The test's isolated process population is this real child, not invented ps bytes.
    query: async (file: string, args: string[]) => {
      if (file === '/bin/ps' && args.includes('-e')) return execFileSync(file, args, { encoding: 'utf8' });
      if (file === '/bin/ps') {
        if (partial) return 'unreadable row\n';
        return child.exitCode !== null ? '' : execFileSync('/bin/ps', ['-p', String(child.pid), '-ww', '-o', args.at(-1)!], { encoding: 'utf8' });
      }
      if (file === '/usr/sbin/lsof') return queryWorktreeHost(file, args);
      return execFileSync(file, args, { encoding: 'utf8', timeout: 5000 });
    },
    liveSources: async () => child.exitCode !== null || unknownSource ? [] : [{ pid: child.pid, source }],
    watch: (_path: string, _options: unknown, change: () => void) => {
      watchEvents.change = change; return { on: (_event: string, fail: () => void) => { watchEvents.error = fail; }, close() {} };
    },
  };
  const factoryBody = shipped.slice(shipped.indexOf("      if (conversationSession) {\n        const route = { channel: 'host-worktree-observer'"),
    shipped.indexOf('      const configurationFor = (topic, binding, handoff = null) => {'));
  const build = async () => {
    const physical = { load: () => ({ sessions: [{ name: 'worker', identity: `worker:${process.pid}:1`, closedAt: child.exitCode === null ? null : now }],
      deliveries: [{ identity: `worker:${process.pid}:1`, state: 'accepted', intake: source }] }),
      tmux: () => ({ code: unknownSource ? 1 : 0, stdout: `${process.pid}:1` }) };
    // Execute the shipped constructor binding; only OS I/O and clock are injected.
    const names = ['conversationSession', 'project', 'HOST_IDENTITY', 'wallNow', 'clock', 'hostStopped', 'sessionHarness',
      'createConversationHostStore', 'join', 'root', 'key', 'ownerMachine', 'conversationOf', 'g', 'journal', 'context',
      'redact', 'physicalFor', 'createHostWorktreeRecovery', 'createJournalWorktreeIntake'];
    const make = Function(...names, `return async () => { let worktreeRecovery; ${factoryBody}; return worktreeRecovery; }`)(
      true, directory, config.identity, config.now, { elapsed: config.monotonic }, config.stopped,
      { current: () => ({ uid: config.workerUid() }) }, () => config.store, join, directory, () => key, 'm', () => 'conversation', {},
      journal, previewTestContext, (text: string) => ({ text }), () => physical,
      (ports: object) => createHostWorktreeRecovery({ ...ports, query: config.query, watch: config.watch,
        // An unknown root is a failed physical identity observation, never a name-based owner.
        ...(unknownSource ? { liveSources: async () => [] } : {}) }), createJournalWorktreeIntake);
    return make();
  };
  let host = await build();
  const exit = async () => { const done = new Promise<void>(resolve => child.once('exit', () => resolve())); child.stdin!.end(); await done; };
  const cycle = async () => {
    const jobs: Promise<unknown>[] = [];
    const body = shipped.split('const workCycle = ')[1]!.split('\n    // One disposable wake')[0]!.trim().replace(/;$/u, '');
    const environment = { journal, ownerHeld: () => true, activationMatchesJournal: () => true, activation: {},
      sentinels: { observeWork() {} }, worktreeRecovery: { tick: () => { const job = host.tick(); jobs.push(job); return job; } },
      revivalAttention: { audit: (_topic: string, event: unknown) => { throw Error(JSON.stringify(event)); } }, redact: (text: string) => ({ text }),
      sentinelCycle: (_lane: unknown, pass: { drain(): Promise<void> }) => { jobs.push(pass.drain()); },
      lane: {}, sentinelTick() {}, sentinelSteps: [], conversationSession: true,
      sessionWork: { port: { maintain: async () => {} } }, worker: { drain: async () => {}, sendRequested: async () => {} } };
    Function('environment', `with (environment) { return (${body}); }`)(environment)();
    await Promise.all(jobs);
  };
  return { checkout, source, config, worker, cycle, get journal() { return journal; }, get host() { return host; }, captured, watchEvents,
    now: (n: number) => { now = n; }, stop: () => { stopped = true; }, partial: () => { partial = true; },
    unknown: () => { unknownSource = true; }, missingUid: () => { missingUid = true; }, exit,
    restart: async () => { host.close(); journal.close(); journal = open(); host = await build(); },
    close: () => { host.close(); journal.close(); } };
}

it('admits a real dirty checkout through signed durable intake after exact process exit, once across restart', async () => {
  const f = await setup();
  try {
    await f.cycle(); expect(f.host.sourceFor(f.checkout)).toBe(f.source);
    await f.exit(); f.now(32000);
    await f.cycle();
    expect(f.journal.view.order.filter(turn => turn.worktreeRecovery)).toHaveLength(1);
    const turn = f.journal.view.order.at(-1)!;
    expect(turn.writer).toMatchObject({ kind: 'system', class: 'verified' });
    expect(turn.text).toContain(f.checkout); expect(turn.worktreeRecovery?.source).toBe(f.source);
    await f.worker().drain(); await f.worker().drain();
    const consumed = f.journal.view.turns.get(turn.id)!;
    expect(consumed.sent).toBe(900);
    expect(f.journal.view.memory).toEqual([]);
    // Lose only the observer cache's admission marker, as if its save failed
    // after the journal had already committed intake.
    const state = f.config.store.load() as { checkouts: Record<string, { admittedSource?: string }> };
    delete state.checkouts[f.checkout]!.admittedSource;
    f.config.store.save(state);
    f.journal.compact(); await f.restart(); f.now(63000);
    f.watchEvents.change?.(); f.now(94000);
    expect((await f.host.tick()).length).toBe(1); // journal returns duplicate, no new turn
    f.now(125000);
    expect(await f.host.tick()).toEqual([]);
    f.watchEvents.change?.(); f.now(94000);
    expect(await f.host.tick()).toEqual([]); // its own recovery activity never creates another request
    expect(f.journal.view.order.filter(turn => turn.worktreeRecovery)).toHaveLength(1);
    expect(readFileSync(join(f.checkout, 'retained-work.json'), 'utf8')).toBe(f.captured);
  } finally { f.close(); }
});

it.each(['clean', 'live', 'unknown', 'partial', 'activity-gap', 'recent', 'missing-identity', 'stop'])(
  'does not create recovery intake for %s evidence', async neighbor => {
    const f = await setup(neighbor !== 'clean');
    try {
      if (neighbor === 'unknown') f.unknown();
      if (neighbor === 'missing-identity') f.missingUid();
      await f.host.tick();
      if (neighbor !== 'live') await f.exit();
      f.now(32000);
      if (neighbor === 'partial') f.partial();
      if (neighbor === 'activity-gap') f.watchEvents.error?.();
      if (neighbor === 'recent') f.watchEvents.change?.();
      if (neighbor === 'stop') f.stop();
      expect(await f.host.tick()).toEqual([]);
      expect(f.journal.view.order.filter(turn => turn.worktreeRecovery)).toHaveLength(0);
    } finally { f.close(); }
  });


it('reads an empty real ps selection while retaining diagnostic failures as unknown', async () => {
  const child = spawn(process.execPath, ['-e', ''], { stdio: 'ignore' });
  children.push(child);
  await new Promise<void>(resolve => child.once('exit', () => resolve()));
  expect(await queryWorktreeHost('/bin/ps', ['-p', String(child.pid), '-o', 'pid='])).toBe('');
  expect(await queryWorktreeHost('/bin/ps', ['--not-a-valid-option-for-this-census'])).toBeNull();
});

it.each(['exit', 'stall', 'error-loop', 'context-wall'])('%s loss reaches the signed topic and exact retained checkout through shipped wiring', async origin => {
  const checkout = await setup();
  try {
    await checkout.cycle();
    const binding = shipped.match(/retiredWorktree: (async \(\) => \{[^\n]+\})/u)?.[1];
    expect(binding).toBeDefined();
    const retired = Function('worktreeRecovery', `return (${binding})`)(checkout.host) as () => Promise<void>;
    let notifications = 0;
    const session = liveWorker({ retiredWorktree: async () => {
      notifications++;
      if (notifications === 1) { await checkout.exit(); checkout.now(32000); }
      await retired();
    } });
    if (origin === 'stall') session.transcript(stalled(session.now()));
    if (origin === 'error-loop') session.transcript(looping(session.now()));
    if (origin === 'context-wall') { session.wall('context-too-long'); session.compaction('replace-required'); }
    session.finishWhen(() => { if (origin === 'exit' && session.launches.length === 1) session.loseWorker(); return session.launches.length >= 2; });
    expect(await session.port.run(session.request('origin-checkout'))).toMatchObject({ state: 'complete' });
    expect(notifications).toBe(1);
    const recovery = checkout.journal.view.order.at(-1)!;
    expect(recovery.worktreeRecovery?.source).toBe(checkout.source);
    expect(recovery.text).toContain(checkout.checkout);
    await checkout.worker().drain(); await checkout.worker().drain();
    expect(checkout.journal.view.turns.get(recovery.id)?.sent).toBe(900);
    expect(readFileSync(join(checkout.checkout, 'retained-work.json'), 'utf8')).toBe(checkout.captured);
    await session.port.close();
  } finally { checkout.close(); }
});
