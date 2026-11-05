/** Binds the copied 1.x suites to the adapted core. These ports read and write the
 * same files the 1.x tests inspect, so the assertions stay as they were; the journal
 * adapter has its own proof in tests/commitments/commitment-host.test.ts. */
import fs from 'node:fs';
import path from 'node:path';
import { CommitmentTracker as Core, type CommitmentTrackerConfig } from '../../../src/commitments/CommitmentTracker.js';
import type { BeaconPorts, CommitmentTrackerPorts, ConfigWatchPort } from '../../../src/commitments/ports.js';
import { PromiseBeacon as BeaconCore, type PromiseBeaconConfig } from '../../../src/commitments/PromiseBeacon.js';
import { CheckInReminderReconciler as ReconcilerCore, type CheckInReminderConfig, type CheckInReminderDeps } from '../../../src/commitments/CheckInReminderReconciler.js';
import { LlmQueue as LlmQueueCore, type LlmQueueOptions } from '../../../src/commitments/LlmQueue.js';
import { ProxyCoordinator as CoordinatorCore } from '../../../src/commitments/ProxyCoordinator.js';
import * as checkInCore from '../../../src/commitments/checkInReminderCore.js';
export { LlmAbortedError } from '../../../src/commitments/LlmQueue.js';
export { TelegramOriginHoldError } from '../../../src/commitments/ports.js';
export * from '../../../src/commitments/CommitmentTracker.js';

export const hostClock = { now: () => Date.now(), iso: (ms: number) => new Date(ms).toISOString(), parse: (iso: string) => Date.parse(iso) };
export const hostTime = { ...hostClock,
  minutesOfDay: (ms: number) => { const d = new Date(ms); return d.getHours() * 60 + d.getMinutes(); },
  formatWhen: (ms: number) => { const d = new Date(ms);
    return `${d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })} at ${d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`; } };
export const hostTimers = {
  after(ms: number, run: () => void) { const t = setTimeout(run, ms); t.unref?.(); return { cancel: () => clearTimeout(t) }; },
  every(ms: number, run: () => void) { const t = setInterval(run, ms); t.unref?.(); return { cancel: () => clearInterval(t) }; },
};
export function trackerPorts(stateDir: string): CommitmentTrackerPorts {
  const storePath = path.join(stateDir, 'state', 'commitments.json');
  const rulesPath = path.join(stateDir, 'state', 'commitment-rules.md');
  const ledgerPath = path.join(stateDir, 'logs', 'commitments-auto-expiry.jsonl');
  return {
    clock: hostClock, timers: hostTimers,
    store: {
      load() { return fs.existsSync(storePath) ? JSON.parse(fs.readFileSync(storePath, 'utf-8')) : null; },
      save(store) {
        const tmp = `${storePath}.${process.pid}.tmp`;
        try { fs.mkdirSync(path.dirname(storePath), { recursive: true }); } catch { return { state: 'failed', errorClass: 'mkdir' }; }
        try { fs.writeFileSync(tmp, JSON.stringify(store) + '\n'); } catch { return { state: 'failed', errorClass: 'temp-write' }; }
        try { fs.renameSync(tmp, storePath); } catch { try { fs.unlinkSync(tmp); } catch { /* best effort */ } return { state: 'failed', errorClass: 'rename' }; }
        return { state: 'committed' };
      },
      readHighWater() { try { const v = JSON.parse(fs.readFileSync(`${storePath}.meta.json`, 'utf-8')).highWaterSeq; return typeof v === 'number' ? v : null; } catch { return null; } },
      writeHighWater(seq) { const tmp = `${storePath}.meta.json.${process.pid}.tmp`; fs.writeFileSync(tmp, JSON.stringify({ highWaterSeq: seq })); fs.renameSync(tmp, `${storePath}.meta.json`); },
    },
    behavioralRules: {
      exists: () => fs.existsSync(rulesPath),
      write(content) { fs.mkdirSync(path.dirname(rulesPath), { recursive: true }); const tmp = `${rulesPath}.${process.pid}.tmp`; fs.writeFileSync(tmp, content); fs.renameSync(tmp, rulesPath); },
      remove() { if (fs.existsSync(rulesPath)) fs.unlinkSync(rulesPath); },
    },
    expiryLedger: { append(row) { fs.mkdirSync(path.dirname(ledgerPath), { recursive: true }); fs.appendFileSync(ledgerPath, `${JSON.stringify(row)}\n`, 'utf-8'); } },
    fileExists: file => fs.existsSync(file),
    log(...parts) { console.log(...parts); },
    degraded() { /* nor on the degradation reporter */ },
  };
}
export class CommitmentTracker extends Core {
  constructor(config: Omit<CommitmentTrackerConfig, 'ports'> & { stateDir: string }) {
    const { stateDir, ...rest } = config;
    super({ ...rest, ports: trackerPorts(stateDir) });
  }
  override sweepAutoExpiry(now?: Date | number) { return super.sweepAutoExpiry(now === undefined ? undefined : typeof now === 'number' ? now : now.getTime()); }
  static override isTopicScopedConfigPath(configPath: string | undefined) { return Core.isTopicScopedConfigPath(configPath); }
}
export function beaconPorts(stateDir: string, now?: () => number): BeaconPorts {
  const dir = path.join(stateDir, 'state', 'promise-beacon');
  fs.mkdirSync(dir, { recursive: true });
  const write = (file: string, value: unknown) => { const tmp = `${file}.tmp`; fs.writeFileSync(tmp, JSON.stringify(value, null, 2)); fs.renameSync(tmp, file); };
  const aggregate = (topic: number) => path.join(dir, `topic-aggregate-${topic}.json`);
  return {
    clock: { ...hostTime, now: now ?? hostTime.now }, timers: hostTimers,
    state: {
      loadHot(id) { try { return JSON.parse(fs.readFileSync(path.join(dir, `${id}.json`), 'utf-8')); } catch { return null; } },
      saveHot(id, hot) { write(path.join(dir, `${id}.json`), hot); },
      loadAggregate(topic) { const file = aggregate(topic); return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : null; },
      saveAggregate(topic, state) { write(aggregate(topic), state); },
      aggregateTopics() { return fs.readdirSync(dir).flatMap(name => { const m = /^topic-aggregate-(-?\d+)\.json$/.exec(name); return m ? [Number(m[1])] : []; }); },
    },
    log(...parts) { console.log(...parts); },
    degraded(event) { degradations.push(event); },
  };
}
export const degradations: unknown[] = [];
export class PromiseBeacon extends BeaconCore {
  constructor(config: Omit<PromiseBeaconConfig, 'ports'> & { stateDir: string; now?: () => number }) {
    const { stateDir, now, ...rest } = config;
    super({ ...rest, ports: beaconPorts(stateDir, now) });
  }
}
export class LlmQueue extends LlmQueueCore {
  constructor(opts: Omit<LlmQueueOptions, 'clock' | 'timers'> & { now?: () => number } = {}) {
    const { now, ...rest } = opts;
    super({ ...rest, clock: { ...hostClock, now: now ?? hostClock.now }, timers: hostTimers });
  }
}
export class ProxyCoordinator extends CoordinatorCore { constructor() { super(() => Date.now()); } }
export class CheckInReminderReconciler extends ReconcilerCore {
  constructor(deps: Omit<CheckInReminderDeps, 'time'> & { now?: () => number }, config: CheckInReminderConfig) {
    const { now, ...rest } = deps;
    super({ ...rest, time: { ...hostTime, now: now ?? hostTime.now } }, config);
  }
}
export const { CHECK_IN_MAX_ATTEMPTS, OPEN_COMMITMENT_STATUSES, CHECK_IN_TEXT_MAX } = checkInCore;
export const selectDueCommitments = <T extends Parameters<typeof checkInCore.isCheckInReminderDue>[0]['commitment'] & { id: string }>(rows: readonly T[], nowMs: number) =>
  checkInCore.selectDueCommitments(rows, nowMs, hostClock.parse);
