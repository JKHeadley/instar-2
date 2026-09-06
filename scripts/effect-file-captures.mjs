import { closeSync, existsSync, fsyncSync, mkdirSync, openSync, readFileSync, readdirSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { hashBytes } from '../dist/facts/index.js';

// Fixture custody, replicated to a second local directory (NOT independent media).
// Hosts must replace this with authenticated scoped custody before production use.
export function createEffectFileCaptures(directories, result) {
  const hashes = new Set();
  if (!directories.length || new Set(directories).size !== directories.length) throw new Error('distinct custody directories required');
  for (const directory of directories) mkdirSync(directory, { recursive: true });
  const read = (directory, hash) => {
    try {
      const bytes = readFileSync(join(directory, `${hash.slice(7)}.capture`), 'utf8');
      return hashBytes(bytes) === hash ? bytes : null;
    } catch { return null; }
  };
  const register = hash => hashes.add(hash);
  for (const file of readdirSync(directories[0])) {
    if (!/^[a-f0-9]{64}\.capture$/.test(file)) continue;
    register(`sha256:${file.slice(0, 64)}`);
  }
  return { get captures() {
    // A fresh plain-data snapshot for P2's canonical fingerprint on EVERY read.
    // Neither cached plaintext nor accessors inside canonical JSON are accepted.
    return Object.fromEntries([...hashes].map(hash => {
      const bytes = read(directories[0], hash);
      return [`effect-capture:${hash}`, { hash, bytes, status: bytes === null ? 'missing' : 'available', byteLength: bytes === null ? 0 : Buffer.byteLength(bytes) }];
    }));
  }, custody: { owner: 'part-ten', verify(references, policy) {
    return result(() => {
      if (policy.lossModel !== 'Second local directory is a peer STAND-IN; shared disk loss is NOT covered.') throw new Error('unsupported custody loss model');
      const copies = policy.durability === 'replicated' ? 1 + policy.replicas : 1;
      if (!Number.isSafeInteger(copies) || copies < 1 || copies > directories.length) throw new Error('custody demand unsupported');
      for (const ref of references) {
        if (!/^sha256:[a-f0-9]{64}$/.test(ref.hash) || ref.reference !== `effect-capture:${ref.hash}`) throw new Error('custody reference mismatch');
        if (directories.slice(0, copies).some(directory => read(directory, ref.hash) === null)) throw new Error('current capture custody demand unmet');
      }
    });
  } }, capture(bytes) {
    return result(() => {
      if (Buffer.byteLength(bytes) > 16384) throw new Error('capture byte ceiling');
      const hash = hashBytes(bytes), name = `${hash.slice(7)}.capture`;
      for (const directory of directories) {
        const file = join(directory, name);
        if (existsSync(file) && readFileSync(file, 'utf8') !== bytes) throw new Error('immutable capture collision');
        const pending = join(directory, `${name}.pending`), fd = openSync(pending, 'w', 0o600);
        try { writeFileSync(fd, bytes); fsyncSync(fd); } finally { closeSync(fd); }
        renameSync(pending, file);
        const dir = openSync(directory, 'r'); try { fsyncSync(dir); } finally { closeSync(dir); }
      }
      const reference = `effect-capture:${hash}`;
      register(hash);
      return { reference, hash };
    });
  } };
}
