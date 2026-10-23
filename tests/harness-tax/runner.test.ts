import { it, expect } from 'vitest';
import { mkdtempSync, readFileSync, readdirSync, mkdirSync, writeFileSync, realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { tasks, parts } from '../../scripts/harness-tax/catalog.mjs';
import { initialize, runDay, validateConfig, validateResult, validateGrade, table, digest, partVerdict, recordedObservation } from '../../scripts/harness-tax/runner.mjs';
import type { Request } from '../../scripts/harness-tax/runner.mjs';
import { driver, grader } from '../../scripts/harness-tax/stub.mjs';
import { createDriver } from '../../scripts/harness-tax/adapters.mjs';
import { ablate } from '../../scripts/harness-tax/ablate.mjs';

const config = () => ({ mode: 'stub', model: 'claude-opus-5-5', start: '2026-10-23T09:00:00-07:00', maxCalls: 100, timeoutMs: 1000, taskIds: ['lookup'] });
const root = () => join(mkdtempSync(join(tmpdir(), 'harness-tax-test-')), 'experiment');
const rows = (dir: string) => readdirSync(join(dir, 'events')).filter(n => n.endsWith('.result.json')).map(n => JSON.parse(readFileSync(join(dir, 'events', n), 'utf8')));

it('has twelve source-linked graded tasks, eight spanning days with all six trust outcomes', () => {
  expect(tasks).toHaveLength(12);
  expect(tasks.filter(t => t.category === 'continuity')).toHaveLength(8);
  expect(new Set(tasks.flatMap(t => t.trust)).size).toBe(6);
  for (const t of tasks) {
    expect(t.sources.length).toBeGreaterThan(0); expect(t.expected).toBeTruthy(); expect(t.rubric).toBeTruthy();
    if (t.category === 'continuity') expect(t.stages.at(-1)!.day).toBeGreaterThan(0);
  }
});

it('runs one task through all three setups, grades and renders a table; restart never duplicates', async () => {
  const dir = root(); initialize(dir, config()); let sends = 0;
  const counted = { execute: async (r: Request) => { sends++; expect(r.expected).toBeUndefined(); expect(r.rubric).toBeUndefined(); return driver.execute(r); } };
  await runDay(dir, 0, counted, grader); await runDay(dir, 0, counted, grader);
  expect(sends).toBe(3); const results = rows(dir); expect(results).toHaveLength(3);
  expect(results.every(r => r.grade.correctness === 'pass' && r.mode === 'stub')).toBe(true);
  expect(table(results)).toContain('grading (infrastructure)');
  expect(table(results)).toContain('instar2');
  expect(() => initialize(dir, config())).toThrow();
});

it('retains uncertain intake after a crash and refuses to resend it', async () => {
  const dir = root(); initialize(dir, config());
  await expect(runDay(dir, 0, { execute: async () => { throw Error('private driver failure'); } }, grader)).rejects.toThrow();
  expect(readdirSync(join(dir, 'events'))).toContain('lookup.bare.0.interrupted.json');
  let called = false;
  await expect(runDay(dir, 0, { execute: async (r: Request) => { called = true; return driver.execute(r); } }, grader)).rejects.toThrow('unfinished intent');
  expect(called).toBe(false);
});

it('checks stop, finite deadlines, prior stages, and cumulative cap across invocations', async () => {
  const dir = root(); initialize(dir, config()); writeFileSync(join(dir, 'STOP'), 'stop');
  await expect(runDay(dir, 0, driver, grader)).rejects.toThrow('operator stop');
  const timed = root(); initialize(timed, { ...config(), timeoutMs: 5 });
  await expect(runDay(timed, 0, { execute: () => new Promise(() => {}) }, grader)).rejects.toThrow('uncertain');
  const staged = root(); initialize(staged, { ...config(), taskIds: ['decision-across-topics'] });
  await expect(runDay(staged, 2, driver, grader)).rejects.toThrow('earlier stage');
  await runDay(staged, 0, driver, grader); await runDay(staged, 2, driver, grader); expect(rows(staged)).toHaveLength(6);
  const capped = root(); initialize(capped, { ...config(), maxCalls: 1 });
  const metered = { execute: async (r: Request) => { const v = await driver.execute(r); v.totals.calls = 1; v.costs[0]!.calls = 1; return v; } };
  await expect(runDay(capped, 0, metered, grader)).rejects.toThrow('cap');
  await expect(runDay(capped, 0, metered, grader)).rejects.toThrow('cap'); expect(rows(capped)).toHaveLength(1);
});

it('rejects model drift, unallocated tokens, unknown grades and floor ablations', async () => {
  const request = { id: 'test', model: 'claude-opus-5-5', fixtures: {}, boundary: 'fresh' };
  const raw = await driver.execute(request);
  expect(() => validateResult({ ...raw, model: 'fallback' }, request, 10)).toThrow('model drift');
  expect(() => validateResult({ ...raw, totals: { tokens: 1, calls: 0 } }, request, 10)).toThrow('reconcile');
  expect(() => validateResult({ ...raw, costs: [{ ...raw.costs[0], part: 'unclassified' }] }, request, 10)).toThrow();
  expect(() => validateConfig({ ...config(), off: ['safety-delivery'] })).toThrow('floors');
  const task = tasks.find(t => t.id === 'lookup')!;
  const uncertain = { ...raw, state: 'uncertain' };
  const grade = await grader.grade({ task, result: uncertain }); grade.correctness = 'pass';
  expect(() => validateGrade(grade, task, uncertain)).toThrow('uncertain');
  expect(() => partVerdict('copy-coaching', [], [], { verdict: 'cut', reason: 'cheaper', evidence: ['cost'] })).toThrow('whole staged');
  expect(() => partVerdict('state-recovery', [], [], { verdict: 'cut', reason: 'cheaper', evidence: ['cost'] })).toThrow('infrastructure');
  expect(partVerdict('copy-coaching', [], [], { verdict: 'change', reason: 'unmeasured', evidence: ['stub-only'] }).verdict).toBe('change');
});

it('live preflight refuses shared or excluded identities and stages before their day', async () => {
  const live = { ...config(), mode: 'live', driverModule: 'driver.mjs', graderModule: 'grader.mjs', targets: Object.fromEntries(['bare', 'instar1', 'instar2'].map((s, i) => [s, { disposable: true, model: config().model, root: `/scratch/${s}`, login: `demo-${i}`, bot: `bot-${i}`, channel: `demo-${i}`, isolationReceipt: 'receipt', floorReceipt: 'receipt' }])) };
  expect(validateConfig(live)).toBe(live);
  const dir = root(); initialize(dir, live);
  await expect(runDay(dir, 0, driver, grader, () => 0)).rejects.toThrow('not due');
  live.targets.bare!.login = 'amrch2388'; expect(() => validateConfig(live)).toThrow('allowed login');
  live.targets.bare!.login = live.targets.instar1!.login; expect(() => validateConfig(live)).toThrow('separate');
});

it('uses actual stage spacing for late campaigns, admits the exact boundary, and retains stub compression', async () => {
  const live = { ...config(), taskIds: ['standing-format'], mode: 'live', driverModule: 'driver.mjs', graderModule: 'grader.mjs',
    targets: Object.fromEntries(['bare', 'instar1', 'instar2'].map(s => [s, { disposable: true, model: config().model,
      root: `/scratch/${s}`, login: `demo-${s}`, bot: `bot-${s}`, channel: `demo-${s}`, isolationReceipt: 'receipt', floorReceipt: 'receipt' }])) };
  const dir = root(); initialize(dir, live);
  const late = Date.parse(live.start) + 4 * 86400000;
  let time = late;
  await runDay(dir, 0, driver, grader, () => time);
  for (const offset of [0, 2 * 86400000 - 1]) {
    time = late + offset;
    await expect(runDay(dir, 2, driver, grader, () => time)).rejects.toThrow('elapsed stage spacing');
    expect(rows(dir)).toHaveLength(3);
    expect(readdirSync(join(dir, 'events')).some(n => n.includes('.1.intent'))).toBe(false);
  }
  time = late + 2 * 86400000;
  await runDay(dir, 2, driver, grader, () => time);
  await expect(runDay(dir, 4, driver, grader, () => time)).rejects.toThrow('elapsed stage spacing');
  time = late + 4 * 86400000;
  await runDay(dir, 4, driver, grader, () => time);
  expect(rows(dir)).toHaveLength(9);
  const stub = root(); initialize(stub, { ...config(), taskIds: ['standing-format'] });
  for (const day of [0, 2, 4]) await runDay(stub, day, driver, grader, () => late);
  expect(rows(stub)).toHaveLength(9);
});

it('captures and meters an evidenced unsupported boundary without dispatch while other setups continue', async () => {
  const targets = Object.fromEntries(['bare', 'instar1', 'instar2'].map(s => [s, { root: `/scratch/${s}`, model: config().model,
    disposable: true, live: false, actualMachine: 'A', epoch: '1', receipt: `inspect-${s}`,
    floors: { secrets: true, spendCap: true, stop: true, uniqueSend: true, durableIntake: true } }]));
  const dispatched: string[] = [], metered: string[] = [];
  let unsupportedReceipt = 'unsupported-compact';
  const host = {
    inspect: async (target: object) => target,
    prepare: async ({ request }: { request: Request }) => ({ requestId: request.id, model: request.model, receipt: 'prepared', copyLineage: 'seed', ablated: [] }),
    boundary: async (name: string, { request }: { request: Request }) => request.setup === 'bare' && name === 'compact'
      ? { state: 'unsupported', actual: false, reason: 'No retained context to compact', receipt: unsupportedReceipt }
      : { actual: true, receipt: 'actual-boundary', beforeContext: 'old', afterContext: 'new' },
    executeBounded: async ({ request }: { request: Request }) => { dispatched.push(request.id); return { state: 'complete', model: request.model }; },
    sendAsDemoUser: async ({ request }: { request: Request }) => { dispatched.push(request.id); return { messageId: request.id, receipt: 'sent' }; },
    awaitReply: async ({ request }: { request: Request }) => ({ state: 'complete', model: request.model, inReplyTo: request.id }),
    collectMessages: async () => { throw Error('must not collect unsupported boundary'); },
    meter: async ({ request }: { request: Request }) => { metered.push(request.id); return { breaches: [], costs: [
      { id: 'prepare', part: 'model-work', calls: 1, tokens: 5, wallMs: 0, evidence: 'preparation-meter' },
    ], totals: { calls: 1, tokens: 5 } }; },
  };
  const adapter = createDriver(host);
  const dir = root(); initialize(dir, { ...config(), taskIds: ['reground-after-compaction'], targets });
  await runDay(dir, 0, adapter, grader);
  await runDay(dir, 2, adapter, grader);
  const results = rows(dir), unsupported = results.find(r => r.result.state === 'unsupported');
  expect(results).toHaveLength(6);
  expect(unsupported.setup).toBe('bare');
  expect(unsupported.result.evidence).toContain('unsupported-compact');
  expect(unsupported.result.totals).toEqual({ calls: 1, tokens: 5 });
  expect(metered).toContain('reground-after-compaction.bare.1');
  expect(dispatched).not.toContain('reground-after-compaction.bare.1');
  expect(dispatched).toContain('reground-after-compaction.instar2.1');
  expect(readdirSync(join(dir, 'events'))).toContain('reground-after-compaction.bare.1.capture.json');
  expect(unsupported.grade.correctness).not.toBe('pass');
  expect(() => validateGrade({ ...unsupported.grade, correctness: 'pass' }, tasks.find(t => t.id === 'reground-after-compaction')!, unsupported.result)).toThrow('cannot pass');
  const before = dispatched.length;
  await runDay(dir, 2, adapter, grader);
  expect(dispatched).toHaveLength(before);
  unsupportedReceipt = '';
  await expect(adapter.execute({ id: 'missing-evidence', setup: 'bare', model: config().model,
    target: targets.bare, boundary: 'compact', prompt: null })).rejects.toThrow('unsupported boundary lacks evidence');
  expect(dispatched).toHaveLength(before);
});

it('allows a complete measured pair, but refuses a cut that loses trust or leaves a task ungraded', () => {
  const makeRows = (off: string[]) => tasks.flatMap(task => task.stages.map((_, stage) => ({
    task: task.id, stage, setup: 'instar2', mode: 'live', off,
    result: { model: config().model, state: 'complete', breaches: [], costs: [{ tokens: 1, calls: 1, wallMs: 1 }] },
    grade: { correctness: 'pass', trust: Object.fromEntries(task.trust.map(k => [k, 'pass'])) },
  })));
  const a = makeRows([]), b = makeRows(['copy-coaching']);
  const judgment = { verdict: 'cut', reason: 'Full paired observations preserve outcomes with lower allocated coaching cost.', evidence: ['paired-run-evidence'] };
  expect(partVerdict('copy-coaching', a, b, judgment).verdict).toBe('cut');
  b.at(-1)!.grade.trust.honestLimits = 'fail';
  expect(() => partVerdict('copy-coaching', a, b, judgment)).toThrow('lower correctness/trust');
  b.at(-1)!.grade.trust.honestLimits = 'unknown';
  expect(() => partVerdict('copy-coaching', a, b, judgment)).toThrow('unknowns');
});

it('each text switch changes only a disposable copy, preserves floor instructions and records undo bytes', () => {
  for (const part of parts.filter(p => p.kind === 'compensating')) {
    const copy = realpathSync(mkdtempSync(join(tmpdir(), 'harness-tax-copy-')));
    mkdirSync(join(copy, 'tests/preview'), { recursive: true });
    for (const file of ['briefing.ts', 'answer-provenance.ts']) writeFileSync(join(copy, 'tests/preview', file), readFileSync(join('tests/preview', file)));
    const receipt = { root: copy, disposable: true, sourceDigest: 'fixture-copy' };
    writeFileSync(join(copy, 'harness-tax-copy.json'), JSON.stringify(receipt));
    const result = ablate(copy, part.id, receipt); expect(result.beforeDigest).not.toBe(result.afterDigest);
    expect(readFileSync(join(copy, 'tests/preview/briefing.ts'), 'utf8')).toContain('secrets, the spend cap, stop, no duplicate sends and durable intake');
    expect(() => ablate(copy, part.id, receipt)).toThrow();
    expect(() => ablate(copy, 'safety-delivery', receipt)).toThrow();
  }
});

it('ports the three real adapter recipes and requires actual movement/restart, matched replies and model', async () => {
  const recipes: { argv?: string[]; copyOfSanitizedRoot?: boolean }[] = [];
  const target = { root: '/scratch/demo', login: 'demo', bot: 'demo-bot', channel: 'demo-channel', disposable: true, live: false, model: config().model,
    floors: { secrets: true, spendCap: true, stop: true, uniqueSend: true, durableIntake: true }, receipt: 'inspect', actualMachine: 'A', epoch: '1' };
  const observation = { state: 'complete', model: config().model, inReplyTo: 'message-1', responderMachine: 'B', evidence: ['reply-1'] };
  const host = {
    inspect: async () => target,
    prepare: async ({ request, recipe }: { request: Request; recipe: typeof recipes[number] }) => { recipes.push(recipe); return { requestId: request.id, receipt: 'prepared', model: request.model, copyLineage: 'sanitized-seed', ablated: [] }; },
    boundary: async () => ({ receipt: 'boundary', actual: true, beforeMachine: 'A', afterMachine: 'B', beforeEpoch: '1', afterEpoch: '2' }),
    executeBounded: async ({ argv }: { argv: string[] }) => { expect(argv.slice(0, 2)).toEqual(['claude', '-p']); return observation; },
    sendAsDemoUser: async () => ({ messageId: 'message-1', receipt: 'send' }),
    awaitReply: async () => observation,
    collectMessages: async () => ({ ...observation, completeWindow: true }),
    meter: async () => ({ breaches: [], totals: { tokens: 0, calls: 0 }, costs: [] }),
  };
  const adapter = createDriver(host);
  for (const setup of ['bare', 'instar1', 'instar2']) await adapter.execute({ id: 'r', model: config().model, setup, target, prompt: 'hi', boundary: 'fresh', off: [], deadlineMs: 10 });
  expect(recipes[1]!.argv!.slice(0, 2)).toEqual(['instar', 'init']); expect(recipes[2]!.copyOfSanitizedRoot).toBe(true);
  const request = { id: 'r', model: config().model, setup: 'instar2', target, prompt: 'hi', boundary: 'move-machine', off: [], deadlineMs: 10 };
  await adapter.execute(request);
  observation.responderMachine = 'A'; await expect(adapter.execute(request)).rejects.toThrow('destination');
  observation.inReplyTo = 'wrong'; await expect(adapter.execute({ ...request, boundary: 'fresh' })).rejects.toThrow('correlated');
  target.floors.stop = false; await expect(adapter.execute(request)).rejects.toThrow('floor');
});

it('replays real archived writer, reviewer, Jev and delivered rows without turning them into task passes', () => {
  const fixture = JSON.parse(readFileSync('tests/preview/fixtures/proofroom-summary-cascade-stall-2026-09-30.json', 'utf8')) as { writer: object[]; review: object[]; jevFaithfulness: object[]; rows: { kind: string }[] };
  const captures = [...fixture.writer, ...fixture.review, ...fixture.jevFaithfulness,
    ...fixture.rows.filter(r => ['answer', 'sent', 'reply-check', 'summary-faithfulness', 'summary-uncertain', 'model-call'].includes(r.kind))];
  expect(captures.length).toBeGreaterThan(6);
  for (const capture of captures) {
    const observed = recordedObservation(capture);
    expect(observed.digest).toBe(digest(capture)); expect(observed).not.toHaveProperty('correctness');
  }
  const uncertain = JSON.parse(readFileSync('tests/preview/fixtures/uncertain-provider-969390396.json', 'utf8'));
  expect(recordedObservation(uncertain).state).toBe('uncertain');
  expect(recordedObservation(fixture.rows.find(r => r.kind === 'summary-faithfulness')!).state).toBe('undecided');
  const jev = JSON.parse(readFileSync('tests/preview/fixtures/jev-admission-2026-10-12.json', 'utf8')) as { cases: { checks: object[] }[] };
  for (const capture of jev.cases.flatMap(r => r.checks)) expect(recordedObservation(capture).state).toBe('unavailable');
  // Explicit synthetic control: archived empty memory candidates are not delivered empty bubbles.
  expect(recordedObservation({ id: 'synthetic-empty-delivery', kind: 'answer', text: '', state: 'complete' }).output).toBe('');
});

for (const [boundary, identity, error] of [
  ['move-machine', 'Machine', 'seat never moved'],
  ['restart', 'Epoch', 'process never restarted'],
  ['compact', 'Context', 'context was not compacted'],
]) {
  it(`requires both ${boundary} identities before dispatch, preserving distinct pairs`, async () => {
    const target = { root: '/scratch/demo', disposable: true, live: false, model: config().model,
      floors: { secrets: true, spendCap: true, stop: true, uniqueSend: true, durableIntake: true },
      receipt: 'inspect', actualMachine: 'A', epoch: 'A' };
    let receipt: Record<string, unknown> = {};
    let sends = 0;
    const host = {
      inspect: async () => target,
      prepare: async ({ request }: { request: Request }) => ({ requestId: request.id, receipt: 'prepared', model: request.model }),
      boundary: async () => ({ receipt: 'boundary', actual: true, ...receipt }),
      sendAsDemoUser: async () => { sends++; return { messageId: 'message', receipt: 'sent' }; },
      awaitReply: async () => ({ state: 'complete', model: config().model, inReplyTo: 'message', responderMachine: 'A' }),
      meter: async () => ({ breaches: [], totals: { tokens: 0, calls: 0 }, costs: [] }),
    };
    const adapter = createDriver(host);
    const request = { id: 'boundary-check', model: config().model, setup: 'instar1', target, prompt: 'hi', boundary, deadlineMs: 10 };
    for (const side of ['before', 'after']) {
      for (const invalid of [undefined, null, '', '   ', 1, true, {}, []]) {
        receipt = { [`before${identity}`]: 'old', [`after${identity}`]: 'A' };
        if (invalid === undefined) delete receipt[`${side}${identity}`];
        else receipt[`${side}${identity}`] = invalid;
        await expect(adapter.execute(request)).rejects.toThrow(error);
        expect(sends).toBe(0);
      }
    }
    receipt = { [`before${identity}`]: 'A', [`after${identity}`]: 'A' };
    await expect(adapter.execute(request)).rejects.toThrow(error);
    expect(sends).toBe(0);
    receipt = { [`before${identity}`]: 'old', [`after${identity}`]: 'A' };
    expect((await adapter.execute(request)).state).toBe('complete');
    expect(sends).toBe(1);
  });
}
