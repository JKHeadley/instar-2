import { expect, it } from 'vitest';
import { appendFileSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { performance } from 'node:perf_hooks';
import { spawnSync } from 'node:child_process';
import { createJournalWorker, openPreviewJournal, raiseJournalCaps } from './journal-test-worker.js';
import { prepareJournalEnvelope } from './journal-envelope.js';
import { appendRun, heldNotices, heldRepliesToday, holdNotice, memoryHealthLine, readRuns, restartHandoff, selfState, selfStateSource } from './self-state.js';
import { JEV_MODEL, REPLY_RULES } from './reply-check.js';
import { TOO_LONG_REPLY_NOTICE } from './journal.js';


const key = new Uint8Array(32).fill(4);
// 2026-09-26 19:00 UTC = 12:00 PDT.
const NOON = Date.UTC(2026, 8, 26, 19, 0);
const genesis = { kind: 'genesis' as const, bot: '12345678', chat: '7654321', operator: '7654321', grant: 'grant:preview',
  configurationDigest: 'sha256:offline', expires: Date.UTC(2026, 8, 28, 20, 40), maxCalls: 3, maxReplies: 3, maxTurns: 6,
  maxBytes: 32768, cursor: 0 };
const update = (id: number, text: string, at: number) => ({ update_id: id,
  message: { chat: { id: 7654321, type: 'private' }, from: { id: 7654321 }, text, date: Math.floor(at / 1000) } });

// The cold-child cost these budgets are sized from is measured in full above the SIGTERM case in
// tests/preview/real-model-recall-sample.test.ts and recorded in docs/defects/full-suite-load-timeouts.md.
it('gives every held reply one fixed plain reason and truthful resend advice', () => {
  const cases = [
    ['reply check unavailable', 'This reply is held because a safety check is unavailable; trying again after it recovers may help.'],
    ['outbound secret refused', 'This reply is held because it may contain a secret; this held reply will not be sent.'],
    ['call cap', 'This reply is held because the spend limit was reached; resending will not help while the limit remains in place.'],
    ['reply cap', 'This reply is held because the spend limit was reached; resending will not help while the limit remains in place.'],
    ['reply size', 'This reply is held because it is too long to send; asking again for a shorter answer may help.'],
    ['encoded reply size', 'This reply is held because it is too long to send; asking again for a shorter answer may help.'],
    ['context overflow', 'This reply is held because the conversation is too large to process right now; a summary may let it resume.'],
    ['prompt overflow', 'This reply is held because the conversation is too large to process right now; a summary may let it resume.'],
    ['summary unavailable: prompt overflow', 'This reply is held because the conversation is too large to process right now; a summary may let it resume.'],
    ['memory correction pending', 'This reply is held while a memory correction is unresolved.'],
    ['summary oversized turn', 'This reply is held because its conversation summary is too large to prepare.'],
    ['summary preflight unavailable', 'This reply is held because its conversation summary could not be prepared.'],
    ['review needed', 'This reply is held because it could not be completed.'],
  ];
  for (const [reason, expected] of cases) {
    const notice = holdNotice(reason!);
    expect(notice).toBe(expected);
    expect(notice).not.toMatch(/(?:credential|\bcap\b|check unavailable|rule[_-]|\bNF-\d+\b)/iu);
  }
  expect(holdNotice('call cap', true)).toBe('This reply is held because the trial is stopped; resending will not help.');
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'preview-hold-notice-')));
  try {
    const path = join(root, 'journal.encrypted');
    // The status command below reads the wall clock, so the trial must outlast the real run, not a fixed date.
    const journal = openPreviewJournal(path, key, { ...genesis, expires: Math.max(NOON, Date.now()) + 86_400_000 });
    const worker = createJournalWorker(journal, { now: () => NOON, stopped: () => false,
      model: async () => 'unused', send: async () => 1, checkOutbound: () => {} });
    worker.intake([update(1, 'one', NOON), update(2, 'two', NOON)]);
    expect(heldNotices(journal.view)).toEqual([]);
    journal.append({ kind: 'hold', id: journal.view.order[0]!.id, reason: 'outbound secret refused', at: NOON });
    journal.append({ kind: 'hold', id: journal.view.order[1]!.id, reason: 'call cap', at: NOON });
    expect(heldNotices(journal.view)).toEqual([
      { update: 1, notice: holdNotice('outbound secret refused') },
      { update: 2, notice: holdNotice('call cap') },
    ]);
    expect(heldNotices(journal.view, true).map(item => item.notice)).toEqual([
      holdNotice('', true), holdNotice('', true),
    ]);
    journal.close();
    const reopened = openPreviewJournal(path, key, undefined, undefined, true);
    expect(heldNotices(reopened.view)).toHaveLength(2);
    reopened.close();
    const command = (action: string) => spawnSync(process.execPath,
      ['--loader', './scripts/slice-ts-loader.mjs', 'tests/preview/journal-agent.mjs', action, '--root', root],
      { cwd: process.cwd(), encoding: 'utf8', env: { ...process.env,
        INSTAR_SECRET_PREVIEW_STORAGE_KEY: Buffer.from(key).toString('hex') } });
    const before = command('status');
    expect(before.status, before.stderr).toBe(0);
    expect(JSON.parse(before.stdout).holds).toEqual([
      { update: 1, notice: holdNotice('outbound secret refused') },
      { update: 2, notice: holdNotice('call cap') },
    ]);
    const stop = command('stop');
    expect(stop.status, stop.stderr).toBe(0);
    const after = command('status');
    expect(after.status, after.stderr).toBe(0);
    expect(JSON.parse(after.stdout).holds.map((item: { notice: string }) => item.notice)).toEqual([
      holdNotice('', true), holdNotice('', true),
    ]);
  } finally { rmSync(root, { recursive: true, force: true }); }
}, 900000); // Several cold `--loader` children at about 50 s each in this suite (12.5-14.8 s one at a time): the
// 10 s default sat below the cost of starting even one. Every child assertion is unchanged.

