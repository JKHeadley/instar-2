// Rule 56: the installed doorway/model map carries exact ids and verification
// times; a map older than its window, unverified, changed or unavailable fails.
import { expect, it } from 'vitest';
import { DOORWAY_FRESH_MS, doorwayFreshness, installDoorways, observeExchange, subscriptionExchange } from './doorway-map.js';

const installed = [{ id: 'preview-subscription', billing: 'subscription' as const, model: 'claude-opus-4-8', priceReason: 'charge not reported by the subscription route' },
  { id: 'typesafe-jev', billing: 'metered' as const, model: 'jev-1.13.0', priceReason: 'no price reported by the route' }];

it('starts unverified, verifies from real exchanges, and ages into a failing stale reading', () => {
  let map = installDoorways(null, installed);
  expect(doorwayFreshness(map, 1000)).toMatchObject({ fresh: false, models: [
    { model: 'claude-opus-4-8', state: 'unverified', fresh: false }, { model: 'jev-1.13.0', state: 'unverified', fresh: false }] });
  map = observeExchange(map, 'preview-subscription', 'claude-opus-4-8', { ok: true, reportedModels: ['claude-opus-4-8'], evidence: 'exchange:a' }, 1000);
  map = observeExchange(map, 'typesafe-jev', 'jev-1.13.0', { ok: true, reportedModels: ['jev-1.13.0'], evidence: 'exchange:b' }, 1000);
  const fresh = doorwayFreshness(map, 1000 + DOORWAY_FRESH_MS);
  expect(fresh.fresh).toBe(true);
  expect(fresh.models[0]).toMatchObject({ state: 'verified', verifiedAt: 1000,
    age: `${DOORWAY_FRESH_MS} ms of doorway-verification-age (preview-subscription/claude-opus-4-8)` });
  expect(map.doorways[0]!.models[0]).toMatchObject({ strength: 'provider-reported', evidence: 'exchange:a' });
  expect(doorwayFreshness(map, 1001 + DOORWAY_FRESH_MS)).toMatchObject({ fresh: false,
    models: [{ state: 'stale', fresh: false }, { state: 'stale', fresh: false }] });
});

it('records a changed model id and an unavailable reading instead of a verification', () => {
  let map = installDoorways(null, installed);
  map = observeExchange(map, 'typesafe-jev', 'jev-1.13.0', { ok: true, reportedModels: ['jev-2.0.0'], evidence: 'exchange:c' }, 50);
  map = observeExchange(map, 'preview-subscription', 'claude-opus-4-8', { ok: false, reason: 'exit', evidence: 'exchange:d' }, 60);
  expect(doorwayFreshness(map, 70).models).toEqual([
    expect.objectContaining({ model: 'claude-opus-4-8', state: 'unavailable', fresh: false }),
    expect.objectContaining({ model: 'jev-1.13.0', state: 'changed', observedId: 'jev-2.0.0', fresh: false })]);
  // An annotated provider id that still leads with the exact id verifies.
  map = observeExchange(map, 'preview-subscription', 'claude-opus-4-8', { ok: true, reportedModels: ['claude-opus-4-8[1m]'], evidence: 'e' }, 80);
  expect(doorwayFreshness(map, 90).models[0]).toMatchObject({ state: 'verified', fresh: true });
});

it('retains a model no longer installed as retired, outside the freshness check', () => {
  let map = installDoorways(null, installed);
  map = observeExchange(map, 'preview-subscription', 'claude-opus-4-8', { ok: true, reportedModels: [], evidence: 'e' }, 10);
  map = installDoorways(map, [{ ...installed[0]!, model: 'claude-fable-5' }]);
  expect(map.doorways.find(d => d.id === 'preview-subscription')!.models).toEqual([
    expect.objectContaining({ id: 'claude-opus-4-8', state: 'retired', verifiedAt: 10 }),
    expect.objectContaining({ id: 'claude-fable-5', state: 'unverified' })]);
  expect(map.doorways.find(d => d.id === 'typesafe-jev')!.models[0]!.state).toBe('retired');
  expect(doorwayFreshness(map, 20).models.map(m => m.model)).toEqual(['claude-fable-5']);
});

it('discovers the subscription outcome from the exchange, ignoring local resource limits', () => {
  const frame = JSON.stringify({ type: 'result', is_error: false, modelUsage: { 'claude-opus-4-8': {} } });
  expect(subscriptionExchange({ code: 0, limited: false, stdout: frame }, 'op')).toEqual({ ok: true, reportedModels: ['claude-opus-4-8'], evidence: 'exchange:op' });
  expect(subscriptionExchange({ code: 0, limited: false, stdout: JSON.stringify({ type: 'result', is_error: true }) }, 'op'))
    .toMatchObject({ ok: false, reason: 'error-frame' });
  expect(subscriptionExchange({ code: 1, limited: false, stdout: '' }, 'op')).toMatchObject({ ok: false, reason: 'exit' });
  expect(subscriptionExchange({ code: null, limited: true, localLimit: 'timeout', stdout: '' }, 'op')).toMatchObject({ ok: false, reason: 'timeout' });
  expect(subscriptionExchange({ code: null, limited: true, localLimit: 'memory', stdout: '' }, 'op')).toBeNull();
  expect(subscriptionExchange({ code: null, limited: true, localLimit: 'capacity', stdout: '' }, 'op')).toBeNull();
});
