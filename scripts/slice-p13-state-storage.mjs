import {
  closeSync,
  existsSync,
  fsyncSync,
  lstatSync,
  openSync,
  readFileSync,
  readlinkSync,
  renameSync,
  symlinkSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { randomUUID } from 'node:crypto';
import { dirname } from 'node:path';
import { canonical, consumeResult } from '../src/index.js';

function hash(value) {
  return consumeResult(canonical(value), {
    Success: encoded => encoded.hash,
    Refused: refusal => { throw new Error(refusal.detail); },
  });
}
function read(path) {
  return existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : null;
}

function lockExists(path) {
  try { lstatSync(path); return true; } catch { return false; }
}

function syncDirectory(path) {
  const descriptor = openSync(dirname(path), 'r');
  try { fsyncSync(descriptor); } finally { closeSync(descriptor); }
}

function processCanContinue(pid) {
  try { process.kill(pid, 0); return true; }
  catch (error) { return error?.code !== 'ESRCH'; }
}

function successorOf(current, candidate) {
  if (!candidate || candidate.type !== 'HarnessAdapterStateSnapshot' || !Number.isSafeInteger(candidate.revision)) return false;
  if (!current) return candidate.revision === 0;
  return candidate.id === current.id && candidate.adapter === current.adapter && candidate.machine === current.machine
    && candidate.maxHandles === current.maxHandles && candidate.maxAttempts === current.maxAttempts
    && candidate.maxEvents === current.maxEvents && candidate.maxCaptureBytes === current.maxCaptureBytes
    && candidate.revision === current.revision + 1;
}

function recoverDeadWriter(path, lock) {
  let owner;
  try { owner = JSON.parse(readlinkSync(lock)); }
  catch { throw new Error('harness adapter state compare-and-swap mismatch'); }
  if (!Number.isSafeInteger(owner?.pid) || owner.pid < 1 || typeof owner?.temporary !== 'string'
    || !owner.temporary.startsWith(`${path}.pending-`))
    throw new Error('harness adapter state compare-and-swap mismatch');
  if (processCanContinue(owner.pid)) throw new Error('harness adapter state compare-and-swap mismatch');

  if (existsSync(owner.temporary)) {
    let candidate;
    try { candidate = read(owner.temporary); }
    catch { throw new Error('harness adapter state recovery retained an unreadable pending successor'); }
    const current = read(path);
    if (!successorOf(current, candidate))
      throw new Error('harness adapter state recovery retained an ambiguous pending successor');
    renameSync(owner.temporary, path);
    syncDirectory(path);
  }
  unlinkSync(lock);
  syncDirectory(path);
}

/** Exact-byte, atomic local custody for Part Thirteen's package-local journal. */
export function createHarnessAdapterFileState(path) {
  if (!path) throw new Error('harness adapter state path is required');
  const lock = `${path}.lock`;
  const load = () => {
    if (lockExists(lock)) recoverDeadWriter(path, lock);
    return read(path);
  };
  return Object.freeze({
    owner: 'part-thirteen',
    id: `file:${path}`,
    load,
    save(expected, snapshot) {
      const current = load();
      const actual = current === null ? null : hash(current);
      if (actual !== expected) throw new Error('harness adapter state compare-and-swap mismatch');

      const temporary = `${path}.pending-${process.pid}-${randomUUID()}`;
      const owner = JSON.stringify({ pid: process.pid, temporary });
      try { symlinkSync(owner, lock); }
      catch {
        if (lockExists(lock)) recoverDeadWriter(path, lock);
        try { symlinkSync(owner, lock); }
        catch { throw new Error('harness adapter state compare-and-swap mismatch'); }
      }

      try {
        const lockedCurrent = read(path);
        const lockedActual = lockedCurrent === null ? null : hash(lockedCurrent);
        if (lockedActual !== expected) throw new Error('harness adapter state compare-and-swap mismatch');
        writeFileSync(temporary, `${JSON.stringify(snapshot)}\n`, { encoding: 'utf8', mode: 0o600 });
        const descriptor = openSync(temporary, 'r');
        try { fsyncSync(descriptor); } finally { closeSync(descriptor); }
        renameSync(temporary, path);
        syncDirectory(path);
      } finally {
        if (lockExists(lock)) {
          unlinkSync(lock);
          syncDirectory(path);
        }
      }
    },
  });
}
