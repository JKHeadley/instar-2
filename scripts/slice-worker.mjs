// The kill-schedule worker. It ONLY re-enters the assembly's public boot path and
// drives the chain; there is no test-only recovery helper here.
import { bootProductionSliceAssembly, sliceConfig } from './slice-assembly.mjs';

const [home, encoded] = process.argv.slice(2);
const assembly = bootProductionSliceAssembly({ home, config: sliceConfig(JSON.parse(encoded ?? '{}')), restartRecovery: true });
const report = await assembly.drive();
process.stdout.write(`${JSON.stringify(report)}\n`);
