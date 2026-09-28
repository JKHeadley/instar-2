// @ts-nocheck -- each doorway's physical IO is replaced only by its captured-frame conformance fixture; everything else is shipped code.
// Rules 26, 49, 59, 69, 105, 115 (D14 §3, D17 §§2, 11): the harness contract applied to the actual
// native compositions, per registered doorway. The self-hosting harness (the public native adapter
// over Eight's confined driver) and the journal runner (a real runner child) each reason through
// the doorway's own adapter code; only the doorway's physical frames are captured. The register's
// harness parity facts cite these cases for each supported harness × doorway tuple.
import { describe, expect, it } from 'vitest';
import { mkdtempSync, readFileSync, realpathSync, rmSync } from 'node:fs';
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
import { prepareJournalEnvelope } from './journal-envelope.js';
import { SELF_HOST_CONTEXT, doorwayProposer, selfHost } from './self-host.mjs';
import { latchStop, openRecordLog, readDurable, stoppedAt } from './self-host-harness.mjs';
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
  const proposerAt = async (root, state, world) => doorwayProposer({ doorwayId: id, io: fixture.io(state), profile: fixture.profile,
    activation: world.activation(), model: world.model, context: SELF_HOST_CONTEXT, stopped: stoppedAt(root), now: () => NOW,
    prepare: prepareJournalEnvelope, provider: fixture.provider });

  it('names its cases literally for the register', () => expect(Object.hasOwn(TITLES, id)).toBe(true));

  it(TITLES[id]?.native ?? `native ${id}`, async () => {
    const world = successiveWorld(), root = realpathSync(mkdtempSync(join(tmpdir(), 'native-contract-')));
    try {
      const state = { outcome: 'complete', calls: 0, stdin: [], answer: () => PLAN };
      const run = async (task, propose, at = root) => selfHost({ task, propose, repo: process.cwd(), root: at, grants: ['local-install'], context: SELF_HOST_CONTEXT });
      // Launch, delivery, lifecycle and grounding: one reasoning call through the doorway carries the task; every tool is an adapter launch.
      const report = await run('Build a word-count capability.', await proposerAt(root, state, world));
      expect(report.passed).toBe(true);
      expect(state.calls).toBe(1);
      expect(state.stdin[0]).toContain('Build a word-count capability.');
      const records = readDurable(join(root, 'assembly.jsonl')).map(row => row.record);
      const observations = records.filter(row => row.type === 'HarnessObservation');
      const byLaunch = Map.groupBy(observations, row => row.launch);
      expect(byLaunch.size).toBeGreaterThanOrEqual(3); // the package test, the installed tests and the installed probe
      for (const rows of byLaunch.values()) expect(rows.map(row => row.phase)).toEqual(['launched', 'input-accepted', 'exit-observed']);
      expect(observations.every(row => row.run.startsWith('self-host:work:'))).toBe(true);
      // Confined tools and the installed capability: the owner resolves the active package; its evidence is these observations.
      const active = resolveActivePackage('agent.word-count', openRecordLog(root, SELF_HOST_CONTEXT).rows(), SELF_HOST_CONTEXT);
      expect(active.kind).toBe('Success');
      expect(records.filter(row => row.type === 'PackageTransition').at(-1).probeEvidence.every(ref => observations.some(row => row.id === ref))).toBe(true);
      expect(SELF_HOST_HARNESS).toBe('preview-self-host-native');
      // Stop: the latch closes the doorway route and every launch before any provider dispatch.
      const open = await proposerAt(root, state, world);
      latchStop(root, NOW);
      expect(await run('Build another capability after stop.', open)).toMatchObject({ stopped: true });
      await expect(open('{}', { operation: 'self-host:direct' })).rejects.toThrow('stop latched before the provider attempt');
      await expect(proposerAt(root, state, world)).rejects.toThrow('stopped or revoked');
      expect(state.calls).toBe(1);
      // Refused and timed-out frames never become a plan; the attempt stays charged and is never retried.
      for (const outcome of ['refused', 'timeout']) {
        const other = realpathSync(mkdtempSync(join(tmpdir(), `native-contract-${outcome}-`)));
        try {
          const failing = { outcome, calls: 0, stdin: [], answer: () => PLAN };
          await expect(run(`A ${outcome} call.`, await proposerAt(other, failing, world), other)).rejects.toThrow('self-host: model');
          expect(failing.calls).toBe(1);
          expect(readDurable(join(other, 'attempts.jsonl')).map(row => row.outcome ?? row.state)).toEqual(['started', 'failed-charge-unknown']);
          expect(readDurable(join(other, 'assembly.jsonl'))).toEqual([]);
        } finally { rmSync(other, { recursive: true, force: true }); }
      }
    } finally { rmSync(root, { recursive: true, force: true }); }
  }, 120000);

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
