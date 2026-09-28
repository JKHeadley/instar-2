// @ts-nocheck -- the registered doorway's physical IO is its captured-frame conformance fixture; every other step is the shipped path.
import { expect, it } from 'vitest';
import { existsSync, mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { OfflineJournal } from '../../scripts/fixed-native-worker-monitor.mjs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { resolveActivePackage } from '../../src/assembly/index.js';
import { SELF_HOST_CONTEXT as context, doorwayProvider, selfHost } from './self-host.mjs';
import { dispatchOwnedProvider, ownerStoreFacts, providerAttemptsOf, providerStores } from './self-host-owners.ts';
import { createSelfHostHarness, latchStop, openRecordLog, readDurable, stoppedAt } from './self-host-harness.mjs';
import { DOORWAY_CONFORMANCE } from './doorway-conformance.js';
import { successiveWorld } from './successive-fixture.js';
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
const NOW = 1790000002000, DOORWAY = 'claude-code-subscription', world = successiveWorld();
/** The registered doorway through its captured-frame fixture; each call answers the next scripted plan. */
const providerAt = (root, state) => doorwayProvider({ doorwayId: DOORWAY, io: DOORWAY_CONFORMANCE[DOORWAY].io(state), profile: DOORWAY_CONFORMANCE[DOORWAY].profile,
  activation: world.activation(), model: world.model, stopped: stoppedAt(root), now: () => NOW });
const host = (root, replies, extra = {}) => {
  const prompts = [];
  const state = { outcome: 'complete', calls: 0, stdin: [], answer: stdin => {
    // The doorway received Seven's exact submitted envelope; the harness's request travels in its context.
    prompts.push(JSON.parse(JSON.parse(stdin).messages[1].content).conversation[0].request);
    const next = replies.length > 1 ? replies.shift() : replies[0];
    return typeof next === 'function' ? next() : next; } };
  // A latched stop closes the doorway before a route exists; the run then reports the stop without any provider.
  const provider = () => providerAt(root, state).catch(error => { if (String(error?.message).includes('stopped or revoked')) return null; throw error; });
  return { prompts, state, run: async task => selfHost({ task, provider: await provider(), repo: process.cwd(), root, grants: ['local-install'], context, ...extra }) };
};
/** Each provider attempt's owner facts, in order, by kind (raw signed envelopes of its store). */
const kindsOf = store => store.facts.map(fact => fact.kind);
const bodyOf = fact => fact.body.record;
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
    const { prompts, state, run } = host(root, [plan("return text.split(' ').length;"), plan(GOOD, { tools: [stage, { operation: 'shell', params: ['rm -rf /'] }] })]);
    const report = await run('Build a word-count capability.');
    expect(report).toMatchObject({ namespace: NS, passed: true, rounds: 2 });
    expect(prompts[1].feedback.failed.some(item => item.tool === 'package-test' && item.code !== 0)).toBe(true);
    // Each model call is its own provider-owner operation: Seven's request (the exact submitted bytes captured), Eight's provider
    // request and Six's charge naming it are durable before the call; Eight's dispatch claims and consumes before invoking.
    const providers = providerStores(root);
    expect(providers).toHaveLength(2);
    for (const store of providers) {
      const kinds = kindsOf(store), at = kind => kinds.indexOf(kind);
      const request = store.facts.find(fact => fact.kind === 'judgment-provider-ProviderJudgmentRequest');
      const effect = store.facts.find(fact => fact.kind === 'effect-provider-ProviderEffectRequest');
      const reservations = store.facts.filter(fact => fact.kind === 'transport-AdmissionReservation');
      expect(reservations.map(fact => bodyOf(fact).state)).toEqual(['prepared', 'dispatch-claimed', 'consumed']);
      expect(bodyOf(reservations[0]).request).toBe(bodyOf(effect).id);
      expect(bodyOf(effect)).toMatchObject({ digest: bodyOf(request).inputDigest, payload: { submitted: bodyOf(request).submitted, submittedDigest: bodyOf(request).inputDigest } });
      expect(at('judgment-provider-ProviderJudgmentRequest')).toBeLessThan(at('effect-provider-ProviderEffectRequest'));
      expect(at('effect-provider-ProviderEffectRequest')).toBeLessThan(kinds.indexOf('transport-AdmissionReservation'));
      expect(at('transport-AdmissionReservation')).toBeLessThan(at('effect-provider-ProviderOperationObservation'));
    }
    // The captured submitted bytes are exactly what the doorway received, one call per attempt.
    expect(providers.map(store => { const capture = bodyOf(store.facts.find(fact => fact.kind === 'judgment-provider-ProviderJudgmentRequest')).submitted;
      return readFileSync(join(store.directory, 'captures', capture.hash.slice(7)), 'utf8'); }).sort()).toEqual([...state.stdin].sort());
    expect(report.tools.find(item => item.tool === 'shell').refused).toContain('not registered');
    expect(report.tools.find(item => item.tool === 'stage-package' && !item.refused)).toMatchObject({ code: 0, contentDigest: report.contentDigest });
    // The owner resolves the active package from the recorded transitions; its evidence is the confined runs' own observations.
    const resolved = active(root); expect(resolved.kind).toBe('Success'); expect(resolved.value.contentDigest).toBe(report.contentDigest);
    const all = records(root), switched = all.filter(row => row.type === 'PackageTransition').at(-1);
    expect(switched).toMatchObject({ from: 'activating', to: 'active', observedArtifactDigest: report.contentDigest });
    for (const id of [...switched.testEvidence, ...switched.probeEvidence])
      expect(all.find(row => row.id === id)).toMatchObject({ type: 'HarnessObservation', phase: 'exit-observed', detail: 'exited:worker-exit' });
    // Per launch: the S8 boundary's signed-receipt observation after the real spawn, the adapter's launch, the
    // delivered input, then the S8 exit observation and the adapter's exit, all naming one launch specification.
    const observations = all.filter(row => row.type === 'HarnessObservation'), first = observations.slice(0, 5);
    expect(first.map(row => [row.phase, row.detail])).toEqual([['launched', 'running:ok'], ['launched', 'actual process launch observed'],
      ['input-accepted', 'durable input accepted; consumption not yet claimed'], ['exit-observed', 'exited:worker-exit'], ['exit-observed', 'exited:worker-exit']]);
    expect(new Set(first.map(row => row.launch)).size).toBe(1);
    expect(first[0].sourceEvidence[0]).toMatch(/^spawned:[0-9]+$/u);
    expect(readDurable(join(root, 'self-host.jsonl')).map(row => row.phase)).toEqual(['provider', 'written', 'tools', 'provider', 'written', 'tools', 'installed']);
    // Every launch and provider attempt has its durable cause in an owner store: Six's prepared, claimed and
    // consumed reservation, and for a launch the HarnessLaunchSpec naming that prepared fact and the plan digest.
    const stores = ownerStoreFacts(root), body = fact => fact.body.record;
    expect(providerAttemptsOf(root, hashBytes('Build a word-count capability.'))).toBe(2);
    expect(readDurable(join(root, 'self-host.jsonl')).filter(row => row.phase === 'provider').map(row => row.operation).sort())
      .toEqual(providers.map(store => bodyOf(store.facts.find(fact => fact.kind === 'transport-AdmissionReservation')).operation).sort());
    // Each launch store: Eight's approved native-launch definition, Six's reservation naming Eight's request, Ten's specification
    // naming the prepared fact, Eight's recorded request (its parameters carry the plan digest and are the reservation's digest,
    // its closure names the Run opening, the reservation, the specification and the Six obligation), then the claim.
    for (const { facts } of stores) {
      const reservations = facts.filter(fact => fact.kind === 'transport-AdmissionReservation');
      expect(reservations.map(fact => body(fact).state)).toEqual(['prepared', 'dispatch-claimed', 'consumed']);
      const spec = facts.find(fact => fact.kind === 'assembly-HarnessLaunchSpec' && body(fact).id.startsWith('launch:'));
      const request = facts.find(fact => fact.kind === 'effect-EffectRequest' && fact.schemaVersion === 2);
      const definition = facts.find(fact => fact.kind === 'effect-OperationDefinition' && fact.schemaVersion === 2);
      const [prepared, claimed] = reservations, index = fact => facts.indexOf(fact);
      expect(body(spec)).toMatchObject({ processOperation: prepared.id, inputDigest: body(request).parameters.inputDigest });
      expect(body(request)).toMatchObject({ id: body(prepared).request, digest: body(prepared).digest, reservation: prepared.id, launchSpec: spec.id,
        definition: body(definition).id, operation: 'native-confined-launch' });
      expect(body(request).closure).toEqual(expect.arrayContaining([prepared.id, spec.id, body(request).pending, body(request).obligation]));
      expect([index(definition), index(prepared), index(spec), index(request), index(claimed)]).toEqual([...[index(definition), index(prepared), index(spec), index(request), index(claimed)]].sort((a, b) => a - b));
    }
    // Every lifecycle step names a real admitted launch: its Six operation, and that operation's dispatch claim in its own store.
    for (const row of all.filter(item => item.type === 'PackageTransition')) {
      const owner = stores.find(({ facts }) => facts.some(fact => fact.kind === 'transport-AdmissionReservation' && body(fact).operation === row.operation));
      expect(owner, row.id).toBeTruthy();
      expect(owner.facts.find(fact => fact.id === row.claim)).toMatchObject({ kind: 'transport-AdmissionReservation', body: { record: { state: 'dispatch-claimed', operation: row.operation } } });
    }
    expect(all.filter(row => row.type === 'HarnessObservation' && row.detail === 'running:ok').map(row => row.launch))
      .toEqual(expect.arrayContaining(stores.flatMap(({ facts }) => facts.filter(fact => fact.kind === 'assembly-HarnessLaunchSpec'
        && body(fact).id.startsWith('launch:')).map(fact => body(fact).id))));
  } finally { rmSync(root, { recursive: true, force: true }); }
}, 240000);

