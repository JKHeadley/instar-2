import { expect, it } from 'vitest';
import { decode } from '../../src/index.js';
import { renderTelegramDeliveryStatus } from '../../src/conversation/index.js';
import { value } from '../intake/fixtures.js';
import { conversationFixture } from './fixture.js';
import { telegramPreparedOutbound, telegramUnpreparedOutbound } from './round5-fixture.js';

const decodeCaptures = (captures: Readonly<Record<string, { readonly bytes?: string | null }>>) => Object.fromEntries(
  Object.entries(captures).flatMap(([reference, capture]) => typeof capture.bytes === 'string' ? [[reference, capture.bytes]] : []),
);

it('P12-NF-29 P12-NF-34 P12-NF-35 round11 unwitnessed-evidence-rejected validates evidence and provider bytes', () => {
  const accepted = telegramPreparedOutbound();
  const observation = value(accepted.doorway.dispatch(accepted.request, accepted.effects.fence));
  const counterfeit = {
    type: 'Evidence', schemaVersion: 1, id: 'evidence:never-decoded-or-witnessed',
    claim: { subject: observation.operation, predicate: 'operation-occurred', value: { digest: observation.digest } },
    observedAt: { value: 100 }, freshFor: 100, capture: observation.capture,
  } as any;
  const unwitnessed = renderTelegramDeliveryStatus({ observation, evidence: counterfeit,
    now: accepted.effects.clock(100), status: 'accepted-by-platform', form: 'words' }, accepted.effects.host.boundary);
  expect(unwitnessed.kind).toBe('Refused');
  if (unwitnessed.kind === 'Refused') expect(unwitnessed.detail).toContain('source: missing required field');

  const evidence = value(decode('Evidence', accepted.effects.evidenceInput({
    id: 'evidence:round11-valid-control',
    claim: { subject: observation.operation, predicate: 'operation-occurred', value: { digest: observation.digest } },
    source: 'probe', observedAt: accepted.effects.clock(100), freshFor: 100,
    capture: observation.capture, strength: 'proof',
  }), { ...accepted.effects.ctx.decode, captures: decodeCaptures(accepted.effects.ctx.captures) }));
  expect(value(renderTelegramDeliveryStatus({ observation, evidence,
    now: accepted.effects.clock(100), status: 'accepted-by-platform', form: 'words' }, accepted.effects.host.boundary)))
    .toBe('Accepted by platform');

  const rejected = telegramPreparedOutbound();
  rejected.telegram.setSendResult('{"ok":false,"error_code":400,"description":"message refused by provider"}');
  const rejectedObservation = value(rejected.doorway.dispatch(rejected.request, rejected.effects.fence));
  const rejectedEvidence = value(decode('Evidence', rejected.effects.evidenceInput({
    id: 'evidence:round11-provider-rejection',
    claim: { subject: rejectedObservation.operation, predicate: 'operation-occurred', value: { digest: rejectedObservation.digest } },
    source: 'probe', observedAt: rejected.effects.clock(100), freshFor: 100,
    capture: rejectedObservation.capture, strength: 'proof',
  }), { ...rejected.effects.ctx.decode, captures: decodeCaptures(rejected.effects.ctx.captures) }));
  const providerRefusal = renderTelegramDeliveryStatus({ observation: rejectedObservation, evidence: rejectedEvidence,
    now: rejected.effects.clock(100), status: 'accepted-by-platform', form: 'words' }, rejected.effects.host.boundary);
  expect(providerRefusal.kind).toBe('Refused');
  if (providerRefusal.kind === 'Refused') expect(providerRefusal.detail).toContain('explicitly refused');
}, 30_000);

it('P12-NF-29 P12-NF-30 P12-NF-41 round11 deterministic preparation refuses before Part Eight or Six custody', () => {
  for (const [name, text, maxEntities, reason] of [
    ['entity-limit', '<b>Hello</b>', 0, 'declared HTML entity limit'],
    ['control-data', 'bad\u0000text', 100, 'unsupported control data'],
  ] as const) {
    const fixture = telegramUnpreparedOutbound(false, text, maxEntities);
    const before = value(fixture.effects.transport.inspect());
    const prepared = fixture.prepare();
    expect(prepared.kind, name).toBe('Refused');
    if (prepared.kind === 'Refused') {
      expect(prepared.detail, name).toContain(reason);
      expect(prepared.detail, name).toMatch(/unsupported|chunking and truncation/);
    }
    expect(value(fixture.effects.transport.inspect()), name).toEqual(before);
    expect(fixture.telegram.calls.send, name).toHaveLength(0);
  }
});

it('P12-NF-04 P12-NF-46 P12-NF-49 round11 every consumed Telegram limit binds the immutable contract', () => {
  const unchanged = conversationFixture();
  const reused = value(unchanged.admit({ ...unchanged.declaration, limits: { ...unchanged.declaration.limits } }));
  expect(reused.contract.id).toBe(unchanged.admitted.contract.id);
  expect(reused.conformance.id).toBe(unchanged.admitted.conformance.id);

  for (const [field, replacement] of [
    ['maxUpdateBytes', 1024], ['maxReplyCharacters', 4095], ['maxReplyBytes', 2048],
    ['maxEntities', 99], ['maxConcurrentPolls', 2], ['maxCharge', 999], ['timeout', 999],
  ] as const) {
    const fixture = conversationFixture();
    const limits = { ...fixture.declaration.limits, [field]: replacement } as any;
    expect(fixture.admit({ ...fixture.declaration, limits }).kind, field).toBe('Refused');
  }
});
