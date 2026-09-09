import { expect, it } from 'vitest';
import { mkdirSync, symlinkSync } from 'node:fs';
import { join } from 'node:path';
import { canonical } from '../../src/index.js';
import { decodeEffectPayload, decodeOutboundMessage, effectOperationContracts, effectPayloadIdentity } from '../../src/effects/index.js';
import type { EffectHost, EffectPayloadKind } from '../../src/effects/index.js';
import { clone, digest } from '../fixtures.js';
import { effectFixture, refused, value } from './fixture.js';
import { typedEffectFixture } from './typed-effect-fixture.js';
import { payload, payloadInput, payloadKinds } from './payload-fixtures.js';

const withIdentity = (input: Record<string, unknown>): Record<string, unknown> => {
  const draft = Object.fromEntries(Object.entries(input).filter(([key]) => key !== 'id' && key !== 'targetDigest'));
  return { ...draft, ...effectPayloadIdentity(draft as unknown as Parameters<typeof effectPayloadIdentity>[0]) };
};
const hostFor = (kind: typeof payloadKinds[number]): EffectHost => {
  const f = effectFixture();
  return kind === 'infrastructure-notice' ? { ...f.host, principal: f.principal('infrastructure', 'system') } : f.host;
};

it.each(payloadKinds)('P8-TP-DECODER-%s accepts its exact closed versioned fixture', kind => {
  const host = hostFor(kind), input = payloadInput(kind, host);
  expect(value(decodeEffectPayload(input, host))).toEqual(input);
});

it.each(payloadKinds)('P8-TP-CLOSED-%s refuses undeclared, wrong kind, missing reference, and digest mismatch', kind => {
  const host = hostFor(kind), input = payloadInput(kind, host);
  refused(decodeEffectPayload({ ...input, undeclared: true }, host), 'undeclared');
  refused(decodeEffectPayload({ ...input, kind: `wrong-${kind}` }, host), 'unknown');
  const missing = clone(input); delete missing.sourceResult;
  refused(decodeEffectPayload(missing, host), 'missing');
  refused(decodeEffectPayload({ ...input, targetDigest: digest('substituted') }, host), 'target digest');
});

it('P8-TP-REFS-MISSING-WRONG-KIND signed history must own the exact run, step, source, and conversation references', () => {
  const contract = effectOperationContracts.acknowledge;
  const f = typedEffectFixture(undefined, 'executor:1', { payloadKind: 'acknowledge', inputSchema: contract.inputSchema,
    canonicalization: contract.canonicalization, observationCapabilities: contract.observations }, ['acknowledge']);
  const raw = { ...payloadInput('acknowledge', f.host), sourceResult: f.pending.id };
  refused(decodeEffectPayload(withIdentity({ ...raw, step: 'step:never-recorded', logicalEffect: 'logical:never-recorded' }), f.host), 'lineage');
  refused(decodeEffectPayload(withIdentity({ ...raw, inboundFact: f.pending.id }), f.host), 'wrong kind');
  const valid = value(decodeEffectPayload(withIdentity(raw), f.host));
  const facts = value(f.host.referenceFacts!());
  const missingHost = { ...f.host, referenceFacts: () => f.success(facts.filter(fact => fact.kind !== 'intake-admitted')) };
  refused(decodeEffectPayload(valid, missingHost), 'missing');
  f.reference('intake-admitted', { id: 'intake:1', account: 'bot:fixture', conversation: 'chat:fixture', revision: 2 });
  refused(decodeEffectPayload(valid, f.host), 'intake fact');
});

it.each(['process-control', 'scheduler-control', 'account-route-change', 'configuration-change',
  'filesystem-mutation', 'git-mutation'] as const)(
  'P8-TP-RECOVERY-REFERENCE-MATRIX %s accepts complete current owner history and refuses missing owner history', kind => {
    const contract = effectOperationContracts[kind];
    const f = typedEffectFixture(undefined, 'executor:1', { payloadKind: kind, inputSchema: contract.inputSchema,
      canonicalization: contract.canonicalization, observationCapabilities: contract.observations }, [kind]);
    const input = withIdentity({ ...payloadInput(kind, f.host), sourceResult: f.pending.id });
    expect(value(decodeEffectPayload(input, f.host)).kind).toBe(kind);
    const missingKind = ({ 'process-control': 'process-parent', 'scheduler-control': 'scheduler-job-generation',
      'account-route-change': 'account-route-generation', 'configuration-change': 'configuration-target-state',
      'filesystem-mutation': 'filesystem-target-state', 'git-mutation': 'git-target-state' } as const)[kind];
    const facts = value(f.host.referenceFacts!());
    const missingHost = { ...f.host, referenceFacts: () => f.success(facts.filter(fact => fact.kind !== missingKind)) };
    refused(decodeEffectPayload(input, missingHost), 'missing');
  });

