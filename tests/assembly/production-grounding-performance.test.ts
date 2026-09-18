// @ts-nocheck -- public compiled Ten composition and physical durable storage.
import { expect, it } from 'vitest';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { prepareProductionSliceAssembly, sliceConfig, take } from '../../scripts/slice-assembly.mjs';

it('PG-R4C verified history reuse stays local and refuses equal-length origin and peer corruption', () => {
  const home = mkdtempSync(join(tmpdir(), 'pg-read-cache-'));
  const { slice } = prepareProductionSliceAssembly(home, sliceConfig({ profile: 'reply' }));
  take(slice.replicas.durability.ensure(slice.facts()));
  for (const [store, directory] of [[slice.store, slice.paths.facts], [slice.peerStore, slice.paths.peer]]) {
    const first = take(store.readForProjection());
    expect(take(store.readForProjection())).toBe(first);
    const file = join(directory, 'facts.json'), bytes = readFileSync(file, 'utf8');
    const rows = JSON.parse(bytes), signature = rows[0].signature;
    const changed = bytes.replace(signature, (signature[0] === '0' ? '1' : '0') + signature.slice(1));
    expect(changed.length).toBe(bytes.length);
    expect(changed).not.toBe(bytes);
    try {
      writeFileSync(file, changed);
      expect(() => take(store.read())).toThrow();
      expect(() => take(store.readForProjection())).toThrow();
    } finally { writeFileSync(file, bytes); }
    expect(take(store.readForProjection()).entries.length).toBe(first.entries.length);
  }
  expect(take(slice.store.readForProjection())).not.toBe(take(slice.peerStore.readForProjection()));
}, 120000);
