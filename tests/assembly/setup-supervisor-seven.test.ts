import { afterEach, expect, it } from 'vitest';
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { canonical } from '../../src/index.js';
import type { DispatchClaim } from '../../src/transport/index.js';
import { transportFixture, value } from '../transport/fixture.js';
// @ts-expect-error Physical Seven capture port.
import { createJudgmentCaptures } from '../../scripts/judgment-captures.mjs';
// @ts-expect-error Installer Seven adapter.
import { setupSevenRoute, renderSetupRequest } from '../../scripts/setup-supervisor-seven.mjs';
// @ts-expect-error Installer protocol.
import { PRECHECKS } from '../../scripts/setup-supervisor-protocol.mjs';
const roots: string[] = [];
afterEach(() => { for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }); });
const record = () => ({ checkpoint: { installation: 'test-installation', session: 'test-session', subject: 'a'.repeat(64),
  authority: 'preparation-grant', step: 'key', phase: 'pre', operation: 'test-key', schema: 'setup-owner-results-v1', frontier: 'test-frontier' },
  checks: PRECHECKS.key.map((name: string, index: number) => ({ name, owner: 'custodian', observed: true, passed: true, receipt: `r${index + 1}` })) });
it('dispatches once through actual Seven/Six and retains full response, owner evidence and metering in existing captures', async () => {
  const root = mkdtempSync(join(tmpdir(), 'setup-seven-')); roots.push(root);
  const f = transportFixture(root);
  const captures = createJudgmentCaptures(root, {}, f.result, 8 * 1048576, f.ctx.decode.captures);
  const fence = value(f.api.acquire('setup', '', 500));
  value(f.api.schedule('setup-schedule', fence, f.run, f.policy));
  let calls = 0;
  const raw = '{"disposition":"accept"}';
  const route = setupSevenRoute({ authority: f.api, host: f.host, context: f.c, captures,
    claim: async (bytes: string) => {
      const reservation = value(f.api.reserve(f.input(fence, { payloadDigest: value(canonical(bytes)).hash, charge: 0 })));
      const claim = value(f.api.claim('setup-claim', fence, reservation.operation));
      return { claim, fence, deadline: 400, incarnation: f.host.incarnation, recordDispatch: () => f.result(() => undefined) };
    }, physical: { admit: async () => null, execute: async (input: any) => {
      calls++; expect(input.prompt).toBe(renderSetupRequest(record()));
      return { state: 'complete', bytes: raw, usage: { inputTokens: 17, outputTokens: 6, charge: 0, source: 'isolated test' },
        cleanup: 'verified', accounting: { raw: { stdout: raw }, elapsedMs: 12 } };
    } } });
  const result = await route.validate(record(), { root });
  expect(calls).toBe(1); expect(result).toMatchObject({ state: 'complete', bytes: raw, cleanup: 'verified' });
  const captured = JSON.parse(value(captures.read(result.capture)) as string);
  expect(captured.record).toEqual(record()); expect(captured.observation.bytes).toBe(raw);
  expect(captured.accounting.raw.stdout).toBe(raw); expect(captured.calls).toBe(1);
  expect(captured.observation.usage).toMatchObject({ inputTokens: 17, outputTokens: 6, charge: 0 });
  expect(await route.admit({ root })).toBeNull();
});
it('does not dispatch when capture capacity cannot retain the answer', async () => {
  const root = mkdtempSync(join(tmpdir(), 'setup-seven-full-')); roots.push(root);
  const f = transportFixture(root), captures = createJudgmentCaptures(root, {}, f.result, 32, f.ctx.decode.captures);
  let calls = 0;
  const route = setupSevenRoute({ authority: f.api, host: f.host, context: f.c, captures,
    claim: () => { calls++; throw Error('not allowed'); }, physical: { admit: () => null, execute: () => { calls++; } } });
  await expect(route.validate(record(), { root })).rejects.toThrow(); expect(calls).toBe(0);
});
it('renders only the closed projection, never free text, and all recorded foreign shapes remain non-decisions', () => {
  const r = record(); expect(renderSetupRequest(r)).not.toContain(r.checkpoint.subject);
  expect(() => renderSetupRequest({ ...r, credentials: 'must-not-enter-prompt' })).toThrow();
  const rows = JSON.parse(readFileSync('tests/preview/fixtures/retrospective-duty-followup-train-1-2026-10-08.json', 'utf8')).otherShapes;
  expect(rows.length).toBeGreaterThan(4);
});