it('P8-TP-RECOVERY-REFERENCE-MATRIX stale, conflicted, and wrong-subject recovery witnesses refuse', () => {
  const processContract = effectOperationContracts['process-control'];
  const process = typedEffectFixture(undefined, 'executor:1', { payloadKind: 'process-control', inputSchema: processContract.inputSchema,
    canonicalization: processContract.canonicalization, observationCapabilities: processContract.observations }, ['process-control']);
  const processInput = { ...payloadInput('process-control', process.host), sourceResult: process.pending.id };
  refused(decodeEffectPayload(withIdentity({ ...processInput, processId: 'process:other' }), process.host), 'subject mismatch');
  process.time(1001);
  refused(decodeEffectPayload(withIdentity(processInput), process.host), 'stale');

  const schedulerContract = effectOperationContracts['scheduler-control'];
  const scheduler = typedEffectFixture(undefined, 'executor:1', { payloadKind: 'scheduler-control', inputSchema: schedulerContract.inputSchema,
    canonicalization: schedulerContract.canonicalization, observationCapabilities: schedulerContract.observations }, ['scheduler-control']);
  scheduler.reference('scheduler-job-generation', { id: 'job-generation:2', jobId: 'job:1', generation: 'job-generation:2', finiteScope: 'one-run',
    undoOperation: 'resume:job:1', reviewAt: 200, status: 'current', validFrom: 0, validUntil: 1000, revision: 2 });
  refused(decodeEffectPayload(withIdentity({ ...payloadInput('scheduler-control', scheduler.host), sourceResult: scheduler.pending.id }), scheduler.host), 'scheduler generation');
});

it('P8-TP-TARGET-WITNESS ancestry substitutions and unresolved symlinks refuse despite self-consistent payload identities', () => {
  const contract = effectOperationContracts['filesystem-mutation'];
  const f = typedEffectFixture(undefined, 'executor:1', { payloadKind: 'filesystem-mutation', inputSchema: contract.inputSchema,
    canonicalization: contract.canonicalization, observationCapabilities: contract.observations }, ['filesystem-mutation']);
  const raw: Record<string, unknown> = { ...payloadInput('filesystem-mutation', f.host), sourceResult: f.pending.id };
  const [target] = raw.fileTargets as Record<string, unknown>[];
  refused(decodeEffectPayload(withIdentity({ ...raw, fileTargets: [{ ...target, ancestryDigest: digest('substituted ancestry') }] }), f.host), 'subject mismatch');

  const real = join(f.directory, 'real'), link = join(f.directory, 'link'); mkdirSync(real); symlinkSync(real, link);
  const path = join(link, 'state.json'), policy = 'policy:symlink-case';
  const symlinkTarget = { canonicalPath: path, resolvedPath: path, ancestryDigest: digest('ancestor'), priorDigest: digest('prior') };
  f.reference('filesystem-target-state', { id: policy, policy, targets: [symlinkTarget], status: 'current', validFrom: 0, validUntil: 1000 });
  refused(decodeEffectPayload(withIdentity({ ...raw, fileTargets: [symlinkTarget], protectedTargetPolicy: policy }), f.host), 'symlink');
});

it('P8-TP-REPAIR-07 P8-TP-NESTED V3 V4 V5 V16 V29 V30 closed decoder refuses malformed shapes and enums', () => {
  const f = effectFixture();
  for (const [kind, field, nested] of [
    ['post-media', 'attachments', { hidden: 'path' }],
    ['create-topic', 'attributes', { hidden: 'attribute' }],
    ['filesystem-mutation', 'fileTargets', { hidden: 'link' }],
    ['git-mutation', 'expectedHeads', { hidden: 'head' }],
  ] as const) {
    const input = payloadInput(kind, f.host), rows = clone(input[field] as Record<string, unknown>[]);
    rows[0] = { ...rows[0], ...nested };
    refused(decodeEffectPayload(withIdentity({ ...input, [field]: rows }), f.host), 'undeclared');
  }
});

