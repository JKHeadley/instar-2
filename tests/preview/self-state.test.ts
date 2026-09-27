import { expect, it } from 'vitest';
import { appendFileSync, mkdtempSync, readFileSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { performance } from 'node:perf_hooks';
import { spawnSync } from 'node:child_process';
import { createJournalWorker, openPreviewJournal, raiseJournalCaps } from './journal.js';
import { appendRun, heldRepliesToday, readRuns, selfState, selfStateSource } from './self-state.js';

const key = new Uint8Array(32).fill(4);
// 2026-09-26 19:00 UTC = 12:00 PDT.
const NOON = Date.UTC(2026, 8, 26, 19, 0);
const genesis = { kind: 'genesis' as const, bot: '12345678', chat: '7654321', operator: '7654321', grant: 'grant:preview',
  configurationDigest: 'sha256:offline', expires: Date.UTC(2026, 8, 28, 20, 40), maxCalls: 3, maxReplies: 3, maxTurns: 6,
  maxBytes: 32768, cursor: 0 };
const update = (id: number, text: string, at: number) => ({ update_id: id,
  message: { chat: { id: 7654321, type: 'private' }, from: { id: 7654321 }, text, date: Math.floor(at / 1000) } });

it('derives an honest self-state from the journal and run log, correct across a restart and a raised cap', async () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'preview-self-')));
  const path = join(root, 'journal.encrypted'), runs = join(root, 'runs.jsonl');
  let clock = NOON - 20 * 3_600_000; // yesterday 16:00 PDT
  const world = () => {
    const journal = openPreviewJournal(path, key, genesis);
    const seen: string[] = [];
    const worker = createJournalWorker(journal, { now: () => clock, stopped: () => false,
      model: async input => { seen.push(input.context); return 'ok'; }, send: async () => 7, checkOutbound: () => {} });
    return { journal, worker, seen };
  };
  try {
    // Run 1: launched yesterday, two turns yesterday, then paused by SIGTERM.
    const run1 = clock; appendRun(runs, { v: 1, launch: run1, pid: 1 });
    let w = world();
    w.worker.intake([update(1, 'hello', clock)]); await w.worker.drain();
    w.worker.intake([update(2, 'again', clock)]); await w.worker.drain();
    w.journal.close();
    appendRun(runs, { v: 1, launch: run1, exit: clock + 60_000, reason: 'paused by signal SIGTERM' });
    // Run 2 today at 08:00 PDT, one turn, then the model-attempt cap holds the next.
    clock = NOON - 4 * 3_600_000;
    const run2 = clock; appendRun(runs, { v: 1, launch: run2, pid: 2 });
    w = world();
    w.worker.intake([update(3, 'today one', clock)]); await w.worker.drain();
    w.worker.intake([update(4, 'today two', clock)]); await w.worker.drain();
    expect(w.journal.view.order.at(-1)!.held).toBe('call cap');
    let text = selfState(w.journal.view, readRuns(runs), clock, 'America/Los_Angeles', run2);
    expect(text).toContain('Operator messages received: 2 today, 4 in this trial');
    expect(text).toContain('My replies Telegram accepted: 1 today, 3 in this trial');
    expect(text).toContain('Model attempts: 3 of 3 used, 0 left');
    expect(text).toContain('Held messages: 1 (call cap)');
    expect(text).toContain('Replies held today: 1. Reasons: 1 (call cap). Update 4: call cap (still held).');
    expect(text).toContain('Caps have not been raised');
    expect(text).toContain('Last restart: 2026-09-26 08:00 PDT. The run before it started 2026-09-25 16:00 PDT and ended 2026-09-25 16:01 PDT: paused by signal SIGTERM.');
    w.journal.close(); // Run 2 dies without recording an end (crash).
    // The operator raises caps; run 3 starts at 11:30 PDT, releases the hold and answers it.
    clock = NOON - 30 * 60_000;
    const capJournal = openPreviewJournal(path, key);
    raiseJournalCaps(capJournal, { maxCalls: 8, maxReplies: 8, maxTurns: 10, authority: 'Justin, topic 52075', at: clock - 60_000 });
    capJournal.close();
    const run3 = clock; appendRun(runs, { v: 1, launch: run3, pid: 3 });
    clock = NOON;
    w = world();
    await w.worker.drain();
    w.worker.intake([update(5, 'how many messages today and when did you last restart?', clock)]);
    const probeState = selfState(w.journal.view, readRuns(runs), clock, 'America/Los_Angeles', run3);
    await w.worker.drain();
    expect(w.journal.view.order.every(turn => turn.sent === 7)).toBe(true);
    expect(probeState).toContain('Operator messages received: 3 today, 5 in this trial (including the one being answered now)');
    expect(probeState).toContain('My replies Telegram accepted: 2 today, 4 in this trial');
    expect(probeState).toContain('Messages exchanged today: 5');
    expect(probeState).toContain('Model attempts: 4 of 8 used, 4 left');
    expect(probeState).toContain('Caps last raised 2026-09-26 11:29 PDT on the authority "Justin, topic 52075"');
    expect(probeState).toContain('This run started 2026-09-26 11:30 PDT; uptime 30m.');
    expect(probeState).toContain('Last restart: 2026-09-26 11:30 PDT. The run before it started 2026-09-26 08:00 PDT and ended without recording why (crash, kill or power loss).');
    expect(probeState).toContain('Launches recorded: 3 (2 today)');
    expect(probeState).toContain('Unknown outcomes (never retried): 0 model call(s), 0 send(s).');
    expect(probeState).toContain('Replies held today: 1. Reasons: 1 (call cap). Update 4: call cap (released).');
    // The zone is stated, never assumed: an hour past local midnight nothing from "yesterday" counts.
    expect(selfState(w.journal.view, readRuns(runs), clock, 'UTC', run3)).toContain('(time zone UTC; "today" means 2026-09-26 there)');
    expect(selfState(w.journal.view, readRuns(runs), NOON + 13 * 3_600_000, 'America/Los_Angeles', run3))
      .toContain('Operator messages received: 0 today, 5 in this trial');
    expect(selfState(w.journal.view, readRuns(runs), NOON + 13 * 3_600_000, 'America/Los_Angeles', run3))
      .toContain('Replies held today: 0.');
    // A read-only status view, with no current launch, reports the latest launch honestly.
    const status = selfState(w.journal.view, readRuns(runs), clock, 'America/Los_Angeles');
    expect(status).toContain('Latest launch 2026-09-26 11:30 PDT has no recorded end: it is running, or ended without recording why.');
    const source = selfStateSource(probeState);
    expect(source.id).toBe('self-state');
    expect(source.text).toContain('derived only from durable records');
    w.journal.close();
    // A torn trailing line is counted and never invents a run.
    appendFileSync(runs, '{"v":1,"launch":');
    expect(readRuns(runs).unreadable).toBe(1);
    expect(readRuns(runs).launches).toHaveLength(3);
    expect(selfState(openPreviewJournal(path, key, undefined, undefined, true).view, readRuns(runs), clock, 'UTC'))
      .toContain('Run log lines unreadable: 1.');
  } finally { rmSync(root, { recursive: true, force: true }); }
});

