import { expect, it } from 'vitest';
import { canonical } from '../../src/index.js';
import { authorAndAppend } from '../../src/facts/index.js';
import { decodeEffectPayload, decodeOutboundMessage, effectOperationContracts, effectPayloadIdentity } from '../../src/effects/index.js';
import { intakeFixture, route } from '../intake/fixtures.js';
import { json, privateKey } from '../facts/fixtures.js';
import { payloadInput } from './payload-fixtures.js';
import { refused, typedEffectFixture, value } from './typed-effect-fixture.js';

const identify = (input: Record<string, unknown>) => {
  const { id: _id, targetDigest: _targetDigest, ...draft } = input;
  return { ...draft, ...effectPayloadIdentity(draft as Parameters<typeof effectPayloadIdentity>[0]) };
};
const setup = (kind: keyof typeof effectOperationContracts) => {
  if (kind === 'ordinary-reply') throw new Error('typed fixture required');
  const contract = effectOperationContracts[kind];
  return typedEffectFixture(undefined, 'executor:1', { payloadKind: kind, inputSchema: contract.inputSchema,
    canonicalization: contract.canonicalization, observationCapabilities: contract.observations }, [kind]);
};

it('P8-TP-R4-V20 legacy decoder mutation matrix remains byte-identical to main', () => {
  const f = typedEffectFixture();
  const valid = JSON.parse(JSON.stringify(f.message)) as Record<string, unknown>;
  const renamed: Record<string, unknown> = { ...valid, renamedText: valid.text }; delete renamed.text;
  const missing: Record<string, unknown> = { ...valid }; delete missing.text;
  const refusal = (detail: string) => ({ type: 'Result', schemaVersion: 1, kind: 'Refused', reason: 'decode', detail,
    site: 'facts.admit', failDirection: 'closed', preserved: 'refusal:metadata' });
  const expected = {
    valid: { type: 'Result', schemaVersion: 1, kind: 'Success', value: valid, capacity: { kind: 'none' } },
    renamedField: refusal('missing text'), missingField: refusal('missing or undeclared field'),
    extraField: refusal('missing or undeclared field'), wrongVersion: refusal('message identity, purpose or speaker'),
  };
  const actual = { valid: decodeOutboundMessage(valid, f.host), renamedField: decodeOutboundMessage(renamed, f.host),
    missingField: decodeOutboundMessage(missing, f.host), extraField: decodeOutboundMessage({ ...valid, extra: true }, f.host),
    wrongVersion: decodeOutboundMessage({ ...valid, schemaVersion: 99 }, f.host) };
  expect(value(canonical(actual)).bytes).toBe(value(canonical(expected)).bytes);
});

it('P8-TP-R4-V09-V10 process references require their complete signed dependency closure and available captures', () => {
  const f = setup('process-control'), facts = value(f.store.read());
  const old = facts.find(fact => fact.kind === 'process-parent')!;
  const dependency = f.note('required action-time predecessor');
  const capture = value(f.host.capture('process identity proof'));
  const witness = { ...JSON.parse(String((old.body as { witness: string }).witness)), proofCapture: capture };
  const replacement = value(authorAndAppend({ kind: 'process-parent', schemaVersion: 1, machine: f.host.machine,
    principal: json(f.host.principal), provenance: json(f.host.principal.provenance), at: json(f.now),
    body: { witness: JSON.stringify(witness) }, required: [dependency.id] }, f.ctx, f.store, privateKey)).fact;
  const complete = value(f.store.read()).filter(fact => fact.id !== old.id);
  const valid = { ...f.host, referenceFacts: () => f.success(complete) };
  expect(decodeEffectPayload(payloadInput('process-control', valid), valid).kind).toBe('Success');
  const missing = { ...valid, referenceFacts: () => f.success(complete.filter(fact => fact.id !== dependency.id)) };
  refused(decodeEffectPayload(payloadInput('process-control', missing), missing), 'required dependency');
  const unavailable = { ...valid, current: () => ({ ...valid.current(), decode: { ...valid.current().decode,
    captureStatuses: { [capture.reference]: 'missing' } } }) };
  refused(decodeEffectPayload(payloadInput('process-control', unavailable), unavailable), 'unavailable');
  expect(replacement.predecessors.required).toContain(dependency.id);
});

it('P8-TP-R4-V11 route changes resolve current provider/run-bound registrations and rollback route', () => {
  const f = setup('account-route-change'), raw = payloadInput('account-route-change', f.host), facts = value(f.store.read());
  expect(decodeEffectPayload(raw, f.host).kind).toBe('Success');
  const registrations = facts.filter(fact => fact.kind === 'registered-account');
  expect(registrations).toHaveLength(2);
  const absent = { ...f.host, referenceFacts: () => f.success(facts.filter(fact => fact.kind !== 'registered-account')) };
  refused(decodeEffectPayload(raw, absent), 'registration missing');
  const wrongKind = identify({ ...raw, fromAccount: f.pending.id });
  refused(decodeEffectPayload(wrongKind, f.host));
  const old = registrations.find(fact => JSON.parse(String((fact.body as { witness: string }).witness)).id === 'bot:old')!;
  const proof = value(f.host.capture('account ownership'));
  const base = JSON.parse(String((old.body as { witness: string }).witness));
  const replacement = value(authorAndAppend({ kind: 'registered-account', schemaVersion: 1, machine: f.host.machine,
    principal: json(f.host.principal), provenance: json(f.host.principal.provenance), at: json(f.now),
    body: { witness: JSON.stringify({ ...base, proofCapture: proof }) }, required: [] }, f.ctx, f.store, privateKey)).fact;
  const replaced = value(f.store.read()).filter(fact => fact.id !== old.id);
  const unavailable = { ...f.host, referenceFacts: () => f.success(replaced), current: () => ({ ...f.host.current(),
    decode: { ...f.host.current().decode, captureStatuses: { [proof.reference]: 'missing' } } }) };
  refused(decodeEffectPayload(raw, unavailable), 'unavailable');
  const withdrawn = { ...f.host, referenceFacts: () => f.success([...facts.filter(fact => fact.id !== old.id && fact.id !== replacement.id),
    { ...old, body: { witness: JSON.stringify({ ...base, status: 'withdrawn' }) } }]) };
  refused(decodeEffectPayload(raw, withdrawn), 'stale');
});

