// A real fresh process, so the doorway is proved against the ESM named imports a test actually
// writes. `import { spawnSync } from 'node:child_process'` takes its binding from the builtin's
// exports at instantiation, so replacing those exports only reaches it once
// `syncBuiltinESMExports()` republishes them — which tests/setup/bound-children.mjs does.
// tests/unit/bound-children-unsynced-probe.mjs is the same assignment without that publish, and
// shows the named import going unbounded. The bound here comes from INSTAR_TEST_CHILD_BOUND_MS,
// since no vitest case is running in this process.
import '../setup/bound-children.mjs';
import { execFileSync, execSync, spawnSync } from 'node:child_process';

const hang = ['-e', 'setTimeout(() => {}, 600000)'];
const report = {};
const run = (name, call) => {
  const started = process.hrtime.bigint();
  try {
    const result = call();
    report[name] = { threw: false, error: result?.error?.code ?? null, signal: result?.signal ?? null,
      stdout: typeof result === 'string' ? result : (result?.stdout ?? null) };
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

// The omitted arguments array. `spawnSync(file[, args][, options])` and `execFileSync` accept
// `undefined`/`null` in second position with the options still third, so the bound must be
// injected into the THIRD argument there: reading the omitted array as the options slot discards
// the caller's own options — its input and encoding, and its own `timeout`.
const sayOk = { input: 'process.stdout.write("ok")', encoding: 'utf8' };
const hangInput = { input: 'setTimeout(() => {}, 600000)', encoding: 'utf8' };
run('omittedArrayFast', () => spawnSync(process.execPath, undefined, { ...sayOk }));
run('omittedArrayFastExecFile', () => execFileSync(process.execPath, null, { ...sayOk }));
run('omittedArrayHang', () => spawnSync(process.execPath, undefined, { ...hangInput }));
run('omittedArrayOwnTimeout', () => spawnSync(process.execPath, null,
  { ...hangInput, timeout: 300, killSignal: 'SIGKILL' }));
process.stdout.write(JSON.stringify(report));
