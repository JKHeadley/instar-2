// Rule 56: the installed doorway/model map carries exact ids and verification
// times; a map older than its window, unverified, changed or unavailable fails.
import { expect, it } from 'vitest';
import { DOORWAY_FRESH_MS, doorwayFreshness, installDoorways, observeExchange, standingDoorwayCheck, subscriptionExchange } from './doorway-map.js';
import { modelEntryFresh } from '../../src/register/index.js';

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

it('returns a reinstalled model (A→B→A) to the checked population, unverified until a real exchange', () => {
  let map = installDoorways(null, installed);
  map = observeExchange(map, 'preview-subscription', 'claude-opus-4-8', { ok: true, reportedModels: [], evidence: 'one' }, 10);
  map = observeExchange(map, 'typesafe-jev', 'jev-1.13.0', { ok: true, reportedModels: [], evidence: 'two' }, 10);
  map = installDoorways(map, [{ ...installed[0]!, model: 'claude-fable-5' }, installed[1]!]);
  map = installDoorways(map, installed);
  // Without the repair the reinstalled model stayed retired: freshness omitted it and reported fresh on Jev alone.
  expect(doorwayFreshness(map, 20)).toMatchObject({ fresh: false, models: [
    { model: 'claude-opus-4-8', state: 'unverified', fresh: false }, { model: 'jev-1.13.0', state: 'verified', fresh: true }] });
  expect(map.doorways[0]!.models.find(m => m.id === 'claude-fable-5')!.state).toBe('retired');
  map = observeExchange(map, 'preview-subscription', 'claude-opus-4-8', { ok: true, reportedModels: [], evidence: 'three' }, 30);
  expect(doorwayFreshness(map, 40)).toMatchObject({ fresh: true });
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

// Live risk (real model output format): a real Claude Code result frame lists every model the CLI used,
// often its background helper first with a dated id, then the requested model. The entry shape below is
// copied from a genuine 2026-09 subscription result frame in the desk's run logs, with only token counts kept.
it('reads a real-shaped subscription result frame: the requested model among helper models verifies; a helper alone is a change', () => {
  const entry = (canonical: string) => ({ inputTokens: 2348, outputTokens: 17, cacheReadInputTokens: 0, cacheCreationInputTokens: 0,
    webSearchRequests: 0, costUSD: 0.002433, contextWindow: 200000, maxOutputTokens: 32000, thinkingTokens: 0, canonicalModel: canonical,
    provider: 'firstParty', costBasis: 'list' });
  const frame = (usage: Record<string, unknown>) => JSON.stringify({ type: 'result', subtype: 'success', is_error: false, num_turns: 1,
    result: 'PREVIEW — ok', stop_reason: 'end_turn', total_cost_usd: 0.03, modelUsage: usage });
  const both = subscriptionExchange({ code: 0, limited: false, stdout: frame({
    'claude-haiku-4-5-20251001': entry('claude-haiku-4-5'), 'claude-opus-4-8': entry('claude-opus-4-8') }) }, 'real');
  expect(both).toEqual({ ok: true, reportedModels: ['claude-haiku-4-5-20251001', 'claude-opus-4-8'], evidence: 'exchange:real' });
  const verified = observeExchange(installDoorways(null, installed, 1000), 'preview-subscription', 'claude-opus-4-8', both!, 1000);
  expect(verified.doorways[0]!.models.find(m => m.id === 'claude-opus-4-8')).toMatchObject({ state: 'verified', strength: 'provider-reported' });
  const helperOnly = subscriptionExchange({ code: 0, limited: false, stdout: frame({ 'claude-haiku-4-5-20251001': entry('claude-haiku-4-5') }) }, 'real');
  const changed = observeExchange(installDoorways(null, installed, 1000), 'preview-subscription', 'claude-opus-4-8', helperOnly!, 1000);
  expect(changed.doorways[0]!.models.find(m => m.id === 'claude-opus-4-8')).toMatchObject({ state: 'changed', observedId: 'claude-haiku-4-5-20251001' });
});

it('runs a standing check through the register\'s model-map age rule: current, then stale while idle, with no exchange', () => {
  // The register's deadline check and the live map decide with the same function, on both sides of the window.
  expect(modelEntryFresh(1000, DOORWAY_FRESH_MS, 1000 + DOORWAY_FRESH_MS)).toBe(true);
  expect(modelEntryFresh(1000, DOORWAY_FRESH_MS, 1001 + DOORWAY_FRESH_MS)).toBe(false);
  expect(modelEntryFresh(2000, DOORWAY_FRESH_MS, 1000)).toBe(false);
  let map = installDoorways(null, installed, 1000);
  map = observeExchange(map, 'preview-subscription', 'claude-opus-4-8', { ok: true, reportedModels: [], evidence: 'a' }, 1000);
  map = observeExchange(map, 'typesafe-jev', 'jev-1.13.0', { ok: true, reportedModels: [], evidence: 'b' }, 1000);
  map = standingDoorwayCheck(map, 2000);
  expect(map.check).toEqual({ at: 2000, fresh: true, since: 2000, failing: [] });
  map = standingDoorwayCheck(map, 3000);
  expect(map.check).toMatchObject({ at: 3000, fresh: true, since: 2000 });
  // Idle: no exchange happens, and the standing check alone records the transition to stale.
  const idle = 1001 + DOORWAY_FRESH_MS;
  map = standingDoorwayCheck(map, idle);
  expect(map.check).toEqual({ at: idle, fresh: false, since: idle,
    failing: ['preview-subscription/claude-opus-4-8:stale', 'typesafe-jev/jev-1.13.0:stale'] });
  // A later real exchange returns part of it to current; the verdict change is recorded again.
  map = observeExchange(map, 'preview-subscription', 'claude-opus-4-8', { ok: true, reportedModels: [], evidence: 'c' }, idle + 5);
  map = standingDoorwayCheck(map, idle + 10);
  expect(map.check).toMatchObject({ fresh: false, since: idle + 10, failing: ['typesafe-jev/jev-1.13.0:stale'] });
  // Unavailable price evidence carries its observation time and window, and goes stale (untrusted) too.
  expect(doorwayFreshness(map, 1000).prices).toEqual([
    { doorway: 'preview-subscription', state: 'unavailable', reason: installed[0]!.priceReason, observedAt: 1000, trusted: false },
    { doorway: 'typesafe-jev', state: 'unavailable', reason: installed[1]!.priceReason, observedAt: 1000, trusted: false }]);
  expect(doorwayFreshness(map, idle).prices.map(p => p.state)).toEqual(['stale', 'stale']);
});
