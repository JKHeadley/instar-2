import { expect, it } from 'vitest';
import { consumeResult } from '../../src/index.js';
import type { Result } from '../../src/index.js';
import { createOperatorSurface, evaluateMinimalPath, minimalResponse, requiredMinimalDependencies } from '../../src/operator/index.js';
import type { MinimalDependency, MinimalPathState } from '../../src/operator/index.js';
import { operatorFixture } from './fixture.js';

type Outcome<T> = Readonly<{ accepted: true; value: T }> | Readonly<{ accepted: false; detail: string }>;
const outcome = <T>(result: Result<T>): Outcome<T> => consumeResult<T, Outcome<T>>(result, {
  Success: value => ({ accepted: true as const, value }),
  Refused: refusal => ({ accepted: false as const, detail: refusal.detail }),
});

const admitted = (): Record<MinimalDependency, boolean> => Object.fromEntries(
  requiredMinimalDependencies.map(name => [name, true]),
) as Record<MinimalDependency, boolean>;
const pathInput = () => ({ admitted: admitted(), ordinaryUnavailable: [] as string[], inputPreserved: true,
  repairOwner: 'repair:1', maximumExposure: 0 });
const responseInput = () => ({ attributable: true, pending: [] as string[], blocked: [] as string[],
  uncertain: [] as string[], emergencyStop: false });
const state = (): { fixture: ReturnType<typeof operatorFixture>; value: MinimalPathState } => {
  const fixture = operatorFixture();
  const result = outcome(evaluateMinimalPath(pathInput(), fixture.f.c));
  expect(result.accepted).toBe(true);
  if (!result.accepted) throw new Error(result.detail);
  return { fixture, value: result.value };
};

it('V81 P11-NF-33 P11-NF-38 refuses a non-boolean preservation assertion', () => {
  const fixture = operatorFixture();
  expect(outcome(evaluateMinimalPath({ ...pathInput(), inputPreserved: 'false' } as never, fixture.f.c)))
    .toMatchObject({ accepted: false });
});

it('V82 P11-NF-34 P11-NF-39 refuses a non-boolean attribution assertion', () => {
  const x = state();
  expect(outcome(minimalResponse(x.value, { ...responseInput(), attributable: 'false' } as never, x.fixture.f.c)))
    .toMatchObject({ accepted: false });
});

it.each([
  ['V83', { replayCount: 1 }],
  ['V84', { repairOwner: '' }],
  ['V85', { maximumExposure: -1 }],
] as const)('%s P11-NF-35 P11-NF-38 P11-NF-48 P11-NF-50 refuses incomplete or contradictory copied state',
  (_id, patch) => {
    const x = state();
    expect(outcome(minimalResponse({ ...x.value, ...patch } as MinimalPathState,
      { ...responseInput(), pending: ['blocked run'] }, x.fixture.f.c))).toMatchObject({ accepted: false });
  });

it('V92 accepts actual boolean false only as a typed negative and refuses preservation or attribution', () => {
  const fixture = operatorFixture();
  expect(outcome(evaluateMinimalPath({ ...pathInput(), inputPreserved: false }, fixture.f.c))).toMatchObject({ accepted: false });
  const x = state();
  expect(outcome(minimalResponse(x.value, { ...responseInput(), attributable: false }, x.fixture.f.c)))
    .toMatchObject({ accepted: false });
});

it('V93 preserves the valid serialized zero-exposure neighbor', () => {
  const x = state();
  expect(outcome(minimalResponse(JSON.parse(JSON.stringify(x.value)) as MinimalPathState,
    responseInput(), x.fixture.f.c))).toMatchObject({ accepted: true });
});

it.each([
  ['V99', 'preserved'],
  ['V100', 'admitted'],
] as const)('%s refuses a copied state with non-boolean %s', (_id, field) => {
  const x = state();
  expect(outcome(minimalResponse({ ...x.value, [field]: 'false' } as never,
    responseInput(), x.fixture.f.c))).toMatchObject({ accepted: false });
});

it('V101 refuses a non-boolean emergency-stop selector', () => {
  const x = state();
  expect(outcome(minimalResponse(x.value, { ...responseInput(), emergencyStop: 'false' } as never, x.fixture.f.c)))
    .toMatchObject({ accepted: false });
});

it('V102 preserves the bounded response for an actual boolean emergency-stop selector', () => {
  const x = state();
  expect(outcome(minimalResponse(x.value, { ...responseInput(), emergencyStop: true }, x.fixture.f.c)))
    .toMatchObject({ accepted: true, value: expect.stringContaining('requires independently verified surface completion') });
});

it('V103 refuses a response for an actual false preservation state', () => {
  const x = state();
  expect(outcome(minimalResponse({ ...x.value, preserved: false }, responseInput(), x.fixture.f.c)))
    .toMatchObject({ accepted: false });
});

it.each(['false', 'true', 0, 1, null, undefined])(
  'R16-F1 refuses non-boolean minimal-dependency admission %j instead of treating it as availability', value => {
    const fixture = operatorFixture(), input = pathInput();
    (input.admitted as Record<string, unknown>)['local-facts'] = value;
    expect(outcome(evaluateMinimalPath(input as never, fixture.f.c))).toMatchObject({ accepted: false });
  });

it('R16-F1 refuses non-boolean challenge single-use fields before Part Four admission or emergency stop', () => {
  const confirm = operatorFixture(), confirmSurface = confirm.surface();
  const confirmChallenge = outcome(confirmSurface.challenge(confirm.request.id));
  expect(confirmChallenge.accepted).toBe(true);
  if (!confirmChallenge.accepted) return;
  expect(outcome(confirmSurface.confirm({ challenge: { ...confirmChallenge.value, singleUse: 'false' } as never,
    proof: 'proof', decision: 'approve' }))).toMatchObject({ accepted: false });
  expect(confirm.admitted).toHaveLength(0);

  const stop = operatorFixture(), stopSurface = stop.surface();
  const stopChallenge = outcome(stopSurface.stopChallenge({ operator: stop.f.alice.id, scope: stop.f.scope }));
  expect(stopChallenge.accepted).toBe(true);
  if (!stopChallenge.accepted) return;
  expect(outcome(stopSurface.stop({ challenge: { ...stopChallenge.value, singleUse: 'false' } as never,
    proof: 'proof', scope: stop.f.scope }))).toMatchObject({ accepted: false });
  expect(stop.stopped).toHaveLength(0);
});

it('R16-F1 refuses non-boolean Part Two currency and Part Ten isolation results', () => {
  const malformedHistory = operatorFixture();
  const historySurface = outcome(createOperatorSurface({ ...malformedHistory.composition,
    history: { ...malformedHistory.history, isCurrent: () => malformedHistory.f.success('false' as never) } }));
  expect(historySurface.accepted).toBe(true);
  if (historySurface.accepted)
    expect(outcome(historySurface.value.render(malformedHistory.request.id))).toMatchObject({ accepted: false });

  const isolation = operatorFixture();
  const isolationSurface = outcome(createOperatorSurface({ ...isolation.composition,
    isolation: { ...isolation.composition.isolation, live: () => isolation.f.success('false' as never) } }));
  expect(isolationSurface.accepted).toBe(true);
  if (isolationSurface.accepted)
    expect(outcome(isolationSurface.value.protection('operation:1', '/protected'))).toMatchObject({ accepted: false });
});
