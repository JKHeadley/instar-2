// @ts-nocheck -- the harness's model doorway is a scripted proposer; every other step is the shipped path.
import { expect, it } from 'vitest';
import { existsSync, mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { resolveActivePackage } from '../../src/assembly/index.js';
import { SELF_HOST_CONTEXT as context, attemptLedger, selfHost } from './self-host.mjs';
import { createSelfHostHarness, latchStop, openRecordLog, readDurable } from './self-host-harness.mjs';
import { createPackageLifecycle } from './self-host-packages.mjs';
import { hashBytes } from '../../src/facts/index.js';

const NS = 'agent.word-count';
const module = body => `export function wordCount(text) { ${body} }\n`;
const GOOD = 'return text.split(/\\s+/u).filter(Boolean).length;';
const test = "import { test } from 'node:test';\nimport assert from 'node:assert/strict';\nimport { wordCount } from './word-count.mjs';\n"
  + "test('counts words', () => { assert.equal(wordCount('one two  three'), 3); assert.equal(wordCount('   '), 0); });\n";
const plan = (body, { version = '1.0.0', expect: expected = 5, testText = test, tools = [] } = {}) => JSON.stringify({
  files: [{ path: 'word-count.mjs', content: module(body) }, { path: 'word-count.test.mjs', content: testText }],
  tools: [{ operation: 'package-test', params: ['word-count.test.mjs'] }, ...tools],
  package: { namespace: NS, version, entrypoints: [{ id: 'word-count', path: 'word-count.mjs' }],
    probe: { entrypoint: 'word-count', export: 'wordCount', input: 'the native harness built this', expect: expected } } });
const temp = () => realpathSync(mkdtempSync(join(tmpdir(), 'self-host-')));
const host = (root, replies, extra = {}) => {
  const prompts = [];
  const propose = async (prompt, meta) => { prompts.push({ ...JSON.parse(prompt), operation: meta.operation }); const next = replies.length > 1 ? replies.shift() : replies[0];
    if (typeof next === 'function') return next(); return next; };
  return { prompts, run: task => selfHost({ task, propose, repo: process.cwd(), root, grants: ['local-install'], context, ...extra }) };
};
const records = root => readDurable(join(root, 'assembly.jsonl')).map(row => row.record);
const active = root => resolveActivePackage(NS, openRecordLog(root, context).rows(), context);
const lifecycleAt = root => { const log = openRecordLog(root, context), stopped = () => false;
  const harness = createSelfHostHarness({ root, context, stopped, now: () => Date.now(), log });
  return createPackageLifecycle({ context, log, harness, stopped, work: 'work:check' }); };

it('develops, tests, repairs, packages, installs and exercises a local capability through the native adapter (Rules 2, 115)', async () => {
  const root = temp();
  try {
    const stage = { operation: 'stage-package', params: [], options: { namespace: NS, version: '1.0.0' } };
    // Round 1 ships a bug its own test catches; round 2 repairs it from the recorded test output.
    const { prompts, run } = host(root, [plan("return text.split(' ').length;"), plan(GOOD, { tools: [stage, { operation: 'shell', params: ['rm -rf /'] }] })]);
    const report = await run('Build a word-count capability.');
    expect(report).toMatchObject({ namespace: NS, passed: true, rounds: 2 });
    expect(prompts[1].feedback.failed.some(item => item.tool === 'package-test' && item.code !== 0)).toBe(true);
    expect(prompts.map(item => item.operation)).toEqual([expect.stringMatching(/:1$/u), expect.stringMatching(/:2$/u)]);
    expect(report.tools.find(item => item.tool === 'shell').refused).toContain('not registered');
    expect(report.tools.find(item => item.tool === 'stage-package' && !item.refused)).toMatchObject({ code: 0, contentDigest: report.contentDigest });
    // The owner resolves the active package from the recorded transitions; its evidence is the confined runs' own observations.
    const resolved = active(root); expect(resolved.kind).toBe('Success'); expect(resolved.value.contentDigest).toBe(report.contentDigest);
    const all = records(root), switched = all.filter(row => row.type === 'PackageTransition').at(-1);
    expect(switched).toMatchObject({ from: 'activating', to: 'active', observedArtifactDigest: report.contentDigest });
    for (const id of [...switched.testEvidence, ...switched.probeEvidence])
      expect(all.find(row => row.id === id)).toMatchObject({ type: 'HarnessObservation', phase: 'exit-observed', detail: 'exit 0' });
    const phases = all.filter(row => row.type === 'HarnessObservation').map(row => row.phase);
    expect(phases.slice(0, 3)).toEqual(['launched', 'input-accepted', 'exit-observed']);
    expect(readDurable(join(root, 'self-host.jsonl')).map(row => row.phase)).toEqual(['written', 'tools', 'written', 'tools', 'installed']);
    expect(readDurable(join(root, 'attempts.jsonl')).map(row => row.state)).toEqual(['started', 'settled', 'started', 'settled']);
  } finally { rmSync(root, { recursive: true, force: true }); }
}, 120000);

it('generated code runs confined: it cannot write outside its scope or read the launcher environment, beside a passing capability', async () => {
  const root = temp(), previous = process.env.ASTRA_FAKE_SECRET;
  process.env.ASTRA_FAKE_SECRET = 'fabricated-launcher-value';
  try {
    const probe = `${test}import { writeFileSync, readFileSync } from 'node:fs';
test('escape attempt', () => {
  const tried = {};
  for (const [name, fn] of Object.entries({ relative: () => writeFileSync(new URL('../outside-scope.txt', import.meta.url), 'x'),
    root: () => writeFileSync(${JSON.stringify(join(root, 'escaped.txt'))}, 'x'),
    read: () => readFileSync(${JSON.stringify(join(root, 'attempts.jsonl'))}, 'utf8') })) { try { fn(); tried[name] = 'allowed'; } catch { tried[name] = 'denied'; } }
  console.log('@escape ' + JSON.stringify({ ...tried, secret: process.env.ASTRA_FAKE_SECRET ?? null, keys: Object.keys(process.env).length }));
});\n`;
    const report = await host(root, [plan(GOOD, { testText: probe })]).run('Build a word-count capability; probe the confinement.');
    expect(report.passed).toBe(true);
    const tested = report.tools.find(item => item.tool === 'package-test');
    expect(tested.code).toBe(0);
    expect(JSON.parse(tested.output.match(/@escape (\{.*\})/u)[1])).toEqual({ relative: 'denied', root: 'denied', read: 'denied', secret: null, keys: 0 });
    expect(existsSync(join(root, 'escaped.txt'))).toBe(false);
    expect(existsSync(join(root, 'release/work/outside-scope.txt'))).toBe(false);
    expect(active(root).value.contentDigest).toBe(report.contentDigest);
  } finally {
    if (previous === undefined) delete process.env.ASTRA_FAKE_SECRET; else process.env.ASTRA_FAKE_SECRET = previous;
    rmSync(root, { recursive: true, force: true });
  }
}, 120000);

it('a probe that never settles is killed at its bound without holding the launcher, and its package stays inhibited', async () => {
  const root = temp();
  try {
    const started = Date.now();
    const hung = plan("return new Promise(() => setInterval(() => {}, 1000));", { testText: "import { test } from 'node:test';\ntest('loads', () => {});\n" });
    const report = await host(root, [hung], { wallMs: 3000 }).run('Build a capability whose probe hangs.');
    expect(report.passed).toBe(false);
    expect(Date.now() - started).toBeLessThan(60000);
    const all = records(root);
    expect(all.some(row => row.type === 'HarnessObservation' && row.detail === 'killed at the 3000 ms bound')).toBe(true);
    expect(all.filter(row => row.type === 'PackageTransition').every(row => row.to === 'inhibited')).toBe(true);
    expect(active(root).kind).toBe('Refused');
  } finally { rmSync(root, { recursive: true, force: true }); }
}, 120000);

it('a failed replacement stays inhibited, the prior version stays active and usable, and a reused version label is refused', async () => {
  const root = temp();
  try {
    const first = await host(root, [plan(GOOD)]).run('Build word-count 1.0.0.');
    const v1 = active(root).value, v1Dir = join(root, 'release/packages', v1.contentDigest.slice(7));
    const v1Bytes = readFileSync(join(v1Dir, 'word-count.mjs'), 'utf8');
    // A replacement whose own tests pass but whose installed probe fails.
    const second = await host(root, [plan(`${GOOD} /* v1.1 */`, { version: '1.1.0', expect: 999 })]).run('Replace word-count with 1.1.0.');
    expect(second.passed).toBe(false);
    const transitions = records(root).filter(row => row.type === 'PackageTransition');
    expect(transitions.slice(-2).map(row => [row.to, row.observedArtifactDigest])).toEqual([['inhibited', expect.not.stringMatching(v1.contentDigest)], ['active', v1.contentDigest]]);
    expect(active(root).value.contentDigest).toBe(first.contentDigest);
    // Reusing an installed version label for different bytes is refused at staging; nothing is overwritten.
    const third = await host(root, [plan(`${GOOD} /* different bytes */`)]).run('Reuse the 1.0.0 label.');
    expect(third.passed).toBe(false);
    expect(third.feedback.failed[0].output).toContain('already names different immutable bytes');
    expect(readFileSync(join(v1Dir, 'word-count.mjs'), 'utf8')).toBe(v1Bytes);
    expect(active(root).value.contentDigest).toBe(first.contentDigest);
    // The retained prior version still behaves.
    expect(lifecycleAt(root).exercise(active(root).value)).toMatchObject({ passed: true, actual: 5 });
  } finally { rmSync(root, { recursive: true, force: true }); }
}, 180000);

it('a cut during activation is completed by the next run, and behavior is retained across a compatible update', async () => {
  const root = temp();
  try {
    await expect(host(root, [plan(GOOD)], { crashAfterActivating: true }).run('Build word-count, interrupted.')).rejects.toThrow('simulated crash during activation');
    expect(records(root).filter(row => row.type === 'PackageTransition').at(-1).to).toBe('activating');
    expect(active(root).kind).toBe('Refused');
    // The next run recovers the interrupted switch from the record log before any new work.
    const next = await host(root, [plan(`${GOOD} /* v1.1 */`, { version: '1.1.0' })]).run('Update word-count to 1.1.0.');
    expect(next.recovered).toEqual([{ namespace: NS, completed: expect.stringMatching(/^sha256:/u) }]);
    const v1 = next.recovered[0].completed;
    expect(next.passed).toBe(true);
    expect(active(root).value.contentDigest).toBe(next.contentDigest);
    expect(active(root).value.priorPackage).toContain('1.0.0');
    // A platform update (the pinned runtime and profile re-materialized) keeps the retained packages and the active behavior.
    rmSync(join(root, 'release/runtime'), { recursive: true, force: true }); rmSync(join(root, 'release/runtime.json'), { force: true });
    const lifecycle = lifecycleAt(root);
    expect(lifecycle.exercise(active(root).value)).toMatchObject({ passed: true, actual: 5 });
    expect(existsSync(join(root, 'release/packages', v1.slice(7), 'word-count.mjs'))).toBe(true);
    expect(readdirSync(join(root, 'release/packages')).filter(name => !name.startsWith('.'))).toHaveLength(2);
  } finally { rmSync(root, { recursive: true, force: true }); }
}, 180000);

it('refuses every provider attempt and tool launch once the stop latch is set', async () => {
  const root = temp();
  try {
    latchStop(root, 1);
    const early = host(root, [plan(GOOD)]);
    expect(await early.run('Build word-count after stop.')).toMatchObject({ passed: false, stopped: true });
    expect(early.prompts).toHaveLength(0);
    expect(readDurable(join(root, 'attempts.jsonl'))).toEqual([]);
    rmSync(join(root, 'preview-stop.json'));
    // The operator stops while the model call is in flight: its plan is written as data, but nothing runs or installs.
    const late = host(root, [() => { latchStop(root, 2); return plan(GOOD); }]);
    expect(await late.run('Build word-count, stopped mid-call.')).toMatchObject({ passed: false, stopped: true });
    expect(records(root).filter(row => row.type === 'HarnessObservation')).toEqual([]);
    const harness = createSelfHostHarness({ root, context, stopped: () => true, now: () => 1, log: openRecordLog(root, context) });
    expect(harness.run({ mode: 'confined', kind: 'test', tool: 'package-test', work: 'w', directory: root, files: [] }).refused).toContain('stop latched');
  } finally { rmSync(root, { recursive: true, force: true }); }
}, 120000);

it('counts provider attempts durably across a restart and refuses past the allowance', async () => {
  const root = temp();
  try {
    const failing = plan("return 0;");
    const first = host(root, [failing]);
    expect(await first.run('A task whose tests keep failing.')).toMatchObject({ passed: false, rounds: 3 });
    expect(first.prompts).toHaveLength(3);
    // A new process on the same root (a restart) reads the same ledger and makes no further call.
    const restarted = host(root, [failing]);
    await expect(restarted.run('A task whose tests keep failing.')).rejects.toThrow('allowance exhausted (3 of 3 recorded)');
    expect(restarted.prompts).toHaveLength(0);
  } finally { rmSync(root, { recursive: true, force: true }); }
}, 180000);

it('an interrupted provider attempt stays charged after a restart', async () => {
  const root = temp();
  try {
    const task = 'A task whose process died mid-call.', ledger = attemptLedger(root, 1);
    ledger.begin(hashBytes(task), 1); // recorded before the call; the process then died with no settled row
    expect(ledger.unknown(hashBytes(task))).toBe(1);
    const restarted = host(root, [plan(GOOD)], { allowance: 1 });
    await expect(restarted.run(task)).rejects.toThrow('allowance exhausted (1 of 1 recorded)');
    expect(restarted.prompts).toHaveLength(0);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

it('refuses a malformed plan and a file outside the package scope before running anything', async () => {
  const root = temp();
  try {
    await expect(host(root, ['this is not a plan']).run('t1')).rejects.toThrow('plan is not one JSON object');
    await expect(host(root, [JSON.stringify({ files: [{ path: '../outside.mjs', content: 'x' }], tools: [] })]).run('t2')).rejects.toThrow('outside the package scope');
    expect(existsSync(join(root, 'outside.mjs'))).toBe(false);
    expect(records(root)).toEqual([]);
    // Without the install grant the install tool is refused by admission; nothing is recorded as active.
    const ungranted = await selfHost({ task: 't3', propose: async () => plan(GOOD), repo: process.cwd(), root, grants: [], context });
    expect(ungranted.passed).toBe(false);
    expect(ungranted.feedback.failed[0].refused).toContain('requires local-install');
    expect(active(root).kind).toBe('Refused');
  } finally { rmSync(root, { recursive: true, force: true }); }
}, 120000);
