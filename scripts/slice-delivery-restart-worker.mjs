import { existsSync, writeFileSync } from 'node:fs';
import { bootProductionSliceAssembly, sliceConfig } from './slice-assembly.mjs';

const home = process.argv[2];
const marker = `${home}/independent-cut.json`;
const boot = bootProductionSliceAssembly({ home, config: sliceConfig({ profile: 'reply' }), restartRecovery: true });
if (!existsSync(marker)) {
  const witness = boot.coordinator.handles.deliveryWitness;
  const observe = witness.observe;
  witness.observe = operation => {
    const receipt = observe(operation);
    writeFileSync(marker, JSON.stringify({ boundary: 'after-part-nine-delivery-probe', operation,
      applications: boot.service.journal().applications.length }));
    process.kill(process.pid, 'SIGKILL');
    return receipt;
  };
}
try {
  const report = await boot.drive();
  writeFileSync(`${home}/final-report.json`, JSON.stringify(report));
} catch (error) {
  writeFileSync(`${home}/recovery-error.txt`, String(error));
  throw error;
}
