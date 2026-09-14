import { closeSync, existsSync, fsyncSync, mkdirSync, openSync, readFileSync, renameSync, rmdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

// Reference P10 adapter, not a second authority database. The single file contains
// exactly P2's signed envelopes. Atomic rename + file/directory fsync precede ACK.
// An abandoned writer lock fails closed; an operator must establish quiescence.
export function createTransportFileStorage(directory, result) {
  mkdirSync(directory, { recursive: true });
  const file = join(directory, 'facts.json');
  const read = () => existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : [];
  return Object.freeze({ owner: 'part-ten', read,
    append(bytes, expectedHead) {
      return result(() => {
        const lock = join(directory, 'append.lock');
        mkdirSync(lock);
        try {
          const records = read();
          if ((records.at(-1)?.contentHash ?? null) !== expectedHead) throw new Error('storage compare-head failed');
          const next = JSON.parse(bytes);
          const pending = join(directory, 'facts.pending');
          const fd = openSync(pending, 'w', 0o600);
          try { writeFileSync(fd, JSON.stringify([...records, next])); fsyncSync(fd); } finally { closeSync(fd); }
          renameSync(pending, file);
          const dir = openSync(directory, 'r');
          try { fsyncSync(dir); } finally { closeSync(dir); }
          return { kind: 'local-durable' };
        } finally { rmdirSync(lock); }
      });
    },
  });
}
