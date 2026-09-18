import { createCipheriv, createDecipheriv, randomBytes, randomUUID } from 'node:crypto';
import { closeSync, constants, existsSync, fsyncSync, lstatSync, mkdirSync, openSync,
  readFileSync, realpathSync, renameSync, rmdirSync, unlinkSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import type { BoundaryContext, Result } from '../index.js';
import { hashBytes } from '../facts/index.js';
import type { SegmentStoragePort } from '../facts/index.js';
import type { PersistenceAdapterPort, PersistenceReceipt } from './contracts.js';
import { boundary, encoded, ensure, freeze, take } from './boundary.js';

export interface ProductionStorage {
  readonly root: string;
  readonly segment: SegmentStoragePort;
  readonly persistence: PersistenceAdapterPort;
  close(): void;
}

/** One process holds the root for its lifetime. Recovery is conservative: a live
 * or reused PID, incomplete lease record, or interrupted recovery stays closed.
 * All acquisition/reclamation uses the same exclusive guard directory. */
export function openProductionStorage(input: Readonly<{ root: string; machine: string;
  key: Uint8Array; policy: string; store: string; context: BoundaryContext }>): Result<ProductionStorage> {
  return boundary('ProductionStorage', null, input.context, () => {
    ensure(input.key.byteLength === 32, 'storage-key: 32 bytes required');
    const root = resolve(input.root), lease = join(root, '.boot-lease'), guard = join(root, '.boot-lease-guard');
    ensure(root === input.root, 'storage-root: canonical absolute directory required');
    mkdirSync(root, { recursive: true, mode: 0o700 });
    ensure(realpathSync(root) === root && !lstatSync(root).isSymbolicLink(), 'storage-root: symlink refused');
    ensure((lstatSync(root).mode & 0o222) !== 0, 'storage-root: not writable');
    const syncDirectory = () => {
      const fd = openSync(root, 'r');
      try { fsyncSync(fd); } finally { closeSync(fd); }
    };
    const writeDurable = (file: string, bytes: string) => {
      const temporary = join(root, `.pending-${randomUUID()}`);
      const fd = openSync(temporary, constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY | constants.O_NOFOLLOW, 0o600);
      try { writeFileSync(fd, bytes, 'utf8'); fsyncSync(fd); }
      finally { closeSync(fd); }
      renameSync(temporary, file); syncDirectory();
    };
    const identity = Object.freeze({ pid: process.pid, machine: input.machine, nonce: randomUUID() });
    try { mkdirSync(guard, { mode: 0o700 }); }
    catch { throw new Error('storage-lease: acquisition or recovery in progress'); }
    try {
      if (existsSync(lease)) {
        let previous: { pid: number; machine: string; nonce: string };
        try { previous = JSON.parse(readFileSync(join(lease, 'owner.json'), 'utf8')); }
        catch { throw new Error('storage-lease: incomplete owner requires recovery'); }
        ensure(Number.isSafeInteger(previous.pid) && previous.pid > 0 && previous.machine === input.machine
          && typeof previous.nonce === 'string', 'storage-lease: owner identity invalid');
        let dead = false;
        try { process.kill(previous.pid, 0); }
        catch (error) { dead = (error as NodeJS.ErrnoException).code === 'ESRCH'; }
        ensure(dead, 'storage-lease: second concurrent boot refused');
        renameSync(lease, join(root, `.retired-lease-${previous.nonce}`)); syncDirectory();
      }
      mkdirSync(lease, { mode: 0o700 });
      writeDurable(join(lease, 'owner.json'), JSON.stringify(identity));
      const leaseFd = openSync(lease, 'r');
      try { fsyncSync(leaseFd); } finally { closeSync(leaseFd); }
    } finally { rmdirSync(guard); syncDirectory(); }
    let closed = false;
    const key = Buffer.from(input.key);
    const current = () => {
      ensure(!closed, 'storage-lease: closed');
      ensure(readFileSync(join(lease, 'owner.json'), 'utf8') === JSON.stringify(identity), 'storage-lease: owner changed');
    };
    const close = () => {
      if (closed) return;
      current(); unlinkSync(join(lease, 'owner.json')); rmdirSync(lease); syncDirectory();
      key.fill(0); closed = true;
    };
    const seal = (name: string, bytes: string) => {
      const nonce = randomBytes(12), cipher = createCipheriv('aes-256-gcm', key, nonce);
      cipher.setAAD(Buffer.from(`${input.machine}:${input.store}:${name}`));
      const ciphertext = Buffer.concat([cipher.update(bytes, 'utf8'), cipher.final()]);
      return JSON.stringify({ nonce: nonce.toString('hex'), ciphertext: ciphertext.toString('base64'), tag: cipher.getAuthTag().toString('hex') });
    };
    const unseal = (name: string, file: string) => {
      ensure(!lstatSync(file).isSymbolicLink(), 'storage: symlink refused');
      const raw = JSON.parse(readFileSync(file, 'utf8')) as { nonce: string; ciphertext: string; tag: string };
      const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(raw.nonce, 'hex'));
      decipher.setAAD(Buffer.from(`${input.machine}:${input.store}:${name}`)); decipher.setAuthTag(Buffer.from(raw.tag, 'hex'));
      return Buffer.concat([decipher.update(Buffer.from(raw.ciphertext, 'base64')), decipher.final()]).toString('utf8');
    };
    const segmentPath = join(root, 'facts.encrypted');
    const readBytes = (): readonly string[] => {
      current(); return existsSync(segmentPath) ? JSON.parse(unseal('facts', segmentPath)) as string[] : [];
    };
    const segment: SegmentStoragePort = Object.freeze({ owner: 'part-ten' as const,
      read: () => readBytes().map(bytes => JSON.parse(bytes) as unknown),
      append: (bytes: string, expectedHead: string | null) => boundary('ProductionSegmentAppend', null, input.context, () => {
        const records = readBytes(), last = records.at(-1);
        ensure((last ? (JSON.parse(last) as { contentHash: string }).contentHash : null) === expectedHead,
          'storage: compare-head failed');
        JSON.parse(bytes);
        writeDurable(segmentPath, seal('facts', JSON.stringify([...records, bytes])));
        return { kind: 'local-durable' as const };
      }),
    });
    type ExactRow = { bytes: string; receipt: PersistenceReceipt };
    const exactPath = join(root, 'exact.encrypted');
    const exactRows = (): ExactRow[] => {
      current(); return existsSync(exactPath) ? JSON.parse(unseal('exact', exactPath)) as ExactRow[] : [];
    };
    const persistence: PersistenceAdapterPort = Object.freeze({ owner: 'part-ten' as const, id: `production-storage:${input.store}`,
      describe: () => freeze({ backend: 'encrypted-on-disk', policy: input.policy, encrypted: true as const, appendAtomic: true as const }),
      appendExact: (request: Parameters<PersistenceAdapterPort['appendExact']>[0]) => boundary('ProductionExactAppend', null, input.context, () => {
        ensure(request.policy === input.policy && request.segment === input.store, 'storage: outside custody policy');
        ensure(hashBytes(request.bytes) === request.bytesDigest, 'storage: exact byte digest differs');
        const rows = exactRows(), old = rows.find(row => row.receipt.position === request.position);
        if (old) { ensure(old.bytes === request.bytes, 'storage: immutable position conflict'); return freeze(old.receipt); }
        ensure((rows.at(-1)?.receipt.physicalHead ?? null) === request.expectedPhysicalHead, 'storage: physical head conflict');
        const receipt: PersistenceReceipt = freeze({ owner: 'part-ten', store: input.store, position: request.position,
          bytesDigest: request.bytesDigest, physicalHead: hashBytes(JSON.stringify([request.expectedPhysicalHead, request.position, request.bytesDigest])),
          durability: 'local-durable' });
        writeDurable(exactPath, seal('exact', JSON.stringify([...rows, { bytes: request.bytes, receipt }])));
        return receipt;
      }),
      readExact: (request: Parameters<PersistenceAdapterPort['readExact']>[0]) => boundary('ProductionExactRead', null, input.context, () => {
        ensure(request.store === input.store && request.access.length > 0 && Number.isSafeInteger(request.maxBytes) && request.maxBytes >= 0,
          'storage: mediated bounded read required');
        const rows = exactRows(); let size = 0;
        return freeze(request.positions.map(position => {
          const row = rows.find(row => row.receipt.position === position); ensure(row, 'storage: position missing');
          size += Buffer.byteLength(row.bytes); ensure(size <= request.maxBytes, 'storage: read bound exceeded'); return row.bytes;
        }));
      }),
      flushEvidence: (receipt: PersistenceReceipt) => boundary('ProductionFlushEvidence', null, input.context, () => {
        const stored = exactRows().find(row => row.receipt.position === receipt.position);
        ensure(stored && encoded(stored.receipt).bytes === encoded(receipt).bytes
          && hashBytes(stored.bytes) === receipt.bytesDigest, 'storage: receipt differs from durable bytes');
        return freeze(stored.receipt);
      }),
    });
    try {
      // A receipt follows a real write, readback, file fsync, and directory fsync.
      const probe = join(root, `.durability-${identity.nonce}`), bytes = randomBytes(32).toString('hex');
      writeDurable(probe, bytes); ensure(readFileSync(probe, 'utf8') === bytes, 'storage-root: durability proof failed');
      unlinkSync(probe); syncDirectory();
      take(boundary('ProductionStorageRecovery', null, input.context, () => { readBytes(); exactRows(); }));
    } catch (error) { close(); throw error; }
    return Object.freeze({ root, segment, persistence, close });
  });
}
