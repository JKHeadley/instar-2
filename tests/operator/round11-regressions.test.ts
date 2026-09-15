// @ts-nocheck -- adversarial provider substitutions intentionally exercise refusal paths.
import { expect, it } from 'vitest';
import { consumeResult, decode } from '../../src/index.js';
import { operatorFixture } from './fixture.js';
import { value } from '../fixtures.js';

const outcome = <T>(result: ReturnType<ReturnType<typeof operatorFixture>['surface']> extends never ? never : any) =>
  consumeResult(result, { Success: (resolved: T) => ({ accepted: true as const, value: resolved }),
    Refused: (refusal: { detail: string }) => ({ accepted: false as const, detail: refusal.detail }) });

it('V71 P11-NF-13 unavailable independent witness inventory leaves an explicit unprotected read-only result', () => {
  const f = operatorFixture();
  f.composition.verification.inspectCurrent = () => decode('Scope',
    { type: 'Scope', schemaVersion: 1, kind: 'project', members: [] }, f.context.decode) as never;
  const status = outcome<{ posture: string; uncertainty: readonly string[] }>(f.surface().protection('operation', 'path'));
  expect(value(f.surface().render(f.request.id)).requestId).toBe('request:1');
  expect(status).toMatchObject({ accepted: true, value: { posture: 'unprotected' } });
  if (status.accepted) expect(status.value.uncertainty.length).toBeGreaterThan(0);
});

it('V72 P11-NF-13 unavailable isolation proof leaves an explicit unprotected read-only result', () => {
  const f = operatorFixture();
  f.composition.isolation.live = () => decode('Scope',
    { type: 'Scope', schemaVersion: 1, kind: 'project', members: [] }, f.context.decode) as never;
  expect(outcome(f.surface().protection('operation', 'path'))).toMatchObject({
    accepted: true, value: { posture: 'unprotected' },
  });
});

it('V87 P11-NF-05 P11-NF-06 first request with only textual recurrence has no standing-grant candidate', () => {
  const f = operatorFixture();
  expect(f.facts().filter(row => row.kind === 'authorization-request')).toHaveLength(1);
  expect(value(f.surface().render(f.request.id)).standingGrantCandidate).toBeNull();
});
