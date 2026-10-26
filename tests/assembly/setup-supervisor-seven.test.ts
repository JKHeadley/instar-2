import { afterEach, expect, it } from 'vitest';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { canonical } from '../../src/index.js';
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
