import { afterEach, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { authoritySealKey, authorityDigest, resolveInstallationPolicy, sealAuthorityRecord,
  singleMachineProfileDigest, SINGLE_MACHINE_PROFILE, ROLE_SINGLE_MACHINE_PROFILE } from './activation-authority.js';
import { openPreviewJournal, previewTestContext } from './journal-test-worker.js';
import { nestedSessionWorkEdge, type SessionWorkEdge, type SessionWorkEffect } from '../../src/assembly/production-session-work.js';
// @ts-expect-error host boundary
import { roleProfileDecision } from './role-profile.mjs';
// @ts-expect-error host boundary
import { createToolEffectOwner } from './admission-gate.mjs';
// @ts-expect-error host boundary
import { admitToolEffect, admitToolCallEffect, admitToolCall } from './tool-admission.mjs';
// @ts-expect-error host boundary
import { admitSessionConnector } from './session-connectors.mjs';
import { evaluateMinimalPath, requiredMinimalDependencies } from '../../src/operator/live.js';
import type { MinimalDependency } from '../../src/operator/contracts.js';
import { consumeResult } from '../../src/index.js';
const now = 1790000000000, key = authoritySealKey(new Uint8Array(32).fill(17));
const words = 'I accept the whole-role single-machine loss model for this test installation.';
const records = { messages: [{ topicId: 1, messageId: 2, text: words, fromUser: true,
  timestamp: new Date(now - 1).toISOString(), telegramUserId: 7, forwarded: false, provenance: 'user' }],
provenance: [{ topicId: 1, messageId: 2, classification: 'human', topicBound: true,
  bodyHash: createHash('sha256').update(words).digest('hex') }], bindings: { 1: { platform: 'telegram', uid: '7',
  boundFrom: 'authenticated-inbound', establishmentEvidence: { kind: 'authenticated-inbound', authorization: 'telegram-is-authorized-sender',
    ingress: 'telegram-polling', senderUid: '7', messageId: '2' } } } };
const accepted = (profile: string = ROLE_SINGLE_MACHINE_PROFILE.id, revoked = false) => sealAuthorityRecord({
  type: 'PreviewActivationAuthority', schemaVersion: 1, grants: [], waivers: [],
  revocations: revoked ? [{ grantId: 'acceptance', at: now, by: '7', source: 'test:withdrawal' }] : [],
  installationPolicies: [{ id: 'acceptance', policy: 'P-08', shape: 'single-machine', grantor: '7', words,
    source: { kind: 'telegram-message', topicId: 1, messageId: 2 }, acceptedAt: now - 1,
    subject: { trial: 'test:trial', profile, profileDigest: singleMachineProfileDigest(profile) } }] }, key);
const proposal = { effect: 'tool:network-write', target: 'api.github.com', request: { method: 'PUT', path: '/test/operation' } };
const config = () => ({ operations: SINGLE_MACHINE_PROFILE.operations, effectPolicy: {
  type: 'PreviewEffectPolicy', resourceLevelUsd: 1, policySensitive: [] as string[],
  registered: [{ ...proposal, consequence: 'external', reversibility: 'irreversible', reach: 'world', costUsd: 0, source: 'test:registration' }],
  grants: [{ id: 'test:role', ...proposal, approves: ['scope'], source: 'test:operator', custodian: 'test:owner', recovery: 'withdraw test grant', expiresAt: now + 1000 }] } });
const parent: SessionWorkEdge = { type: 'SessionWorkEdge', schemaVersion: 1, id: 'test:parent', parent: 'test:root', child: 'test:work',
  scope: 'test:scope', owner: 'test:owner', authority: 'test:role', budget: { steps: 1, deadline: now + 1000, maxResultBytes: 1024, calls: 2, tokens: null },
  exitTest: 'test result', placement: 'test:machine', transport: 'test:host', resultDestination: 'test:result', openedAt: now - 1 };
const cleanups: (() => void)[] = [];
afterEach(() => cleanups.splice(0).reverse().forEach(clean => clean()));
function world() {
  const root = mkdtempSync(join(tmpdir(), 'p08-role-')), path = join(root, 'journal.encrypted');
  cleanups.push(() => rmSync(root, { recursive: true, force: true }));
  const storage = new Uint8Array(32).fill(23);
  let journal = openPreviewJournal(path, storage, { kind: 'genesis', bot: '12345678', chat: '7', operator: '7', grant: 'test:trial',
    configurationDigest: 'sha256:offline', expires: now + 10000, maxCalls: 10, maxReplies: 10, maxTurns: 10, maxBytes: 32768, cursor: 0 });
  cleanups.push(() => journal.close());
  journal.append({ kind: 'session-work', record: parent, at: now });
  const state = { record: accepted(), profile: ROLE_SINGLE_MACHINE_PROFILE.id as string, singleMachine: true, config: config(), stopped: false, failAppend: false };
  const decide = (tool: string, input: typeof proposal, edge = parent) => roleProfileDecision({ profile: state.profile, singleMachine: state.singleMachine,
    trial: 'test:trial', operator: '7', now, authority: { record: state.record, records, sealKey: key }, parent: edge,
    active: journal.view.activeSessionWork, config: state.config, tool, input,
    decide: (_tool: string, input: typeof proposal, configuration: unknown, at: number) => admitToolEffect(input, configuration, at) });
  const written: SessionWorkEffect[] = [];
  const owner = createToolEffectOwner({ decide, now: () => now, stopped: () => state.stopped,
    prepared: (id: string) => journal.view.toolEffects?.includes(id) ?? false,
    append: (record: SessionWorkEffect) => { if (state.failAppend) throw Error('injected disk failure');
      journal.append({ kind: 'session-work', record, at: now }); written.push(record); } });
  return { state, decide, written, owner, journal: () => journal, path,
    admit: (input = proposal, edge = parent) => owner.admit({ parent: edge, tool: 'test-network-write', input, call: 'test:call' }),
    reopen: () => { journal.close(); journal = openPreviewJournal(path, storage); } };
}
it('v1 bytes and acceptance stay valid; the same complete role grant still refuses network-write durability', () => {
  const w = world(); w.state.profile = SINGLE_MACHINE_PROFILE.id; w.state.record = accepted(SINGLE_MACHINE_PROFILE.id);
  expect(resolveInstallationPolicy('test:trial', w.state.record, '7', now, records, key).kind).toBe('resolved');
  expect(w.admit()).toMatchObject({ admitted: false, doorway: { disposition: 'refused' } });
  expect(w.decide('test', proposal).refusedFor).toEqual(['durability']);
  expect(singleMachineProfileDigest()).toBe(authorityDigest(SINGLE_MACHINE_PROFILE));
});
it('v2 requires its own exact acceptance; old, missing, unsealed and revoked acceptances do not authorize it', () => {
  const w = world();
  w.state.record = accepted(SINGLE_MACHINE_PROFILE.id);
  expect(w.admit()).toMatchObject({ admitted: false, reason: expect.stringContaining('a new acceptance is required') });
  w.state.record = sealAuthorityRecord({ ...accepted(), installationPolicies: [] }, key);
  expect(w.admit()).toMatchObject({ admitted: false, reason: expect.stringContaining('a new acceptance is required') });
  w.state.record = { ...accepted(), seal: 'forged' };
  expect(w.admit().admitted).toBe(false);
  w.state.record = accepted(ROLE_SINGLE_MACHINE_PROFILE.id, true);
  expect(w.admit()).toMatchObject({ admitted: false, reason: expect.stringContaining('revoked') });
});
it('v2 admits the network-write through the real effect owner and journal, with the whole cause; restart cannot duplicate it', () => {
  const w = world();
  expect(w.admit()).toMatchObject({ admitted: true });
  expect(w.written).toHaveLength(1);
  expect(JSON.parse(w.written[0]!.cause!)).toMatchObject({ input: proposal, prefix: [parent],
    policy: { profile: 'single-machine-v2' }, authority: w.state.record, source: { messages: records.messages }, configuration: w.state.config });
  w.reopen();
  expect(w.admit()).toMatchObject({ admitted: false, reason: expect.stringContaining('never sent twice') });
});
it('v2 rechecks the current target, method, expiry, sign-off, acceptance and stop on each admission', () => {
  const w = world();
  expect(w.admit({ ...proposal, target: 'other.test' }).admitted).toBe(false);
  expect(w.admit({ ...proposal, request: { ...proposal.request, method: 'DELETE' } }).admitted).toBe(false);
  w.state.config.effectPolicy.grants[0]!.expiresAt = now;
  expect(w.admit().admitted).toBe(false);
  w.state.config = config(); w.state.config.effectPolicy.policySensitive = [proposal.target];
  expect(w.admit().admitted).toBe(false);
  w.state.config = config(); w.state.config.effectPolicy.registered[0]!.costUsd = 2;
  expect(w.admit().admitted).toBe(false);
  for (const condition of ['publicInPersonName', 'widensAuthority']) {
    w.state.config = config(); Object.assign(w.state.config.effectPolicy.registered[0]!, { [condition]: true });
    expect(w.admit().admitted).toBe(false);
    w.state.config.effectPolicy.grants[0]!.approves.push(condition);
    expect(w.decide('test', proposal).admitted).toBe(true);
  }
  w.state.config = config(); w.state.stopped = true;
  expect(w.admit().admitted).toBe(false);
  w.state.stopped = false;
  expect(w.admit().admitted).toBe(true);
  w.state.record = accepted(ROLE_SINGLE_MACHINE_PROFILE.id, true);
  expect(w.admit({ ...proposal, extra: 'next' } as typeof proposal)).toMatchObject({ admitted: false, reason: expect.stringContaining('revoked') });
});
it('an incomplete or mismatched causal prefix and failed durable append refuse before dispatch', () => {
  const w = world();
  expect(w.admit(proposal, { ...parent, id: 'missing' })).toMatchObject({ admitted: false, reason: expect.stringContaining('causal prefix') });
  expect(w.admit(proposal, { ...parent, authority: 'changed' }).admitted).toBe(false);
  const nested = nestedSessionWorkEdge({ ...parent, id: 'missing-ancestor' }, { id: 'child', tool: 'Agent' }, now);
  w.journal().append({ kind: 'session-work', record: nested, at: now });
  expect(w.admit(proposal, nested)).toMatchObject({ admitted: false, reason: expect.stringContaining('causal prefix') });
  w.state.failAppend = true;
  expect(w.admit()).toMatchObject({ admitted: false, reason: expect.stringContaining('could not be recorded') });
  expect(w.written).toHaveLength(0);
});
it('provider calls and ordinary replies retain identical accepted minimal-path decisions under both profiles', () => {
  const admitted = Object.fromEntries(requiredMinimalDependencies.map(key => [key, key !== 'replication-peer'])) as Record<MinimalDependency, boolean>;
  for (const operation of SINGLE_MACHINE_PROFILE.operations) {
    const decisions = [SINGLE_MACHINE_PROFILE.id, ROLE_SINGLE_MACHINE_PROFILE.id].map(profile => {
      const resolution = resolveInstallationPolicy('test:trial', accepted(profile), '7', now, records, key, profile);
      expect(resolution.kind).toBe('resolved');
      if (resolution.kind !== 'resolved') throw Error('acceptance unresolved');
      return consumeResult(evaluateMinimalPath({ admitted, ordinaryUnavailable: [], inputPreserved: true,
        repairOwner: 'test:owner', maximumExposure: 0, shape: { kind: 'single-machine', installation: resolution.trial,
          profile, lossModel: resolution.profileDigest, operation, policy: { policy: 'P-08', installation: resolution.trial,
            profile, operations: SINGLE_MACHINE_PROFILE.operations, causalPrefix: 'full', lossModel: resolution.profileDigest,
            acceptance: resolution.acceptance } } }, previewTestContext), {
        Success: value => value, Refused: refusal => { throw Error(String(refusal)); } });
    });
    expect(decisions[0]).toMatchObject({ admitted: true, missing: [] });
    expect(decisions[1]).toEqual(decisions[0]);
  }
});
it('an old owner-written journal replays unchanged and raw hooks retain legacy admission', () => {
  const w = world(); w.state.profile = SINGLE_MACHINE_PROFILE.id;
  w.state.config.effectPolicy.registered[0]!.reversibility = 'reversible';
  expect(w.admit().admitted).toBe(true);
  const before = authorityDigest({ active: w.journal().view.activeSessionWork, effects: w.journal().view.toolEffects });
  const bytes = readFileSync(w.path);
  w.reopen();
  expect(authorityDigest({ active: w.journal().view.activeSessionWork, effects: w.journal().view.toolEffects })).toBe(before);
  expect(readFileSync(w.path)).toEqual(bytes);
  const tool = 'mcp__test__write', configuration = { ...config(), maxCalls: 10 };
  expect(admitToolCallEffect(tool, {}, configuration, now).admitted).toBe(false);
  expect(admitToolCall({ tool_name: tool, tool_input: {} }, { ...configuration, gate: 'test:host' }, 1, {}, 1, now).decision).toBe('gate');
});

it('the installed MCP decision seam consumes v2 only at the host and records its exact role grant', () => {
  const w = world(), tool = 'mcp__test__write';
  const configuration = config();
  configuration.effectPolicy.registered = [{ ...configuration.effectPolicy.registered[0]!, effect: 'tool:mcp', target: tool,
    request: undefined } as unknown as typeof configuration.effectPolicy.registered[0]];
  configuration.effectPolicy.grants = [{ ...configuration.effectPolicy.grants[0]!, effect: 'tool:mcp', target: tool,
    request: undefined } as unknown as typeof configuration.effectPolicy.grants[0]];
  // JSON is the on-disk policy format; omit absent optional fields before canonical retention.
  const plain = JSON.parse(JSON.stringify(configuration));
  const decision = (enabled = true) => roleProfileDecision({ profile: ROLE_SINGLE_MACHINE_PROFILE.id, singleMachine: true, trial: 'test:trial', operator: '7', now,
    authority: { record: accepted(), records, sealKey: key }, parent, active: w.journal().view.activeSessionWork,
    config: plain, tool, input: { body: 'test payload' },
    decide: (tool: string, input: unknown, config: unknown, now: number) => admitSessionConnector({ tool, input, config, now, enabled,
      mcp: { servers: { test: {} }, digest: 'test:connector' }, decide: admitToolCallEffect }) });
  expect(decision(false).admitted).toBe(false);
  expect(decision()).toMatchObject({ admitted: true, disposition: 'granted' });
  expect(JSON.parse(decision().localCause)).toMatchObject({ tool, input: { body: 'test payload' },
    configuration: { effectPolicy: { grants: [{ target: tool }] } } });
});

it('v2 never lowers enrolled-peer durability, including when the peer is lost', () => {
  const w = world(); w.state.singleMachine = false;
  expect(w.admit()).toMatchObject({ admitted: false, reason: expect.stringContaining('enrolled-peer') });
  w.state.singleMachine = true;
  expect(w.decide('test', proposal).admitted).toBe(true);
});
