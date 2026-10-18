// Host-only observation, using sampled CPU idle (never load average) and physical
// free memory. Unknown observations keep new work in its existing durable queue.
import { cpus, freemem, totalmem } from 'node:os';
import { setTimeout as wait } from 'node:timers/promises';

export function createTopicWorkerCapacity(limits, io = { cpus, freemem, totalmem, wait }) {
  const sample = () => io.cpus().reduce((sum, cpu) => ({ idle: sum.idle + cpu.times.idle,
    total: sum.total + Object.values(cpu.times).reduce((a, b) => a + b, 0) }), { idle: 0, total: 0 });
  return async () => {
    try {
      const before = sample(); await io.wait(100); const after = sample();
      const total = after.total - before.total, idle = after.idle - before.idle;
      const free = io.freemem(), memory = io.totalmem();
      const memoryKnown = Number.isFinite(free) && Number.isFinite(memory) && memory > 0 && free >= 0 && free <= memory;
      const memoryPressure = memoryKnown && (free < limits.minFreeMemoryBytes || free / memory < limits.minFreeMemoryFraction);
      return { admit: memoryKnown && !memoryPressure && total > 0 && idle >= 0 && idle <= total
        && 100 * idle / total >= limits.minCpuIdlePercent, memoryPressure };
    } catch { return { admit: false, memoryPressure: false }; }
  };
}
