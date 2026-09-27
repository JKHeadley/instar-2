import { expect, it } from 'vitest';
import { appendFileSync, mkdtempSync, readFileSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { performance } from 'node:perf_hooks';
import { createJournalWorker, openPreviewJournal, raiseJournalCaps } from './journal-test-worker.js';
import { prepareJournalEnvelope } from './journal-envelope.js';
import { appendRun, memoryHealthLine, readRuns, restartHandoff, selfState, selfStateSource } from './self-state.js';


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
    expect(probeState).toContain('0 turn-model calls and 0 summary-model calls without a durable result');
    expect(probeState).toContain('0 Telegram sends without a durable result');
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
    expect(text).toContain('1 turn-model calls and 0 summary-model calls without a durable result');
    expect(text).toContain('0 Telegram sends without a durable result');
    expect(() => selfState(journal.view, readRuns(join(root, 'runs.jsonl')), NOON, 'Mars/Olympus')).toThrow(RangeError);
    journal.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
});

it('counts memory health from recorded prompt evidence and journal dispositions across replay', () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'preview-health-')));
  const path = join(root, 'journal.encrypted');
  try {
    const journal = openPreviewJournal(path, key, genesis);
    const worker = createJournalWorker(journal, { now: () => NOON, stopped: () => false,
      model: async () => 'unused', send: async () => 1, checkOutbound: () => {} });
    for (const [index, text] of ['old', 'new', 'turn 3'].entries()) worker.intake([update(index + 1, text, NOON)]);
    const [first, second, third] = journal.view.order;
    const prompt = (id: string, packet: object) => prepareJournalEnvelope({ question: 'health', context: JSON.stringify(packet), id },
      'claude-offline-exact-1', genesis.grant, NOON);
    journal.append({ kind: 'reserve', id: first!.id, prompt: prompt(first!.id, { recalled: [{ id: 'old-1' }, { id: 'old-2' }],
      channelMemory: [{ id: 'channel-1' }] }), at: NOON });
    journal.append({ kind: 'answer', id: first!.id, text: 'old', at: NOON });
    journal.append({ kind: 'intent', id: first!.id, text: 'PREVIEW — old', chat: genesis.chat,
      update: first!.update, grant: genesis.grant, at: NOON });
    journal.append({ kind: 'reserve', id: second!.id, at: NOON }); // older journal had no prepared prompt
    journal.append({ kind: 'answer', id: second!.id, text: 'pending', memoryPending: true, at: NOON });
    journal.append({ kind: 'hold', id: second!.id, reason: 'memory correction pending', at: NOON });
    journal.append({ kind: 'reserve', id: third!.id, prompt: prompt(third!.id, {}), at: NOON });
    journal.append({ kind: 'channel-item', item: { source: 'conversation', account: 'owned-account', id: 'item-1',
      from: 'operator', at: NOON, text: 'older fact' }, at: NOON });
    journal.append({ kind: 'summary-reserve', through: 1, at: NOON });
    journal.append({ kind: 'summary', through: 1, text: 'first turn', at: NOON });
    expect(memoryHealthLine(journal.view)).toContain('1 unresolved operator memory corrections');
    journal.append({ kind: 'summary-reserve', through: 2, at: NOON });
    journal.append({ kind: 'summary', through: 2, text: 'corrected fact', memoryFor: [second!.id],
      memory: [{ mode: 'correct', source: first!.id, trigger: second!.id, quote: 'old', replacement: 'new' }], at: NOON });
    journal.append({ kind: 'summary-reserve', through: 3, at: NOON });
    const expected = memoryHealthLine(journal.view);
    expect(expected).toContain('1 journal turns currently held; 2 summaries, 2 accepted operator turns covered by latest summary (through Telegram update 2)');
    expect(expected).toContain('2 original-turn recall-sentinel hits and 1 channel-item recall-sentinel hits in 2 recorded model prompts (1 unmeasured legacy prompts)');
    expect(expected).toContain('1 old-claim items withheld; 0 unresolved operator memory corrections');
    expect(expected).toContain('0 channel-import cursors recorded (1 imported channel items; fixture import has no source cursor)');
    expect(expected).toContain('1 turn-model calls and 1 summary-model calls without a durable result');
    expect(expected).toContain('1 Telegram sends without a durable result');
    expect(expected).not.toContain('older fact');
    expect(Buffer.byteLength(expected)).toBeLessThan(1024);
    journal.close();
    const replay = openPreviewJournal(path, key, undefined, undefined, true);
    expect(memoryHealthLine(replay.view)).toBe(expected);
    replay.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
});

