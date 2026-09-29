// @ts-nocheck -- physical CLI fixture values intentionally cross the JS host boundary.
import { expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { subscriptionCallOutcome, observedSubscriptionIO } from './call-diagnostics.mjs';
import { openPreviewJournal, MODEL_FAILURE_REPLY } from './journal.js';
import { mkdtempSync, readFileSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';

const frame = (outputTokens, subtype = 'success') => JSON.stringify({ type: 'result', subtype,
  is_error: false, result: 'provider text must not be stored', usage: { output_tokens: outputTokens } });
const physical = (stdout, extra = {}) => ({ code: 0, limited: false, localLimit: null, stdout, ...extra });

it('extracts only metadata from a genuine redacted Claude Code result capture', () => {
  const stdout = readFileSync(join(process.cwd(), 'tests/fixtures/provider-failure/claude-limit-result.json'), 'utf8');
  const outcome = subscriptionCallOutcome(physical(stdout, { code: 1 }), 100, 50, 2048, 16384);
  expect(outcome).toMatchObject({ exitCode: 1, localLimit: null, type: 'result', subtype: 'success',
    isError: true, outputTokens: 0, promptBytes: 100 });
  expect(JSON.stringify(outcome)).not.toContain(JSON.parse(stdout).result);
});

it('distinguishes a parsed 2048-token over-cap result from a 120-second local timeout without retaining prose', () => {
  const over = subscriptionCallOutcome(physical(frame(2049)), 4096, 25, 2048, 16384);
  expect(over).toEqual({ exitCode: 0, localLimit: 'output-cap', elapsedMs: 25, type: 'result', subtype: 'success',
    isError: false, outputTokens: 2049, promptBytes: 4096 });
  const timeout = subscriptionCallOutcome(physical('', { code: null, limited: true, localLimit: 'timeout' }),
    4096, 120000, 2048, 16384);
  expect(timeout).toEqual({ exitCode: null, localLimit: 'timeout', elapsedMs: 120000, type: null, subtype: null,
    isError: null, outputTokens: null, promptBytes: 4096 });
  expect(subscriptionCallOutcome(physical(frame(3), { localLimit: 'size', limited: true }), 10, 5, 2048, 16384)
    .localLimit).toBe('size');
  expect(subscriptionCallOutcome(physical(frame(3, 'secret provider prose')), 10, 5, 2048, 16384)
    .subtype).toBe('other');
  expect(JSON.stringify(over)).not.toContain('provider text');
});

it('durably records each physical model result before returning, without recording preflight commands', async () => {
  const rows = [], policy = { args: ['--safe-mode', '--print'], maxTokens: 2048, maxOutputBytes: 16384 };
  const commands = [], physicalIO = { execute: async command => { commands.push(command.args);
    if (command.args[0] === '--version') return physical('2.1.280 (Claude Code)');
    return physical(frame(2049)); } };
  let elapsed = 0;
  const io = observedSubscriptionIO(physicalIO, policy, 'summary:2', row => rows.push(row),
    { elapsed: () => (elapsed += 5), at: () => 123 });
  await io.execute({ args: ['--version'], stdin: '', timeout: 5000 });
  expect(rows).toHaveLength(0);
  const result = await io.execute({ args: policy.args, stdin: 'prompt', timeout: 120000 });
  expect(result.stdout).toContain('provider text');
  expect(rows).toMatchObject([{ kind: 'call-outcome', role: 'summary', id: 'summary:2', at: 123,
    outcome: { localLimit: 'output-cap', elapsedMs: 5, promptBytes: 6, outputTokens: 2049 } }]);
  expect(JSON.stringify(rows)).not.toContain('provider text');
  expect(commands).toHaveLength(2);
  const failureRows = [];
  const failing = observedSubscriptionIO({ execute: async () => { throw Error('provider prose'); } }, policy,
    'turn:1:reply-review', row => failureRows.push(row));
  await expect(failing.execute({ args: policy.args, stdin: 'review prompt' })).rejects.toThrow('physical invocation failed');
  expect(failureRows).toMatchObject([{ role: 'reply-review', outcome: { type: null, promptBytes: 13 } }]);
  expect(JSON.stringify(failureRows)).not.toContain('provider prose');
});

it('replays content-free answer, summary and reply-review outcomes and exposes bounded status counts', () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'preview-call-outcomes-')));
  const key = new Uint8Array(32).fill(7), path = join(root, 'journal.encrypted');
  const id = 'telegram:12345678:update:1';
  try {
    const journal = openPreviewJournal(path, key, { kind: 'genesis', bot: '12345678', chat: '7654321',
      operator: '7654321', grant: 'grant:preview', configurationDigest: 'sha256:offline', expires: 9999999999999,
      maxCalls: 20, maxReplies: 20, maxTurns: 20, maxBytes: 32768, cursor: 0 });
    journal.append({ kind: 'intake', id, update: 1, text: 'question', raw: 'question', accepted: true, cursor: 2, at: 1000 });
    journal.append({ kind: 'reserve', id, at: 1001 });
    const model = subscriptionCallOutcome(physical(frame(2049)), 40, 10, 2048, 16384);
    journal.append({ kind: 'call-outcome', id, role: 'model', outcome: model, at: 1010 });
    journal.append({ kind: 'answer', id, text: MODEL_FAILURE_REPLY, state: 'rejected', failureClass: 'rejected', at: 1011 });
    journal.append({ kind: 'summary-reserve', through: 1, at: 1012 });
    journal.append({ kind: 'call-outcome', id: 'summary:1', role: 'summary', outcome:
      subscriptionCallOutcome(physical('', { code: null, limited: true, localLimit: 'timeout' }), 50, 120000, 2048, 16384), at: 1013 });
    journal.append({ kind: 'summary-uncertain', through: 1, state: 'uncertain', at: 1014 });
    journal.append({ kind: 'reply-review-reserve', id, candidate: MODEL_FAILURE_REPLY, at: 1015 });
    journal.append({ kind: 'call-outcome', id: `${id}:reply-review`, role: 'reply-review', outcome:
      subscriptionCallOutcome(physical(frame(2)), 60, 20, 2048, 16384), at: 1016 });
    journal.close();
    const replayed = openPreviewJournal(path, key, undefined, undefined, true);
    expect(Object.fromEntries(replayed.view.callOutcomeCounts)).toMatchObject({ total: 3, 'role:model': 1,
      'role:summary': 1, 'role:reply-review': 1, 'output-cap': 1, timeout: 1, 'result-frame': 1 });
    expect(replayed.view.callOutcomes).toHaveLength(3);
    replayed.close();
    const status = spawnSync(process.execPath,
      ['--no-warnings', '--loader', './scripts/slice-ts-loader.mjs', 'tests/preview/journal-agent.mjs', 'status', '--root', root],
      { cwd: process.cwd(), encoding: 'utf8', timeout: 10000,
        env: { ...process.env, INSTAR_SECRET_PREVIEW_STORAGE_KEY: Buffer.from(key).toString('hex') } });
    expect(status.status, status.stderr).toBe(0);
    const parsed = JSON.parse(status.stdout);
    expect(parsed.callOutcomeCounts.total).toBe(3);
    expect(parsed.lastCallOutcomes.map(row => row.role)).toEqual(['model', 'summary', 'reply-review']);
    expect(JSON.stringify(parsed.lastCallOutcomes)).not.toContain('provider text');
  } finally { rmSync(root, { recursive: true, force: true }); }
});

