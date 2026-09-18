// @ts-nocheck -- exercises the compiled public production composition boundary.
import { expect, it } from 'vitest';
import { mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { groundingCheckpoint } from '../assembly/production-grounding-evidence.mjs';
import { bootProductionSliceAssembly, prepareProductionSliceAssembly, sliceConfig, take, settled } from '../../scripts/slice-assembly.mjs';

it('PG-R4B production slice binds actual captured input, current custody and one durable Six context operation through default restart', async () => {
  const home = mkdtempSync(join(tmpdir(), 'grounded-production-slice-')), config = sliceConfig({ profile: 'reply' });
  const events = [];
  const prepared = prepareProductionSliceAssembly(home, config, { onContextEvent(event) {
    events.push(event); groundingCheckpoint(`slice-${event.phase}`, event);
    if (event.phase === 'consumed-before-invoke') {
      const peerClaim = take(prepared.slice.peerStore.read()).filter(row => row.kind === 'transport-AdmissionReservation'
        && row.body.record.operation === event.operation).at(-1);
      expect(peerClaim.body.record.state).toBe('consumed');
      expect(peerClaim.id).toBe(event.fact);
    }
  } });
  const boot = bootProductionSliceAssembly({ home, config, prepared, authorizationRequest: prepared.authorizationRequest });
  expect(prepared.assembly.spine.store).toBe(boot.store);
  const report = await boot.drive();
  expect(report.grounding).toBe('grounded');
  expect(report.externalApplications).toHaveLength(1);
  expect(report.contextOperations).toHaveLength(1);
  expect(report.contextOperations[0]).toMatchObject({ role: 'harness-live-input', resolved: true, charge: 0,
    application: { actualCharge: 0, unresolved: 0, exposure: 0 } });
  expect(events.map(event => event.phase)).toEqual(['sample', 'consumed-before-invoke', 'context-consumed']);
  const facts = boot.facts(), spec = facts.find(row => row.kind === 'assembly-ContextDeliverySpecification');
  const request = facts.find(row => row.kind === 'effect-EffectRequest' && row.body.record.definition === 'slice-context-definition:1');
  const message = facts.find(row => row.kind === 'effect-OutboundMessage' && row.body.record.id === request.body.record.message);
  expect(message.body.record.context.input).toEqual({ fact: spec.body.record.input,
    reference: spec.body.record.inputDigest, hash: spec.body.record.inputDigest });
  expect(request.body.record.digest).not.toBe(spec.body.record.inputDigest);
  const consumed = facts.find(row => row.kind === 'transport-AdmissionReservation'
    && row.body.record.operation === spec.body.record.operation && row.body.record.state === 'consumed');
  const response = facts.find(row => row.kind === 'effect-OperationObservation'
    && row.body.record.operation === spec.body.record.operation && row.body.record.stage === 'response');
  const observation = facts.find(row => row.kind === 'assembly-HarnessObservation'
    && row.body.record.contextDelivery === spec.id && row.body.record.phase === 'context-consumed');
  expect(consumed.body.record.digest).toBe(request.body.record.digest);
  expect(consumed.segment.position).toBeLessThan(response.segment.position);
  expect(response.segment.position).toBeLessThan(observation.segment.position);
  expect(observation.segment.position).toBeLessThan(facts.find(row => row.kind === 'session-grounding').segment.position);
  const contextFiles = readdirSync(home).filter(name => /^context-.*\.json$/.test(name));
  expect(contextFiles).toHaveLength(1);
  expect(JSON.parse(readFileSync(join(home, contextFiles[0]), 'utf8')).contents)
    .toContainEqual(expect.objectContaining({ class: 'message', bytes: report.preservedInput.bytes }));

  take(boot.store.readForProjection());
  const capturePath = join(boot.paths.captures, `${response.body.record.capture.hash.slice(7)}.capture`);
  const bytes = readFileSync(capturePath, 'utf8');
  try {
    writeFileSync(capturePath, 'x'.repeat(bytes.length));
    const changed = settled(boot.store.readForProjection());
    expect(changed.ok && changed.value.entries.every(row => !row.taint.length && !row.conflicts.length)).toBe(false);
  } finally { writeFileSync(capturePath, bytes); }
  expect(take(boot.store.readForProjection()).entries.every(row => !row.taint.length && !row.conflicts.length)).toBe(true);

  const reopened = bootProductionSliceAssembly({ home, config, restartRecovery: true });
  const restarted = await reopened.drive();
  expect(restarted.grounding).toBe('grounded');
  expect(restarted.externalApplications).toHaveLength(1);
  expect(restarted.outbound.operation).toBe(report.outbound.operation);
  expect(restarted.contextOperations).toEqual(report.contextOperations);
  expect(readdirSync(home).filter(name => /^context-.*\.json$/.test(name))).toEqual(contextFiles);
}, 600000);
