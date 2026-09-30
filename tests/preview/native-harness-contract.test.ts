// @ts-nocheck -- each doorway's physical IO is replaced only by its captured-frame conformance fixture; everything else is shipped code.
// Rules 26, 49, 59, 69, 105, 115 (D14 §3, D17 §§2, 11): the harness contract applied to the actual
// native composition, per registered doorway. The self-hosting harness (the public native adapter
// whose launches are admitted by the owners and launched through the S8 boundary) reasons through
// the doorway's own adapter code; only the doorway's physical frames are captured. Its supported
// tuple is bound to the exact composition bytes and runtime this case runs (checked here and by the
// architecture lint). The journal runner case is provider and conversation-restart evidence; its
// tuple is declared unproven because it is not the shared full-port contract.
import { describe, expect, it } from 'vitest';
import { mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { resolveActivePackage } from '../../src/assembly/index.js';
import { SUBSCRIPTION_CONVERSATION_FRAMING, SUBSCRIPTION_DOORWAYS, subscriptionConversationPolicy,
  subscriptionDoorway } from '../../src/assembly/production-provider.js';
import { DOORWAY_CONFORMANCE } from './doorway-conformance.js';
import { offlineProfile, successiveWorld } from './successive-fixture.js';
import { encoded } from './canonical.js';
import { cutoverHarness } from './journal-cutover-harness.mjs';
import { SELF_HOST_CONTEXT, doorwayProvider, selfHost } from './self-host.mjs';
import { CONFINEMENT_LIMITS, confinedRelease, createReleaseLeaf, createSelfHostHarness, latchStop, openRecordLog, readDurable, stoppedAt } from './self-host-harness.mjs';
import { dispatchOwnedProvider, ownerStoreFacts, providerAttemptsOf, providerStores } from './self-host-owners.ts';
import { currentRuntime } from '../../scripts/composition-digest.mjs';
import { hashBytes } from '../../src/facts/index.js';
import { SELF_HOST_HARNESS } from './stall-coverage.js';
import { parityMatrix } from '../../scripts/check-architecture.mjs';

const context = { site: 'preview.journal', preserved: 'preview:test', register: {
  generation: { owner: 'part-three', name: 'RegisterGeneration', id: 'preview:register' },
  entries: ['preview.journal', 'preview', 'host'], producers: ['host'], methods: [], actions: {}, subjects: {},
  sites: { 'preview.journal': 'closed', 'types.decode': 'closed' }, keys: {}, allowRedelegation: false,
  conflictStanding: { ordinary: 'delegate', authority: 'operator' } }, captures: {} };
const NOW = 1790000002000;
/** Literal case titles per doorway fixture: the register's harness parity facts cite them verbatim. */
const TITLES = Object.freeze({ 'claude-code-subscription': {
  native: 'native composition honours the harness contract through doorway claude-code-subscription',
  journal: 'the journal runner converses through doorway claude-code-subscription' } });
const PLAN = JSON.stringify({ files: [
  { path: 'word-count.mjs', content: 'export function wordCount(text) { return text.split(/\\s+/u).filter(Boolean).length; }\n' },
  { path: 'word-count.test.mjs', content: "import { test } from 'node:test';\nimport assert from 'node:assert/strict';\nimport { wordCount } from './word-count.mjs';\ntest('counts', () => assert.equal(wordCount('a b  c'), 3));\n" }],
  tools: [{ operation: 'package-test', params: ['word-count.test.mjs'] }],
  package: { namespace: 'agent.word-count', version: '1.0.0', entrypoints: [{ id: 'word-count', path: 'word-count.mjs' }],
    probe: { entrypoint: 'word-count', export: 'wordCount', input: 'the native harness built this', expect: 5 } } });
const message = (world, id, text) => ({ update_id: id, message: { message_id: 100 + id,
  from: { id: Number(world.configuration.operatorSenderId), is_bot: false, first_name: 'Justin' },
  chat: { id: Number(world.configuration.chatId), type: 'private' }, date: Math.floor(Date.now() / 1000), text } });

it('every registered doorway either runs these contracts or is declared unsupported or unproven in the register', () => {
  const tuples = parityMatrix().harnessTuples;
  for (const id of Object.keys(SUBSCRIPTION_DOORWAYS)) {
    const declared = tuples.filter(row => row.doorway === id);
    expect(declared.length, `doorway ${id} has no harness parity facts`).toBeGreaterThan(0);
    for (const tuple of declared) if (tuple.status === 'supported') expect(Object.hasOwn(DOORWAY_CONFORMANCE, id), `doorway ${id} has no conformance fixture`).toBe(true);
  }
  expect(() => subscriptionDoorway('unregistered-doorway')).toThrow('not registered');
});

describe.each(Object.keys(DOORWAY_CONFORMANCE))('native compositions through doorway %s', id => {
  const fixture = DOORWAY_CONFORMANCE[id];
  const proposerAt = async (root, state, world) => doorwayProvider({ doorwayId: id, io: fixture.io(state), profile: fixture.profile,
    activation: world.activation(), model: world.model, stopped: stoppedAt(root), now: () => NOW });

  it('names its cases literally for the register', () => expect(Object.hasOwn(TITLES, id)).toBe(true));

  it(TITLES[id]?.native ?? `native ${id}`, async () => {
    const world = successiveWorld(), root = realpathSync(mkdtempSync(join(tmpdir(), 'native-contract-')));
    try {
      const state = { outcome: 'complete', calls: 0, stdin: [], answer: () => PLAN };
      const run = async (task, provider, at = root) => selfHost({ task, provider, repo: process.cwd(), root: at, grants: ['local-install'], context: SELF_HOST_CONTEXT });
      // Launch, delivery, lifecycle and grounding: one reasoning call through the doorway carries the task; every tool is an adapter launch.
      const report = await run('Build a word-count capability.', await proposerAt(root, state, world));
      expect(report.passed).toBe(true);
      expect(state.calls).toBe(1);
      expect(state.stdin[0]).toContain('Build a word-count capability.');
      const records = readDurable(join(root, 'assembly.jsonl')).map(row => row.record);
      const observations = records.filter(row => row.type === 'HarnessObservation');
      const byLaunch = Map.groupBy(observations, row => row.launch);
      expect(byLaunch.size).toBeGreaterThanOrEqual(3); // the package test, the installed tests and the installed probe
      // Each launch: the S8 boundary's signed receipt of the real start, the adapter's launch, the delivered recorded
      // input, the S8 exit receipt and the adapter's exit observation.
      for (const rows of byLaunch.values()) expect(rows.map(row => [row.phase, row.detail])).toEqual([['launched', 'running:ok'],
        ['launched', 'actual process launch observed'], ['input-accepted', 'durable input accepted; consumption not yet claimed'],
        ['exit-observed', 'exited:worker-exit'], ['exit-observed', 'exited:worker-exit']]);
      // Every launch was admitted by the owners before it ran: its specification is in an owner store, bound to that store's
      // Run, to the prepared Six reservation that was claimed and consumed, and to Eight's recorded request, whose parameters
      // carry the recorded input digest and are the reservation's digest.
      const specs = ownerStoreFacts(root).flatMap(({ facts }) => facts.filter(fact => fact.kind === 'assembly-HarnessLaunchSpec'
        && fact.body.record.id.startsWith('launch:')).map(fact => ({ spec: fact.body.record, facts })));
      for (const launch of byLaunch.keys()) {
        const found = specs.find(item => item.spec.id === launch);
        expect(found, launch).toBeTruthy();
        const reservations = found.facts.filter(fact => fact.kind === 'transport-AdmissionReservation').map(fact => fact.body.record);
        expect(reservations.map(row => row.state)).toEqual(['prepared', 'dispatch-claimed', 'consumed']);
        const request = found.facts.find(fact => fact.kind === 'effect-EffectRequest' && fact.body.record.id === reservations[0].request)?.body.record;
        expect(request).toMatchObject({ operation: 'native-confined-launch', digest: reservations[0].digest, run: reservations[0].run });
        expect(found.spec).toMatchObject({ run: reservations[0].run, harness: SELF_HOST_HARNESS, inputDigest: request.parameters.inputDigest });
      }
      // The one provider call went through the provider owners: Seven's request, Eight's provider request, Six's charge naming it.
      const [call] = providerStores(root);
      const effect = call.facts.find(fact => fact.kind === 'effect-provider-ProviderEffectRequest').body.record;
      expect(call.facts.filter(fact => fact.kind === 'transport-AdmissionReservation').map(fact => [fact.body.record.state, fact.body.record.request]))
        .toEqual([['prepared', effect.id], ['dispatch-claimed', effect.id], ['consumed', effect.id]]);
      // The certified tuple is this composition: its declared conformance digest is the running adapter's artifact, on this
      // resolved runtime, and the adapter admits that conformance only because it matches its own running closure.
      const tuple = parityMatrix().harnessTuples.find(row => row.harness === SELF_HOST_HARNESS && row.doorway === id && row.mode === 'self-hosting');
      const described = createSelfHostHarness({ root, context: SELF_HOST_CONTEXT, stopped: () => false, now: () => NOW,
        log: openRecordLog(root, SELF_HOST_CONTEXT) }).adapter.describe();
      expect(tuple).toMatchObject({ status: 'supported', conformance: [described.artifact], runtime: [currentRuntime()],
        artifact: ['createSelfHostHarness@tests/preview/self-host-harness.mjs'] });
      expect(described.conformance).toBe(`self-host:${tuple.conformance[0]}`);
      expect(described.platform).toBe(`${tuple.platform}-${process.arch}`);
      // Confined tools and the installed capability: the owner resolves the active package; its evidence is these observations.
      const active = resolveActivePackage('agent.word-count', openRecordLog(root, SELF_HOST_CONTEXT).rows(), SELF_HOST_CONTEXT);
      expect(active.kind).toBe('Success');
      expect(records.filter(row => row.type === 'PackageTransition').at(-1).probeEvidence.every(ref => observations.some(row => row.id === ref))).toBe(true);
      expect(SELF_HOST_HARNESS).toBe('preview-self-host-native');
      // Stop: the latch closes the doorway route and every launch before any provider dispatch.
      const open = await proposerAt(root, state, world);
      latchStop(root, NOW);
      expect(await run('Build another capability after stop.', open)).toMatchObject({ stopped: true });
      await expect(dispatchOwnedProvider({ root, task: 'direct', question: 'q', conversation: [], allowance: 3, provider: open, stopped: stoppedAt(root) }))
        .rejects.toThrow('stop latched before the provider attempt');
      await expect(proposerAt(root, state, world)).rejects.toThrow('stopped or revoked');
      expect(state.calls).toBe(1);
      // Refused and timed-out frames never become a plan; the attempt stays charged and is never retried.
      for (const outcome of ['refused', 'timeout']) {
        const other = realpathSync(mkdtempSync(join(tmpdir(), `native-contract-${outcome}-`)));
        try {
          const failing = { outcome, calls: 0, stdin: [], answer: () => PLAN };
          await expect(run(`A ${outcome} call.`, await proposerAt(other, failing, world), other)).rejects.toThrow('self-host: model');
          expect(failing.calls).toBe(1);
          // Prepared by Seven and Eight, charged, claimed and consumed in Six before the call; recorded as an unknown charge;
          // never retried; nothing launched.
          expect(providerAttemptsOf(other, hashBytes(`A ${outcome} call.`))).toBe(1);
          expect(providerStores(other)[0].facts.filter(fact => fact.kind === 'transport-AdmissionReservation').map(fact => fact.body.record.state))
            .toEqual(['prepared', 'dispatch-claimed', 'consumed']);
          expect(readDurable(join(other, 'self-host.jsonl')).map(row => row.outcome)).toEqual(['failed-charge-unknown']);
          expect(readDurable(join(other, 'assembly.jsonl'))).toEqual([]);
        } finally { rmSync(other, { recursive: true, force: true }); }
      }
    } finally { rmSync(root, { recursive: true, force: true }); }
  }, 240000);

  it(TITLES[id]?.journal ?? `journal ${id}`, () => {
    const world = successiveWorld(), harness = cutoverHarness(world, offlineProfile, { INSTAR_PREVIEW_CUTOVER_DOORWAY: id });
    harness.setUpdates([message(world, 1, 'What is the marker? Juniper.')]);
    expect(harness.launchLive(2).status).toBe(0);
    const sends = () => harness.calls().filter(call => call.kind === 'send');
    expect(sends().map(call => call.text)).toEqual([expect.stringContaining('Juniper is the marker.')]);
    // Grounding: the request that reached the doorway carried the operator's message inside the journal packet.
    const submitted = readFileSync(join(world.directory, 'doorway.jsonl'), 'utf8').trim().split('\n').map(line => JSON.parse(line));
    expect(submitted.every(row => row.doorway === id)).toBe(true);
    expect(submitted[0].stdin).toContain('What is the marker? Juniper.');
    expect(submitted[0].stdin).toContain('packet');
    // Lifecycle: a restart answers nothing twice; a stop closes the conversation before any further doorway call.
    const calls = submitted.length;
    expect(harness.launchLive(2).status).toBe(0);
    expect(sends()).toHaveLength(1);
    const stop = spawnSync(process.execPath, ['--no-warnings', '--loader', './scripts/slice-ts-loader.mjs', 'tests/preview/journal-agent.mjs', 'stop',
      '--root', harness.liveRoot], { cwd: process.cwd(), env: { ...process.env, INSTAR_SECRET_PREVIEW_STORAGE_KEY: Buffer.alloc(32, 19).toString('hex') }, encoding: 'utf8' });
    expect(stop.status).toBe(0);
    harness.setUpdates([message(world, 1, 'x'), message(world, 2, 'Anything new?')]);
    harness.launchLive(2);
    expect(readFileSync(join(world.directory, 'doorway.jsonl'), 'utf8').trim().split('\n')).toHaveLength(calls);
    expect(sends()).toHaveLength(1);
  }, 120000);
});

describe.each(Object.keys(DOORWAY_CONFORMANCE))('doorway %s captured-frame route cases (Rules 30, 115)', id => {
  const world = successiveWorld(), model = world.model, policy = subscriptionConversationPolicy(model), now = 1790000002000;
  const activation = world.activation(), fixture = DOORWAY_CONFORMANCE[id], doorway = subscriptionDoorway(id);
  const state = { outcome: 'complete', calls: 0, stdin: [] }; let active = true;
  const route = doorway.create({ context, credential: { type: 'SecretRef', schemaVersion: 1, vault: 'preview', name: fixture.profile.reference },
    profile: fixture.profile, resolveProfile: () => fixture.profile, provider: fixture.provider, model, route: 'preview-subscription',
    disclosure: 'Subscription preview; charge UNKNOWN', activation, framing: SUBSCRIPTION_CONVERSATION_FRAMING, io: fixture.io(state),
    now: () => now, active: () => active,
    adapterEvidenceContract: { reference: activation.reference, version: activation.profileDigest, ...doorway.contract,
      successfulFinalReplyReasons: [...doorway.contract.successfulFinalReplyReasons], endpoint: fixture.profile.loginProfileIdentity,
      account: fixture.profile.expectedAccount, credentialReference: fixture.profile.reference, controller: 'preview-journal',
      sourceEvidence: [activation.reference], terminalEvidence: activation.reference, strength: 'attestation',
      maxMetadataBytes: policy.maxMetadataBytes, maxRawTerminalBytes: policy.maxRawTerminalBytes, maxCaptureBytes: policy.maxCaptureBytes } });
  const prepared = encoded({ provider: fixture.provider, model, route: 'preview-subscription',
    messages: [{ role: 'user', content: 'What is the marker?' }, { role: 'context', content: 'conformance-context-marker' }],
    attachments: [], tools: [], settings: { automaticRetries: 0, maxTokens: policy.maxTokens },
    outputSchema: { type: 'Decision' }, floor: { actions: ['work'] }, evidence: ['turn:1'], point: 'judgment', generation: 'trial' }).bytes;
  const invoke = operation => route.value.invoke(prepared, { operation, deadline: now + 180000, timeout: policy.timeout,
    maxOutputBytes: policy.maxOutputBytes, maxTokens: policy.maxTokens, maxCharge: 0, automaticRetries: 0 });

  it('admits the route and captures the exact submitted context', async () => {
    expect(route.kind).toBe('Success');
    const result = await invoke('turn:1');
    expect(result.state).toBe('complete');
    expect(state.stdin.at(-1)).toContain('conformance-context-marker');
  });
  it('never reports an unobserved charge as zero', async () => {
    state.outcome = 'complete';
    expect((await invoke('turn:charge')).usage.charge).toBeNull();
  });
  it('keeps a refused, timed-out or over-cap call from becoming an answer, without retrying it', async () => {
    for (const [outcome, operation] of [['refused', 'turn:refused'], ['timeout', 'turn:timeout'], ['over-cap', 'turn:over-cap']]) {
      state.outcome = outcome; const before = state.calls;
      const result = await invoke(operation);
      expect(result.state).not.toBe('complete');
      expect(result.bytes).toBeNull();
      expect(state.calls - before).toBe(1);
    }
  });
  it('refuses a call once the run is stopped, before any provider dispatch', async () => {
    state.outcome = 'complete'; active = false; const before = state.calls;
    const stopped = await invoke('turn:stopped').catch(error => ({ state: 'refused', error }));
    expect(stopped.state).not.toBe('complete');
    expect(state.calls).toBe(before);
    active = true;
  });
});

// Rules 2, 37 (D14 §9): the confined launch deadline is the work's bound, measured from the runner's
// readiness (its own wall bound armed), never from the spawn: the operating system's admission of a
// freshly pinned runtime takes unbounded time under host load and is not the work. Only startMs
// bounds spawn-to-readiness. Each side is exercised with a stand-in runner inside the real confinement.
it('the confined launch deadline runs from readiness, and a runner that never becomes ready is still ended', async () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'native-deadline-')));
  try {
    const release = confinedRelease(root);
    const launch = async (name, source, limits, wallMs) => {
      writeFileSync(join(release.release, 'bin', `${name}.mjs`), source);
      const leaf = createReleaseLeaf({ release: { ...release, runner: join(release.release, 'bin', `${name}.mjs`) }, bootId: 'boot:1', wallMs,
        limits: { ...CONFINEMENT_LIMITS, ...limits }, resolvePlan: () => ({ plan: { mode: 'confined', wallMs } }) });
      const began = performance.now();
      leaf.start({ operation: name, digest: name }, name);
      const state = leaf.byOperation.get(name);
      state.child.stdin.end('');
      await state.settled;
      return { observed: leaf.observe(name), code: state.exit.code, elapsed: performance.now() - began };
    };
    const ready = "import { closeSync, writeSync } from 'node:fs'; writeSync(3, '@ready\\n'); closeSync(3);\n";
    // A start slower than bound plus grace is not the work: the runner exits cleanly and is never killed.
    const slow = await launch('slow-start', `Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 1500);\n${ready}process.exit(0);\n`,
      { startMs: 60000, graceMs: 100 }, 300);
    expect(slow).toMatchObject({ code: 0, observed: { state: 'exited', reason: 'worker-exit' } });
    expect(slow.elapsed).toBeGreaterThan(1500);
    // Ready work that overruns its bound is still ended at bound plus grace after readiness.
    const overrun = await launch('overrun', `${ready}setInterval(() => {}, 1000);\n`, { startMs: 60000, graceMs: 100 }, 300);
    expect(overrun).toMatchObject({ code: null, observed: { state: 'expired', reason: 'deadline' } });
    expect(overrun.elapsed).toBeGreaterThanOrEqual(400);
    expect(overrun.elapsed).toBeLessThan(60000);
    // A runner that never reports readiness is ended at startMs.
    const silent = await launch('never-ready', 'setInterval(() => {}, 1000);\n', { startMs: 1500, graceMs: 100 }, 300);
    expect(silent).toMatchObject({ code: null, observed: { state: 'expired', reason: 'deadline' } });
    expect(silent.elapsed).toBeGreaterThanOrEqual(1500);
  } finally { rmSync(root, { recursive: true, force: true }); }
}, 120000);
