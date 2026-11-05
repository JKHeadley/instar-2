// @ts-nocheck -- host controller/read adapter; the pure probe is typed separately.
import { afterEach, expect, it, vi } from 'vitest';
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createProductUpdater } from '../../scripts/update-product.mjs';
import { observeUpdateBound } from '../../scripts/update-runner.mjs';
import { initializeUpdateRuntime, readUpdateRuntime, writeUpdateRuntime } from '../../scripts/update.mjs';
import { PREVIEW_PROOF_PLANS, executeProof, nextDuePlan } from './proofs.js';
const roots = [], controllers = [];
afterEach(() => { controllers.forEach(c => c.stop()); roots.forEach(r => rmSync(r, { recursive: true, force: true })); vi.useRealTimers(); vi.restoreAllMocks(); });
const plan = PREVIEW_PROOF_PLANS.find(p => p.id === 'update-bound');
const resources = { allocation: { state: 'six' }, active: [], ceilings: { aggregate: { launches: 9 }, reserveLaunches: 1 } };
async function world() {
  await initializeUpdateRuntime();
  vi.useFakeTimers(); vi.setSystemTime(1800000000000);
  vi.spyOn(console, 'log').mockImplementation(() => {}); vi.spyOn(console, 'error').mockImplementation(() => {});
  const root = mkdtempSync(join(tmpdir(), 'update-bound-')); roots.push(root);
  writeFileSync(join(root, 'runtime-settings.json'), JSON.stringify({ updates: { autoApply: false }, monitoring: { templatesDriftVerifier: { enabled: false } } }));
  const discover = vi.fn(async () => '0.1.0');
  const make = () => { const c = createProductUpdater(root, { runningVersion: () => '0.1.0', stopped: () => false, readiness: () => ({ idle: true }), discover }); controllers.push(c); return c; };
  const controller = make();
  const ports = { now: () => Date.now(), supervisors: {}, updateBound: () => observeUpdateBound(root, controller, resources) };
  const probe = () => executeProof(plan, ports, 'g1', () => 0);
  return { root, discover, controller, make, ports, probe };
}
it('P9-PREVIEW-update-bound PREVIEW-UPDATE-BOUND reads actual durable pressure and timers; missing, corrupt and stale-view evidence is not passing', async () => {
  const w = await world();
  expect(w.probe().disposition).toBe('unknown');
  await w.controller.updater.tick();
  const good = w.probe(); expect(good.disposition).toBe('passed');
  expect(good.observed.lastCheck).toBe(readUpdateRuntime(w.root).updater.lastCheck);
  expect(nextDuePlan([plan], [good], 'g1', w.ports, Date.now() + 59999)).toBeNull();
  expect(nextDuePlan([plan], [good], 'g1', w.ports, Date.now() + 60000)?.id).toBe('update-bound');
  const saved = readUpdateRuntime(w.root).updater;
  writeUpdateRuntime(w.root, 'updater', { ...saved, nextAttemptAt: saved.nextAttemptAt + 1 });
  expect(w.probe().disposition).toBe('failed');
  writeFileSync(join(w.root, 'update-state.json'), '{broken');
  expect(w.probe().disposition).toBe('unknown');
  expect(readFileSync(join(w.root, 'update-state.json'), 'utf8')).toBe('{broken');
});
it('observes real backoff, durable three-failure stop and refusal after recreation without resetting pressure', async () => {
  const w = await world(); w.discover.mockRejectedValue(Error('offline'));
  for (let i = 0; i < 3; i++) {
    await w.controller.updater.tick();
    expect(w.probe().disposition).toBe('passed');
    if (i < 2) vi.setSystemTime(w.controller.updater.nextAttemptAt);
  }
  expect(w.controller.updater.stopped).toBe(true);
  const count = w.discover.mock.calls.length;
  const recreated = w.make(); recreated.start(); await recreated.updater.tick();
  expect(w.discover).toHaveBeenCalledTimes(count);
  expect(readUpdateRuntime(w.root).updater.failureState.failures).toHaveLength(3);
  // Break the actual stopped controller's timer invariant; the observer must see it.
  w.controller.updater.interval = setInterval(() => {}, 60000);
  expect(w.probe().disposition).toBe('failed');
});
it('refuses each resource, pressure, cadence and reserve boundary, with their adjacent admissible observations', async () => {
  const w = await world(); await w.controller.updater.tick();
  const good = w.probe().observed;
  expect(plan.confirms(good)).toBe(true);
  for (const changed of [{ resourceAllocation: 'absent' }, { activeLaunches: 10 }, { maintenanceLaunches: 9 },
    { intervalMinutes: 0 }, { intervalMinutes: 1441 }, { failures: 4 }, { failures: 1, lastFailureAt: Date.now(), nextAttemptAt: Date.now() },
    { pressureMatches: false }, { pausedAt: Date.now(), stopped: false }, { stopped: true, timers: 1 }])
    expect(plan.confirms({ ...good, ...changed }), JSON.stringify(changed)).toBe(false);
  expect(plan.confirms({ ...good, activeLaunches: 9, maintenanceLaunches: 8, intervalMinutes: 1 })).toBe(true);
  expect(plan.confirms({ ...good, intervalMinutes: 1440, stopped: true, timers: 0 })).toBe(true);
});
