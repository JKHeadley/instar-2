// Rule 56: the installed doorway/model map carries exact ids and verification
// times; a map older than its window, unverified, changed or unavailable fails.
import { expect, it } from 'vitest';
import { DOORWAY_FRESH_MS, doorwayFreshness, installDoorways, observeExchange, standingDoorwayCheck, subscriptionExchange } from './doorway-map.js';
import { subscriptionDoorway } from '../../src/assembly/production-provider.js';
import { readFileSync } from 'node:fs';
import { doorwayNotices } from './credential-reminders.js';
import type { DoorwayMap } from './doorway-map.js';
import { modelEntryFresh } from '../../src/register/index.js';
import codexCapture from './fixtures/codex-answer-0.156.1.json' with { type: 'json' };
import recordedStreams from './codex-recorded-frames.json' with { type: 'json' };
import recordedShapes from './fixtures/retrospective-duty-followup-train-1-2026-10-08.json' with { type: 'json' };
const discoverExchange = (result: Parameters<typeof subscriptionExchange>[0], operation: string, exchangeModels: Parameters<typeof subscriptionExchange>[2]['exchangeModels']) =>
  subscriptionExchange(result, operation, { exchangeModels });

it('discovers the real Codex exchange through its registered adapter without inventing a provider model id', () => {
  const doorway = subscriptionDoorway('codex-cli-subscription');
  const capture = codexCapture.captures.find(row => row.args[0] === 'exec')!;
  const observed = discoverExchange(capture, 'recorded-codex', doorway.exchangeModels);
  expect(observed).toEqual({ ok: true, reportedModels: [], evidence: 'exchange:recorded-codex' });
  const routes = [{ ...installed[0]!, model: codexCapture.model }];
  const map = observeExchange(installDoorways(null, routes), 'preview-subscription', codexCapture.model, observed!, 1000);
  expect(map.doorways[0]!.models[0]).toMatchObject({ state: 'verified', strength: 'configured-route', verifiedAt: 1000 });
  expect(doorwayFreshness(standingDoorwayCheck(map, 1100), 1100)).toMatchObject({ fresh: true });
  expect(discoverExchange(capture, 'wrong-adapter', subscriptionDoorway('claude-code-subscription').exchangeModels))
    .toMatchObject({ ok: false, reason: 'error-frame' });
  for (const result of [{ ...capture, code: 1 }])
    expect(discoverExchange(result, 'failed', doorway.exchangeModels)).toMatchObject({ ok: false });
  expect(discoverExchange({ ...capture, limited: true, localLimit: 'capacity' }, 'local', doorway.exchangeModels)).toBeNull();
  expect(discoverExchange({ ...capture, limited: true, localLimit: 'timeout' }, 'local', doorway.exchangeModels)).toBeNull();
  for (const stdout of ['', capture.stdout.replace('turn.completed', 'turn.failed'), capture.stdout + '\nnot-json',
    capture.stdout.replace('agent_message', 'unregistered_item')])
    expect(discoverExchange({ ...capture, stdout }, 'incomplete', doorway.exchangeModels)).toMatchObject({ ok: false });
});