it('says uptime and restarts are unknown when no launch was recorded, and marks UNKNOWN effects', async () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'preview-self-')));
  try {
    const journal = openPreviewJournal(join(root, 'journal.encrypted'), key, genesis);
    const worker = createJournalWorker(journal, { now: () => NOON, stopped: () => false,
      model: async () => { throw Error('lost'); }, send: async () => null, checkOutbound: () => {} });
    worker.intake([update(1, 'hi', NOON)]); await worker.drain();
    const text = selfState(journal.view, readRuns(join(root, 'runs.jsonl')), NOON, 'UTC');
    expect(text).toContain('Run history: no launch has been recorded, so uptime and restarts are unknown.');
    expect(text).toContain('Unknown outcomes (never retried): 1 model call(s), 0 send(s).');
    expect(() => selfState(journal.view, readRuns(join(root, 'runs.jsonl')), NOON, 'Mars/Olympus')).toThrow(RangeError);
    journal.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
});

it('status replays distinct replies held on the local day and gives each journal reason', () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'preview-held-status-')));
  const now = Date.now(), dayStart = Math.floor(now / 86_400_000) * 86_400_000;
  try {
    const journal = openPreviewJournal(join(root, 'journal.encrypted'), key, { ...genesis, expires: now + 86_400_000 });
    const worker = createJournalWorker(journal, { now: () => now, stopped: () => false,
      model: async () => 'unused', send: async () => null, checkOutbound: () => {} });
    worker.intake([update(1, 'earlier question', dayStart - 3_600_000), update(2, 'today question', dayStart)]);
    const [earlier, today] = journal.view.order;
    journal.append({ kind: 'hold', id: earlier!.id, reason: 'reply cap', at: dayStart - 1_000 });
    journal.append({ kind: 'hold', id: earlier!.id, reason: 'call cap', at: dayStart });
    journal.append({ kind: 'hold', id: today!.id, reason: 'reply check unavailable', at: dayStart });
    journal.append({ kind: 'hold', id: today!.id, reason: 'reply cap', at: dayStart });
    journal.close();
    const status = spawnSync(process.execPath,
      ['--no-warnings', '--loader', './scripts/slice-ts-loader.mjs', 'tests/preview/journal-agent.mjs',
        'status', '--root', root, '--time-zone', 'UTC'],
      { cwd: process.cwd(), env: { ...process.env, INSTAR_SECRET_PREVIEW_STORAGE_KEY: Buffer.from(key).toString('hex') },
        encoding: 'utf8', timeout: 10_000 });
    expect(status.status, status.stderr).toBe(0);
    const result = JSON.parse(status.stdout);
    expect(result.heldRepliesToday).toEqual({ count: 2, replies: [
      { update: 1, reasons: ['call cap'], stillHeld: true },
      { update: 2, reasons: ['reply check unavailable', 'reply cap'], stillHeld: true },
    ] });
    expect(result.self).toContain('Replies held today: 2. Reasons: 1 (call cap), 1 (reply check unavailable), 1 (reply cap). '
      + 'Update 1: call cap (still held). '
      + 'Update 2: reply check unavailable; reply cap (still held).');
    expect(result.holds).toEqual([{ update: 1, reason: 'call cap' }, { update: 2, reason: 'reply cap' }]);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

it('excludes summary work on delivered turns while retaining a real reply hold after delivery', async () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'preview-held-summary-')));
  try {
    const journal = openPreviewJournal(join(root, 'journal.encrypted'), key, { ...genesis, maxCalls: 1 });
    const worker = createJournalWorker(journal, { now: () => NOON, stopped: () => false,
      model: async () => 'ok', send: async () => 1, checkOutbound: () => {} });
    worker.intake([update(1, 'first', NOON)]); await worker.drain();
    const first = journal.view.order[0]!;
    journal.append({ kind: 'hold', id: first.id, reason: 'summary oversized turn', at: NOON });
    expect(heldRepliesToday(journal.view, NOON, 'UTC')).toEqual({ count: 0, replies: [] });
    expect(selfState(journal.view, { launches: [], unreadable: 0 }, NOON, 'UTC')).toContain('Replies held today: 0.');
    worker.intake([update(2, 'second', NOON)]);
    const second = journal.view.order[1]!;
    await worker.drain();
    expect(second.held).toBe('call cap');
    raiseJournalCaps(journal, { maxCalls: 4, maxReplies: 4, maxTurns: 7, authority: 'Justin recorded raise', at: NOON });
    await worker.drain();
    expect(second.sent).toBe(1);
    journal.append({ kind: 'hold', id: second.id, reason: 'summary preflight unavailable', at: NOON });
    expect(heldRepliesToday(journal.view, NOON, 'UTC')).toEqual({ count: 1, replies: [
      { update: 2, reasons: ['call cap'], stillHeld: false },
    ] });
    expect(selfState(journal.view, { launches: [], unreadable: 0 }, NOON, 'UTC'))
      .toContain('Replies held today: 1. Reasons: 1 (call cap). Update 2: call cap (released).');
    journal.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
});

