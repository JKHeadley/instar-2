import { beforeEach, expect, it } from 'vitest';
import { setTimeout as yieldWorker } from 'node:timers/promises';
import { canonical } from '../../src/index.js';
import { createFactStore, decodeHistoricalBody, hashBytes } from '../../src/facts/index.js';
import { decodeEffectPayload, decodeOutboundMessage, effectOperationContracts, effectPayloadIdentity,
  referencedPayloadFacts } from '../../src/effects/index.js';
import type { EffectHost, EffectPayloadKind } from '../../src/effects/index.js';
import { clone } from '../fixtures.js';
import { effectFixture, refused, value } from './fixture.js';
import { payloadInput, payloadKinds } from './payload-fixtures.js';
import { typedEffectFixture } from './typed-effect-fixture.js';
// @ts-expect-error Reference physical host is JavaScript, outside pure core compilation.
import { createTransportFileStorage } from '../../scripts/transport-file-storage.mjs';

beforeEach(async () => { await yieldWorker(1); });

const identify = (input: Record<string, unknown>): Record<string, unknown> => {
  const draft = Object.fromEntries(Object.entries(input).filter(([key]) => key !== 'id' && key !== 'targetDigest'));
  return { ...draft, ...effectPayloadIdentity(draft as Parameters<typeof effectPayloadIdentity>[0]) };
};

const setup = (kind: typeof payloadKinds[number], supported = true) => {
  const contract = effectOperationContracts[kind];
  return typedEffectFixture(undefined, 'executor:1', { payloadKind: kind, inputSchema: contract.inputSchema,
    canonicalization: contract.canonicalization, observationCapabilities: contract.observations }, supported ? [kind] : []);
};

it.each(payloadKinds)('P8-TP-DECODER-%s P8-TP-R6-VALID-%s accepts the exact closed slice-A payload', kind => {
  const f = setup(kind), input = payloadInput(kind, f.host);
  expect(value(decodeEffectPayload(input, f.host))).toEqual(input);
});

it.each(payloadKinds)('P8-TP-CLOSED-%s P8-TP-R6-MALFORMED-%s refuses removed, null, extra, unknown, and changed-digest input', kind => {
  const f = setup(kind), input = payloadInput(kind, f.host);
  for (const key of Object.keys(input)) {
    const removed = { ...input }; delete removed[key];
    expect(decodeEffectPayload(removed, f.host).kind).toBe('Refused');
    expect(decodeEffectPayload({ ...input, [key]: null }, f.host).kind).toBe('Refused');
  }
  refused(decodeEffectPayload({ ...input, undeclared: true }, f.host), 'undeclared');
  refused(decodeEffectPayload({ ...input, kind: `unsupported-${kind}` }, f.host), 'unknown');
  refused(decodeEffectPayload({ ...input, targetDigest: hashBytes('substitution') }, f.host), 'target digest');
});

it.each(payloadKinds)('P8-TP-R6-ROUTE-CONFLICT-%s refuses a competing current signed route and accepts an unrelated route', kind => {
  const f = setup(kind), input = payloadInput(kind, f.host);
  expect(decodeEffectPayload(input, f.host).kind).toBe('Success');
  f.reference('conversation-route-generation', { id: 'conversation-route:other', account: 'bot:other', conversation: 'chat:other',
    status: 'current', validFrom: 0, validUntil: 1000 });
  expect(decodeEffectPayload(input, f.host).kind).toBe('Success');
  f.reference('conversation-route-generation', { id: 'conversation-route:2', account: 'bot:fixture', conversation: 'chat:fixture',
    status: 'current', validFrom: 0, validUntil: 1000, supersedes: 'conversation-route:1' });
  refused(decodeEffectPayload(input, f.host), 'route generation');
});

it('P8-TP-R7-INTAKE-RECEIPT-COMPLETE refuses incomplete and hash-inconsistent signed Part Four receipt witnesses', () => {
  const incomplete = setup('acknowledge');
  incomplete.reference('intake-receipt', { id: 'receipt:incomplete', adapter: 'bot:fixture' });
  incomplete.reference('intake-admitted', { id: 'intake:incomplete', adapter: 'bot:fixture', channel: 'chat:fixture',
    receipt: 'receipt:incomplete', binding: 'none' });
  refused(decodeEffectPayload(identify({ ...payloadInput('acknowledge', incomplete.host), inboundFact: 'intake:incomplete' }),
    incomplete.host), 'receipt');

  const mismatch = setup('acknowledge'), capture = value(mismatch.host.capture('known incoming bytes'));
  mismatch.reference('intake-receipt', { id: 'receipt:mismatch', adapter: 'bot:fixture',
    ingress: JSON.stringify({ channel: 'chat:fixture', sender: 'sender:fixture', identityEpoch: 'epoch:1', eventId: 'event:2' }),
    capture, rawHash: hashBytes('different') });
  mismatch.reference('intake-admitted', { id: 'intake:mismatch', adapter: 'bot:fixture', channel: 'chat:fixture',
    receipt: 'receipt:mismatch', binding: 'none' });
  refused(decodeEffectPayload(identify({ ...payloadInput('acknowledge', mismatch.host), inboundFact: 'intake:mismatch' }),
    mismatch.host), 'capture/hash');
});