it('reports the bounded durable work snapshot only after a recorded restart', () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'preview-handoff-')));
  try {
    const journal = openPreviewJournal(join(root, 'journal.encrypted'), key, genesis);
    const worker = createJournalWorker(journal, { now: () => NOON, stopped: () => false,
      model: async () => 'unused', send: async () => 1, checkOutbound: () => {} });
    for (let i = 1; i <= 6; i++) worker.intake([update(i, `private text ${String(i)}`, NOON)]);
    const turns = journal.view.order;
    journal.append({ kind: 'hold', id: turns[0]!.id, reason: 'call cap', at: NOON });
    journal.append({ kind: 'reserve', id: turns[1]!.id, at: NOON });
    journal.append({ kind: 'model-uncertain', id: turns[1]!.id, state: 'uncertain', at: NOON });
    journal.append({ kind: 'notice', id: turns[1]!.id, noticeClass: 'unknown-answer', at: NOON });
    journal.append({ kind: 'reserve', id: turns[2]!.id, at: NOON });
    journal.append({ kind: 'answer', id: turns[2]!.id, text: 'done', at: NOON });
    journal.append({ kind: 'intent', id: turns[2]!.id, text: 'PREVIEW — done', chat: genesis.chat,
      update: 3, grant: genesis.grant, at: NOON });
    journal.append({ kind: 'reserve', id: turns[3]!.id, at: NOON }); // No terminal result: UNKNOWN, but no notice due time.
    const runs = join(root, 'runs.jsonl');
    appendRun(runs, { v: 1, launch: NOON - 60_000, pid: 1 });
    expect(restartHandoff(journal.view, readRuns(runs), NOON - 60_000)).toBeNull();
    appendRun(runs, { v: 1, launch: NOON, pid: 2 });
    const note = restartHandoff(journal.view, readRuns(runs), NOON)!;
    expect(note.id).toBe('restart-handoff');
    expect(note.text).toContain('pending turns 5 (updates 1, 2, 4, …)');
    expect(note.text).toContain('held items 1 (updates 1)');
    expect(note.text).toContain('UNKNOWN model outcomes 2 (updates 2, 4)');
    expect(note.text).toContain('UNKNOWN sends 1 (updates 3)');
    expect(note.text).toContain('lost-answer notices due 1 (updates 2)');
    expect(note.text).toContain('prior run has no recorded end');
    expect(note.text).not.toContain('private text');
    expect(Buffer.byteLength(note.text)).toBeLessThan(500);
    appendRun(runs, { v: 1, launch: NOON, exit: NOON + 1000, reason: 'paused by signal SIGTERM' });
    appendRun(runs, { v: 1, launch: NOON + 2000, pid: 3 });
    expect(restartHandoff(journal.view, readRuns(runs), NOON + 2000)?.text)
      .toContain('prior run ended: paused by signal SIGTERM');
    appendRun(runs, { v: 1, launch: NOON + 2000, exit: NOON + 3000, reason: 'x'.repeat(1000) });
    appendRun(runs, { v: 1, launch: NOON + 4000, pid: 4 });
    const bounded = restartHandoff(journal.view, readRuns(runs), NOON + 4000)!;
    expect(bounded.text).toContain(`${'x'.repeat(80)}…`);
    expect(Buffer.byteLength(bounded.text)).toBeLessThan(500);
    journal.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
});

it('keeps an UNKNOWN model outcome in the handoff after its notice gains an intent or receipt', async () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'preview-handoff-')));
  const path = join(root, 'journal.encrypted'), runs = join(root, 'runs.jsonl');
  try {
    const journal = openPreviewJournal(path, key, genesis);
    let calls = 0;
    const worker = createJournalWorker(journal, { now: () => NOON, stopped: () => false,
      model: async () => ++calls === 1 ? { state: 'uncertain' } : 'done',
      send: async () => calls === 1 ? null : 7, checkOutbound: () => {} });
    worker.intake([update(1, 'uncertain', NOON)]); await worker.drain();
    worker.intake([update(2, 'completed', NOON)]); await worker.drain();
    expect(journal.view.order[0]).toMatchObject({ modelState: 'uncertain', noticeClass: 'unknown-answer' });
    expect(journal.view.order[0]!.intent).toBeDefined();
    expect(journal.view.order[1]).toMatchObject({ modelState: 'complete', sent: 7 });
    journal.close();
    appendRun(runs, { v: 1, launch: NOON - 60_000, pid: 1 });
    appendRun(runs, { v: 1, launch: NOON + 60_000, pid: 2 });
    const reopened = openPreviewJournal(path, key);
    const note = restartHandoff(reopened.view, readRuns(runs), NOON + 60_000)!.text;
    expect(note).toContain('pending turns 0');
    expect(note).toContain('UNKNOWN model outcomes 1 (updates 1)');
    expect(note).toContain('UNKNOWN sends 1 (updates 1)');
    expect(note).toContain('lost-answer notices due 0');
    reopened.append({ kind: 'sent', id: reopened.view.order[0]!.id, message: 8, at: NOON + 60_000 });
    reopened.close();
    const delivered = openPreviewJournal(path, key);
    const deliveredNote = restartHandoff(delivered.view, readRuns(runs), NOON + 60_000)!.text;
    expect(deliveredNote).toContain('UNKNOWN model outcomes 1 (updates 1)');
    expect(deliveredNote).toContain('UNKNOWN sends 0');
    expect(deliveredNote).not.toContain('updates 2');
    delivered.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
});

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

// Rule 37 quarantine: docs/defects/preview-self-state-timing-flake.md.
it.skip('keeps per-turn self-state overhead in milliseconds at the journal frame scale', async () => {
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
