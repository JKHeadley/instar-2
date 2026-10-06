// The other side of the design decision, in a real fresh process: the SAME export replacement
// tests/setup/bound-children.mjs performs, with the one `syncBuiltinESMExports()` line removed.
// The wrapper is still called through the module object, and still unreached through the ESM
// named import — which is exactly the failure the first attempt at this fix measured and then
// misread as "no public route can reach a named import". The child sleeps 4 s and the bound is
// 200 ms, so an unbounded call simply returns normally after the full sleep.
import childProcess from 'node:child_process';
import { spawnSync } from 'node:child_process';

let wrapped = 0;
const original = childProcess.spawnSync;
childProcess.spawnSync = (...args) => {
  wrapped += 1;
  const slot = Array.isArray(args[1]) ? 2 : 1;
  const options = { ...(typeof args[slot] === 'object' && args[slot] !== null ? args[slot] : {}) };
  if (options.timeout === undefined) { options.timeout = 200; options.killSignal = 'SIGKILL'; }
  const call = [...args];
  call[slot] = options;
  return original(...call);
};
// deliberately NOT calling syncBuiltinESMExports()

const sleep = ['-e', 'setTimeout(() => {}, 4000)'];
const measure = call => {
  const started = process.hrtime.bigint();
  const result = call();
  return { error: result?.error?.code ?? null, ms: Number((process.hrtime.bigint() - started) / 1000000n) };
};

const throughNamedImport = measure(() => spawnSync(process.execPath, sleep, { encoding: 'utf8' }));
const throughModuleObject = measure(() => childProcess.spawnSync(process.execPath, sleep, { encoding: 'utf8' }));
process.stdout.write(JSON.stringify({ throughNamedImport, throughModuleObject, wrapped }));