it.each(['edit-message', 'react'] as const)(
  'P8-TP-R7-TARGET-CONFLICT-%s refuses a competing current target and accepts an inactive neighbor', kind => {
    const f = setup(kind), input = payloadInput(kind, f.host);
    f.reference('conversation-message', { id: 'message:future', message: 'message:7', account: 'bot:fixture',
      conversation: 'chat:fixture', status: 'current', validFrom: 2000, validUntil: 3000 });
    expect(decodeEffectPayload(input, f.host).kind).toBe('Success');
    f.reference('conversation-message', { id: 'message:replacement', message: 'message:7', account: 'bot:fixture',
      conversation: 'chat:fixture', status: 'current', validFrom: 0, validUntil: 1000, supersedes: 'message:7' });
    refused(decodeEffectPayload(input, f.host), 'target message');
  });

it.each(payloadKinds)('P8-TP-R7-PROTECTED-DENIAL-%s refuses a signed protected-target denial', kind => {
  const f = setup(kind), input = payloadInput(kind, f.host);
  f.reference('intake-stop', { adapter: 'bot:fixture', channel: 'chat:fixture', authority: 'part-four' });
  refused(decodeEffectPayload(input, f.host), 'protected');
});

it('P8-TP-R7-STATUS-SNAPSHOT refuses unavailable signed recorder evidence and a flattened history', () => {
  const f = setup('post-text'), input = payloadInput('post-text', f.host), facts = value(f.store.read());
  const provenance = f.bob.provenance as unknown as { record: { reference: string } };
  const reference = provenance.record.reference, bytes = f.host.current().decode.captures[reference]!;
  const captures = { ...f.ctx.captures, [reference]: { hash: hashBytes(bytes), bytes: null, status: 'missing' as const,
    byteLength: Buffer.byteLength(bytes) } };
  const cold = createFactStore({ ...f.ctx, captures }, createTransportFileStorage(`${f.directory}/origin`, f.success));
  const source = facts.find(row => row.id === input.sourceResult)!;
  expect(value(decodeHistoricalBody(source, { ...f.ctx, captures, facts }, f.ctx.decode)).taint).toContain('evidence-unavailable');
  refused(decodeEffectPayload(input, { ...f.host, referenceFacts: () => cold.readForProjection() }), 'status');
  refused(decodeEffectPayload(input, { ...f.host, referenceFacts: () => cold.read() } as unknown as EffectHost), 'status snapshot');
});

it('P8-TP-R6-CAPTURE-BYTES P8-TP-R6-FINDING-2 refuses absent, corrupt, or hash-mismatched declared attachment bytes', () => {
  const f = setup('post-media'), input = payloadInput('post-media', f.host);
  const attachment = (input.attachments as { capture: { reference: string; hash: string } }[])[0]!;
  const current = f.host.current();
  const withCaptures = (captures: Record<string, string>, status = 'available'): EffectHost => ({ ...f.host,
    current: () => ({ ...current, decode: { ...current.decode, captures,
      captureStatuses: { [attachment.capture.reference]: status } } }) });
  const absent = { ...current.decode.captures }; delete absent[attachment.capture.reference];
  refused(decodeEffectPayload(input, withCaptures(absent)), 'capture');
  refused(decodeEffectPayload(input, withCaptures({ ...current.decode.captures,
    [attachment.capture.reference]: 'changed bytes' })), 'capture');
  const wrong = identify({ ...input, attachments: [{ ...(input.attachments as object[])[0],
    capture: { ...attachment.capture, hash: hashBytes('different') } }] });
  refused(decodeEffectPayload(wrong, f.host), 'capture');
});

it.each(['missing', 'expired'] as const)('P8-TP-R6-TRANSCRIPT-%s P8-TP-R6-FINDING-3 retains historical transcript when submitted bytes are honestly unavailable', status => {
  const f = setup('derive-transcript'), payload = value(decodeEffectPayload(payloadInput('derive-transcript', f.host), f.host));
  const fact = value(f.spine.append(payload, referencedPayloadFacts(payload, f.host))).fact;
  const facts = value(f.store.read()), request = facts.find(row => row.kind === 'judgment-JudgmentRequest')!;
  const witness = JSON.parse(String((request.body as { witness: string }).witness));
  const reference = String(witness.record.submitted.reference);
  const context = { ...f.ctx, facts, captures: { ...f.ctx.captures,
    [reference]: { ...f.ctx.captures[reference]!, bytes: null, status } } };
  const decoded = value(decodeHistoricalBody(fact, context, context.decode));
  expect(decoded.taint).toContain('evidence-unavailable');
});

