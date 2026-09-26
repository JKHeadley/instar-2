import { expect, it } from 'vitest';
import { appendFileSync, mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { performance } from 'node:perf_hooks';
import { createJournalWorker, openPreviewJournal, raiseJournalCaps } from './journal.js';
import { appendRun, readRuns, selfState, selfStateSource } from './self-state.js';

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
    // The zone is stated, never assumed: an hour past local midnight nothing from "yesterday" counts.
    expect(selfState(w.journal.view, readRuns(runs), clock, 'UTC', run3)).toContain('(time zone UTC; "today" means 2026-09-26 there)');
    expect(selfState(w.journal.view, readRuns(runs), NOON + 13 * 3_600_000, 'America/Los_Angeles', run3))
      .toContain('Operator messages received: 0 today, 5 in this trial');
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
