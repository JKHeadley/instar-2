/** Binds the copied 1.x suites to the adapted core. These ports read and write the
 * same files the 1.x tests inspect, so the assertions stay as they were; the journal
 * adapter has its own proof in tests/commitments/commitment-host.test.ts. */
import fs from 'node:fs';
import path from 'node:path';
import { CommitmentTracker as Core, type CommitmentTrackerConfig } from '../../../src/commitments/CommitmentTracker.js';
import type { CommitmentTrackerPorts, ConfigWatchPort } from '../../../src/commitments/ports.js';
export * from '../../../src/commitments/CommitmentTracker.js';

export const hostClock = { now: () => Date.now(), iso: (ms: number) => new Date(ms).toISOString(), parse: (iso: string) => Date.parse(iso) };
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