it('keeps the model briefing bounded after many released holds and a completed summary', async () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'preview-held-many-')));
  try {
    const journal = openPreviewJournal(join(root, 'journal.encrypted'), key,
      { ...genesis, maxCalls: 300, maxReplies: 300, maxTurns: 300, maxBytes: 6144 });
    const intake = createJournalWorker(journal, { now: () => NOON, stopped: () => false,
      model: async () => 'unused', send: async () => 1, checkOutbound: () => {} });
    for (let i = 1; i <= 200; i++) {
      intake.intake([update(i, 'hello', NOON)]);
      const id = journal.view.order.at(-1)!.id;
      journal.append({ kind: 'hold', id, reason: 'call cap', at: NOON });
      journal.append({ kind: 'reserve', id, at: NOON });
      journal.append({ kind: 'answer', id, text: 'ok', at: NOON });
      journal.append({ kind: 'intent', id, text: 'PREVIEW — ok', chat: genesis.chat,
        update: i, grant: genesis.grant, at: NOON });
      journal.append({ kind: 'sent', id, message: i, at: NOON });
    }
    journal.append({ kind: 'summary-reserve', through: 200, at: NOON });
    journal.append({ kind: 'summary', through: 200, text: 'Earlier hello messages.', at: NOON });
    const held = heldRepliesToday(journal.view, NOON, 'UTC');
    expect(held).toMatchObject({ count: 200 });
    expect(held.replies).toHaveLength(200);
    const briefing = selfState(journal.view, { launches: [], unreadable: 0 }, NOON, 'UTC');
    expect(briefing).toContain('Replies held today: 200. Reasons: 200 (call cap).');
    expect(briefing).toContain('195 more reply details omitted; full reasons are in read-only status.');
    expect(Buffer.byteLength(briefing)).toBeLessThan(4000);
    const worker = createJournalWorker(journal, { now: () => NOON, stopped: () => false,
      sources: () => [selfStateSource(selfState(journal.view, { launches: [], unreadable: 0 }, NOON, 'UTC'))],
      model: async () => 'ok', send: async () => 1, checkOutbound: () => {} });
    const probe = worker.probe('How many replies were held today?');
    expect(probe).toHaveProperty('context');
    expect('context' in probe ? Buffer.byteLength(probe.context) : Infinity).toBeLessThan(6144);
    worker.intake([update(201, 'next reply', NOON)]);
    await worker.drain();
    expect(journal.view.order.at(-1)?.sent).toBe(1);
    journal.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
}, 120000);

