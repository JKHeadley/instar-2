import fs from 'node:fs';
import { syncBuiltinESMExports } from 'node:module';
import { join, resolve } from 'node:path';

const original = {
  closeSync: fs.closeSync,
  existsSync: fs.existsSync,
  fsyncSync: fs.fsyncSync,
  openSync: fs.openSync,
  renameSync: fs.renameSync,
  writeFileSync: fs.writeFileSync,
};

let installed = false;
let active = false;
let selectedCut = '';
let selectedMarker = '';
let selectedDirectory = '';
const descriptors = new Map();

function pause(stage) {
  if (!active || stage !== selectedCut) return;
  if (!selectedMarker) throw new Error('cut marker required');
  original.writeFileSync(selectedMarker, stage);
  while (original.existsSync(selectedMarker)) Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 20);
}

function install() {
  if (installed) return;
  installed = true;
  fs.openSync = function cutOpen(path, flags, mode) {
    const descriptor = original.openSync(path, flags, mode);
    const target = resolve(String(path));
    if (target === resolve(join(selectedDirectory, 'facts.pending'))) descriptors.set(descriptor, 'pending');
    else if (target === resolve(selectedDirectory)) descriptors.set(descriptor, 'directory');
    return descriptor;
  };
  fs.writeFileSync = function cutWrite(target, data, options) {
    const tracked = typeof target === 'number' && descriptors.get(target) === 'pending';
    if (tracked) pause('before-write');
    const result = original.writeFileSync(target, data, options);
    if (tracked) pause('after-write');
    return result;
  };
  fs.fsyncSync = function cutFsync(descriptor) {
    const kind = descriptors.get(descriptor);
    const before = kind === 'pending' ? 'before-fsync' : kind === 'directory' ? 'before-directory-sync' : '';
    const after = kind === 'pending' ? 'after-fsync' : kind === 'directory' ? 'after-directory-sync' : '';
    if (before) pause(before);
    const result = original.fsyncSync(descriptor);
    if (after) pause(after);
    return result;
  };
  fs.renameSync = function cutRename(oldPath, newPath) {
    const tracked = resolve(String(oldPath)) === resolve(join(selectedDirectory, 'facts.pending'))
      && resolve(String(newPath)) === resolve(join(selectedDirectory, 'facts.json'));
    if (tracked) pause('before-rename');
    const result = original.renameSync(oldPath, newPath);
    if (tracked) pause('after-rename');
    return result;
  };
  fs.closeSync = function cutClose(descriptor) {
    try { return original.closeSync(descriptor); }
    finally { descriptors.delete(descriptor); }
  };
  syncBuiltinESMExports();
}

/** Test-only composition around the byte-identical production adapter. */
export async function createCuttableTransportFileStorage(directory, result, cut = '', marker = '') {
  selectedDirectory = resolve(directory);
  selectedCut = cut;
  selectedMarker = marker;
  install();
  const { createTransportFileStorage } = await import('../transport-file-storage.mjs');
  const storage = createTransportFileStorage(directory, result);
  return Object.freeze({ storage, enableCuts() { active = true; } });
}