it('never mistakes recorded model judgments or delivered text for successful provider framing', () => {
  // Actual proof-room writer/reviewer/Jev outputs, including undecided/uncertain
  // decisions, are payloads. Only the adapter's terminal envelope can verify a route.
  expect(recordedShapes.otherShapes.map(row => row.kind)).toEqual(['summary-writer', 'summary-uncertain',
    'jev-undecided', 'jev-unsure', 'reply-review', 'delivered-reply', 'empty-reply-in-recorded-context']);
  for (const id of ['claude-code-subscription', 'codex-cli-subscription']) {
    const parse = subscriptionDoorway(id).exchangeModels;
    for (const row of recordedShapes.otherShapes) expect(parse(row.raw), `${id}: ${row.kind} ${row.id}`).toBeNull();
  }
  const parse = subscriptionDoorway('codex-cli-subscription').exchangeModels;
  expect(parse(recordedStreams.streams.ok)).toEqual([]);
  expect(parse(recordedStreams.streams.decision)).toEqual([]);
  expect(parse(recordedStreams.streams.turnFailed)).toBeNull();

});

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
  expect(subscriptionExchange({ code: 0, limited: false, stdout: frame }, 'op', subscriptionDoorway('claude-code-subscription'))).toEqual({ ok: true, reportedModels: ['claude-opus-4-8'], evidence: 'exchange:op' });
  expect(subscriptionExchange({ code: 0, limited: false, stdout: JSON.stringify({ type: 'result', is_error: true }) }, 'op', subscriptionDoorway('claude-code-subscription')))
    .toMatchObject({ ok: false, reason: 'error-frame' });
  expect(subscriptionExchange({ code: 1, limited: false, stdout: '' }, 'op', subscriptionDoorway('claude-code-subscription'))).toMatchObject({ ok: false, reason: 'exit' });
  expect(subscriptionExchange({ code: null, limited: true, localLimit: 'timeout', stdout: '' }, 'op', subscriptionDoorway('claude-code-subscription'))).toBeNull();
  expect(subscriptionExchange({ code: null, limited: true, localLimit: 'memory', stdout: '' }, 'op', subscriptionDoorway('claude-code-subscription'))).toBeNull();
  expect(subscriptionExchange({ code: null, limited: true, localLimit: 'capacity', stdout: '' }, 'op', subscriptionDoorway('claude-code-subscription'))).toBeNull();
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
    'claude-haiku-4-5-20251001': entry('claude-haiku-4-5'), 'claude-opus-4-8': entry('claude-opus-4-8') }) }, 'real', subscriptionDoorway('claude-code-subscription'));
  expect(both).toEqual({ ok: true, reportedModels: ['claude-haiku-4-5-20251001', 'claude-opus-4-8'], evidence: 'exchange:real' });
  const verified = observeExchange(installDoorways(null, installed, 1000), 'preview-subscription', 'claude-opus-4-8', both!, 1000);
  expect(verified.doorways[0]!.models.find(m => m.id === 'claude-opus-4-8')).toMatchObject({ state: 'verified', strength: 'provider-reported' });
  const helperOnly = subscriptionExchange({ code: 0, limited: false, stdout: frame({ 'claude-haiku-4-5-20251001': entry('claude-haiku-4-5') }) }, 'real', subscriptionDoorway('claude-code-subscription'));
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

// Recorded train-127 capability turn: a working Codex route was called unavailable.
it('retires the false preview route and verifies the selected Codex doorway from real 0.156.1 bytes', () => {
  const historical = JSON.parse(readFileSync('tests/preview/fixtures/codex-doorway-train-127-2026-10-22.json', 'utf8')) as {
    update: number; map: DoorwayMap; delivered: { reply: string } };
  const captured = JSON.parse(readFileSync('tests/preview/fixtures/codex-answer-0.156.1.json', 'utf8')) as {
    model: string; captures: { code: number; limited: boolean; stdout: string }[] };
  expect(historical.update).toBe(367052949);
  expect(historical.delivered.reply).toBe('I need to check that answer before I can send it.');
  const now = historical.map.doorways[1]!.models[0]!.verifiedAt! + 1000;
  expect(doorwayNotices(historical.map, now)[0]!.line).toContain('preview-subscription/gpt-6-astra is unavailable');
  const doorway = subscriptionDoorway('codex-cli-subscription');
  let map = installDoorways(historical.map, [
    { ...installed[0]!, id: doorway.id, model: captured.model }, installed[1]!], now);
  expect(doorwayFreshness(map, now).models[0]!.state).toBe('unverified');
  const exchange = subscriptionExchange(captured.captures.at(-1)!, 'recorded-codex', doorway);
  expect(exchange).toEqual({ ok: true, reportedModels: [], evidence: 'exchange:recorded-codex' });
  map = standingDoorwayCheck(observeExchange(map, doorway.id, captured.model, exchange!, now), now);
  expect(doorwayFreshness(map, now)).toMatchObject({ fresh: true, models: [
    { doorway: doorway.id, model: 'gpt-6-astra', state: 'verified' }, { doorway: 'typesafe-jev', state: 'verified' }] });
  expect(map.doorways[0]!.models[0]).toMatchObject({ strength: 'configured-route', evidence: 'exchange:recorded-codex' });
  expect(map.doorways.find(d => d.id === 'preview-subscription')!.models[0]!.state).toBe('retired');
  expect(doorwayNotices(map, now)).toEqual([]);
  expect(doorwayNotices(standingDoorwayCheck(map, now + DOORWAY_FRESH_MS + 1), now + DOORWAY_FRESH_MS + 1)[0]!.line)
    .toContain('codex-cli-subscription/gpt-6-astra is stale');
});

