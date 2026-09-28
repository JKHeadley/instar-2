// @ts-nocheck -- the doorway IO is replaced only by each doorway's captured-frame conformance fixture.
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { SUBSCRIPTION_CONVERSATION_FRAMING, SUBSCRIPTION_DOORWAYS, subscriptionConversationPolicy,
  subscriptionDoorway } from '../../src/assembly/production-provider.js';
import { DOORWAY_CONFORMANCE } from './doorway-conformance.js';
import { successiveWorld } from './successive-fixture.js';
import { encoded } from './canonical.js';
import { PREVIEW_JOURNAL_HARNESS } from './stall-coverage.js';

const context = { site: 'preview.journal', preserved: 'preview:test', register: {
  generation: { owner: 'part-three', name: 'RegisterGeneration', id: 'preview:register' },
  entries: ['preview.journal', 'preview', 'host'], producers: ['host'], methods: [], actions: {}, subjects: {},
  sites: { 'preview.journal': 'closed', 'types.decode': 'closed' }, keys: {}, allowRedelegation: false,
  conflictStanding: { ordinary: 'delegate', authority: 'operator' } }, captures: {} };
const register = JSON.parse(readFileSync('src/conversation/parity.register.json', 'utf8'));

it('every registered doorway either runs this contract or is enumerated unsupported in the parity register', () => {
  for (const id of Object.keys(SUBSCRIPTION_DOORWAYS)) {
    const tuple = register.harnessTuples.find(row => row.harness === PREVIEW_JOURNAL_HARNESS && row.doorway === id);
    expect(tuple, `doorway ${id} missing from the parity register`).toBeDefined();
    if (tuple.status === 'supported') expect(Object.hasOwn(DOORWAY_CONFORMANCE, id), `doorway ${id} has no conformance fixture`).toBe(true);
    else expect(tuple.reason.length).toBeGreaterThan(10);
  }
  expect(() => subscriptionDoorway('unregistered-doorway')).toThrow('not registered');
});

describe.each(Object.keys(DOORWAY_CONFORMANCE))('native harness contract through doorway %s (Rules 30, 115)', id => {
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
