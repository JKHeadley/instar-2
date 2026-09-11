import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { createFactStore } from '../../src/facts/index.js';
import { assemblyInput } from '../assembly/fixture.js';
import { assemblyRuntimeFixture } from '../assembly/runtime-fixture.js';
import { value } from '../intake/fixtures.js';
import { conversationFixture, telegramRaw } from './fixture.js';
import { telegramOutbound, wireTelegram } from './round3-fixture.js';

it('P12-NF-37 round3 a real Part Six observation wake is read-only and cannot invoke the Telegram operation again', () => {
  const f = telegramOutbound(true);
  const original = value(f.doorway.dispatch(f.request, f.effects.fence));
  expect(original.stage).toBe('unknown');
  expect(f.telegram.calls.send).toHaveLength(1);
  f.effects.time(110);
  value(f.effects.transport.recover('round3-observation', f.effects.fence, original.operation, f.doorway));
  expect(f.telegram.calls.send).toHaveLength(1);
  const observations = value(f.doorway.inspect()).filter(row => row.record.type === 'OperationObservation');
  expect(observations.some(row => row.record.type === 'OperationObservation'
    && row.record.operation === original.operation && row.record.stage === 'observer-accepted'
    && row.record.wake.length > 0)).toBe(true);
});

it('P12-NF-39 round3 expiry and reconstructed custody retain original bytes, receipt, hold, and terminal instead of purging or dead-letter loss', () => {
  const f = conversationFixture();
  const wire = wireTelegram(f);
  const raw = telegramRaw('media-metadata');
  f.queue(raw);
  const cycle = value(wire.ingress.pollOnce());
  expect(cycle.captured[0]?.intake).toBe('owned-refusal');
  const receipt = value(wire.facts.read()).find(row => row.kind === 'intake-receipt')!;
  const capture = (receipt.body as any).capture as { reference: string; hash: string };
  expect(f.intake.context.captures[capture.reference]?.bytes).toBe(raw);
  f.intake.setTime(1_200);
  expect(value(wire.intake.expireHolds())).toBe(1);
  f.intake.setTime(100_000);
  expect(value(wire.intake.expireHolds())).toBe(0);

  const rebuilt = createFactStore(f.intake.context, f.intake.storage);
  const retained = value(rebuilt.read());
  expect(retained.some(row => row.id === receipt.id && row.kind === 'intake-receipt')).toBe(true);
  expect(retained.some(row => row.kind === 'intake-held')).toBe(true);
  expect(retained.some(row => row.kind === 'intake-expired')).toBe(true);
  expect(f.intake.context.captures[capture.reference]).toMatchObject({ bytes: raw, hash: capture.hash, status: 'available' });
});

it('P12-NF-47 round3 Part Ten measurement evidence refuses missing target or success-only samples and retains honest measured workload evidence', () => {
  const f = assemblyRuntimeFixture();
  const good = assemblyInput('GrowthObservation');
  expect(value(f.runtime.record('GrowthObservation', good))).toMatchObject({
    type: 'GrowthObservation', hardwareProfile: 'fixture-machine', completion: 'complete',
    sampleCount: 1, denominator: 1, measurements: ['measurement:replay'],
  });

  const missingTarget = { ...good, id: 'telegram-growth:target-as-measurement',
    measurements: ['configured-target:not-a-measurement'] };
  expect(f.runtime.record('GrowthObservation', missingTarget).kind).toBe('Refused');

  const successOnly = { ...good, id: 'telegram-growth:success-only', denominator: 2 };
  expect(f.runtime.record('GrowthObservation', successOnly).kind).toBe('Refused');

  const unlabeledEstimate = { ...good, id: 'telegram-growth:estimate-as-measured',
    measurements: ['estimate:not-a-measurement'] };
  expect(f.runtime.record('GrowthObservation', unlabeledEstimate).kind).toBe('Refused');
});

it('P12-NF-49 round3 mode and API upgrades do not reuse prior conformance and the active-generation briefing names current modes and operations', () => {
  const polling = conversationFixture();
  const webhook = conversationFixture({ mode: 'webhook', botId: '9010' });
  expect(polling.admitted.mode).toBe('long-poll');
  expect(webhook.admitted.mode).toBe('webhook');
  expect(webhook.admitted.contract.id).not.toBe(polling.admitted.contract.id);
  expect(webhook.admitted.conformance.id).not.toBe(polling.admitted.conformance.id);

  polling.setProbe({ ...polling.admitted.probe, apiVersion: '9.3' });
  const changedApi = polling.admit({ ...polling.declaration, apiVersion: '9.3' });
  expect(changedApi.kind).toBe('Refused');
  expect(polling.admit().kind).toBe('Refused');
  polling.setProbe(polling.admitted.probe);
  expect(polling.admit().kind).toBe('Success');

  const source = JSON.parse(readFileSync('generated/source.json', 'utf8')) as { generation: string; commit: string };
  const capabilities = readFileSync('generated/capabilities.md', 'utf8');
  expect(source.generation).toMatch(/^sha256:[a-f0-9]{64}$/);
  expect(source.commit).toMatch(/^[a-f0-9]{40}$/);
  for (const row of ['telegram.mode.long-poll.default', 'telegram.mode.webhook.signed-choice-only',
    'telegram.operation.ordinary-reply.supported', 'telegram.operation.media.inhibited',
    'public.IntakePort.receive', 'public.EffectDoorway.handoff']) expect(capabilities).toContain(row);
});