const jevPass = { model: JEV_MODEL, answers: Object.fromEntries(
  Object.keys(REPLY_RULES).map(id => [id, { type: 'noul', noul: 0.01 }])) };

it('sends the fixed too-long notice after a healthy safety check without partial output', async () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'preview-hold-size-')));
  try {
    const journal = openPreviewJournal(join(root, 'journal.encrypted'), key, genesis);
    let checks = 0, sends = 0;
    const worker = createJournalWorker(journal, { now: () => NOON, stopped: () => false,
      model: async () => 'x'.repeat(4100), send: async () => { sends++; return 1; }, checkOutbound: () => {},
      replyCheck: { jev: async () => { checks++; return { value: jevPass, latencyMs: 1 }; },
        escalate: async () => { throw Error('unexpected review'); }, elapsedMs: () => 0 } });
    worker.intake([update(1, 'one', NOON)]); await worker.drain();
    expect(checks).toBe(1);
    expect(sends).toBe(1);
    expect(journal.view.order[0]?.intent).toBe(TOO_LONG_REPLY_NOTICE);
    expect(journal.view.order[0]?.intent).not.toContain('x'.repeat(4100));
    expect(heldNotices(journal.view)).toEqual([]);
    expect(selfState(journal.view, { launches: [], unreadable: 0 }, NOON, 'UTC'))
      .toContain('Held messages: none.');
    journal.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
});

