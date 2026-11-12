// Host-only observation, using sampled CPU idle (never load average) and available
// memory. Unknown observations keep new work in its existing durable queue.
import { execFile } from 'node:child_process';
import { cpus, freemem, totalmem } from 'node:os';
import { setTimeout as wait } from 'node:timers/promises';
import { promisify } from 'node:util';

const run = promisify(execFile);

/** macOS os.freemem() counts raw free pages only, which macOS keeps near zero while its reclaimable
 * cache holds the rest. Same measure as 1.x src/monitoring/hostMemoryPressure.ts parseVmStat. */
export function parseVmStatAvailable(output) {
  const pages = label => Number(output.match(new RegExp(`${label}:\\s+(\\d+)`))?.[1]);
  const available = (pages('Pages free') + pages('Pages inactive') + pages('Pages purgeable'))
    * Number(output.match(/page size of (\d+) bytes/)?.[1]);
  if (!Number.isFinite(available)) throw Error('vm_stat output unreadable');
  return available;
}
const availableMemory = async () => process.platform === 'darwin'
  ? parseVmStatAvailable((await run('vm_stat', [], { timeout: 5000 })).stdout) : freemem();

export function createTopicWorkerCapacity(limits, io = { cpus, availableMemory, totalmem, wait }, note = () => {}) {
  const sample = () => io.cpus().reduce((sum, cpu) => ({ idle: sum.idle + cpu.times.idle,
    total: sum.total + Object.values(cpu.times).reduce((a, b) => a + b, 0) }), { idle: 0, total: 0 });
  let reported = '';
  // A refused worker otherwise waits with nothing in any record. Only changes are written.
  const report = line => { if (line !== reported) { reported = line; if (line) note(line); } };
  return async (operatorRequested = false) => {
    try {
      const free = await io.availableMemory(), memory = io.totalmem();
      const memoryKnown = Number.isFinite(free) && Number.isFinite(memory) && memory > 0 && free >= 0 && free <= memory;
      const memoryPressure = memoryKnown && (free < limits.minFreeMemoryBytes || free / memory < limits.minFreeMemoryFraction);
      let cpuKnown = true, cpuRoom = true;
      // Rules 14/15: CPU is never an admission condition for the verified person's work.
      // 1.x load-assess.sh uses a full second, not a noisy 100-ms snapshot.
      if (!operatorRequested && memoryKnown && !memoryPressure) {
        const before = sample(); await io.wait(1000); const after = sample();
        const total = after.total - before.total, idle = after.idle - before.idle;
        cpuKnown = total > 0 && idle >= 0 && idle <= total;
        cpuRoom = cpuKnown && 100 * idle / total >= limits.minCpuIdlePercent;
      }
      const reason = !memoryKnown || !cpuKnown ? 'unknown measurement'
        : memoryPressure ? 'available memory below reserve' : !cpuRoom ? 'CPU idle below floor' : '';
      report(reason ? `worker capacity refused: ${reason}` : '');
      return { admit: memoryKnown && !memoryPressure && cpuRoom, memoryPressure, reason };
    } catch {
      report('worker capacity refused: unknown measurement');
      return { admit: false, memoryPressure: false, reason: 'unknown measurement' };
    }
  };
}
