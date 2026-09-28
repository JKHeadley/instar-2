// Rule 56 on the live path: the installed doorway/model map, kept current by
// bounded discovery at the real exchange boundary. An answered exchange verifies
// the exact model id it reached (the provider-reported id when the route reports
// one); a failed exchange is an unavailable reading; a different reported id is a
// change. Nothing here issues a probe of its own: no new traffic and no spend, so
// an idle map ages honestly into `stale` and fails its freshness check instead of
// being refreshed by assertion.
import { readFileSync } from 'node:fs';
import { durablePreviewWrite } from './state.js';
import { liveMeasurement, renderMeasured } from './measured.js';
import { modelEntryFresh } from '../../src/register/index.js';

export const DOORWAY_FRESH_MS = 24 * 60 * 60 * 1000;
export type ModelState = 'unverified' | 'verified' | 'changed' | 'unavailable' | 'retired';
export interface DoorwayModel {
  readonly id: string; readonly state: ModelState; readonly verifiedAt: number | null; readonly freshForMs: number;
  readonly evidence: string | null; readonly strength: 'provider-reported' | 'configured-route' | null;
  readonly observedId?: string; readonly unavailableAt?: number; readonly unavailableReason?: string;
}
export interface Doorway {
  readonly id: string; readonly billing: 'subscription' | 'metered';
  /** Price evidence the route actually reports; never scraped or assumed. An unavailable reading is
   * itself an observation with its time and window: past the window it is stale and not trusted. */
  readonly price: Readonly<{ state: 'unavailable'; reason: string; observedAt?: number; freshForMs?: number }>;
  readonly models: readonly DoorwayModel[];
}
/** The last verdict of the standing freshness check, and when the verdict last changed. */
export interface DoorwayCheck { readonly at: number; readonly fresh: boolean; readonly since: number; readonly failing: readonly string[] }
export interface DoorwayMap { readonly version: 1; readonly doorways: readonly Doorway[]; readonly check?: DoorwayCheck }
export interface InstalledDoorway { readonly id: string; readonly billing: 'subscription' | 'metered'; readonly model: string; readonly priceReason: string }

/** Merge the installed routes into the persisted map. A model no longer installed is retained as `retired`.
 * `at` is the installation's observation time of each route's (unavailable) price evidence. */
export function installDoorways(previous: DoorwayMap | null, installed: readonly InstalledDoorway[], at?: number): DoorwayMap {
  const doorways = installed.map(route => {
    const prior = previous?.doorways.find(d => d.id === route.id);
    // A retired model installed again rejoins the checked population unverified: its
    // old verification is not evidence for the new installation (the A→B→A case).
    const models = (prior?.models ?? []).map(m => m.id !== route.model ? { ...m, state: 'retired' as const }
      : m.state === 'retired' ? { id: m.id, state: 'unverified' as const, verifiedAt: null, freshForMs: m.freshForMs,
        evidence: null, strength: null } : m);
    if (!models.some(m => m.id === route.model)) models.push({ id: route.model, state: 'unverified', verifiedAt: null,
      freshForMs: DOORWAY_FRESH_MS, evidence: null, strength: null });
    return { id: route.id, billing: route.billing, price: { state: 'unavailable' as const, reason: route.priceReason,
      ...(at === undefined ? {} : { observedAt: at, freshForMs: DOORWAY_FRESH_MS }) }, models };
  });
  const retired = (previous?.doorways ?? []).filter(d => !installed.some(r => r.id === d.id))
    .map(d => ({ ...d, models: d.models.map(m => ({ ...m, state: 'retired' as const })) }));
  return { version: 1, doorways: [...doorways, ...retired], ...(previous?.check ? { check: previous.check } : {}) };
}

export type ExchangeObservation = Readonly<{ ok: true; reportedModels: readonly string[]; evidence: string }
  | { ok: false; reason: string; evidence: string }>;
/** Record one real exchange on an installed route's exact model. */
export function observeExchange(map: DoorwayMap, doorway: string, model: string, observation: ExchangeObservation, at: number): DoorwayMap {
  return { ...map, doorways: map.doorways.map(d => d.id !== doorway ? d : { ...d, models: d.models.map(m => {
    if (m.id !== model || m.state === 'retired') return m;
    if (!observation.ok) return { ...m, state: 'unavailable', unavailableAt: at, unavailableReason: observation.reason };
    const reported = observation.reportedModels;
    // A route may annotate its id (e.g. a context-window suffix); the exact id must still lead.
    if (reported.length && !reported.some(id => id === model || id.startsWith(`${model}[`))) return { ...m, state: 'changed', observedId: reported.join(','),
      unavailableAt: at, unavailableReason: 'provider reported a different model id', evidence: observation.evidence };
    return { id: m.id, state: 'verified', verifiedAt: at, freshForMs: m.freshForMs, evidence: observation.evidence,
      strength: reported.length ? 'provider-reported' : 'configured-route' };
  }) }) };
}

export interface ModelFreshness { readonly doorway: string; readonly model: string; readonly state: ModelState | 'stale';
  readonly fresh: boolean; readonly age: string | null; readonly verifiedAt: number | null; readonly observedId?: string }
export interface PriceFreshness { readonly doorway: string; readonly state: 'unavailable' | 'stale'; readonly reason: string;
  readonly observedAt: number | null; readonly trusted: boolean }