it('answers during a reviewer outage, recording the review unavailable, and holds nothing', async () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'preview-hold-recover-')));
  try {
    const journal = openPreviewJournal(join(root, 'journal.encrypted'), key, { ...genesis, maxCalls: 8 });
    let calls = 0, sends = 0;
    const worker = createJournalWorker(journal, { now: () => NOON, stopped: () => false,
      model: async () => { calls++; return 'safe answer'; },
      send: async () => { sends++; return sends; }, checkOutbound: () => {},
      replyCheck: { jev: async () => { throw Error('Jev unavailable'); },
        escalate: async () => { throw Error('review unavailable'); }, elapsedMs: () => 0 } });
    worker.intake([update(1, 'one', NOON)]); await worker.drain();
    // Rule 95: the advisory reviewer fails toward reachability; the outage is recorded, not a hold.
    expect(journal.view.order[0]?.held).toBeUndefined();
    expect(journal.view.order[0]?.sent).toBe(1);
    expect(journal.view.order[0]?.release?.review).toBe('unavailable');
    expect(heldNotices(journal.view)).toEqual([]);
    await worker.drain();
    expect(calls).toBe(1);
    expect(sends).toBe(1);
    journal.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
});

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
    expect(text).toContain("My memory: 4 accepted operator turns, 0 summaries and 0 validated memory changes in this trial's encrypted local journal.");
    expect(text).toContain('It survives runner restarts and spans this trial\'s topics');
    expect(text).toContain('My replies Telegram accepted: 1 today, 3 in this trial');
    expect(text).toContain('Model attempts: 3 of 3 used, 0 left');
    expect(text).toContain(`Held messages: 1 — ${holdNotice('call cap')}`);
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
    expect(heldNotices(w.journal.view)).toEqual([]);
    w.worker.intake([update(5, 'how many messages today and when did you last restart?', clock)]);
    const probeState = selfState(w.journal.view, readRuns(runs), clock, 'America/Los_Angeles', run3);
    await w.worker.drain();
    expect(w.journal.view.order.every(turn => turn.sent === 7)).toBe(true);
    expect(probeState).toContain('Operator messages received: 3 today, 5 in this trial (including the one being answered now)');
    expect(probeState).toContain('My memory: 5 accepted operator turns');
    expect(probeState).toContain('The verified operator can ask me to correct or forget a recorded fact');
    expect(probeState).toContain('original audit record remains in the journal');
    expect(probeState).toContain('My replies Telegram accepted: 2 today, 4 in this trial');
    expect(probeState).toContain('Messages exchanged today: 5');
    expect(probeState).toContain('Model attempts: 4 of 8 used, 4 left');
    expect(probeState).toContain('Caps last raised 2026-09-26 11:29 PDT on the authority "Justin, topic 52075"');
    expect(probeState).toContain('This run started 2026-09-26 11:30 PDT; uptime 30m.');
    expect(probeState).toContain('Last restart: 2026-09-26 11:30 PDT. The run before it started 2026-09-26 08:00 PDT and ended without recording why (crash, kill or power loss).');
    expect(probeState).toContain('Launches recorded: 3 (2 today)');
    expect(probeState).toContain('0 turn-model calls and 0 summary-model calls without a durable result');
    expect(probeState).toContain('0 send(s) without a durable result');
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
    expect(text).toContain('1 turn-model calls and 0 summary-model calls without a durable result');
    expect(text).toContain('0 send(s) without a durable result');
    expect(() => selfState(journal.view, readRuns(join(root, 'runs.jsonl')), NOON, 'Mars/Olympus')).toThrow(RangeError);
    journal.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
});

