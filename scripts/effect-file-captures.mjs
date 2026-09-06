import { closeSync, existsSync, fsyncSync, mkdirSync, openSync, readFileSync, readdirSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { hashBytes } from '../dist/facts/index.js';

// Fixture custody, replicated to a second local directory (NOT independent media).
// Hosts must replace this with authenticated scoped custody before production use.
export function createEffectFileCaptures(directories, result) {
  const captures = {};
  for (const directory of directories) mkdirSync(directory, { recursive: true });
  for (const file of readdirSync(directories[0])) {
    if (!/^[a-f0-9]{64}\.capture$/.test(file)) continue;
    const bytes = readFileSync(join(directories[0], file), 'utf8'), hash = hashBytes(bytes);
    if (file !== `${hash.slice(7)}.capture`) throw new Error('capture file digest mismatch');
    captures[`effect-capture:${hash}`] = { hash, bytes, status: 'available', byteLength: Buffer.byteLength(bytes) };
  }
  return { captures, capture(bytes) {
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
      captures[reference] = { hash, bytes, status: 'available', byteLength: Buffer.byteLength(bytes) };
      return { reference, hash };
    });
  } };
}
