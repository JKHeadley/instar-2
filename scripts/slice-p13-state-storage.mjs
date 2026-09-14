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

function lockValue(lock) {
  try { return readlinkSync(lock); } catch { return null; }
}

function restoreMovedLock(lock, moved, value) {
  try {
    symlinkSync(value, lock);
  } catch {
    if (lockValue(lock) !== value) {
      throw new Error('harness adapter state compare-and-swap mismatch');
    }
  }
  unlinkSync(moved);
  syncDirectory(lock);
}

/**
 * Rename is the atomic claim. Reading the moved symlink afterwards proves
 * whether it was still the exact lock observed by the caller. If a stale
 * reader moved a successor's lock, restore that successor and refuse.
 */
function claimExactLock(lock, expected, purpose) {
  const moved = `${lock}.${purpose}-${process.pid}-${randomUUID()}`;
  try { renameSync(lock, moved); }
  catch { throw new Error('harness adapter state compare-and-swap mismatch'); }
  const claimed = lockValue(moved);
  if (claimed !== expected) {
    if (claimed !== null) restoreMovedLock(lock, moved, claimed);
    throw new Error('harness adapter state compare-and-swap mismatch');
  }
  return moved;
}

function requireExactLock(lock, expected) {
  if (lockValue(lock) !== expected)
    throw new Error('harness adapter state compare-and-swap mismatch');
}

function releaseExactLock(path, lock, expected) {
  if (!lockExists(lock)) return false;
  const moved = claimExactLock(lock, expected, 'release');
  unlinkSync(moved);
  syncDirectory(path);
  return true;
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
  let observed;
  try {
    observed = readlinkSync(lock);
    owner = JSON.parse(observed);
  }
  catch { throw new Error('harness adapter state compare-and-swap mismatch'); }
  if (!Number.isSafeInteger(owner?.pid) || owner.pid < 1 || typeof owner?.temporary !== 'string'
    || !owner.temporary.startsWith(`${path}.pending-`))
    throw new Error('harness adapter state compare-and-swap mismatch');
  if (processCanContinue(owner.pid)) throw new Error('harness adapter state compare-and-swap mismatch');

  const deadClaim = claimExactLock(lock, observed, 'dead');
  const recoveryOwner = JSON.stringify({ pid: process.pid, temporary: owner.temporary });
  try {
    symlinkSync(recoveryOwner, lock);
  } catch {
    unlinkSync(deadClaim);
    throw new Error('harness adapter state compare-and-swap mismatch');
  }

  try {
    if (existsSync(owner.temporary)) {
      let candidate;
      try { candidate = read(owner.temporary); }
      catch { throw new Error('harness adapter state recovery retained an unreadable pending successor'); }
      const current = read(path);
      if (!successorOf(current, candidate))
        throw new Error('harness adapter state recovery retained an ambiguous pending successor');
      requireExactLock(lock, recoveryOwner);
      renameSync(owner.temporary, path);
      syncDirectory(path);
    }
  } finally {
    try { releaseExactLock(path, lock, recoveryOwner); }
    finally {
      if (lockExists(deadClaim)) unlinkSync(deadClaim);
      syncDirectory(path);
    }
  }
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
        requireExactLock(lock, owner);
        writeFileSync(temporary, `${JSON.stringify(snapshot)}\n`, { encoding: 'utf8', mode: 0o600 });
        const descriptor = openSync(temporary, 'r');
        try { fsyncSync(descriptor); } finally { closeSync(descriptor); }
        requireExactLock(lock, owner);
        renameSync(temporary, path);
        syncDirectory(path);
      } finally {
        if (lockExists(lock)) releaseExactLock(path, lock, owner);
      }
    },
  });
}