it('counts memory health from recorded prompt evidence and journal dispositions across replay', () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'preview-health-')));
  const path = join(root, 'journal.encrypted');
  try {
    const journal = openPreviewJournal(path, key, { ...genesis, maxCalls: 6 });
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
    expect(expected).toContain('0 channel-import cursors recorded (1 imported channel items)');
    expect(expected).toContain('1 turn-model calls and 1 summary-model calls without a durable result');
    expect(expected).toContain('1 send(s) without a durable result');
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

it('status replays distinct replies held on the local day and gives each journal reason', () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'preview-held-status-')));
  // The spawned status reads its own clock: never anchor "today" within 30 s of the UTC day's end, or the child
  // can land on the next day and see no holds (this failed once at 23:59:5x UTC).
  const untilMidnight = 86_400_000 - (Date.now() % 86_400_000);
  if (untilMidnight < 30_000) Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, untilMidnight + 1_000);
  const now = Date.now(), dayStart = Math.floor(now / 86_400_000) * 86_400_000;
  try {
    const journal = openPreviewJournal(join(root, 'journal.encrypted'), key, { ...genesis, expires: now + 86_400_000 });
    // Journal time never runs backward (clock floor), so intake is recorded before the holds.
    const worker = createJournalWorker(journal, { now: () => dayStart - 3_600_000, stopped: () => false,
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
        encoding: 'utf8', timeout: 240_000 });
    expect(status.status, status.stderr).toBe(0);
    const result = JSON.parse(status.stdout);
    expect(result.heldRepliesToday).toEqual({ count: 2, replies: [
      { update: 1, reasons: ['call cap'], stillHeld: true },
      { update: 2, reasons: ['reply check unavailable', 'reply cap'], stillHeld: true },
    ] });
    expect(result.self).toContain('Replies held today: 2. Reasons: 1 (call cap), 1 (reply check unavailable), 1 (reply cap). '
      + 'Update 1: call cap (still held). '
      + 'Update 2: reply check unavailable; reply cap (still held).');
    // int11's status gives each current hold in plain operator wording.
    expect(result.holds).toEqual([{ update: 1, notice: holdNotice('call cap') }, { update: 2, notice: holdNotice('reply cap') }]);
  } finally { rmSync(root, { recursive: true, force: true }); }
}, 600000); // One cold `--loader` status child at 240 s (measured about 50 s to start inside this suite).

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
      { ...genesis, maxCalls: 300, maxReplies: 300, maxTurns: 300, maxBytes: 8192 });
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
    expect('context' in probe ? Buffer.byteLength(probe.context) : Infinity).toBeLessThan(8192);
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
    // Rule 37 repair (docs/defects/preview-self-state-timing-flake.md). The recorded diagnosis is that the old
    // assertion read wall-clock time, so it also counted host scheduling contention that is not self-state's cost:
    // 6.14 ms isolated, 18.48 ms in a review run, 29.9 ms under parallel load against a 25 ms bound, and a
    // consumed-CPU sample measured 63.7 ms under load 40 (Node charges GC and helper threads to this process too).
    // No absolute wall or CPU number can separate our cost from the host's, so the bound is now RELATIVE: the same
    // derivation is measured at the 2000-turn frame scale and at a 200-turn scale, interleaved in one loop so both
    // samples carry identical contention. A cost that really grows with the journal moves the ratio; a loaded host
    // moves both samples together and cancels. The absolute figures are printed every run, so the "milliseconds"
    // claim stays a visible measurement.
    const build = (name: string, turns: number) => {
      const directory = join(root, name); mkdirSync(directory, { recursive: true });
      const journal = openPreviewJournal(join(directory, 'journal.encrypted'), key,
        { ...genesis, maxCalls: 2000, maxReplies: 2000, maxTurns: 2000 });
      const worker = createJournalWorker(journal, { now: () => NOON, stopped: () => false,
        model: async () => 'ok', send: async () => 1, checkOutbound: () => {} });
      // Intake only: every one of these turns is inside the 26-hour window the self-state formats.
      for (let i = 1; i <= turns; i++) worker.intake([update(i, `turn ${String(i)}`, NOON - (turns - i) * 45_000)]);
      const runs = join(directory, 'runs.jsonl');
      for (let i = 0; i < 20; i++) appendRun(runs, { v: 1, launch: NOON - (20 - i) * 3_600_000, pid: i });
      return { journal, log: readRuns(runs) };
    };
    const frame = build('frame', 2000), reference = build('reference', 200);
    const derive = (subject: { journal: { view: Parameters<typeof selfState>[0] }; log: ReturnType<typeof readRuns> }) =>
      selfStateSource(selfState(subject.journal.view, subject.log, NOON, 'America/Los_Angeles', subject.log.launches.at(-1)!.at));
    const frameSamples: number[] = [], referenceSamples: number[] = [];
    for (let i = 0; i < 200; i++) {
      const a = performance.now(); derive(frame);
      const b = performance.now(); derive(reference);
      const c = performance.now();
      frameSamples.push(b - a); referenceSamples.push(c - b);
    }
    const at95 = (values: number[]) => values.slice().sort((a, b) => a - b)[Math.ceil(values.length * .95) - 1]!;
    const framed = at95(frameSamples), referenced = at95(referenceSamples), ratio = framed / referenced;
    process.stdout.write(`self-state: 2000-turn p95=${framed.toFixed(2)} ms, 200-turn p95=${referenced.toFixed(2)} ms, ratio=${ratio.toFixed(2)}\n`);
    // Ten times the turns must not cost more than ten times the work: a superlinear derivation fails here, and
    // the 200-turn reference carries the same contention, so host load cannot decide it.
    expect(ratio).toBeLessThanOrEqual(10);
    frame.journal.close(); reference.journal.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
}, 180000); // Two journal builds (2 200 intakes) plus 400 derivations; the work, not a bound on it.

it('carries the self-state in every packet after rolling summaries take over the history', async () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'preview-self-')));
  const runs = join(root, 'runs.jsonl');
  try {
    appendRun(runs, { v: 1, launch: NOON, pid: 1 });
    const journal = openPreviewJournal(join(root, 'journal.encrypted'), key,
      // cbuild-2: room for the always-offered summary decision (measured fit 7600; was 7168).
      { ...genesis, maxCalls: 80, maxReplies: 40, maxTurns: 40, maxBytes: 7600 });
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
}, 300000); // 30 turns of real drain+summary work; the 10 s default was below that cost under load.
