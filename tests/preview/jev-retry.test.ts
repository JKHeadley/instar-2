import { afterEach, expect, it, vi } from 'vitest';
import { readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runInNewContext } from 'node:vm';
import { createHash } from 'node:crypto';
import { checkReply, jevQuestions, JEV_MODEL, JEV_REPLY_BUDGET_MS, parseJevResponse, jevUnavailableCause,
  type ReplyCheckResult, type ReplyCheckPorts } from './reply-check.js';
import { createJournalWorker, openPreviewJournal, unknownCallKeys } from './journal.js';
import { assertLiveJudgment, modelCallRecord } from './model-call-boundary.js';
import { appendGroupCarry } from './group-carry.js';
import { key, scope, now, permissionFor } from './group-carry-fixture.js';

const launcher = readFileSync(new URL('./journal-agent.mjs', import.meta.url), 'utf8');
const start = launcher.indexOf('    const callJev = async ');
const end = launcher.indexOf('    // model-call-boundary:end', start);
if (start < 0 || end < 0) throw Error('shipped client absent');
const captured = JSON.parse(readFileSync(new URL('./fixtures/group-audience-live-2026-10-10.json', import.meta.url), 'utf8'));
const pass = captured.recorded.checks.find((row: ReplyCheckResult) => row.path === 'jev');
const passBody = JSON.stringify({ model: JEV_MODEL,
  answers: Object.fromEntries(Object.entries(pass.scores).map(([rule, noul]) => [rule, { type: 'noul', noul }])),
  usage: { input_tokens: pass.usage.inputTokens, output_tokens: pass.usage.outputTokens } });
const liveFailures = JSON.parse(readFileSync(new URL('./fixtures/jev-unavailable-2026-10-11.json', import.meta.url), 'utf8'));
afterEach(() => vi.useRealTimers());

function client(fetcher: (url: string, init: RequestInit) => Promise<unknown>, extras: Record<string, unknown> = {}) {
  const timeouts: number[] = [];
  const call = runInNewContext(`${launcher.slice(start, end)}\ncallJev;`, {
    requireGroupDisclosure: async () => {}, journal: { view: {} }, shared: null,
    assertLiveJudgment, JEV_MODEL, parseJevResponse, performance,
    AbortSignal: { timeout: (ms: number) => {
      timeouts.push(ms); const controller = new AbortController();
      setTimeout(() => controller.abort(), ms); return controller.signal;
    } },
    sha256: (body: string) => createHash('sha256').update(body).digest('hex'),
    typesafeKey: () => 'TEST-only', observeJev: () => {}, recordModelCall: () => {}, fetch: fetcher, ...extras,
  }) as (judgment: string, text: string, questions: object, timeout?: number, occurrence?: string) => ReturnType<ReplyCheckPorts['jev']>;
  return { call, timeouts, jev: (text: string, questions = jevQuestions, timeout?: number, occurrence?: string) =>
    call('jev-reply-check', text, questions, timeout, occurrence) };
}

it.each(['timeout', 'http-503', 'network', 'parse', 'other'] as const)('records only bounded %s causes; one retry can rescue or fall back', async cause => {
  vi.useFakeTimers();
  for (const rescue of [true, false]) {
    let calls = 0, reviews = 0, reservations = 0;
    const rows: ReplyCheckResult[] = [];
    const transport = client(async () => {
      calls++;
      if (rescue && calls === 2) return new Response(passBody);
      if (cause === 'timeout') return new Promise(() => {});
      if (cause === 'network') throw new TypeError('secret URL must not escape');
      if (cause === 'other') throw Error('secret must not escape');
      return new Response(cause === 'parse' ? '{broken' : 'sensitive upstream body', { status: cause === 'parse' ? 200 : 503 });
    });
    const pending = checkReply(captured.recorded.answer, 'recorded:969390330', {
      ...transport, elapsedMs: () => performance.now(), reserveJevRetry: () => { reservations++; return true; },
      reserveEscalation: () => true, record: row => rows.push(row),
      escalate: async () => { reviews++; return { verdict: 'pass', ruleIds: [], confidence: null, latencyMs: 0 }; },
    });
    await vi.advanceTimersByTimeAsync(1800);
    expect(await pending).toEqual({ outcome: 'pass', path: rescue ? 'jev' : 'subscription' });
    expect(calls).toBe(2); expect(reservations).toBe(1); expect(reviews).toBe(rescue ? 0 : 1);
    expect(transport.timeouts).toEqual([850, 850]);
    const failed = rows.filter(row => row.verdict === 'unavailable');
    expect(failed).toHaveLength(rescue ? 1 : 2);
    expect(failed.every(row => row.cause === cause)).toBe(true);
    expect(JSON.stringify(rows)).not.toContain('secret');
    expect(rows.filter(row => row.path === 'jev').reduce((sum, row) => sum + row.latencyMs, 0)).toBeLessThan(2000);
  }
});

