// Small POSIX installer-state primitive. Publish only fully synced bytes, never an
// empty marker or partially written grant. Link is no-replace even with two installers.
import { closeSync, fsyncSync, linkSync, lstatSync, openSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { dirname } from 'node:path';

export function syncDirectory(path) {
  const fd = openSync(path, 'r');
  try { fsyncSync(fd); } finally { closeSync(fd); }
}
export function readSetupRecord(path) {
  try {
    const stat = lstatSync(path);
    if (!stat.isFile() || stat.size > 1048576) throw Error('setup record is not a bounded regular file');
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch (error) { if (error.code === 'ENOENT') return null; throw error; }
}
export function publishSetupRecord(path, value) {
  const temporary = `${path}.${randomUUID()}.pending`;
  const fd = openSync(temporary, 'wx', 0o600);
  try { writeFileSync(fd, `${JSON.stringify(value, null, 2)}\n`); fsyncSync(fd); } finally { closeSync(fd); }
  try {
    try { linkSync(temporary, path); }
    catch (error) { if (error.code !== 'EEXIST') throw error; }
    syncDirectory(dirname(path));
    return readSetupRecord(path);
  } finally { unlinkSync(temporary); }
}
