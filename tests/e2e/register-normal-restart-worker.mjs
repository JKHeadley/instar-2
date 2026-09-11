import fs from 'node:fs';
import { syncBuiltinESMExports } from 'node:module';
import { resolve } from 'node:path';

const [script, root, output, cut, commit, workflow, provider, check] = process.argv.slice(2);
const original = fs.writeFileSync; let writes = 0;
fs.writeFileSync = function(path, ...args) {
  const result = original.call(this, path, ...args);
  if (String(path).startsWith(resolve(output) + '/') && ++writes === Number(cut)) {
    process.stdout.write(`CUT ${writes} ${String(path)}\n`);
    process.kill(process.pid, 'SIGKILL');
  }
  return result;
};
syncBuiltinESMExports();
const { run } = await import(script);
try {
  await run(['--workflow', workflow, '--provider', provider, '--commit', commit, '--now', '100', '--out', output,
    ...(check === 'check' ? ['--check'] : [])], root);
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`); process.exitCode = 1;
}