it('keeps only the last ten outcomes in the status projection while counting all calls', () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'preview-call-window-')));
  const key = new Uint8Array(32).fill(7), path = join(root, 'journal.encrypted');
  try {
    const journal = openPreviewJournal(path, key, { kind: 'genesis', bot: '12345678', chat: '7654321',
      operator: '7654321', grant: 'grant:preview', configurationDigest: 'sha256:offline', expires: 9999999999999,
      maxCalls: 20, maxReplies: 20, maxTurns: 20, maxBytes: 32768, cursor: 0 });
    for (let update = 1; update <= 11; update++) {
      const id = `telegram:12345678:update:${update}`;
      journal.append({ kind: 'intake', id, update, text: 'q', raw: 'q', accepted: true, cursor: update + 1, at: update });
      journal.append({ kind: 'reserve', id, at: update });
      journal.append({ kind: 'call-outcome', id, role: 'model', outcome:
        subscriptionCallOutcome(physical(frame(1)), 10, 1, 2048, 16384), at: update });
    }
    expect(journal.view.callOutcomeCounts.get('total')).toBe(11);
    expect(journal.view.callOutcomes.map(row => row.id)).toEqual(
      Array.from({ length: 10 }, (_, index) => `telegram:12345678:update:${index + 2}`));
    journal.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
});

it('observes a paid summary review and reopens; rejects malformed diagnostics before append', async () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'preview-summary-review-outcome-')));
  const key = new Uint8Array(32).fill(7), path = join(root, 'journal.encrypted');
  try {
    const journal = openPreviewJournal(path, key, { kind: 'genesis', bot: '12345678', chat: '7654321',
      operator: '7654321', grant: 'grant:preview', configurationDigest: 'sha256:offline', expires: 9999999999999,
      maxCalls: 20, maxReplies: 20, maxTurns: 20, maxBytes: 32768, cursor: 0 });
    journal.append({ kind: 'intake', id: 'turn-1', update: 1, text: 'Remember this.', raw: 'remember',
      accepted: true, cursor: 2, at: 1000 });
    journal.append({ kind: 'summary-reserve', through: 1, at: 1001 });
    journal.append({ kind: 'summary-candidate', through: 1, state: '{}', at: 1002 });
    journal.append({ kind: 'summary-check', through: 1,
      result: { path: 'jev', verdict: 'unsure', latencyMs: 1 }, at: 1003 });
    journal.append({ kind: 'summary-review-reserve', through: 1, at: 1004 });
    const policy = { args: ['--safe-mode', '--print'], maxTokens: 2048, maxOutputBytes: 16384 };
    const io = observedSubscriptionIO({ execute: async () => physical(frame(2)) }, policy, 'summary:1:review',
      row => journal.append(row), { elapsed: () => 10, at: () => 1005 });
    await io.execute({ args: policy.args, stdin: 'review prompt', timeout: 120000 });
    const before = journal.size;
    expect(() => journal.append({ kind: 'call-outcome', id: 'summary:1:review', role: 'summary',
      outcome: { ...subscriptionCallOutcome(physical(frame(2)), 10, 10, 2048, 16384), elapsedMs: -1 }, at: 1006 }))
      .toThrow('call outcome malformed');
    expect(journal.size).toBe(before);
    journal.close();
    const replay = openPreviewJournal(path, key, undefined, undefined, true);
    expect(replay.view.order[0]?.text).toBe('Remember this.');
    expect(replay.view.callOutcomeCounts.get('role:summary')).toBe(1);
    replay.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
});