it('times out admission without a late provider dispatch', async () => {
  vi.useFakeTimers(); let release!: () => void, calls = 0;
  const transport = client(async () => { calls++; return new Response(passBody); }, {
    requireGroupDisclosure: () => new Promise<void>(resolve => { release = resolve; }),
  });
  const pending = transport.jev('reply', jevQuestions, 850).catch(jevUnavailableCause);
  await vi.advanceTimersByTimeAsync(850);
  expect(await pending).toBe('timeout'); release(); await Promise.resolve(); await Promise.resolve();
  expect(calls).toBe(0);
});

// Reviewer reproduction: real carried-group worker + extracted shipped client,
// recorded update 969390330, with controlled latency at the OUTER disclosure check.
it.each([0, 400, 1500, Infinity])('includes a %s ms worker disclosure wait in the Jev budget', async delay => {
  vi.useFakeTimers(); vi.setSystemTime(now);
  const root = mkdtempSync(join(tmpdir(), 'jev-worker-deadline-'));
  const genesis = { kind: 'genesis' as const, bot: scope.bot, chat: scope.operator, operator: scope.operator,
    grant: 'TEST-jev-deadline', configurationDigest: 'sha256:test', expires: now + 86400000,
    maxCalls: 20, maxReplies: 20, maxTurns: 20, maxBytes: 65536, cursor: 0 };
  const source = openPreviewJournal(join(root, 'source'), key, genesis);
  const journal = openPreviewJournal(join(root, 'group'), key, { ...genesis, chat: scope.chat, forum: true });
  appendGroupCarry(journal, source, scope, permissionFor(scope), true, now, () => false); source.close();
  const dispatched: number[] = [], releases: (() => void)[] = [];
  let fallbackAt = 0, sends = 0;
  const transport = client(async () => {
    dispatched.push(Date.now());
    // Slow admitted requests prove the client only receives the unspent budget.
    if (delay === 400) return new Promise(() => {});
    return new Response('{}', { status: 503 });
  }, { performance: { now: () => Date.now() } });
  try {
    const worker = createJournalWorker(journal, {
      now: () => Date.now(), stopped: () => false,
      groupDisclosure: async () => {
        if (delay > 0 && journal.view.jevChecks > 0 && !journal.view.order[0]?.reviewReserved)
          await new Promise<void>(resolve => {
            releases.push(resolve);
            if (Number.isFinite(delay)) setTimeout(resolve, delay);
          });
        return true;
      },
      model: async () => captured.recorded.answer, checkOutbound: () => {}, send: async () => ++sends,
      replyCheck: { ...transport, elapsedMs: () => Date.now(), escalate: async () => {
        fallbackAt = Date.now(); return { verdict: 'pass', ruleIds: [], confidence: null, latencyMs: 0 };
      } },
    });
    worker.intake([{ update_id: captured.recorded.update, message: { message_id: 1,
      chat: { id: Number(scope.chat), type: 'supergroup', is_forum: true },
      from: { id: Number(scope.operator) }, text: captured.recorded.text } }]);
    const pending = worker.drain();
    await vi.advanceTimersByTimeAsync(JEV_REPLY_BUDGET_MS); await pending;
    const turn = journal.view.order[0]!;
    expect(fallbackAt - turn.jevReservedAt!).toBeLessThanOrEqual(JEV_REPLY_BUDGET_MS);
    expect(dispatched).toHaveLength(delay < 850 ? 2 : 0);
    expect(transport.timeouts).toEqual(delay === 0 ? [850, 850] : delay === 400 ? [450, 450] : []);
    expect(turn.replyChecks?.filter(row => row.path === 'jev').map(row => row.cause))
      .toEqual(delay === 0 ? ['http-503', 'http-503'] : ['timeout', 'timeout']);
    expect(unknownCallKeys(journal.view).jev).toEqual([`jev:${turn.id}`, `jev-retry:${turn.id}`]);
    expect(sends).toBe(1);
    // Releasing either timed-out admission must not enter the client, even after send.
    releases.forEach(release => release()); await vi.advanceTimersByTimeAsync(5000);
    expect(dispatched).toHaveLength(delay < 850 ? 2 : 0);
    await worker.drain(); expect(sends).toBe(1);
  } finally { journal.close(); rmSync(root, { recursive: true, force: true }); }
});

