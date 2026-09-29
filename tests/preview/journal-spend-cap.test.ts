import { expect, it } from 'vitest';
import { mkdtempSync, realpathSync, rmSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { createCipheriv, createHash, randomBytes } from 'node:crypto';
import { createJournalWorker, openPreviewJournal, openQuestionCandidates, raiseJournalCaps, reachedJournalCap, reportJournalCap, unknownCallCounts, MINIMAL_RESERVE, MINIMAL_POLL_LIMIT } from './journal-test-worker.js';

const key = new Uint8Array(32).fill(19);
const root = () => realpathSync(mkdtempSync(join(tmpdir(), 'preview-cap-')));
const genesis = (limits: Partial<{ maxCalls: number; maxReplies: number; maxTurns: number; maxBytes: number }> = {}) => ({
  kind: 'genesis' as const, bot: '12345678', chat: '7654321', operator: '7654321', grant: 'trial',
  configurationDigest: 'sha256:trial', expires: 9999999999999, cursor: 0,
  maxCalls: 4, maxReplies: 4, maxTurns: 4, maxBytes: 32768, ...limits });
const update = (id: number) => ({ update_id: id, message: { chat: { id: 7654321, type: 'private' },
  from: { id: 7654321 }, text: `question ${id}` } });
const id = (n: number) => `telegram:12345678:update:${n}`;
const worker = (journal: ReturnType<typeof openPreviewJournal>, counts: { calls: number; sends: number }) =>
  createJournalWorker(journal, { now: () => 1000, stopped: () => false,
    model: async () => { counts.calls++; return 'answer'; },
    send: async () => { counts.sends++; return counts.sends; }, checkOutbound: () => {} });

it('keeps reading past maxTurns through the minimal reserve without poisoning replay, and answers ordinarily after a raise', async () => {
  const dir = root(), path = join(dir, 'journal.encrypted');
  try {
    let journal = openPreviewJournal(path, key, genesis({ maxTurns: 1 }));
    const counts = { calls: 0, sends: 0 }, first = worker(journal, counts);
    const lines: string[] = [];
    expect(reportJournalCap(journal, 1000, line => lines.push(line))).toBeNull();
    expect(first.intake([update(2), update(1)])).toBe(3);
    // Rule 15: the second update is preserved by the reserve, not left behind the cap.
    expect(journal.view.order.map(turn => [turn.update, turn.reserve ?? false])).toEqual([[1, false], [2, true]]);
    // An ordinary (non-reserve) frame past the allowance is still refused before it is written.
    expect(() => journal.append({ kind: 'intake', id: id(3), update: 3, text: 'question 3',
      raw: JSON.stringify(update(3)), accepted: true, cursor: 4, at: 1000 })).toThrow('capacity');
    await first.drain();
    expect(counts).toEqual({ calls: 1, sends: 2 });
    expect(first.pollLimit()).toBe(MINIMAL_POLL_LIMIT);
    expect(reportJournalCap(journal, 1000, line => lines.push(line))).toBe('update cap reached');
    expect(lines).toEqual(['PREVIEW — turns cap reached; work paused. Check status for held work.\n']);
    journal.close();
    journal = openPreviewJournal(path, key);
    expect(journal.view.cursor).toBe(3);
    expect(journal.view.order).toHaveLength(2);
    expect(reportJournalCap(journal, 1001, line => lines.push(line))).toBe('update cap reached');
    expect(lines).toHaveLength(1);
    raiseJournalCaps(journal, { maxCalls: 4, maxReplies: 4, maxTurns: 2, authority: 'Justin recorded raise', at: 1001 });
    const resumed = worker(journal, counts);
    expect(resumed.intake([update(1), update(2)])).toBe(3);
    await resumed.drain();
    expect({ calls: counts.calls, sends: counts.sends, turns: journal.view.order.length }).toEqual({ calls: 2, sends: 3, turns: 2 });
    expect(reportJournalCap(journal, 1002, line => lines.push(line))).toBe('update cap reached');
    expect(lines).toHaveLength(2);
    journal.close();
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

it('counts each UNKNOWN answer, summary, review and Jev check once across restart and refuses a cap raise', () => {
  const dir = root(), path = join(dir, 'journal.encrypted');
  try {
    let journal = openPreviewJournal(path, key, genesis({ maxCalls: 3 }));
    const w = worker(journal, { calls: 0, sends: 0 });
    w.intake([update(1), update(2), update(3)]);
    journal.append({ kind: 'reserve', id: id(1), at: 1000 });
    journal.append({ kind: 'summary-reserve', through: 2, at: 1000 });
    journal.append({ kind: 'reserve', id: id(3), at: 1000 });
    journal.append({ kind: 'answer', id: id(3), text: 'answer', at: 1000 });
    journal.append({ kind: 'reply-jev-reserve', id: id(3), at: 1000 });
    expect(() => journal.append({ kind: 'reply-review-reserve', id: id(3), candidate: 'answer', at: 1000 })).toThrow('capacity');
    expect(journal.view.calls).toBe(3);
    const lines: string[] = [];
    expect(reportJournalCap(journal, 1000, line => lines.push(line))).toBe('model attempt cap reached');
    expect(lines).toEqual(['PREVIEW — calls trial cap at least 80% used (3/3); 0 remain.\n',
      'PREVIEW — calls cap reached; work paused. Check status for held work.\n']);
    journal.close();
    journal = openPreviewJournal(path, key);
    expect(unknownCallCounts(journal.view)).toEqual({ answers: 1, summaries: 1, reviews: 0, jev: 1, index: 0, total: 3 });
    const status = spawnSync(process.execPath, ['--no-warnings', '--loader', './scripts/slice-ts-loader.mjs',
      'tests/preview/journal-agent.mjs', 'status', '--root', dir], { cwd: process.cwd(), encoding: 'utf8',
      env: { ...process.env, INSTAR_SECRET_PREVIEW_STORAGE_KEY: Buffer.from(key).toString('hex') }, timeout: 10000 });
    expect(status.status, status.stderr).toBe(0);
    expect(JSON.parse(status.stdout)).toMatchObject({ calls: 3, unknownCalls: 3,
      unknownCallBreakdown: { answers: 1, summaries: 1, reviews: 0, jev: 1, index: 0, total: 3 },
      capReports: ['calls:80:3', 'calls:3'] });
    expect(() => raiseJournalCaps(journal, { maxCalls: 4, maxReplies: 4, maxTurns: 4,
      authority: 'Justin recorded raise', at: 1001 })).toThrow('UNKNOWN');
    expect(() => journal.append({ kind: 'reserve', id: id(2), at: 1000 })).toThrow('capacity');
    expect(() => journal.append({ kind: 'summary-reserve', through: 3, at: 1000 })).toThrow('capacity');
    journal.close();
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

it('counts an UNKNOWN subscription review separately from a completed answer and Jev check', () => {
  const dir = root(), path = join(dir, 'journal.encrypted');
  try {
    let journal = openPreviewJournal(path, key, genesis({ maxCalls: 2 }));
    worker(journal, { calls: 0, sends: 0 }).intake([update(1)]);
    journal.append({ kind: 'reserve', id: id(1), at: 1000 });
    journal.append({ kind: 'answer', id: id(1), text: 'answer', at: 1000 });
    journal.append({ kind: 'reply-jev-reserve', id: id(1), at: 1000 });
    journal.append({ kind: 'reply-check', id: id(1), result: { verdict: 'unsure', ruleIds: [],
      confidence: .5, path: 'jev', latencyMs: 2 }, at: 1000 });
    journal.append({ kind: 'reply-review-reserve', id: id(1), candidate: 'answer', at: 1000 });
    journal.close();
    journal = openPreviewJournal(path, key);
    expect(journal.view.calls).toBe(2);
    expect(unknownCallCounts(journal.view)).toEqual({ answers: 0, summaries: 0, reviews: 1, jev: 0, index: 0, total: 1 });
    expect(() => raiseJournalCaps(journal, { maxCalls: 3, maxReplies: 4, maxTurns: 4,
      authority: 'Justin recorded raise', at: 1001 })).toThrow('UNKNOWN');
    journal.close();
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

it('counts an unresolved revised-text review as UNKNOWN in status and the cap-raise refusal, and a conclusive one not', () => {
  for (const verdict of [undefined, 'unavailable', 'pass', 'violation'] as const) {
    const dir = root(), path = join(dir, 'journal.encrypted');
    try {
      let journal = openPreviewJournal(path, key, genesis({ maxCalls: 10 }));
      worker(journal, { calls: 0, sends: 0 }).intake([update(1)]);
      journal.append({ kind: 'reserve', id: id(1), at: 1000 });
      journal.append({ kind: 'answer', id: id(1), text: 'answer', at: 1000 });
      journal.append({ kind: 'reply-revision-reserve', id: id(1), objections: ['raw_path'], at: 1000 });
      journal.append({ kind: 'reply-revision', id: id(1), state: 'complete', text: 'revised answer', at: 1000 });
      journal.append({ kind: 'reply-revision-review-reserve', id: id(1), at: 1000 });
      if (verdict !== undefined) journal.append({ kind: 'reply-revision-review', id: id(1), verdict,
        ruleIds: verdict === 'violation' ? ['defers_work'] : [], at: 1000 });
      journal.close();
      journal = openPreviewJournal(path, key);
      const unknown = verdict === undefined || verdict === 'unavailable' ? 1 : 0;
      expect(unknownCallCounts(journal.view), String(verdict)).toEqual({ answers: 0, summaries: 0, reviews: unknown, jev: 0, index: 0, total: unknown });
      journal.close();
      const status = spawnSync(process.execPath, ['--no-warnings', '--loader', './scripts/slice-ts-loader.mjs',
        'tests/preview/journal-agent.mjs', 'status', '--root', dir], { cwd: process.cwd(), encoding: 'utf8',
        env: { ...process.env, INSTAR_SECRET_PREVIEW_STORAGE_KEY: Buffer.from(key).toString('hex') }, timeout: 10000 });
      expect(status.status, status.stderr).toBe(0);
      expect(JSON.parse(status.stdout)).toMatchObject({ unknownCalls: unknown, unknownCallBreakdown: { reviews: unknown, total: unknown } });
      journal = openPreviewJournal(path, key);
      const raise = () => raiseJournalCaps(journal, { maxCalls: 11, maxReplies: 4, maxTurns: 4,
        authority: 'Justin recorded raise', at: 1001 });
      if (unknown) { expect(raise).toThrow('UNKNOWN'); expect(journal.view.limits.maxCalls).toBe(10); }
      else { raise(); expect(journal.view.limits.maxCalls).toBe(11); }
      journal.close();
    } finally { rmSync(dir, { recursive: true, force: true }); }
  }
});

it('replays a previously valid cap raise after unavailable Jev and completed subscription review', () => {
  const dir = root(), path = join(dir, 'journal.encrypted'), origin = genesis();
  try {
    let journal = openPreviewJournal(path, key, origin);
    worker(journal, { calls: 0, sends: 0 }).intake([update(1)]);
    journal.append({ kind: 'reserve', id: id(1), at: 1000 });
    journal.append({ kind: 'answer', id: id(1), text: 'answer', at: 1000 });
    journal.append({ kind: 'reply-jev-reserve', id: id(1), at: 1000 });
    journal.append({ kind: 'reply-check', id: id(1), result: { verdict: 'unavailable', ruleIds: [],
      confidence: null, path: 'jev', latencyMs: 2 }, at: 1000 });
    journal.append({ kind: 'reply-review-reserve', id: id(1), candidate: 'answer', at: 1000 });
    journal.append({ kind: 'reply-review-state', id: id(1), state: 'complete', at: 1000 });
    journal.append({ kind: 'reply-check', id: id(1), result: { verdict: 'pass', ruleIds: [],
      confidence: 1, path: 'subscription', latencyMs: 2 }, at: 1000 });
    journal.append({ kind: 'intent', id: id(1), text: 'PREVIEW — answer', chat: origin.chat,
      update: 1, grant: origin.grant, at: 1000 });
    journal.append({ kind: 'sent', id: id(1), message: 1, at: 1000 });
    expect(unknownCallCounts(journal.view)).toEqual({ answers: 0, summaries: 0, reviews: 0, jev: 1, index: 0, total: 1 });
    expect(() => raiseJournalCaps(journal, { maxCalls: 5, maxReplies: 4, maxTurns: 4,
      authority: 'Justin recorded raise', at: 1001 })).toThrow('UNKNOWN');
    journal.close();

    // Reproduce a cap frame emitted by the prior writer, with its authenticated
    // journal framing, so the upgraded reader must accept the existing history.
    const row = { kind: 'caps', genesisHash: createHash('sha256').update(JSON.stringify(origin)).digest('hex'),
      maxCalls: 5, maxReplies: 4, maxTurns: 4, maxBytes: 32768, authority: 'Justin recorded raise', at: 1001 };
    const offset = readFileSync(path).length, nonce = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', key, nonce);
    cipher.setAAD(Buffer.from(`preview-journal:${offset}`));
    const body = Buffer.concat([cipher.update(JSON.stringify(row), 'utf8'), cipher.final()]);
    const frame = Buffer.concat([nonce, cipher.getAuthTag(), body]);
    const length = Buffer.alloc(4); length.writeUInt32BE(frame.length);
    writeFileSync(path, Buffer.concat([length, frame]), { flag: 'a' });

    journal = openPreviewJournal(path, key);
    expect(journal.view.limits.maxCalls).toBe(5);
    expect(journal.view.calls).toBe(2);
    expect(journal.view.replies).toBe(1);
    expect(journal.view.order[0]?.sent).toBe(1);
    expect(unknownCallCounts(journal.view).jev).toBe(1);
    journal.close();
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

it('holds maxReplies and maxBytes work, and journals one cap report per reached threshold', async () => {
  const dir = root(), path = join(dir, 'journal.encrypted');
  try {
    let journal = openPreviewJournal(path, key, genesis({ maxReplies: 1, maxBytes: 128 }));
    const counts = { calls: 0, sends: 0 }, w = worker(journal, counts);
    w.intake([update(1)]); await w.drain();
    expect(counts).toEqual({ calls: 0, sends: 0 });
    expect(reachedJournalCap(journal.view)).toEqual({ reason: 'bytes', limit: 128 });
    // Rule 15: a reached cap never stops reading the operator.
    expect(() => w.pollGate()).not.toThrow();
    const lines: string[] = [];
    expect(reportJournalCap(journal, 1000, line => lines.push(line))).toBe('context byte cap reached');
    expect(reportJournalCap(journal, 1001, line => lines.push(line))).toBe('context byte cap reached');
    expect(lines).toEqual(['PREVIEW — bytes cap reached; work paused. Check status for held work.\n']);
    journal.close();
    journal = openPreviewJournal(path, key);
    expect([...journal.view.capReports]).toEqual(['bytes:128']);
    expect(reportJournalCap(journal, 1001, line => lines.push(line))).toBe('context byte cap reached');
    expect(lines).toHaveLength(1);
    raiseJournalCaps(journal, { maxCalls: 4, maxReplies: 1, maxTurns: 4, maxBytes: 32768,
      authority: 'Justin recorded raise', at: 1001 });
    const resumed = worker(journal, counts);
    await resumed.drain();
    expect(counts).toEqual({ calls: 1, sends: 1 });
    expect(reachedJournalCap(journal.view)).toEqual({ reason: 'replies', limit: 1 });
    expect(reportJournalCap(journal, 1002, line => lines.push(line))).toBe('reply cap reached');
    expect(lines.slice(1)).toEqual(['PREVIEW — replies trial cap at least 80% used (1/1); 0 remain.\n',
      'PREVIEW — replies cap reached; work paused. Check status for held work.\n']);
    expect(() => journal.append({ kind: 'intent', id: id(1), text: 'again', chat: '7654321',
      update: 1, grant: 'trial', at: 1003 })).toThrow('capacity');
    journal.close();
    journal = openPreviewJournal(path, key);
    expect(journal.view.replies).toBe(1);
    expect([...journal.view.capReports]).toEqual(['bytes:128', 'replies:80:1', 'replies:1']);
    journal.close();
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

it.each(['calls', 'replies'] as const)('reports the %s 80%% and final boundaries once, then answers a pending question once after a raise', async reason => {
  const dir = root(), path = join(dir, 'journal.encrypted');
  const initial = reason === 'calls' ? genesis({ maxCalls: 5, maxReplies: 8, maxTurns: 8 })
    : genesis({ maxCalls: 8, maxReplies: 5, maxTurns: 8 });
  const lines: string[] = [], counts = { calls: 0, sends: 0 };
  try {
    let journal = openPreviewJournal(path, key, initial);
    let active = worker(journal, counts);
    for (let number = 1; number <= 5; number++) {
      active.intake([update(number)]); await active.drain();
      const stopped = reportJournalCap(journal, 1000, line => lines.push(line));
      if (number < 4) { expect(stopped).toBeNull(); expect(lines).toEqual([]); }
      if (number === 3) expect(() => journal.append({ kind: 'cap-report', reason, limit: 5,
        level: 'near', at: 1000 })).toThrow('cap report');
      if (number === 4) {
        expect(stopped).toBeNull();
        expect(lines).toEqual([`PREVIEW — ${reason} trial cap at least 80% used (4/5); 1 remain.\n`]);
        expect(() => journal.append({ kind: 'cap-report', reason, limit: 5,
          level: 'near', at: 1000 })).toThrow('cap report');
      }
      if (number === 5) expect(stopped).toBe(reason === 'calls' ? 'model attempt cap reached' : 'reply cap reached');
    }
    expect(counts).toEqual({ calls: 5, sends: 5 });
    expect(lines).toEqual([`PREVIEW — ${reason} trial cap at least 80% used (4/5); 1 remain.\n`,
      `PREVIEW — ${reason} cap reached; work paused. Check status for held work.\n`]);
    journal.close();
    journal = openPreviewJournal(path, key);
    expect(reportJournalCap(journal, 1001, line => lines.push(line))).not.toBeNull();
    expect(lines).toHaveLength(2);
    active = worker(journal, counts);
    // Rule 15: no ordinary cap closes polling; past the reply cap the reserve answers.
    expect(() => active.pollGate()).not.toThrow();
    expect(journal.view.cursor).toBe(6);
    // Exercise an already accepted update in the final poll batch.
    active.intake([update(6)]); await active.drain();
    expect(journal.view.order[5]?.held).toBe(reason === 'calls' ? 'call cap' : 'reply cap');
    expect(openQuestionCandidates(journal.view).map(question => question.quote)).toContain('question 6');
    expect(journal.view.cursor).toBe(7);
    // The capped question gets one limited answer from the reserve, not silence.
    expect(counts.sends).toBe(6);
    expect(journal.view.order[5]?.limited?.reason).toBe(reason);
    expect(journal.view.replies).toBe(5);
    raiseJournalCaps(journal, { maxCalls: reason === 'calls' ? 7 : 8,
      maxReplies: reason === 'replies' ? 7 : 8, maxTurns: 8, authority: 'Justin recorded raise', at: 1002 });
    await active.drain(); await active.drain();
    expect(journal.view.order[5]?.sent).toBe(7);
    expect(openQuestionCandidates(journal.view)).toEqual([]);
    expect(counts).toEqual({ calls: 6, sends: 7 });
    expect(journal.view.calls).toBeLessThanOrEqual(journal.view.limits.maxCalls);
    expect(journal.view.replies).toBeLessThanOrEqual(journal.view.limits.maxReplies);
    expect(reportJournalCap(journal, 1003, line => lines.push(line))).toBeNull();
    expect(lines.at(-1)).toBe(`PREVIEW — ${reason} trial cap at least 80% used (6/7); 1 remain.\n`);
    journal.close();
    journal = openPreviewJournal(path, key);
    await worker(journal, counts).drain();
    expect(reportJournalCap(journal, 1004, line => lines.push(line))).toBeNull();
    expect(counts).toEqual({ calls: 6, sends: 7 });
    expect(lines).toHaveLength(3);
    expect([...journal.view.capReports]).toEqual([`${reason}:80:5`, `${reason}:5`, `${reason}:80:7`]);
    journal.close();
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