/** Rule 56's check: every installed model's verification age within its window, decided by the
 * register's own model-map age check (`modelEntryFresh`), else it fails. Price evidence is reported
 * with its observation time: an unavailable reading past its window is stale and flagged, and price
 * evidence is informational, so it never makes the model map fresh or stale. */
export function doorwayFreshness(map: DoorwayMap, now: number): { readonly fresh: boolean; readonly models: readonly ModelFreshness[];
  readonly prices: readonly PriceFreshness[] } {
  const models = map.doorways.flatMap(d => d.models.filter(m => m.state !== 'retired').map(m => {
    if (m.state !== 'verified' || m.verifiedAt === null)
      return { doorway: d.id, model: m.id, state: m.state, fresh: false, age: null, verifiedAt: m.verifiedAt,
        ...(m.observedId ? { observedId: m.observedId } : {}) };
    const age = liveMeasurement('doorway-verification-age', `${d.id}/${m.id}`, now - m.verifiedAt, now);
    const fresh = modelEntryFresh(m.verifiedAt, m.freshForMs, now);
    return { doorway: d.id, model: m.id, state: fresh ? 'verified' as const : 'stale' as const, fresh,
      age: renderMeasured(age), verifiedAt: m.verifiedAt };
  }));
  const prices = map.doorways.filter(d => d.models.some(m => m.state !== 'retired')).map(d => {
    const observedAt = d.price.observedAt ?? null;
    const current = observedAt !== null && modelEntryFresh(observedAt, d.price.freshForMs ?? 0, now);
    return { doorway: d.id, state: current ? 'unavailable' as const : 'stale' as const, reason: d.price.reason, observedAt, trusted: false };
  });
  return { fresh: models.length > 0 && models.every(m => m.fresh), models, prices };
}

/** The standing freshness process (Rule 56): run from the agent's existing bounded poll cycle, with no
 * model call of its own. It records the current verdict, and when the verdict last changed, so an
 * idle installation shows its map going stale without anyone asking for status. */
export function standingDoorwayCheck(map: DoorwayMap, now: number): DoorwayMap {
  const verdict = doorwayFreshness(map, now);
  const failing = verdict.models.filter(m => !m.fresh).map(m => `${m.doorway}/${m.model}:${m.state}`);
  const changed = !map.check || map.check.fresh !== verdict.fresh || map.check.failing.join() !== failing.join();
  return { ...map, check: { at: now, fresh: verdict.fresh, since: changed ? now : map.check!.since, failing } };
}

export function readDoorwayMap(path: string): DoorwayMap | null {
  try { const map = JSON.parse(readFileSync(path, 'utf8')) as DoorwayMap; return map.version === 1 ? map : null; }
  catch { return null; }
}
export const writeDoorwayMap = (path: string, map: DoorwayMap): void => durablePreviewWrite(path, map);

/** Content-free discovery at the subscription exchange: the exit, result frame and reported model ids only. */
export function subscriptionExchange(result: { code: number | null; limited: boolean; localLimit?: string | null; stdout: string },
  operation: string): ExchangeObservation | null {
  // A local ceiling or capacity refusal says nothing about the provider route.
  if (result.limited && result.localLimit !== 'timeout') return null;
  if (result.limited) return { ok: false, reason: 'timeout', evidence: `exchange:${operation}` };
  const frame = ((): { type?: unknown; is_error?: unknown; modelUsage?: unknown } | null => {
    try { const parsed: unknown = JSON.parse(result.stdout); return parsed && typeof parsed === 'object' ? parsed : null; }
    catch { return null; }
  })();
  if (result.code !== 0 || frame?.type !== 'result' || frame.is_error !== false)
    return { ok: false, reason: result.code !== 0 ? 'exit' : 'error-frame', evidence: `exchange:${operation}` };
  const usage = frame.modelUsage && typeof frame.modelUsage === 'object' && !Array.isArray(frame.modelUsage)
    ? Object.keys(frame.modelUsage).filter(key => key.length <= 128).slice(0, 8) : [];
  return { ok: true, reportedModels: usage, evidence: `exchange:${operation}` };
}

/** Qualified internal usage against what the provider actually reported. A reserved
 * call without a complete usage report stays an open commitment at its reserved
 * amount; charge is never reported by these routes, so it stays UNKNOWN — never
 * settled at zero and never released. */
export function usageReconciliation(view: { calls: number; tokenCalls: readonly { input: number; output: number;
  observedInput: boolean; observedOutput: boolean }[]; tokenCurrent: ReadonlyMap<string, number>;
  callOutcomeCounts: ReadonlyMap<string, number> }) {
  const open = [...view.tokenCurrent.values()].map(index => view.tokenCalls[index]).filter(call => call !== undefined);
  return { reservedCalls: view.calls, physicalOutcomes: view.callOutcomeCounts.get('total') ?? 0,
    reportedCalls: view.tokenCalls.filter(call => call.observedInput && call.observedOutput).length,
    openCommitments: { calls: open.length, reservedInputTokens: open.reduce((sum, call) => sum + (call.observedInput ? 0 : call.input), 0),
      reservedOutputTokens: open.reduce((sum, call) => sum + (call.observedOutput ? 0 : call.output), 0) },
    charge: { state: 'UNKNOWN' as const, settled: null, released: null, basis: 'these routes report no billed charge' } };
}
