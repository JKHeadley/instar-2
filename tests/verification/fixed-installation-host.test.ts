import { afterEach, expect, it } from 'vitest';
import { chmodSync, mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import * as one from '../../src/index.js';
import * as nine from '../../src/verification/index.js';
import type { IndependentSurfaceVerifierPort, SurfaceChallenge } from '../../src/operator/index.js';
import { factsFixture, refused, value } from '../facts/fixtures.js';
// @ts-expect-error The separately launched physical host is JavaScript.
import { createFixedInstallationHost } from '../../scripts/fixed-installation-verifier-clock-observer.mjs';

const cleanup: (() => void)[] = [];
afterEach(() => { while (cleanup.length) cleanup.pop()!(); });

// These are host protocol tests with an isolated test factor, NOT installed
// independent-verifier/probe evidence. The clock and replay journal are real.
function setup() {
  const f = factsFixture(), journal = realpathSync(mkdtempSync(join(tmpdir(), 'm4-verifier-')));
  chmodSync(journal, 0o700); cleanup.push(() => rmSync(journal, { recursive: true, force: true }));
  const configuration = { subject: 'agent', observer: 'operator-observer', domain: 'test-host',
    trustReference: 'test-only:factor', service: 'verifier', surface: 'phone-surface',
    operator: f.alice.id, operatorUid: process.getuid!(), agentUid: process.getuid!() + 1,
    commonFailures: ['shared host compromise or loss'], factorKey: 'host', maxChallenges: 32,
    maxLifetime: 10000, journal, clockSubject: 'machine-a', clockProducer: 'probe' };
  const input = { configuration, owners: { one, nine }, boundary: f.c, context: () => f.ctx.decode,
    capture: { preserve: (bytes: string) => f.success({ reference: f.capture(bytes), hash: f.capture(bytes) }) } };
  const reopen = () => createFixedInstallationHost(input);
  const host = reopen();
  const port: IndependentSurfaceVerifierPort = host.verifier;
  const subject = () => ({ request: 'request:one', requestDigest: f.capture('request'), renderingDigest: f.capture('rendering'),
    artifact: f.capture('artifact'), action: 'approve', scope: f.scope, audience: 'independent-emergency-stop',
    operator: f.alice.id, requestedBy: f.bob.id, base: 'base:one', issuedAt: Date.now(), expiresAt: Date.now() + 5000,
    singleUse: true as const, surface: 'phone-surface', generation: f.ctx.decode.register.generation });
  const issue = () => value(port.issue(subject()));
  const proof = (challenge: SurfaceChallenge, decision = 'approve', delta = {}) => {
    const { id, ...fields } = challenge;
    const signed = f.proof({ type: 'VerifiedOperatorChallenge', schemaVersion: 1, challenge: id, ...fields,
      decision, actDigest: 'none', ...delta }, { id: f.alice.id, kind: 'person' }, 'verified-operator-challenge', false, 'phone-surface');
    return JSON.stringify({ type: 'VerifiedActProofBundle', schemaVersion: 1, challenge: signed.input, act: null });
  };
  return { f, host, port, input, reopen, issue, proof, subject };
}

it('P10-SI-13 verifies one exact signed challenge, refuses replay, and preserves refusal after host restart', () => {
  const f = setup(), challenge = f.issue(), proof = f.proof(challenge);
  expect(value(f.port.verify(challenge, proof, 'approve')).challenge).toBe(challenge.id);
  refused(f.port.verify(challenge, proof, 'approve'), 'already consumed');
  refused(f.reopen().verifier.verify(challenge, proof, 'approve'), 'already consumed');
  expect(f.host.identities.subject).not.toBe(f.host.identities.observer);
  expect(f.host.identities.commonFailures).toEqual(['shared host compromise or loss']);
});

it.each(['request', 'renderingDigest', 'artifact', 'base', 'scope', 'decision'])(
  'P10-SI-13 refuses a signed proof with changed %s', field => {
    const f = setup(), challenge = f.issue();
    refused(f.port.verify(challenge, f.proof(challenge, 'approve', { [field]: 'changed' }), 'approve'), 'differs from exact challenge');
    expect(value(f.port.verify(challenge, f.proof(challenge), 'approve')).challenge).toBe(challenge.id);
  });

it('P10-SI-13 uses wall clock at consumption and rejects an expired challenge without accepting a refreshed copy', async () => {
  const f = setup(), subject = f.subject();
  const challenge = value(f.port.issue({ ...subject, expiresAt: Date.now() + 80 }));
  const proof = f.proof(challenge);
  await new Promise(resolve => setTimeout(resolve, Math.max(0, challenge.expiresAt - Date.now()) + 5));
  refused(f.port.verify(challenge, proof, 'approve'), 'expired');
  refused(f.port.verify({ ...challenge, expiresAt: Date.now() + 5000 }, proof, 'approve'), 'bytes changed');
});

it('P10-SI-13 refuses stale and incomparable clock evidence without refreshing observation time', async () => {
  const f = setup(), at = value<one.Clock>(f.host.clock());
  const evidence = value(one.decode('Evidence', f.f.evidenceInput({ observedAt: at, freshFor: 80 }), f.f.ctx.decode));
  expect(value(f.host.freshness(evidence))).toBe('fresh');
  await new Promise(resolve => setTimeout(resolve, Math.max(0, at.value + 80 - Date.now()) + 5));
  expect(value(f.host.freshness(evidence))).toBe('expired');
  const foreign = value(one.decodeMeasurement('clock', f.f.clockRaw(Date.now(), 'machine-b'), f.f.ctx.decode));
  const incomparable = value(one.decode('Evidence', f.f.evidenceInput({ observedAt: foreign, freshFor: 5000 }), f.f.ctx.decode));
  expect(value(f.host.freshness(incomparable))).toBe('unknown');
});

it('P10-SI-13 refuses same-identity administration, missing factor and readiness without real probes', () => {
  const f = setup();
  expect(() => createFixedInstallationHost({ ...f.input,
    configuration: { ...f.input.configuration, agentUid: process.getuid!() } })).toThrow('outside the agent');
  const absent = createFixedInstallationHost({ ...f.input,
    configuration: { ...f.input.configuration, factorKey: 'missing' } });
  refused(absent.verifier.issue(f.subject()), 'factor unavailable');
  refused(f.host.readiness(), 'live verifier probes unavailable');
  const empty = createFixedInstallationHost({ ...f.input, probes: () => ({ probes: [] }) });
  refused(empty.readiness(), 'live verifier probes unavailable');
  refused(f.host.observePost(), 'authentic exact-post evidence unavailable');
});