it('classifies malformed scores as parse and never retries a valid unsure verdict', async () => {
  for (const malformed of [true, false]) {
    let calls = 0, retries = 0; const rows: ReplyCheckResult[] = [];
    const value = JSON.parse(passBody);
    value.answers.parks_on_user.noul = malformed ? 'invalid' : 0.55;
    await checkReply('reply', 'id', { elapsedMs: () => 0, record: row => rows.push(row),
      jev: async () => { calls++; return { value, latencyMs: 0 }; },
      reserveJevRetry: () => { retries++; return true; }, reserveEscalation: () => true,
      escalate: async () => ({ verdict: 'pass', ruleIds: [], confidence: null, latencyMs: 0 }),
    });
    expect(calls).toBe(malformed ? 2 : 1); expect(retries).toBe(malformed ? 1 : 0);
    expect(rows[0]).toMatchObject(malformed ? { verdict: 'unavailable', cause: 'parse' } : { verdict: 'unsure' });
  }
  expect(jevUnavailableCause({ jevCause: 'http-503 secret' })).toBe('other');
});

for (const live of liveFailures.rows) for (const rescue of [true, false])
it(`replays live unavailable shape ${live.update}, rescue=${rescue}, through durable worker and restart`, async () => {
  vi.useFakeTimers();
  const root = mkdtempSync(join(tmpdir(), 'jev-retry-')), path = join(root, 'journal');
  const key = new Uint8Array(32).fill(7);
  let journal = openPreviewJournal(path, key, { kind: 'genesis', bot: '12345678', chat: '7654321', operator: '7654321',
    grant: 'TEST-jev-retry', configurationDigest: 'sha256:test', expires: 9999999999999,
    maxCalls: 10, maxReplies: 10, maxTurns: 10, maxBytes: 65536, cursor: 0 });
  let calls = 0, reviews = 0, sends = 0;
  const transport = client(async () => {
    calls++;
    return new Response(rescue && calls === 2 ? passBody : '{}', { status: rescue && calls === 2 ? 200 : 503 });
  }, { journal, recordModelCall: (row: Parameters<typeof modelCallRecord>[0]) => journal.append(modelCallRecord({ ...row, at: 1000 })) });
  const ports = { now: () => 1000, stopped: () => false, model: async () => captured.recorded.answer,
    checkOutbound: () => {}, send: async () => ++sends,
    replyCheck: { ...transport, elapsedMs: () => performance.now(), escalate: async () => {
      reviews++; return { verdict: 'pass' as const, ruleIds: [], confidence: null, latencyMs: live.otherChecks[0].latencyMs };
    } },
  };
  try {
    const worker = createJournalWorker(journal, ports);
    worker.intake([{ update_id: live.update, message: { message_id: 1, chat: { id: 7654321, type: 'private' },
      from: { id: 7654321 }, text: captured.recorded.text } }]);
    await worker.drain();
    const turn = journal.view.order[0]!;
    const rows = turn.replyChecks!;
    expect(rows[0]).toMatchObject({ ...live.jev[0], latencyMs: 0, cause: 'http-503' });
    expect(rows.map(row => [row.path, row.verdict])).toEqual(rescue
      ? [['jev', 'unavailable'], ['jev', 'pass']]
      : [['jev', 'unavailable'], ['jev', 'unavailable'], ['subscription', 'pass']]);
    expect(calls).toBe(2); expect(reviews).toBe(rescue ? 0 : 1); expect(sends).toBe(1);
    expect(journal.view.jevChecks).toBe(2);
    expect(journal.view.modelCalls.total).toBe(2);
    const unknown = unknownCallKeys(journal.view).jev;
    expect(unknown).toEqual(rescue ? [`jev:${turn.id}`] : [`jev:${turn.id}`, `jev-retry:${turn.id}`]);
    const tokens = structuredClone(journal.view.tokenTotals);
    expect(tokens.replyCheck.unknownCalls).toBeGreaterThanOrEqual(rescue ? 1 : 2);
    journal.close(); journal = openPreviewJournal(path, key);
    expect(journal.view.tokenTotals).toEqual(tokens);
    expect(unknownCallKeys(journal.view).jev).toEqual(unknown);
    await createJournalWorker(journal, ports).drain();
    expect(calls).toBe(2); expect(sends).toBe(1);
  } finally { journal.close(); rmSync(root, { recursive: true, force: true }); }
});

