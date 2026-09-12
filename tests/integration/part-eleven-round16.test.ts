import { expect, it } from 'vitest';
import { consumeResult } from '../../src/index.js';
import type { Result } from '../../src/index.js';
import { evaluateMinimalPath, minimalResponse, requiredMinimalDependencies } from '../../src/operator/index.js';
import type { MinimalDependency, MinimalPathState } from '../../src/operator/index.js';
import { operatorFixture } from '../operator/fixture.js';

type Outcome<T> = Readonly<{ accepted: true; value: T }> | Readonly<{ accepted: false; detail: string }>;
const outcome = <T>(result: Result<T>): Outcome<T> => consumeResult<T, Outcome<T>>(result, {
  Success: value => ({ accepted: true as const, value }),
  Refused: refusal => ({ accepted: false as const, detail: refusal.detail }),
});
const admissions = (): Record<MinimalDependency, boolean> => Object.fromEntries(
  requiredMinimalDependencies.map(name => [name, true]),
) as Record<MinimalDependency, boolean>;

it('R16-F1 integration: a forged truthy challenge boolean cannot reach the real Part Four verified-act seam', () => {
  const fixture = operatorFixture(), surface = fixture.surface();
  const issued = outcome(surface.challenge(fixture.request.id));
  expect(issued.accepted).toBe(true);
  if (!issued.accepted) return;
  expect(outcome(surface.confirm({ challenge: { ...issued.value, singleUse: 'false' } as never,
    proof: 'signed-proof', decision: 'approve' }))).toMatchObject({ accepted: false });
  expect(fixture.admitted).toHaveLength(0);
  expect(fixture.facts().filter(row => row.kind === 'intake-verified-act')).toHaveLength(0);
});

it('R16-F2 integration: copied minimal state is accepted only with the complete zero-replay owned-exposure invariant', () => {
  const fixture = operatorFixture();
  const evaluated = outcome(evaluateMinimalPath({ admitted: admissions(), ordinaryUnavailable: ['ordinary-model'],
    inputPreserved: true, repairOwner: 'repair:integration', maximumExposure: 7 }, fixture.f.c));
  expect(evaluated.accepted).toBe(true);
  if (!evaluated.accepted) return;
  const copied = JSON.parse(JSON.stringify(evaluated.value)) as MinimalPathState;
  const response = { attributable: true, pending: ['ordinary run'], blocked: [], uncertain: [], emergencyStop: false };
  expect(outcome(minimalResponse(copied, response, fixture.f.c))).toMatchObject({ accepted: true });
  for (const patch of [{ replayCount: 1 }, { repairOwner: '' }, { maximumExposure: -1 }, { admitted: false }])
    expect(outcome(minimalResponse({ ...copied, ...patch } as MinimalPathState, response, fixture.f.c)))
      .toMatchObject({ accepted: false });
});