it('P8-TP-R6-FETCH-MISSING P8-TP-R6-FINDING-3 retains historical media fetch when intake bytes are honestly missing', () => {
  const f = setup('fetch-inbound-media'), payload = value(decodeEffectPayload(payloadInput('fetch-inbound-media', f.host), f.host));
  const fact = value(f.spine.append(payload, referencedPayloadFacts(payload, f.host))).fact;
  const facts = value(f.store.read()), receipt = facts.find(row => row.kind === 'intake-receipt')!;
  const witness = JSON.parse(String((receipt.body as { witness: string }).witness));
  const reference = String(witness.capture.reference);
  const context = { ...f.ctx, facts, captures: { ...f.ctx.captures,
    [reference]: { ...f.ctx.captures[reference]!, bytes: null, status: 'missing' as const } } };
  const decoded = value(decodeHistoricalBody(fact, context, context.decode));
  expect(decoded.taint).toContain('evidence-unavailable');
});

it('P8-TP-SIGNED-REPLAY-REFUSAL refuses signed replay when its route dependency is absent', () => {
  const f = setup('post-text'), payload = value(decodeEffectPayload(payloadInput('post-text', f.host), f.host));
  const fact = value(f.spine.append(payload, referencedPayloadFacts(payload, f.host))).fact;
  const facts = value(f.store.read()).filter(row => row.kind !== 'conversation-route-generation');
  const context = { ...f.ctx, facts };
  refused(decodeHistoricalBody(fact, context, context.decode));
});

it('P8-TP-DEFINITIONS exposes exactly ordinary-reply plus the eight slice-A contracts with four independent questions', () => {
  const kinds: readonly EffectPayloadKind[] = ['ordinary-reply', ...payloadKinds];
  expect(Object.keys(effectOperationContracts)).toEqual(kinds);
  for (const kind of kinds) {
    const contract = effectOperationContracts[kind];
    expect(contract.inputSchema).toContain(kind);
    expect(contract.canonicalization).toBe('instar-canonical-json-v1');
    expect(new Set(Object.values(contract.observations)).size).toBe(4);
  }
});

it('P8-TP-LEGACY P8-TP-F12-LEGACY-FIXTURE preserves ordinary-reply bytes and request shape', () => {
  const f = effectFixture(), decoded = value(decodeOutboundMessage(clone(f.message), f.host));
  expect(value(canonical(decoded)).bytes).toBe(value(canonical(f.message)).bytes);
  const request = f.prepare();
  expect(Object.keys(request)).toEqual(['type', 'schemaVersion', 'id', 'definition', 'message', 'semanticMessage', 'run',
    'pending', 'attempt', 'digest', 'verificationOwner', 'verificationBar', 'obligation', 'closure']);
  expect(request.id).toBe(f.requestId); expect(request.digest).toBe(f.messageDigest);
});

it('P8-TP-R6-MAIN-MUTATION-HARNESS matches main 6148c28 for every legacy fixture mutation and signed lifecycle byte', () => {
  const f = effectFixture(), raw = clone(f.message) as unknown as Record<string, unknown>;
  const decoded: Record<string, unknown> = { valid: decodeOutboundMessage(raw, f.host) };
  for (const key of Object.keys(raw)) {
    const missing = { ...raw }; delete missing[key];
    decoded[`missing:${key}`] = decodeOutboundMessage(missing, f.host);
    decoded[`renamed:${key}`] = decodeOutboundMessage({ ...missing, [`renamed_${key}`]: raw[key] }, f.host);
    for (const mutation of [null, 0, false, [], {}, ''])
      decoded[`mutation:${key}:${JSON.stringify(mutation)}`] = decodeOutboundMessage({ ...raw, [key]: mutation }, f.host);
  }
  decoded.extra = decodeOutboundMessage({ ...raw, extra: 'x' }, f.host);
  const q = f.prepare(), observed = value(f.api.dispatch(q, f.fence));
  f.assess('happened', 3, true);
  const settled = value(f.api.settle(observed.operation));
  const facts = value(f.store.read()), rows = value(f.api.inspect());
  const historicalRecords = rows.map(row => decodeHistoricalBody(row.fact, { ...f.ctx, facts }, f.ctx.decode));
  const bytes = value(canonical({ decoded, q, observed, settled,
    records: rows.map(row => row.record), historicalRecords })).bytes;
  // Generated by the byte-identical main 6148c28 fixture used by the independent
  // preservation harness. Any legacy decoder, request, operation, or replay drift fails.
  expect(hashBytes(bytes)).toBe('sha256:42094803335a7081554dd43b65437864f850c5cc15ab7c688948dbb93b405e00');
});