export const isCheckInReminderDue = (input: { commitment: Parameters<typeof checkInCore.isCheckInReminderDue>[0]['commitment']; nowMs: number }) =>
  checkInCore.isCheckInReminderDue({ ...input, parse: hostClock.parse });
export const formatCheckInDate = (iso: string) => checkInCore.formatCheckInDate(iso, hostTime);
export const buildCheckInReminderText = (opts: { userRequest: string; checkInAt: string }) =>
  checkInCore.buildCheckInReminderText({ userRequest: opts.userRequest, when: formatCheckInDate(opts.checkInAt) });
/** 1.x's LiveConfig surface over the same config.json the suites write. */
export class LiveConfig implements ConfigWatchPort {
  private readonly file: string;
  constructor(stateDir: string) { this.file = path.join(stateDir, 'config.json'); }
  get(key: string, fallback: unknown): unknown {
    let at: unknown; try { at = JSON.parse(fs.readFileSync(this.file, 'utf-8')); } catch { return fallback; }
    for (const part of key.split('.')) {
      if (typeof at !== 'object' || at === null) return fallback;
      at = (at as Record<string, unknown>)[part];
    }
    return at === undefined ? fallback : at;
  }
  set(key: string, value: unknown): void {
    let root: Record<string, unknown> = {}; try { root = JSON.parse(fs.readFileSync(this.file, 'utf-8')); } catch { /* new file */ }
    const parts = key.split('.'); let at = root;
    for (const part of parts.slice(0, -1)) {
      if (typeof at[part] !== 'object' || at[part] === null) at[part] = {};
      at = at[part] as Record<string, unknown>;
    }
    at[parts.at(-1)!] = value;
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    fs.writeFileSync(this.file, JSON.stringify(root, null, 2));
  }
  stop(): void { /* nothing to stop */ }
}
export const SafeFsExecutor = {
  safeRmSync: (target: string, opts?: fs.RmOptions & { operation?: string }) => fs.rmSync(target, { recursive: opts?.recursive ?? false, force: opts?.force ?? false }),
  safeUnlinkSync: (target: string) => fs.unlinkSync(target),
};
export type { DeliveryOutcome } from '../../../src/commitments/ports.js';
