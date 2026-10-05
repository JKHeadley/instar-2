// A real fresh process, so the doorway is proved against the ESM named imports a test actually
// writes. Patching the child_process exports instead passes a stub test and never fires here:
// `import { spawnSync } from 'node:child_process'` takes its binding from the builtin's exports
// at instantiation. The bound comes from INSTAR_TEST_CHILD_BOUND_MS, since no vitest case is
// running in this process.
import '../setup/bound-children.mjs';
import { execFileSync, execSync, spawnSync } from 'node:child_process';

const hang = ['-e', 'setTimeout(() => {}, 600000)'];
const report = {};
const run = (name, call) => {
  const started = process.hrtime.bigint();
  try {
    const result = call();
    report[name] = { threw: false, error: result?.error?.code ?? null };
  } catch (error) {
    report[name] = { threw: true, code: error.code, message: error.message };
  }
  report[name].ms = Number((process.hrtime.bigint() - started) / 1000000n);
};

run('spawnSync', () => spawnSync(process.execPath, hang, { encoding: 'utf8' }));
run('execFileSync', () => execFileSync(process.execPath, hang, { encoding: 'utf8' }));
run('execSync', () => execSync(`${process.execPath} -e "setTimeout(() => {}, 600000)"`, { encoding: 'utf8' }));
run('fast', () => spawnSync(process.execPath, ['-e', 'process.stdout.write("ok")'], { encoding: 'utf8' }));
run('ownTimeout', () => spawnSync(process.execPath, hang, { encoding: 'utf8', timeout: 300, killSignal: 'SIGKILL' }));
process.stdout.write(JSON.stringify(report));