it.each(['cap', 'stop', 'crash'] as const)('preserves the %s floor at the retry reservation', async mode => {
  const root = mkdtempSync(join(tmpdir(), 'jev-retry-floor-')), path = join(root, 'journal');
  const key = new Uint8Array(32).fill(8);
  let journal = openPreviewJournal(path, key, { kind: 'genesis', bot: '12345678', chat: '7654321', operator: '7654321',
    grant: 'TEST-jev-floor', configurationDigest: 'sha256:test', expires: 9999999999999,
    maxCalls: 10, maxReplies: mode === 'cap' ? 1 : 10, maxTurns: 10, maxBytes: 65536, cursor: 0 },
    stage => { if (mode === 'crash' && stage === 'after:reply-jev-reserve' && journal.view.order[0]?.jevRetried)
      throw Error('injected crash after durable retry reservation'); });
  let calls = 0, reviews = 0, sends = 0, stopped = false;
  const ports = { now: () => 1000, stopped: () => stopped, model: async () => captured.recorded.answer,
    checkOutbound: () => {}, send: async () => ++sends,
    replyCheck: { elapsedMs: () => 0,
      jev: async () => { calls++; if (mode === 'stop') stopped = true; throw Error('outage'); },
      escalate: async () => { reviews++; return { verdict: 'pass' as const, ruleIds: [], confidence: null, latencyMs: 0 }; },
    },
  };
  try {
    const worker = createJournalWorker(journal, ports);
    worker.intake([{ update_id: 1, message: { message_id: 1, chat: { id: 7654321, type: 'private' },
      from: { id: 7654321 }, text: captured.recorded.text } }]);
    if (mode === 'stop') await expect(worker.drain()).rejects.toThrow('preview stopped');
    else if (mode === 'crash') await expect(worker.drain()).rejects.toThrow('injected crash');
    else await worker.drain();
    expect(calls).toBe(1);
    if (mode === 'cap') { expect(reviews).toBe(1); expect(sends).toBe(1); expect(journal.view.jevChecks).toBe(1); }
    if (mode === 'stop') { expect(reviews).toBe(0); expect(sends).toBe(0); }
    if (mode === 'crash') {
      expect(journal.view.order[0]?.jevRetried).toBe(true);
      expect(journal.view.jevChecks).toBe(2); expect(sends).toBe(0);
      journal.close(); journal = openPreviewJournal(path, key);
      await createJournalWorker(journal, ports).drain();
      expect(calls).toBe(1); expect(reviews).toBe(1); expect(sends).toBe(1);
      expect(unknownCallKeys(journal.view).jev).toHaveLength(2);
      expect(journal.view.order[0]?.replyChecks?.filter(row => row.path === 'jev')).toHaveLength(2);
      expect(journal.view.order[0]?.replyChecks?.[1]?.cause).toBe('other');
      expect(() => journal.append({ kind: 'reply-jev-reserve', id: journal.view.order[0]!.id, retry: true, at: 1000 }))
        .toThrow('Jev reservation order or cap');
    }
  } finally { journal.close(); rmSync(root, { recursive: true, force: true }); }
});

it('spends only the remaining reply deadline and does not retry after it expires', async () => {
  let clock = 0, retries = 0, reviews = 0;
  const rows: ReplyCheckResult[] = [];
  const result = await checkReply('reply', 'id', { now: () => clock, elapsedMs: () => clock, deadlineAt: 40,
    jev: async (_text, _questions, timeout) => { expect(timeout).toBe(40); clock = 40; throw { name: 'TimeoutError' }; },
    reserveJevRetry: () => { retries++; return true; }, reserveEscalation: () => true, record: row => rows.push(row),
    escalate: async () => { reviews++; return { verdict: 'pass', ruleIds: [], confidence: null, latencyMs: 0 }; },
  });
  expect(result).toEqual({ outcome: 'unavailable', path: 'jev' });
  expect(retries).toBe(0); expect(reviews).toBe(0); expect(rows[0]?.cause).toBe('timeout');
});


it('keeps summary admission outside its original provider timeout and adds no reply retry', async () => {
  vi.useFakeTimers(); let release!: () => void, calls = 0;
  const transport = client(async () => { calls++; return new Response(passBody); }, {
    requireGroupDisclosure: () => new Promise<void>(resolve => { release = resolve; }),
  });
  const pending = transport.call('jev-summary-integrity', 'summary', jevQuestions);
  await vi.advanceTimersByTimeAsync(3000);
  expect(calls).toBe(0); expect(transport.timeouts).toEqual([]);
  release(); await pending;
  expect(calls).toBe(1); expect(transport.timeouts).toEqual([2000]);
});