it('recovers a new launch after a torn tail and counts malformed rows without hiding damage', () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'preview-self-')));
  const path = join(root, 'runs.jsonl'), old = NOON - 3_600_000, current = NOON;
  try {
    appendRun(path, { v: 1, launch: old, pid: 1 });
    appendRun(path, { v: 1, launch: old, exit: old + 60_000, reason: 'paused by signal SIGTERM' });
    appendFileSync(path, '{"v":1,"launch":');
    appendRun(path, { v: 1, launch: current, pid: 2 });
    appendFileSync(path, 'null\n');
    const raw = readFileSync(path, 'utf8');
    expect(raw).toContain('{"v":1,"launch":\n');
    const log = readRuns(path);
    expect(log.launches.map(run => run.at)).toEqual([old, current]);
    expect(log.unreadable).toBe(2);
    const journal = openPreviewJournal(join(root, 'journal.encrypted'), key, genesis);
    const text = selfState(journal.view, log, current, 'America/Los_Angeles', current);
    expect(text).toContain('This run started 2026-09-26 12:00 PDT; uptime 0m.');
    expect(text).toContain('Run log lines unreadable: 2.');
    expect(text).toContain('run history is incomplete');
    journal.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
});

it('keeps per-turn self-state overhead in milliseconds at the journal frame scale', async () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'preview-self-')));
  try {
    const journal = openPreviewJournal(join(root, 'journal.encrypted'), key, { ...genesis, maxCalls: 2000, maxReplies: 2000, maxTurns: 2000 });
    const worker = createJournalWorker(journal, { now: () => NOON, stopped: () => false,
      model: async () => 'ok', send: async () => 1, checkOutbound: () => {} });
    // Intake only: every one of these turns is inside the 26-hour window the self-state formats.
    for (let i = 1; i <= 2000; i++) worker.intake([update(i, `turn ${String(i)}`, NOON - (2000 - i) * 45_000)]);
    const runs = join(root, 'runs.jsonl');
    for (let i = 0; i < 20; i++) appendRun(runs, { v: 1, launch: NOON - (20 - i) * 3_600_000, pid: i });
    const log = readRuns(runs), samples: number[] = [];
    for (let i = 0; i < 200; i++) {
      const start = performance.now();
      selfStateSource(selfState(journal.view, log, NOON, 'America/Los_Angeles', log.launches.at(-1)!.at));
      samples.push(performance.now() - start);
    }
    const p95 = samples.sort((a, b) => a - b)[Math.ceil(samples.length * .95) - 1]!;
    process.stdout.write(`self-state at 2000 turns: p95=${p95.toFixed(2)} ms\n`);
    expect(p95).toBeLessThan(25);
    journal.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
}, 60000);