it('P8-TP-TARGET target substitution, path traversal, symlink resolution, and ancestry substitution refuse at decode', () => {
  const f = effectFixture();
  const text = payloadInput('post-text', f.host);
  refused(decodeEffectPayload({ ...text, conversation: 'chat:attacker' }, f.host), 'target digest');
  const config = payloadInput('configuration-change', f.host);
  refused(decodeEffectPayload(withIdentity({ ...config, canonicalTarget: '/project/../secret' }), f.host), 'ambiguous');
  const filesystem = payloadInput('filesystem-mutation', f.host);
  const target = (filesystem.fileTargets as Record<string, unknown>[])[0]!;
  refused(decodeEffectPayload(withIdentity({ ...filesystem, fileTargets: [{ ...target, resolvedPath: '/private/secret' }] }), f.host), 'symlink');
  refused(decodeEffectPayload({ ...filesystem, fileTargets: [{ ...target, ancestryDigest: digest('other ancestor') }] }, f.host), 'target digest');
  const git = payloadInput('git-mutation', f.host);
  refused(decodeEffectPayload(withIdentity({ ...git, targets: ['../outside'] }), f.host), 'ambiguous');
});

it('P8-TP-AUTH payloads cannot self-attest authority and infrastructure notices cannot impersonate an agent', () => {
  const f = effectFixture();
  refused(decodeEffectPayload({ ...payloadInput('process-control', f.host), authority: 'self-attested' }, f.host), 'undeclared');
  refused(decodeEffectPayload(payloadInput('infrastructure-notice', f.host), f.host), 'impersonate');
  const systemHost = { ...f.host, principal: f.principal('infrastructure', 'system') };
  expect(payload('infrastructure-notice', systemHost).kind).toBe('infrastructure-notice');
});

it('P8-TP-DEFINITIONS every variant has one exact schema, canonicalization, and four distinct observation questions', () => {
  const kinds: readonly EffectPayloadKind[] = ['ordinary-reply', ...payloadKinds];
  expect(Object.keys(effectOperationContracts)).toEqual(kinds);
  for (const kind of kinds) {
    const contract = effectOperationContracts[kind];
    expect(contract.inputSchema).toContain(kind);
    expect(contract.canonicalization).toBe('instar-canonical-json-v1');
    expect(new Set(Object.values(contract.observations)).size).toBe(4);
  }
});

it('P8-TP-REPAIR-10 P8-TP-LEGACY V24 V32 ordinary-reply bytes, decoder value, request keys, identity and digest remain unchanged', () => {
  const f = effectFixture(), decoded = value(decodeOutboundMessage(clone(f.message), f.host));
  expect(value(canonical(decoded)).bytes).toBe(value(canonical(f.message)).bytes);
  const q = f.prepare();
  expect(Object.keys(q)).toEqual(['type', 'schemaVersion', 'id', 'definition', 'message', 'semanticMessage', 'run',
    'pending', 'attempt', 'digest', 'verificationOwner', 'verificationBar', 'obligation', 'closure']);
  expect(q.id).toBe(f.requestId); expect(q.digest).toBe(f.messageDigest);
  expect(q.payload).toBeUndefined(); expect(q.binding).toBeUndefined();
});

it('P8-TP-DIGEST typed payload identity and request digest are stable; changed rendering creates a new immutable request', () => {
  const f = typedEffectFixture(undefined, 'executor:1', {}, ['post-text']);
  const definition = effectOperationContracts['post-text'];
  const typedFixture = typedEffectFixture(undefined, 'executor:1', { payloadKind: 'post-text', inputSchema: definition.inputSchema,
    canonicalization: definition.canonicalization, observationCapabilities: definition.observations }, ['post-text']);
  const raw = payloadInput('post-text', typedFixture.host);
  const first = value(decodeEffectPayload(withIdentity({ ...raw, sourceResult: typedFixture.pending.id }), typedFixture.host));
  const second = value(decodeEffectPayload(clone(first), typedFixture.host));
  expect(second.id).toBe(first.id); expect(value(canonical(second)).hash).toBe(value(canonical(first)).hash);
  const changed = value(decodeEffectPayload(withIdentity({ ...first, text: 'different rendering' }), typedFixture.host));
  expect(changed.id).not.toBe(first.id);
  void f;
});