function recoveryFixture() {
  const root = mkdtempSync(join(tmpdir(), 'setup-seven-recovery-')); roots.push(root);
  const f = transportFixture(root);
  // Exactly one response reservation plus bounded request storage, never two.
  const captures = createJudgmentCaptures(root, {}, f.result, 4 * 1048576 + 16384, f.ctx.decode.captures);
  const fence = value(f.api.acquire('setup', '', 500));
  value(f.api.schedule('setup-schedule', fence, f.run, f.policy));
  let failure = '', calls = 0, claims = 0;
  let issuedClaim: DispatchClaim | undefined;
  const route = setupSevenRoute({ authority: f.api, host: f.host, context: f.c, captures,
    claim: async (bytes: string) => {
      claims++;
      if (failure === 'claim') throw Error('transient claim failure');
      const reservation = value(f.api.reserve(f.input(fence, { payloadDigest: value(canonical(bytes)).hash, charge: 0 })));
      // Expiry refuses before consuming this capability; repairing the deadline
      // can reuse it without minting another claim or operation.
      const claim = issuedClaim ??= value(f.api.claim('setup-claim', fence, reservation.operation));
      return { claim, fence, deadline: failure === 'exchange' ? 0 : 400,
        incarnation: f.host.incarnation, recordDispatch: () => f.result(() => undefined) };
    }, physical: { admit: () => null, execute: async () => {
      calls++;
      if (failure === 'physical') throw Error('physical outcome unknown');
      return { state: 'complete', bytes: '{"disposition":"accept"}',
        usage: { inputTokens: 17, outputTokens: 6, charge: 0, source: 'isolated test' },
        cleanup: 'verified', accounting: failure === 'capture' ? { oversized: 'x'.repeat(4 * 1048576) } : {} };
    } } });
  const releases = () => readdirSync(join(root, 'captures/capacity')).filter(name => name.endsWith('.release.json'));
  return { root, f, route, captures, releases, calls: () => calls, claims: () => claims,
    fail: (mode: string) => { failure = mode; } };
}
it.each(['fresh', 'claim', 'exchange'])('recovers one-slot capacity after %s pre-dispatch admission', async mode => {
  const t = recoveryFixture();
  if (mode !== 'fresh') {
    t.fail(mode);
    await expect(t.route.validate(record(), { root: t.root })).rejects.toThrow();
    expect(t.calls()).toBe(0);
    expect(t.releases()).toHaveLength(1);
    // Release retains the submitted request, and exchange refusal keeps Six evidence.
    expect(readdirSync(join(t.root, 'captures')).filter(name => /^[a-f0-9]{64}$/.test(name))).toHaveLength(1);
    if (mode === 'exchange') expect(value(t.f.api.inspect()).some(row => row.record.type === 'AdmissionReservation' && row.record.state === 'dispatch-claimed')).toBe(true);
    t.fail('');
  }
  const result = await t.route.validate(record(), { root: t.root });
  expect(result.state).toBe('complete'); expect(t.calls()).toBe(1);
  expect(JSON.parse(value(t.captures.read(result.capture)) as string).calls).toBe(1);
  // Bound, completed evidence must continue to consume its reserved capacity.
  await expect(t.route.validate(record(), { root: t.root })).rejects.toThrow();
  expect(t.calls()).toBe(1);
  expect(t.releases()).toHaveLength(mode === 'fresh' ? 0 : 1);
});
it.each(['physical', 'capture'])('retains capacity after a %s failure once execution began', async mode => {
  const t = recoveryFixture(); t.fail(mode);
  if (mode === 'capture') await expect(t.route.validate(record(), { root: t.root })).rejects.toThrow();
  else {
    const result = await t.route.validate(record(), { root: t.root });
    expect(result.state).toBe('uncertain');
    expect(JSON.parse(value(t.captures.read(result.capture)) as string).observation.limitation.kind).toBe('transport-threw');
  }
  expect(t.calls()).toBe(1); expect(t.releases()).toHaveLength(0);
  t.fail('');
  await expect(t.route.validate(record(), { root: t.root })).rejects.toThrow();
  expect(t.calls()).toBe(1); expect(t.claims()).toBe(1);
});
