// Install the existing lifecycle hook beside the read-only admitted tool hook. The harness
// identity cannot traverse the runner's repository; it reads this content-addressed copy.
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, chmodSync } from 'node:fs';
import { dirname, join } from 'node:path';
const source = new URL('./session-hooks/stop.mjs', import.meta.url);
export function lifecycleHookPath(toolHook) {
  const digest = createHash('sha256').update(readFileSync(source)).digest('hex');
  return join(dirname(toolHook), `lifecycle-${digest}.mjs`);
}
export function installLifecycleHook(toolHook) {
  const path = lifecycleHookPath(toolHook), bytes = readFileSync(source);
  try { writeFileSync(path, bytes, { flag: 'wx', mode: 0o644 }); }
  catch (error) { if (error.code !== 'EEXIST') throw error; }
  if (!readFileSync(path).equals(bytes)) throw Error('installed lifecycle hook differs from shipped bytes');
  chmodSync(path, 0o644);
  return path;
}