it('generated code runs confined: it cannot write outside its scope or read the launcher environment, beside a passing capability', async () => {
  const root = temp(), previous = process.env.ASTRA_FAKE_SECRET;
  process.env.ASTRA_FAKE_SECRET = 'fabricated-launcher-value';
  try {
    const probe = `${test}import { writeFileSync, readFileSync } from 'node:fs';
test('escape attempt', () => {
  const tried = {};
  for (const [name, fn] of Object.entries({ relative: () => writeFileSync(new URL('../outside-scope.txt', import.meta.url), 'x'),
    root: () => writeFileSync(${JSON.stringify(join(root, 'escaped.txt'))}, 'x'),
    read: () => readFileSync(${JSON.stringify(join(root, 'owners', '.storage-key'))}, 'utf8') })) { try { fn(); tried[name] = 'allowed'; } catch { tried[name] = 'denied'; } }
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
}, 240000);

it('a probe that never settles is killed at its bound without holding the launcher, and its package stays inhibited', async () => {
  const root = temp();
  try {
    const started = Date.now();
    const hung = plan("return new Promise(() => setInterval(() => {}, 1000));", { testText: "import { test } from 'node:test';\ntest('loads', () => {});\n" });
    const report = await host(root, [hung], { wallMs: 3000 }).run('Build a capability whose probe hangs.');
    expect(report.passed).toBe(false);
    expect(Date.now() - started).toBeLessThan(100000); // the 3 s bound plus the provider-owner call and the other launches
    const all = records(root);
    expect(all.some(row => row.type === 'HarnessObservation' && row.detail === 'expired:deadline')).toBe(true);
    expect(all.filter(row => row.type === 'PackageTransition').every(row => row.to === 'inhibited')).toBe(true);
    expect(active(root).kind).toBe('Refused');
  } finally { rmSync(root, { recursive: true, force: true }); }
}, 240000);

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
    expect(await lifecycleAt(root).exercise(active(root).value)).toMatchObject({ passed: true, actual: 5 });
  } finally { rmSync(root, { recursive: true, force: true }); }
}, 360000);

it('a version-only update is its own immutable package, and a switch the owner cannot resolve is never reported as installed', async () => {
  const root = temp();
  try {
    const log = openRecordLog(root, context), lifecycle = lifecycleAt(root);
    const bytes = module(GOOD), testFile = { path: 'word-count.test.mjs', bytes: test, digest: hashBytes(test) };
    const stage = version => lifecycle.stage({ namespace: NS, version, entrypoints: [{ id: 'word-count', path: 'word-count.mjs' }],
      probe: { entrypoint: 'word-count', export: 'wordCount', input: 'the native harness built this', expect: 5 } },
    [{ path: 'word-count.mjs', bytes, digest: hashBytes(bytes), kind: 'file' }], [testFile]);
    // The same code and tests under 1.0.0 and then 1.1.0: two packages, and the owner resolves the update.
    const first = await lifecycle.install(stage('1.0.0'));
    expect(first.passed).toBe(true);
    expect(active(root).value).toMatchObject({ version: '1.0.0', contentDigest: first.active });
    const second = await lifecycle.install(stage('1.1.0'));
    expect(second.passed).toBe(true);
    expect(second.active).not.toBe(first.active);
    expect(active(root).value).toMatchObject({ version: '1.1.0', contentDigest: second.active, sourceDigest: active(root).value.sourceDigest });
    expect(new Set(records(root).filter(row => row.type === 'LocalCapabilityPackage').map(row => row.sourceDigest)).size).toBe(1);
    // A switch the owner cannot resolve (here: a second record claiming the candidate's identity) is inhibited, never reported
    // as installed, and the prior version is re-proven and stays the resolved active package.
    const third = stage('1.2.0');
    log.append({ ...third.package, id: `${third.package.id}:impostor` });
    const refusedSwitch = await lifecycle.install(third);
    expect(refusedSwitch).toMatchObject({ passed: false, active: second.active });
    expect(records(root).filter(row => row.type === 'PackageTransition').slice(-3).map(row => [row.from, row.to, row.observedArtifactDigest]))
      .toEqual([['eligible', 'activating', third.package.contentDigest], ['activating', 'inhibited', third.package.contentDigest], ['activating', 'active', second.active]]);
    expect(active(root).value).toMatchObject({ version: '1.1.0', contentDigest: second.active });
    // A run that died right after recording such a switch leaves an active head the owner cannot resolve; the next run's
    // recovery does not skip it as "active": it inhibits it and restores the prior version.
    const fourth = stage('1.3.0');
    log.append(fourth.package); log.append({ ...fourth.package, id: `${fourth.package.id}:impostor` });
    const head = records(root).filter(row => row.type === 'PackageTransition').at(-1);
    log.append({ ...head, id: 'transition:switched-then-died', predecessors: [head.id], manifestDigest: fourth.package.contentDigest,
      observedArtifactDigest: fourth.package.contentDigest, priorActiveDigest: second.active, from: 'activating', to: 'active' });
    expect(active(root).kind).toBe('Refused');
    expect(await lifecycleAt(root).recover()).toEqual([{ namespace: NS, inhibited: fourth.package.contentDigest, restored: second.active }]);
    expect(active(root).value).toMatchObject({ version: '1.1.0', contentDigest: second.active });
    // A run cut right after recording `activating` for a candidate the owner cannot resolve: recovery never reports the switch
    // completed; it inhibits the candidate and restores the prior usable version in the same step (the reviewer's reproduction).
    const fifth = stage('1.4.0');
    log.append({ ...fifth.package, id: `${fifth.package.id}:impostor` });
    await expect(lifecycleAt(root).install(fifth, { crashAfterActivating: true })).rejects.toThrow('simulated crash during activation');
    expect(records(root).filter(row => row.type === 'PackageTransition').at(-1)).toMatchObject({ to: 'activating', observedArtifactDigest: fifth.package.contentDigest });
    expect(await lifecycleAt(root).recover()).toEqual([{ namespace: NS, inhibited: fifth.package.contentDigest, restored: second.active }]);
    expect(active(root).value).toMatchObject({ version: '1.1.0', contentDigest: second.active });
    expect(records(root).filter(row => row.type === 'PackageTransition' && row.observedArtifactDigest === fifth.package.contentDigest).map(row => row.to))
      .toEqual(['activating', 'inhibited']);
  } finally { rmSync(root, { recursive: true, force: true }); }
}, 240000);

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
    expect(await lifecycle.exercise(active(root).value)).toMatchObject({ passed: true, actual: 5 });
    expect(existsSync(join(root, 'release/packages', v1.slice(7), 'word-count.mjs'))).toBe(true);
    expect(readdirSync(join(root, 'release/packages')).filter(name => !name.startsWith('.'))).toHaveLength(2);
  } finally { rmSync(root, { recursive: true, force: true }); }
}, 360000);

it('a confined child ends at its own deadline after its launcher is killed, and its launch was decided durably first', async () => {
  const root = temp();
  const script = `import { createSelfHostHarness, openRecordLog, stoppedAt } from ${JSON.stringify(join(process.cwd(), 'tests/preview/self-host-harness.mjs'))};
import { SELF_HOST_CONTEXT } from ${JSON.stringify(join(process.cwd(), 'tests/preview/self-host.mjs'))};
const root = ${JSON.stringify(root)};
const harness = createSelfHostHarness({ root, context: SELF_HOST_CONTEXT, stopped: stoppedAt(root), now: () => Date.now(), log: openRecordLog(root, SELF_HOST_CONTEXT), wallMs: 5000 });
const directory = harness.stageWork([{ path: 'hang.test.mjs', bytes: "import { test } from 'node:test';\\ntest('hangs', () => { for (;;) {} });\\n" }]);
await harness.run({ mode: 'confined', kind: 'test', tool: 'package-test', work: 'w', directory, files: ['hang.test.mjs'] });`;
  const launcher = spawn(process.execPath, ['--no-warnings', '--loader', './scripts/slice-ts-loader.mjs', '--input-type=module', '-e', script],
    { cwd: process.cwd(), stdio: ['ignore', 'ignore', 'pipe'] });
  let stderr = ''; launcher.stderr.on('data', chunk => { stderr += chunk; });
  try {
    let launched;
    for (const started = Date.now(); !launched && Date.now() - started < 60000;) {
      launched = records(root).find(row => row.type === 'HarnessObservation' && row.detail === 'running:ok');
      if (!launched) await new Promise(done => setTimeout(done, 100));
    }
    expect(launched, stderr).toBeTruthy();
    const pid = Number(launched.sourceEvidence[0].slice('spawned:'.length)), alive = () => { try { process.kill(pid, 0); return true; } catch { return false; } };
    launcher.kill('SIGKILL');
    await new Promise(done => launcher.on('close', done));
    expect(alive()).toBe(true); // the executor is gone; the confined child is still there, spinning in its generated test
    const since = Date.now();
    while (alive() && Date.now() - since < 15000) await new Promise(done => setTimeout(done, 100));
    expect(alive()).toBe(false); // ended by its own wall bound (5 s), with no launcher left to enforce anything
    // The M1 service decided durably before the process started; the lost launcher's release receipt is part of that journal.
    const [store] = ownerStoreFacts(root);
    const journal = new OfflineJournal(join(root, 'owners', store.store, 'monitor.journal'));
    expect(journal.entries.map(row => row.kind)).toEqual(['initialized', 'dispatch-decided', 'released']);
  } finally { launcher.kill('SIGKILL'); rmSync(root, { recursive: true, force: true }); }
}, 90000);

it('launch evidence is only the real start of an admitted process: a start failure and an unadmitted operation launch nothing', async () => {
  const root = temp();
  try {
    const log = openRecordLog(root, context);
    const harness = createSelfHostHarness({ root, context, stopped: () => false, now: () => Date.now(), log });
    const failed = await harness.run({ mode: 'host', kind: 'tool', tool: 'missing-binary', work: 'w', argv: [join(root, 'no-such-binary')], cwd: root,
      credentials: [], paths: [], roots: [root] });
    expect(failed.refused).toBe('monitor unknown:guard-lost');
    const observed = records(root).filter(row => row.type === 'HarnessObservation');
    // The monitor answered from its durable decision; nothing claims a launch the OS never made.
    expect(observed.map(row => [row.phase, row.detail])).toEqual([['uncertain', 'unknown:guard-lost']]);
    const [store] = ownerStoreFacts(root);
    expect(new OfflineJournal(join(root, 'owners', store.store, 'monitor.journal')).entries.map(row => row.kind)).toEqual(['initialized', 'dispatch-decided']);
    // A launch the owners did not admit (a fabricated operation or claim for a genuine specification) is refused before any monitor call.
    const spec = store.facts.find(fact => fact.kind === 'assembly-HarnessLaunchSpec' && fact.body.record.id.startsWith('launch:')).body.record;
    const claim = store.facts.find(fact => fact.kind === 'transport-AdmissionReservation' && fact.body.record.state === 'dispatch-claimed');
    expect(harness.adapter.launch(spec, 'operation:fabricated', claim.id)).toMatchObject({ kind: 'Refused', detail: expect.stringContaining('no admitted operation') });
    expect(harness.adapter.launch(spec, claim.body.record.operation, 'claim:fabricated')).toMatchObject({ kind: 'Refused', detail: expect.stringContaining('no admitted operation') });
    expect(records(root).filter(row => row.type === 'HarnessObservation')).toHaveLength(1);
  } finally { rmSync(root, { recursive: true, force: true }); }
}, 60000);

it('refuses every provider attempt and tool launch once the stop latch is set', async () => {
  const root = temp();
  try {
    latchStop(root, 1);
    const early = host(root, [plan(GOOD)]);
    expect(await early.run('Build word-count after stop.')).toMatchObject({ passed: false, stopped: true });
    expect(early.prompts).toHaveLength(0);
    expect(ownerStoreFacts(root)).toEqual([]);
    expect(providerStores(root)).toEqual([]);
    rmSync(join(root, 'preview-stop.json'));
    // The operator stops while the model call is in flight: its plan is written as data, but nothing runs or installs.
    const late = host(root, [() => { latchStop(root, 2); return plan(GOOD); }]);
    expect(await late.run('Build word-count, stopped mid-call.')).toMatchObject({ passed: false, stopped: true });
    expect(records(root).filter(row => row.type === 'HarnessObservation')).toEqual([]);
    const harness = createSelfHostHarness({ root, context, stopped: () => true, now: () => 1, log: openRecordLog(root, context) });
    expect((await harness.run({ mode: 'confined', kind: 'test', tool: 'package-test', work: 'w', directory: root, files: [] })).refused).toContain('stop latched');
    const provider = await providerAt(root, { outcome: 'complete', calls: 0, stdin: [] }).catch(error => error);
    expect(String(provider?.message ?? provider)).toContain('stopped or revoked'); // the latch closes the doorway before any route exists
    await expect(dispatchOwnedProvider({ root, task: 't', question: 'q', conversation: [], allowance: 3, provider: {}, stopped: () => true }))
      .rejects.toThrow('stop latched before the provider attempt');
    expect(providerStores(root)).toHaveLength(1); // the mid-call attempt only
  } finally { rmSync(root, { recursive: true, force: true }); }
}, 240000);

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
}, 360000);

it('an interrupted provider attempt stays charged after a restart', async () => {
  const root = temp();
  try {
    const task = 'A task whose process died mid-call.';
    // The attempt is prepared, charged and consumed before the call; the call then dies with no answer (an uncertain outcome).
    await expect(host(root, [() => { throw Error('provider process died'); }], { allowance: 1 }).run(task)).rejects.toThrow('self-host: model');
    expect(providerAttemptsOf(root, hashBytes(task))).toBe(1);
    expect(readDurable(join(root, 'self-host.jsonl')).filter(row => row.phase === 'provider').map(row => row.outcome)).toEqual(['failed-charge-unknown']);
    const restarted = host(root, [plan(GOOD)], { allowance: 1 });
    await expect(restarted.run(task)).rejects.toThrow('allowance exhausted (1 of 1 recorded)');
    expect(restarted.prompts).toHaveLength(0);
  } finally { rmSync(root, { recursive: true, force: true }); }
}, 120000);

it('refuses a malformed plan and a file outside the package scope before running anything', async () => {
  const root = temp();
  try {
    await expect(host(root, ['this is not a plan']).run('t1')).rejects.toThrow('plan is not one JSON object');
    await expect(host(root, [JSON.stringify({ files: [{ path: '../outside.mjs', content: 'x' }], tools: [] })]).run('t2')).rejects.toThrow('outside the package scope');
    expect(existsSync(join(root, 'outside.mjs'))).toBe(false);
    expect(records(root)).toEqual([]);
    // Without the install grant the install tool is refused by admission; nothing is recorded as active.
    const ungranted = await host(root, [plan(GOOD)], { grants: [] }).run('t3');
    expect(ungranted.passed).toBe(false);
    expect(ungranted.feedback.failed[0].refused).toContain('requires local-install');
    expect(active(root).kind).toBe('Refused');
  } finally { rmSync(root, { recursive: true, force: true }); }
}, 240000);