it('carries the self-state in every packet after rolling summaries take over the history', async () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'preview-self-')));
  const runs = join(root, 'runs.jsonl');
  try {
    appendRun(runs, { v: 1, launch: NOON, pid: 1 });
    const journal = openPreviewJournal(join(root, 'journal.encrypted'), key,
      { ...genesis, maxCalls: 80, maxReplies: 40, maxTurns: 40, maxBytes: 6144 });
    const packets: { id: string; packet: { historyMode: string; sources?: { id: string; text: string }[] } }[] = [];
    const worker = createJournalWorker(journal, { now: () => NOON, stopped: () => false,
      sources: () => [selfStateSource(selfState(journal.view, readRuns(runs), NOON, 'UTC', NOON))],
      model: async input => { if (!input.id.startsWith('summary:')) packets.push({ id: input.id, packet: JSON.parse(input.context) });
        return input.id.startsWith('summary:') ? 'An ordinary conversation about errands.' : 'ok'; },
      send: async () => 1, checkOutbound: () => {} });
    for (let i = 1; i <= 30; i++) {
      worker.intake([update(i, `ordinary turn ${String(i)} ${'e'.repeat(300)}`, NOON)]);
      await worker.drain(); await worker.summarizeIfNeeded();
    }
    expect(journal.view.order.every(turn => turn.sent === 1)).toBe(true);
    expect(journal.view.summaries.length).toBeGreaterThan(0);
    expect(packets).toHaveLength(30);
    for (const { packet } of packets) expect(packet.sources?.map(source => source.id)).toContain('self-state');
    const late = packets.filter(({ packet }) => packet.historyMode === 'summary-plus-recent');
    expect(late.length).toBeGreaterThan(0);
    const self = late.at(-1)!.packet.sources!.find(source => source.id === 'self-state')!;
    expect(self.text).toMatch(/Summaries: [1-9]/);
    expect(self.text).toContain('This run started 2026-09-26 19:00 UTC');
    journal.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
});
