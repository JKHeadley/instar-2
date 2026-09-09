// An independent, fresh-process rebuild of every minimal-plane projection from the
// durable facts alone. It is a SECOND execution of the same implementation, not a
// second implementation: this base ships exactly one fold implementation, and the
// two-architecture comparison is the repository's CI matrix.
import { bootSliceAssembly, sliceConfig } from './slice-assembly.mjs';

const [home, encoded] = process.argv.slice(2);
const assembly = bootSliceAssembly(home, sliceConfig({ ...JSON.parse(encoded ?? '{}'), cuts: [], productionRestart: true }));
assembly.restoreGrants(); assembly.restoreEvidence();
process.stdout.write(`${JSON.stringify(assembly.rebuildAll())}\n`);
