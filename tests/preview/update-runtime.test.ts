import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, symlinkSync, rmSync, statSync, utimesSync, unlinkSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
// @ts-expect-error Host JavaScript.
import { AutoUpdater } from '../../scripts/update-auto.mjs';
// @ts-expect-error Host JavaScript.
import { UpdateRestartHandshake } from '../../scripts/update-handshake.mjs';
// @ts-expect-error Host JavaScript.
import { readUpdateRuntime, writeUpdateRuntime, installedUpdate, initializeUpdateRuntime, resumeAutomaticUpdate } from '../../scripts/update.mjs';
// @ts-expect-error Host JavaScript.
import { observeUpdateBoot, drainUpdateRestart } from '../../scripts/update-runner.mjs';
// @ts-expect-error Host JavaScript.
import { createProductUpdater, createUpdateLaunch } from '../../scripts/update-product.mjs';
// @ts-expect-error Host JavaScript.
import { runTemplatesDriftVerifier } from '../../scripts/update-drift.mjs';
// @ts-expect-error Host JavaScript.
import { LiveConfig } from '../../scripts/update-live-config.mjs';
// @ts-expect-error Host JavaScript.
import { installMcp, verifyMcpDefaults } from '../../scripts/mcp-setup.mjs';
// @ts-expect-error Host JavaScript.
import { readRootMcp } from './tool-turn.mjs';
const roots: string[] = [], controllers: { stop(): void }[] = [];
const root = () => { const r = mkdtempSync(join(tmpdir(), 'update-runtime-')); roots.push(r); return r; };
const save = (r: string, name: string, value: unknown) => writeFileSync(join(r, name), JSON.stringify(value));
beforeEach(async () => { await initializeUpdateRuntime(); vi.useFakeTimers(); vi.setSystemTime(new Date('2026-11-05T10:00:00Z')); vi.spyOn(console, 'log').mockImplementation(() => {}); });
afterEach(() => { controllers.splice(0).forEach(c => c.stop()); vi.useRealTimers(); vi.restoreAllMocks(); roots.splice(0).forEach(r => rmSync(r, { recursive: true, force: true })); });
function installed(r: string, version = '0.2.0') {
  const relative = `releases/v${version}/node_modules/@instar/constitutional-types`, dir = join(r, relative);
  mkdirSync(join(dir, 'bin'), { recursive: true }); save(dir, 'package.json', { name: '@instar/constitutional-types', version });
  writeFileSync(join(dir, 'bin/instar2.mjs'), '// valid candidate');
  symlinkSync(relative, join(r, 'current'));
  save(r, 'version.json', { version, release: `v${version}`, schema: 1, migrations: [] });
  save(r, 'update-state.json', { id: 'transaction', phase: 'complete', release: `v${version}`, next: { version }, runtime: {} });
  return dir;
}
function controller(r = root(), config: Record<string, unknown> = {}) {
  let stopped = false;
  const restart = vi.fn(() => true);
  const checker = { getInstalledVersion: () => '0.1.0', getShadowInstalledVersion: (): string | null => '0.2.0',
    check: vi.fn(async () => ({ currentVersion: '0.1.0', latestVersion: '0.2.0', updateAvailable: true })),
    applyUpdate: vi.fn(async () => ({ success: true, previousVersion: '0.1.0', newVersion: '0.2.0' })) };
  const u = new AutoUpdater(checker, { load: () => readUpdateRuntime(r).updater,
    save: (value: unknown) => writeUpdateRuntime(r, 'updater', value), stopped: () => stopped,
    observe: () => {}, requestRestart: restart }, r, { preRestartDelaySecs: 0, restartHandshake: new UpdateRestartHandshake(r), ...config });
  u.setSessionDeps({ listRunningSessions: () => [] }); controllers.push(u);
  return { r, u, restart, checker, stop: () => { stopped = true; u.stop(); } };
}
it('persists restart handshake, refuses installed/syntax-only success, and deduplicates a boot failure', () => {
  const r = root(), h = new UpdateRestartHandshake(r);
  h.writePendingHandshake({ expectedVersion: '0.2.0', previousVersion: '0.1.0', deferredNotification: '' });
  expect(observeUpdateBoot(r, { version: '0.2.0', launch: 'a', healthy: false }).kind).toBe('not-healthy');
  expect(observeUpdateBoot(r, { version: '0.1.0', launch: 'requester', healthy: true }).kind).toBe('requesting-launch');
  expect(h.verify({ runningVersion: '0.1.0', launch: 'a', healthy: true })).toMatchObject({ kind: 'failed', retryCount: 1, escalate: false });
  expect(h.verify({ runningVersion: '0.1.0', launch: 'a', healthy: true }).kind).toBe('already-observed');
  expect(h.verify({ runningVersion: '0.1.0', launch: 'b', healthy: true })).toMatchObject({ kind: 'failed', retryCount: 2, escalate: true });
  expect(h.verify({ runningVersion: '0.1.0', launch: 'extra', healthy: false }).retryCount).toBe(2);
  expect(observeUpdateBoot(r, { version: '0.2.0', launch: 'c', healthy: true, pid: 0 }).kind).toBe('verified');
  expect(new UpdateRestartHandshake(r).readPendingHandshake()).toBeNull();
  expect(readUpdateRuntime(r).handshake.failures).toHaveLength(2);
});
it('keeps malformed handshake bytes instead of inventing a clean start', () => {
  const r = root(); writeUpdateRuntime(r, 'handshake', { expectedVersion: 9 });
  expect(() => new UpdateRestartHandshake(r).readPendingHandshake()).toThrow('Malformed');
  expect(readUpdateRuntime(r).handshake.expectedVersion).toBe(9);
});
it('the real transaction and runner boundary preserve active work, stop, stale requests and mismatched bytes', () => {
  const r = root(); installed(r);
  const request = { status: 'requested', transaction: 'transaction', version: '0.2.0', expiresAt: Date.now() + 60000 };
  writeUpdateRuntime(r, 'request', request);
  const args = { version: '0.1.0', launch: 'old', idle: true, stopped: false };
  expect(drainUpdateRestart(r, { ...args, idle: false })).toBe(false);
  expect(drainUpdateRestart(r, { ...args, stopped: true })).toBe(false);
  expect(drainUpdateRestart(r, { ...args, now: request.expiresAt })).toBe(false);
  writeUpdateRuntime(r, 'request', { ...request, transaction: 'other' }); expect(drainUpdateRestart(r, args)).toBe(false);
  writeUpdateRuntime(r, 'request', request); expect(drainUpdateRestart(r, args)).toBe(true);
  expect(readUpdateRuntime(r).request).toMatchObject({ status: 'drained', launch: 'old' });
  expect(drainUpdateRestart(r, args)).toBe(false);
  save(join(r, 'current'), 'package.json', { name: '@instar/constitutional-types', version: '0.3.0' });
  expect(() => installedUpdate(r)).toThrow('version');
});
it('recovers an installed version with no lastApplied marker and no retry timer, without reinstalling', async () => {
  const { u, restart, checker, r } = controller();
  await u.tick();
  expect(readUpdateRuntime(r).updater.restartDeferral.targetVersion).toBe('0.2.0');
  await vi.advanceTimersByTimeAsync(2100);
  expect(checker.applyUpdate).not.toHaveBeenCalled(); expect(restart).toHaveBeenCalledOnce();
  expect(readUpdateRuntime(r).handshake.status).toBe('pending');
});
it('restores durable active-work deferrals across controllers and rechecks released verification holds after one second', async () => {
  const first = controller(); let holding = true;
  first.u.setRestartHold('local-verify', () => holding ? [{ name: 'local-verify-a', until: Date.now() + 300000, reason: 'proof' }] : []);
  await first.u.gatedRestart('0.2.0', true);
  expect(first.restart).not.toHaveBeenCalled(); expect(readUpdateRuntime(first.r).updater.restartDeferral.bypassWindow).toBe(true);
  first.stop();
  const second = controller(first.r); second.u.setRestartHold('local-verify', () => holding ? [{ name: 'local-verify-a', until: Date.now() + 300000, reason: 'proof' }] : []);
  second.u.start(); holding = false; second.u.recheckRestartHolds();
  await vi.advanceTimersByTimeAsync(999); expect(second.restart).not.toHaveBeenCalled();
  await vi.advanceTimersByTimeAsync(2101); expect(second.restart).toHaveBeenCalledOnce();
});
it('a new hold before the brought-forward retry still blocks; stop cancels start, apply and batch callbacks', async () => {
  const { u, restart, checker, stop } = controller(); let holding = true;
  u.setRestartHold('local-verify', () => holding ? [{ name: 'local-verify-a', until: Date.now() + 300000, reason: 'proof' }] : []);
  await u.gatedRestart('0.2.0'); holding = false; u.recheckRestartHolds(); holding = true;
  await vi.advanceTimersByTimeAsync(4000); expect(restart).not.toHaveBeenCalled();
  u.start(); stop(); await vi.advanceTimersByTimeAsync(3600000);
  expect(restart).not.toHaveBeenCalled(); expect(checker.check).not.toHaveBeenCalled();
});
it('preserves fifteen-minute cross-version batching and thirty-minute same-version cooldown', async () => {
  const { u, restart, r } = controller();
  const first = u.gatedRestart('0.2.0'); await vi.advanceTimersByTimeAsync(2100); await first;
  expect(restart).toHaveBeenCalledTimes(1);
  await u.gatedRestart('0.3.0'); await u.gatedRestart('0.4.0');
  expect(u._getBatchedRestartState().targetVersion).toBe('0.4.0');
  expect(readUpdateRuntime(r).updater.restartDeferral.targetVersion).toBe('0.4.0');
  await vi.advanceTimersByTimeAsync(900000); expect(restart).toHaveBeenCalledTimes(2);
  await u.gatedRestart('0.4.0'); expect(restart).toHaveBeenCalledTimes(2);
});
it('protects healthy sessions beyond four hours, and rechecks stop after the pre-restart delay', async () => {
  const { u, restart, stop } = controller(undefined, { preRestartDelaySecs: 60 }); let busy = true;
  u.setSessionDeps({ listRunningSessions: () => [{ name: 'work' }] }, { getStatus: () => ({ sessionHealth: [{ sessionName: 'work', status: busy ? 'healthy' : 'idle' }] }) });
  await u.gatedRestart('0.2.0'); await vi.advanceTimersByTimeAsync(4 * 3600000 + 1);
  expect(restart).not.toHaveBeenCalled(); busy = false;
  const attempt = u.gatedRestart('0.2.0'); stop(); await vi.advanceTimersByTimeAsync(62000); await attempt;
  expect(restart).not.toHaveBeenCalled();
});
it('real product composition observes LiveConfig auto-apply and drift kill switch, without reading authority from settings', async () => {
  const r = root(); installed(r);
  save(r, 'runtime-settings.json', { updates: { autoApply: false, autoRestart: false }, monitoring: { templatesDriftVerifier: { enabled: false } }, authority: 'not-authority' });
  const c = createProductUpdater(r, { runningVersion: () => '0.1.0', stopped: () => false,
    readiness: () => ({ idle: true }), discover: async () => '0.3.0', apply: vi.fn() }); controllers.push(c);
  await c.updater.tick(); expect(c.updater.getStatus().config.autoApply).toBe(false);
  expect(readUpdateRuntime(r).templateScan).toBeUndefined();
  save(r, 'runtime-settings.json', { updates: { autoApply: true, autoRestart: true } }); c.live.forceRefresh();
  await c.updater.tick(); expect(c.updater.getStatus().config.autoApply).toBe(true);
  expect(c.updater.getStatus().coalescingUntil).not.toBeNull();
});
it('classifies current and prior template SHAs, preserves unknown bytes, and deduplicates durably across instances', () => {
  const r = root(), a = root(), b = root();
  const current = '{"current":true}', prior = '{"old":true}', custom = '{"mine":true}';
  // Real byte hashes; classifier intentionally does not reinterpret JSON permissions.
  const { createHash } = require('node:crypto');
  const hash = (s: string) => createHash('sha256').update(s).digest('hex');
  const spec = [{ basename: 'mcp.json', currentSha: hash(current), priorShas: [hash(prior)] }];
  writeFileSync(join(a, 'mcp.json'), prior); writeFileSync(join(b, 'mcp.json'), custom);
  expect(runTemplatesDriftVerifier(r, { agentRoots: [a, b, b], templates: spec })).toMatchObject({ scanned: 2, prior: 1, drifted: 1, suppressed: 0 });
  expect(readFileSync(join(b, 'mcp.json'), 'utf8')).toBe(custom);
  expect(runTemplatesDriftVerifier(r, { agentRoots: [a, b], templates: spec }).suppressed).toBe(1);
  writeFileSync(join(a, 'mcp.json'), current); writeFileSync(join(b, 'mcp.json'), custom + ' ');
  expect(runTemplatesDriftVerifier(r, { agentRoots: [a, b], templates: spec })).toMatchObject({ prior: 0, drifted: 1, suppressed: 0 });
  expect(Object.keys(readUpdateRuntime(r).templateFindings)).toHaveLength(2);
});
it('LiveConfig refreshes actual readers, emits changes and retains last valid data on malformed input', () => {
  const r = root(); save(r, 'runtime-settings.json', { updates: { autoApply: false } });
  const c = new LiveConfig(r); const changes = vi.fn(); c.on('change', changes);
  expect(c.get('updates.autoApply', true)).toBe(false);
  save(r, 'runtime-settings.json', { updates: { autoApply: true } }); c.forceRefresh();
  expect(c.get('updates.autoApply', false)).toBe(true); expect(changes).toHaveBeenCalledOnce();
  writeFileSync(join(r, 'runtime-settings.json'), '{'); c.forceRefresh();
  expect(c.get('updates.autoApply', false)).toBe(true); expect(c.lastError).toContain('unreadable');
});
it('actual updater decisions read changed bytes with unchanged mtime; a reentrant listener sees the new value', async () => {
  const r = root(); save(r, 'runtime-settings.json', { updates: { autoApply: false }, monitoring: { templatesDriftVerifier: { enabled: false } } });
  const c = createProductUpdater(r, { runningVersion: () => '0.1.0', stopped: () => false,
    readiness: () => ({ idle: true }), discover: async () => '0.2.0', apply: vi.fn() }); controllers.push(c);
  await c.updater.tick(); expect(c.updater.getStatus().config.autoApply).toBe(false);
  const settings = join(r, 'runtime-settings.json'), times = statSync(settings);
  const observed: unknown[] = []; c.live.on('change', ({ path }: { path: string }) => observed.push(c.live.get(path)));
  save(r, 'runtime-settings.json', { updates: { autoApply: true }, monitoring: { templatesDriftVerifier: { enabled: false } } });
  utimesSync(settings, times.atime, times.mtime);
  await c.updater.tick(); expect(c.updater.getStatus().config.autoApply).toBe(true); expect(observed).toEqual([true]);
  save(r, 'runtime-settings.json', { updates: { autoApply: false } }); await c.updater.tick();
  unlinkSync(settings); await c.updater.tick(); expect(c.updater.getStatus().config.autoApply).toBe(false);
});
it('same-release cadence repairs the real MCP consumer through the existing transaction, even with discovery offline', async () => {
  const r = root(), directory = installed(r, '0.1.0');
  mkdirSync(join(directory, 'scripts'));
  writeFileSync(join(directory, 'scripts/update-release.mjs'), `export * from ${JSON.stringify(pathToFileURL(join(process.cwd(), 'scripts/update-release.mjs')).href)};`);
  installMcp(r);
  const path = join(r, 'mcp.json'), config = JSON.parse(readFileSync(path, 'utf8'));
  // Missing template is a real migration postcondition failure; preserve all
  // authority-bearing inputs and use the installed migration's own verifier.
  unlinkSync(path); expect(verifyMcpDefaults(r)).toBe(false);
  let idle = false, stopped = false;
  const execute = vi.fn(async () => ({ code: 0, stdout: '', limited: false }));
  const c = createProductUpdater(r, { runningVersion: () => '0.1.0', stopped: () => stopped,
    readiness: () => ({ idle }), discover: async () => { throw Error('offline'); }, execute }); controllers.push(c);
  await c.updater.tick(); expect(verifyMcpDefaults(r)).toBe(false);
  idle = true; vi.setSystemTime(Date.now() + 1800001);
  await c.updater.tick(); expect(verifyMcpDefaults(r)).toBe(true);
  expect(readRootMcp(r)).toMatchObject({ servers: config.mcpServers, reads: config.reads });
  expect(execute).toHaveBeenCalledWith(expect.objectContaining({ executable: process.execPath, args: expect.arrayContaining(['--check']) }));
  const state = JSON.parse(readFileSync(join(r, 'update-state.json'), 'utf8'));
  expect(state.steps).toContainEqual({ id: 'mcp-defaults-verified-1104', status: 'done' });
  unlinkSync(path); stopped = true; vi.setSystemTime(Date.now() + 3600001);
  await c.updater.tick(); expect(verifyMcpDefaults(r)).toBe(false);
});
it('release discovery uses maintenance admission and retains failed capacity pressure', async () => {
  const r = root(); save(r, 'runtime-settings.json', { monitoring: { templatesDriftVerifier: { enabled: false } } });
  const execute = vi.fn(async () => ({ code: 0, stdout: 'fixture\trefs/tags/v0.1.0\n', limited: false }));
  const c = createProductUpdater(r, { runningVersion: () => '0.1.0', stopped: () => false,
    readiness: () => ({ idle: true }), execute }); controllers.push(c);
  await c.updater.tick(); expect(execute).toHaveBeenCalledWith(expect.objectContaining({ executable: 'git', timeout: 15000 }));
  expect(c.updater.getStatus().lastError).toBeNull();
  execute.mockResolvedValue({ code: 0, stdout: '', limited: true });
  await c.updater.tick(); expect(c.updater.getStatus().lastError).toContain('unavailable');
  expect(readUpdateRuntime(r).updater.failureState.failures).toHaveLength(1);
});
it('same-release repair honors both live switches independently', async () => {
  const r = root(); installed(r, '0.1.0');
  const apply = vi.fn(async () => ({ status: 'unchanged' }));
  const c = createProductUpdater(r, { runningVersion: () => '0.1.0', stopped: () => false,
    readiness: () => ({ idle: true }), discover: async () => '0.1.0', apply }); controllers.push(c);
  for (const [autoApply, enabled] of [[false, true], [true, false], [false, false]]) {
    save(r, 'runtime-settings.json', { updates: { autoApply }, monitoring: { templatesDriftVerifier: { enabled } } });
    await c.updater.tick(); expect(apply).not.toHaveBeenCalled();
  }
  save(r, 'runtime-settings.json', { updates: { autoApply: true }, monitoring: { templatesDriftVerifier: { enabled: true } } });
  await c.updater.tick(); expect(apply).toHaveBeenCalledOnce();
});
it('shipped runner wiring observes health after a successful poll and drains only at its idle boundary', () => {
  const code = readFileSync('tests/preview/journal-agent.mjs', 'utf8');
  expect(code).toContain('drainUpdateRestart(root,');
  expect(code).toContain('updateController = createProductUpdater(root,');
  expect(code).toContain('updateController?.start(); updateController?.updater.recheckRestartHolds(); observeUpdateBoot(root,');
  expect(code).toContain('updateController?.stop();'); expect(code).toContain('idle: updateIdle()');
  expect(code.indexOf('observeUpdateBoot(root,')).toBeGreaterThan(code.indexOf('updates.ok !== true'));
  expect(code).toContain('updateVerifying = () => Boolean(stepJob || replyReviewJob || retroJob || summaryJob)');
});
it('the existing host watchdog selects installed bytes and restores its prior runner after failed admission', async () => {
  const r = root(), initial = root(), candidate = installed(r);
  save(initial, 'package.json', { version: '0.1.0' }); save(r, 'authority.json', { sealed: 'unchanged' });
  new UpdateRestartHandshake(r).writePendingHandshake({ expectedVersion: '0.2.0', previousVersion: '0.1.0', deferredNotification: '' });
  const launches: string[] = [];
  const next = createUpdateLaunch({ root: r, agent: [process.execPath, join(initial, 'tests/preview/journal-agent.mjs'), 'run', '--root', r] },
    async ({ cwd }: { cwd: string }) => { launches.push(cwd); return { code: cwd === candidate ? 1 : 0 }; });
  expect((await next()).code).toBe(1); expect((await next()).code).toBe(0);
  expect(launches).toEqual([candidate, initial]);
  expect(readUpdateRuntime(r).handshake).toMatchObject({ status: 'failed', retryCount: 1 });
  expect(JSON.parse(readFileSync(join(r, 'authority.json'), 'utf8'))).toEqual({ sealed: 'unchanged' });
  expect(readFileSync('scripts/host-watch.mjs', 'utf8')).toContain('createUpdateLaunch(config, spawnJournal)');
});
it('malformed optional update state cannot prevent launching the original runner', async () => {
  const r = root(), initial = root(); save(initial, 'package.json', { version: '0.1.0' });
  writeFileSync(join(r, 'update-state.json'), '{');
  const launch = vi.fn(async () => ({ code: 0 }));
  const next = createUpdateLaunch({ root: r, agent: [join(initial, 'tests/preview/journal-agent.mjs')] }, launch);
  expect((await next()).code).toBe(0); expect(launch).toHaveBeenCalledOnce();
  expect(readFileSync(join(r, 'update-state.json'), 'utf8')).toBe('{');
});
it('a recreated watchdog refuses a known schema-incompatible prior runner without erasing its evidence', async () => {
  const r = root(), initial = root(), prior = installed(r, '0.1.0');
  save(initial, 'package.json', { version: '0.0.9' });
  mkdirSync(join(prior, 'scripts'));
  writeFileSync(join(prior, 'scripts/update-release.mjs'), 'export const readableSchemas = [1];');
  writeUpdateRuntime(r, 'healthyRelease', 'v0.1.0');
  writeUpdateRuntime(r, 'handshake', { status: 'failed', expectedVersion: '0.1.0' });
  save(r, 'version.json', { version: '0.1.0', release: 'v0.1.0', schema: 2, migrations: [] });
  const before = readFileSync(join(r, 'update-state.json'), 'utf8');
  const launch = vi.fn(async () => ({ code: 0 }));
  const next = createUpdateLaunch({ root: r, agent: [join(initial, 'tests/preview/journal-agent.mjs')] }, launch);
  expect(await next()).toMatchObject({ signal: 'schema-incompatible' });
  expect(launch).not.toHaveBeenCalled();
  expect(readFileSync(join(r, 'update-state.json'), 'utf8')).toBe(before);
});
it('actual updater timers coalesce newer releases and respect live disabling before an armed apply fires', async () => {
  const c = controller(); let latest = '0.2.0'; c.checker.getShadowInstalledVersion = () => null;
  c.checker.check.mockImplementation(async () => ({ currentVersion: '0.1.0', latestVersion: latest, updateAvailable: true }));
  await c.u.tick(); await vi.advanceTimersByTimeAsync(120000); latest = '0.3.0'; await c.u.tick();
  await vi.advanceTimersByTimeAsync(299999); expect(c.checker.applyUpdate).not.toHaveBeenCalled();
  await vi.advanceTimersByTimeAsync(3000); expect(c.checker.applyUpdate).toHaveBeenCalledOnce();
  const other = controller(); other.checker.getShadowInstalledVersion = () => null;
  const live = new LiveConfig(other.r); other.u.liveConfig = live;
  await other.u.tick(); save(other.r, 'runtime-settings.json', { updates: { autoApply: false } }); live.forceRefresh();
  await vi.advanceTimersByTimeAsync(301000); expect(other.checker.applyUpdate).not.toHaveBeenCalled();
});
it('concurrent restart decisions cannot submit two requests during the checkpoint delay', async () => {
  const c = controller();
  const first = c.u.gatedRestart('0.2.0'), second = c.u.gatedRestart('0.2.0');
  await vi.advanceTimersByTimeAsync(2100); await Promise.all([first, second]);
  expect(c.restart).toHaveBeenCalledOnce();
});
it('live settings reach the held restart consumer and cannot widen limits or authority', async () => {
  const c = controller(); const live = new LiveConfig(c.r); c.u.liveConfig = live;
  save(c.r, 'runtime-settings.json', { updates: { autoRestart: false, preRestartDelaySecs: 3,
    restartWindow: { start: '23:00', end: '05:00' } }, limits: { maxCalls: 999999 }, authority: 'changed' }); live.forceRefresh();
  await c.u.gatedRestart('0.2.0'); expect(c.restart).not.toHaveBeenCalled();
  expect(c.u.getStatus().config).toMatchObject({ autoRestart: false, preRestartDelaySecs: 3, restartWindow: { start: '23:00', end: '05:00' } });
  expect(c.u.getStatus().config).not.toHaveProperty('limits'); expect(c.u.getStatus().config).not.toHaveProperty('authority');
  save(c.r, 'runtime-settings.json', { updates: { autoRestart: true, preRestartDelaySecs: -1, restartWindow: { start: '29:00', end: 'bad' } } }); live.forceRefresh();
  const restart = c.u.gatedRestart('0.2.0'); await vi.advanceTimersByTimeAsync(2100); await restart;
  expect(c.restart).toHaveBeenCalledOnce(); expect(c.u.getStatus().config.preRestartDelaySecs).toBe(3);
});
it('unchanged release observations do not postpone a pending apply forever', async () => {
  const c = controller(); c.checker.getShadowInstalledVersion = () => null;
  await c.u.tick(); await vi.advanceTimersByTimeAsync(120000); await c.u.tick();
  await vi.advanceTimersByTimeAsync(183000); expect(c.checker.applyUpdate).toHaveBeenCalledOnce();
});

