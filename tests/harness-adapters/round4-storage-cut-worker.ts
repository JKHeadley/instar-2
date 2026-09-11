import fs from 'node:fs';
import { syncBuiltinESMExports } from 'node:module';
import { canonical, consumeResult } from '../../src/index.js';
import type { HarnessAdapterStateSnapshot } from '../../src/harness-adapters/index.js';
// @ts-expect-error The exact-byte filesystem host is JavaScript outside pure core compilation.
import { createHarnessAdapterFileState } from '../../scripts/slice-p13-state-storage.mjs';

const [mode, cut, path] = process.argv.slice(2) as [string, string, string];
const die = () => process.kill(process.pid, 'SIGKILL');
const original = {
  symlinkSync: fs.symlinkSync,
  writeFileSync: fs.writeFileSync,
  fsyncSync: fs.fsyncSync,
  renameSync: fs.renameSync,
  unlinkSync: fs.unlinkSync,
};

if (mode === 'seed') {
  fs.symlinkSync = ((...args: Parameters<typeof fs.symlinkSync>) => {
    const result = original.symlinkSync(...args);
    if (cut === 'lock') die();
    return result;
  }) as typeof fs.symlinkSync;
  fs.writeFileSync = ((...args: Parameters<typeof fs.writeFileSync>) => {
    const result = original.writeFileSync(...args);
    if (cut === 'write' && String(args[0]).includes('.pending-')) die();
    return result;
  }) as typeof fs.writeFileSync;
  fs.fsyncSync = ((...args: Parameters<typeof fs.fsyncSync>) => {
    const result = original.fsyncSync(...args);
    if (cut === 'fsync') die();
    return result;
  }) as typeof fs.fsyncSync;
  fs.renameSync = ((...args: Parameters<typeof fs.renameSync>) => {
    const result = original.renameSync(...args);
    if (cut === 'rename') die();
    return result;
  }) as typeof fs.renameSync;
  fs.unlinkSync = ((...args: Parameters<typeof fs.unlinkSync>) => {
    const result = original.unlinkSync(...args);
    if (cut === 'unlink' && String(args[0]).endsWith('.lock')) die();
    return result;
  }) as typeof fs.unlinkSync;
  syncBuiltinESMExports();
}

const hash = (snapshot: HarnessAdapterStateSnapshot) => consumeResult(canonical(snapshot), {
  Success: encoded => encoded.hash,
  Refused: refusal => { throw new Error(refusal.detail); },
});
const store = createHarnessAdapterFileState(path);
const current = store.load() as HarnessAdapterStateSnapshot;
const successor = { ...current, revision: current.revision + 1 };

try {
  store.save(hash(current), successor);
  process.stdout.write(JSON.stringify({ status: 'saved', revision: successor.revision }));
} catch (error) {
  process.stdout.write(JSON.stringify({ status: 'refused', detail: error instanceof Error ? error.message : String(error) }));
}
