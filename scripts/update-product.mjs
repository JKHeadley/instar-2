// Production composition for the carried-over updater. It never signs admission,
// edits installation facts, sends notices, or restores a journal from a backup.
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { AutoUpdater } from './update-auto.mjs';
import { UpdateRestartHandshake } from './update-handshake.mjs';
import { runTemplatesDriftVerifier } from './update-drift.mjs';
import { LiveConfig } from './update-live-config.mjs';
import { hostResources } from './resource-owner.mjs';
import { readableSchemas } from './update-release.mjs';
import { installedUpdate, ownedUpdateExecutor, readableUpdateRelease, UpdateSchemaRefused, readUpdateRuntime, writeUpdateRuntime, updateRoot, initializeUpdateRuntime } from './update.mjs';
const versionOf = directory => JSON.parse(readFileSync(join(directory, 'package.json'), 'utf8')).version;
const newer = (a, b) => {
  const aa = a.split('.').map(Number), bb = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) { if (aa[i] !== bb[i]) return aa[i] > bb[i]; }
  return false;
};
async function latestRelease(execute, root) {
  const result = await execute({ executable: 'git', args: ['ls-remote', '--tags', '--refs', 'https://github.com/JKHeadley/instar-2.git'],
    cwd: root, timeout: 15000, maxBytes: 1024 * 1024 });
  if (result.code !== 0 || result.limited || result.cancellationReason) throw Error('Release discovery unavailable');
  const versions = result.stdout.split('\n').map(line => /\trefs\/tags\/v(\d+\.\d+\.\d+)$/u.exec(line)?.[1]).filter(Boolean);
  return versions.reduce((best, value) => !best || newer(value, best) ? value : best, null);
}
export function createProductUpdater(root, { runningVersion, stopped, readiness, discover, apply = updateRoot,
  execute = ownedUpdateExecutor(hostResources, stopped) }) {
  const live = new LiveConfig(root);
  const handshake = new UpdateRestartHandshake(root);
  let selected = null;
  const checker = {
    getInstalledVersion: runningVersion,
    getShadowInstalledVersion: () => installedUpdate(root)?.version ?? null,
    check: async () => {
      const enabled = live.get('monitoring.templatesDriftVerifier.enabled', true) === true;
      runTemplatesDriftVerifier(root, { enabled });
      const current = installedUpdate(root), installed = current?.version;
      // Use the installed release's own verified migration and transaction even
      // when discovery is offline or no new release exists. No second repair lane.
      if (enabled && current && installed === runningVersion() && readiness()?.idle
        && !stopped() && live.get('updates.autoApply', true) === true)
        await apply(root, { release: current.release, execute, fallbackSchemas: readableSchemas });
      let latest;
      try { latest = await (discover ? discover() : latestRelease(execute, root)); }
      catch (error) { if (!installed || !newer(installed, runningVersion())) throw error; latest = installed; }
      if (installed && (!latest || newer(installed, latest))) latest = installed;
      selected = latest;
      return { currentVersion: runningVersion(), latestVersion: latest, updateAvailable: Boolean(latest && newer(latest, runningVersion())) };
    },
    applyUpdate: async () => {
      const previousVersion = runningVersion();
      if (!selected) return { success: false, previousVersion, message: 'No selected release' };
      await apply(root, { release: `v${selected}`, execute, fallbackSchemas: readableSchemas });
      const installed = installedUpdate(root);
      return { success: installed?.version === selected, previousVersion, newVersion: installed?.version,
        message: installed?.version === selected ? 'Installed; restart unverified' : 'Installation verification failed' };
    },
  };
  const ports = {
    stopped,
    load: () => readUpdateRuntime(root).updater,
    save: data => writeUpdateRuntime(root, 'updater', data),
    observe: message => writeUpdateRuntime(root, 'observation', { message, at: new Date().toISOString() }),
    requestRestart: version => {
      if (stopped() || !readiness()?.idle) return false;
      const installed = installedUpdate(root);
      if (installed?.version !== version) return false;
      const pending = handshake.readPendingHandshake();
      if (pending?.expectedVersion === version && pending.retryCount >= 2) return false;
      writeUpdateRuntime(root, 'request', { id: randomUUID(), status: 'requested', version,
        transaction: installed.transaction, expiresAt: Date.now() + 3600000 });
      return true;
    },
  };
  const updater = new AutoUpdater(checker, ports, root, { restartHandshake: handshake }, null, live);
  updater.setSessionDeps({ listRunningSessions: () => [{ name: 'admitted-runner' }] }, {
    getStatus: () => ({ sessionHealth: [{ sessionName: 'admitted-runner', status: readiness()?.idle ? 'idle' : 'healthy' }] }),
  });
  // The live runner's verification/review work is included in its idle evidence.
  updater.setRestartHold('local-verify', () => readiness()?.verifying
    ? [{ name: 'local-verify', reason: 'admitted runner verification is in flight', until: Date.now() + 300000 }] : []);
  return { updater, live, handshake, stop() { updater.stop(); live.stop(); },
    start() { updater.start(); } };
}
// One launch adapter for the EXISTING host watchdog. It owns no restart loop,
// crash ledger, signals or notices; superviseJournal retains all those policies.
export function createUpdateLaunch(config, launch) {
  const initial = config.agent.find(arg => arg.endsWith('/tests/preview/journal-agent.mjs'));
  const initialDirectory = dirname(dirname(dirname(initial)));
  let lastGood = initialDirectory;
  return async () => {
    let directory = lastGood, enabled = false, selectedRelease = null;
    try {
      await initializeUpdateRuntime(); enabled = true;
      const installed = installedUpdate(config.root), runtime = readUpdateRuntime(config.root), handshake = runtime.handshake;
      if (installed && !(handshake?.status === 'failed' && handshake.expectedVersion === installed.version)) {
        directory = installed.directory; selectedRelease = installed.release;
      } else if (runtime.healthyRelease) {
        const prior = await readableUpdateRelease(config.root, runtime.healthyRelease);
        directory = prior.directory; selectedRelease = prior.release;
      }
    } catch (error) {
      // A proven unreadable schema is not corrupt optional state. Never launch
      // old code against it; retain the transaction for compatible recovery.
      if (error instanceof UpdateSchemaRefused) return { code: null, signal: 'schema-incompatible', hung: false };
      /* Optional update uncertainty must not deny the existing runner. */
    }
    const version = versionOf(directory), launchId = randomUUID();
    let healthy = false;
    const agent = config.agent.map(arg => arg === initial ? join(directory, 'tests/preview/journal-agent.mjs')
      : arg === join(initialDirectory, 'scripts/slice-ts-loader.mjs') ? join(directory, 'scripts/slice-ts-loader.mjs') : arg);
    const outcome = await launch({ ...config, agent, cwd: directory }, beat => {
      if (beat?.healthy && beat.version === version) {
        if (!healthy && enabled && selectedRelease) {
          try { writeUpdateRuntime(config.root, 'healthyRelease', selectedRelease); }
          catch { /* A lost observation is not a new authority or a reason to stop serving. */ }
        }
        healthy = true; lastGood = directory;
      }
    });
    if (enabled && !healthy && directory !== initialDirectory) {
      try { new UpdateRestartHandshake(config.root).verify({ runningVersion: version, launch: launchId, healthy: false }); }
      catch { /* Preserve corrupt state; existing watchdog still records this launch outcome. */ }
    }
    return outcome;
  };
}