it('keeps Codex failed, partial, malformed and empty exchanges unverified, and local limits neutral', () => {
  const doorway = subscriptionDoorway('codex-cli-subscription');
  const captured = JSON.parse(readFileSync('tests/preview/fixtures/codex-answer-0.156.1.json', 'utf8')) as {
    captures: { code: number; limited: boolean; stdout: string }[] };
  const recorded = JSON.parse(readFileSync('tests/preview/codex-recorded-frames.json', 'utf8')) as { streams: Record<string, string> };
  const complete = captured.captures.at(-1)!;
  expect(subscriptionExchange({ ...complete, code: 1 }, 'exit', doorway)).toMatchObject({ ok: false, reason: 'exit' });
  expect(subscriptionExchange({ ...complete, limited: true, localLimit: 'timeout' }, 'timeout', doorway))
    .toBeNull();
  for (const localLimit of ['memory', 'capacity', 'stop'])
    expect(subscriptionExchange({ ...complete, limited: true, localLimit }, localLimit, doorway)).toBeNull();
  const events = complete.stdout.trim().split('\n').map(line => JSON.parse(line));
  const empty = events.map(event => JSON.stringify(event.type === 'item.completed' && event.item.type === 'agent_message'
    ? { ...event, item: { ...event.item, text: '' } } : event)).join('\n');
  for (const stdout of [recorded.streams.turnFailed!, events.slice(0, 2).map(event => JSON.stringify(event)).join('\n'),
    complete.stdout + 'not JSON\n', empty, '']) {
    expect(subscriptionExchange({ ...complete, stdout }, 'bad', doorway)).toMatchObject({ ok: false, reason: 'error-frame' });
  }
  // Successful tool exchanges also prove reachability; this is not an answer-admission decision.
  expect(subscriptionExchange({ ...complete, stdout: recorded.streams.toolUsed! }, 'tool', doorway)).toMatchObject({ ok: true });
  expect(subscriptionExchange(complete, 'wrong-format', subscriptionDoorway('claude-code-subscription'))).toMatchObject({ ok: false });
});

it('observes recorded summary, uncertain/undecided Jev, review and delivered-reply bodies without interpreting their verdicts', () => {
  const corpus = JSON.parse(readFileSync('tests/preview/fixtures/retrospective-duty-followup-train-1-2026-10-08.json', 'utf8')) as {
    otherShapes: { kind: string; id: string; raw: string }[] };
  const captured = JSON.parse(readFileSync('tests/preview/fixtures/codex-answer-0.156.1.json', 'utf8')) as {
    captures: { code: number; limited: boolean; stdout: string }[] };
  const run = captured.captures.at(-1)!;
  const events = run.stdout.trim().split('\n').map(line => JSON.parse(line));
  expect(corpus.otherShapes.map(row => row.kind)).toEqual(['summary-writer', 'summary-uncertain', 'jev-undecided',
    'jev-unsure', 'reply-review', 'delivered-reply', 'empty-reply-in-recorded-context']);
  for (const row of corpus.otherShapes) {
    // Historical journal bodies replayed in captured transport framing, not new Codex answers.
    const stdout = events.map(event => JSON.stringify(event.type === 'item.completed' && event.item.type === 'agent_message'
      ? { ...event, item: { ...event.item, text: row.raw } } : event)).join('\n');
    const observed = subscriptionExchange({ ...run, stdout }, row.id, subscriptionDoorway('codex-cli-subscription'));
    expect(observed?.ok, row.id).toBe(row.raw.trim().length > 0);
    expect(observed?.evidence).toBe(`exchange:${row.id}`);
  }
});