it('keeps each owned launch\'s resource facts on its durable call-outcome row across restart and compaction', () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'preview-call-resources-')));
  const key = new Uint8Array(32).fill(7), path = join(root, 'journal.encrypted');
  const id = 'telegram:12345678:update:1';
  const resources = { enforcement: { cpuPerProcess: 'hard', handlesPerProcess: 'hard', processGrowth: 'sampled', treeHandles: 'unsupported',
    memory: 'sampled', treeCpu: 'sampled' }, uidProcesses: { state: 'hard', subject: 'uid:501', limit: 900 },
    admission: { work: 'maintenance', concurrent: 2, waitedMs: 15 }, peakMemoryBytes: 1024, peakProcesses: 3, treeCpuMilliseconds: 40, census: 'complete',
    leakedDescendants: 2, cleanup: 'unresolved', membership: 'working-area-joined',
    allocation: { set: `allocation:sha256:${'c'.repeat(64)}`, state: 'reserved' }, provider: 'prose must not travel' };
  try {
    const journal = openPreviewJournal(path, key, { kind: 'genesis', bot: '12345678', chat: '7654321',
      operator: '7654321', grant: 'grant:preview', configurationDigest: 'sha256:offline', expires: 9999999999999,
      maxCalls: 20, maxReplies: 20, maxTurns: 20, maxBytes: 32768, cursor: 0 });
    journal.append({ kind: 'intake', id, update: 1, text: 'question', raw: 'question', accepted: true, cursor: 2, at: 1000 });
    journal.append({ kind: 'reserve', id, at: 1001 });
    const outcome = subscriptionCallOutcome(physical(frame(3), { resources }), 40, 10, 2048, 16384);
    const { provider: _prose, ...kept } = resources;
    expect(outcome.resources).toEqual(kept);
    // A malformed resource record is refused, not stored.
    expect(() => journal.append({ kind: 'call-outcome', id, role: 'model', outcome: { ...outcome, resources: { ...outcome.resources, census: 'lots' } }, at: 1009 }))
      .toThrow(/call outcome malformed/u);
    // A user-ID limit without its subject, or an admission without its concurrency, is refused too.
    expect(() => journal.append({ kind: 'call-outcome', id, role: 'model', outcome: { ...outcome, resources: { ...outcome.resources,
      uidProcesses: { state: 'hard', subject: 'tree', limit: 4 } } }, at: 1009 })).toThrow(/call outcome malformed/u);
    expect(() => journal.append({ kind: 'call-outcome', id, role: 'model', outcome: { ...outcome, resources: { ...outcome.resources,
      admission: { work: 'maintenance', concurrent: 0, waitedMs: 0 } } }, at: 1009 })).toThrow(/call outcome malformed/u);
    // A Six allocation must name a real set id and a returned/reserved state.
    expect(() => journal.append({ kind: 'call-outcome', id, role: 'model', outcome: { ...outcome, resources: { ...outcome.resources,
      allocation: { set: 'set-1', state: 'returned' } } }, at: 1009 })).toThrow(/call outcome malformed/u);
    expect(() => journal.append({ kind: 'call-outcome', id, role: 'model', outcome: { ...outcome, resources: { ...outcome.resources,
      membership: 'confined' } }, at: 1009 })).toThrow(/call outcome malformed/u);
    journal.append({ kind: 'call-outcome', id, role: 'model', outcome, at: 1010 });
    journal.compact();
    journal.close();
    const replayed = openPreviewJournal(path, key, undefined, undefined, true);
    expect(Object.fromEntries(replayed.view.callOutcomeCounts)).toMatchObject({ 'leaked-descendants': 2, 'cleanup-unresolved': 1 });
    expect(replayed.view.callOutcomes.at(-1)!.outcome.resources).toMatchObject({ admission: { concurrent: 2 }, uidProcesses: { subject: 'uid:501' },
      membership: 'working-area-joined', allocation: { state: 'reserved' } });
    replayed.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
});