it('P8-TP-R4-V26 a newer current signed generation invalidates the requested old job generation', () => {
  const f = setup('scheduler-control'), raw = payloadInput('scheduler-control', f.host);
  const generation = value(f.store.read()).find(fact => fact.kind === 'scheduler-job-generation')!;
  const old = JSON.parse(String((generation.body as { witness: string }).witness));
  value(authorAndAppend({ kind: 'scheduler-job-generation', schemaVersion: 1, machine: f.host.machine,
    principal: json(f.host.principal), provenance: json(f.host.principal.provenance), at: json(f.now),
    body: { witness: JSON.stringify({ ...old, id: 'job-generation:3', generation: 'job-generation:3', supersedes: old.id }) },
    required: [generation.id] }, f.ctx, f.store, privateKey));
  refused(decodeEffectPayload(raw, f.host), 'superseded');
});

it('P8-TP-R4-V15 declared attachment byte count equals the encoded captured byte length', () => {
  const f = setup('post-media'), raw = payloadInput('post-media', f.host);
  expect(decodeEffectPayload(raw, f.host).kind).toBe('Success');
  const attachments = (raw.attachments as Record<string, unknown>[]).map(item => ({ ...item, bytes: 0 }));
  refused(decodeEffectPayload(identify({ ...raw, attachments }), f.host), 'byte count');
});

it('P8-TP-R4-V16 transcript source capture is resolved independently of matching intake/provider hashes', () => {
  const f = setup('derive-transcript'), raw = payloadInput('derive-transcript', f.host);
  const reference = (raw.sourceCapture as { reference: string }).reference;
  const unavailable = { ...f.host, current: () => { const current = f.host.current(); const captures = { ...current.decode.captures };
    delete captures[reference]; return { ...current, decode: { ...current.decode, captures, captureStatuses: { [reference]: 'missing' } } }; } };
  refused(decodeEffectPayload(raw, unavailable), 'source capture');
});

it('P8-TP-R4-V24 typed requests refuse a missing, wrong-kind, conflicting, or mismatched semantic parent', () => {
  const f = setup('post-text'), raw = payloadInput('post-text', f.host), facts = value(f.store.read());
  const missingRaw = identify({ ...raw, semanticMessage: 'semantic:never-admitted' });
  refused(decodeEffectPayload(missingRaw, f.host), 'semantic parent');
  const semantic = facts.find(fact => fact.kind === 'semantic-message-admission')!;
  const missing = { ...f.host, referenceFacts: () => f.success(facts.filter(fact => fact.id !== semantic.id)) };
  refused(decodeEffectPayload(raw, missing), 'semantic parent');
  f.reference('semantic-message-admission', { id: raw.semanticMessage, run: 'run:other', sourceLineage: 'run:other',
    status: 'current', validFrom: 0, validUntil: 1000 });
  refused(decodeEffectPayload(raw, f.host), 'semantic parent');
});

it('P8-TP-R4-V25 real Part Four media receipt resolves provider-file identity from captured bytes', () => {
  const intake = intakeFixture(); intake.bind();
  const bytes = JSON.stringify({ schemaVersion: 1, kind: 'message', text: 'photo', platformFile: 'provider-file:1', mediaType: 'image/png' });
  intake.port().receive(bytes, route);
  const receipt = intake.facts().find(fact => fact.kind === 'intake-receipt')!;
  const f = setup('fetch-inbound-media');
  const facts = [...value(f.store.read()).filter(fact => fact.kind !== 'intake-receipt'), ...intake.facts()];
  const host = { ...f.host, referenceFacts: () => f.success(facts), current: () => { const current = f.host.current();
    return { ...current, decode: { ...current.decode, captures: { ...current.decode.captures,
      ...Object.fromEntries(Object.entries(intake.context.captures).filter(([, capture]) => capture.status === 'available')
        .map(([reference, capture]) => [reference, capture.bytes!])) } } }; } };
  const accepted = identify({ ...payloadInput('fetch-inbound-media', host), account: 'host', conversation: route.channel,
    inboundReceipt: receipt.id, platformFile: 'provider-file:1' });
  expect(decodeEffectPayload(accepted, host).kind).toBe('Success');
  refused(decodeEffectPayload(identify({ ...accepted, platformFile: 'provider-file:other' }), host), 'file subject');
  refused(decodeEffectPayload(identify({ ...accepted, conversation: 'wrong-channel' }), host), 'subject mismatch');
});