it('failure backoff and a durable three-failure brake survive recreation and ordinary success cannot reset pressure', async () => {
  const c = controller(); c.checker.check.mockRejectedValue(new Error('unavailable'));
  vi.spyOn(console, 'error').mockImplementation(() => {});
  await c.u.tick(); await c.u.tick(); expect(c.checker.check).toHaveBeenCalledOnce();
  await vi.advanceTimersByTimeAsync(30 * 60000); await c.u.tick();
  expect(c.checker.check).toHaveBeenCalledTimes(2);
  await vi.advanceTimersByTimeAsync(60 * 60000); await c.u.tick();
  expect(c.u.getStatus().failureState.pausedAt).not.toBeNull();
  const resumed = controller(c.r); resumed.u.start(); await resumed.u.tick();
  await vi.advanceTimersByTimeAsync(2 * 86400000); await resumed.u.tick();
  expect(resumed.checker.check).not.toHaveBeenCalled();
  expect(readUpdateRuntime(c.r).updater.failureState.failures).toHaveLength(3);
  const paused = readUpdateRuntime(c.r).updater.failureState.pausedAt;
  expect(resumeAutomaticUpdate(c.r, paused + 1)).toBe(false);
  writeFileSync(join(c.r, 'preview-stop.json'), '{}');
  expect(resumeAutomaticUpdate(c.r, paused)).toBe(false);
  rmSync(join(c.r, 'preview-stop.json'));
  expect(resumeAutomaticUpdate(c.r, paused)).toBe(true);
  expect(resumeAutomaticUpdate(c.r, paused)).toBe(false);
  expect(readUpdateRuntime(c.r).updater.resumed.previous.failures).toHaveLength(3);
  const restarted = controller(c.r); await restarted.u.tick(); expect(restarted.checker.check).toHaveBeenCalledOnce();
});

it('the shipped template inventory recognizes bytes written by the actual MCP installer', () => {
  const r = root(); installMcp(r);
  expect(runTemplatesDriftVerifier(r, { agentRoots: [r] })).toMatchObject({ scanned: 1, prior: 0, drifted: 0 });
  expect(Object.keys(readUpdateRuntime(r).templateFindings)).toHaveLength(0);
});
