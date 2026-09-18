import { spawnSync } from 'node:child_process';
import { mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { expect, it } from 'vitest';
import { openProductionStorage } from '../../src/assembly/production-storage.js';
import { factsFixture, value } from '../facts/fixtures.js';
// @ts-expect-error Ten physical host is JavaScript outside the pure core.
import { productionStorageIO } from '../../scripts/production-boot-io.mjs';

it.each(['facts', 'captures', 'exact'])('production boot storage: SIGKILL after durable %s permits conservative lease recovery with identical bytes', cut => {
  const f = factsFixture(), root = realpathSync(mkdtempSync(join(tmpdir(), 'boot-storage-crash-')));
  const input = { root, machine: 'machine-a', policy: 'policy:crash', store: 'store:crash', context: f.c };
  try {
    const child = spawnSync(process.execPath, ['tests/assembly/production-boot-storage-crash-worker.mjs'],
      { input: JSON.stringify({ ...input, cut }), encoding: 'utf8', timeout: 10000 });
    expect(child.signal).toBe('SIGKILL'); expect(child.stdout).toContain(`durable:${cut}`);
    const recovered = value(openProductionStorage({ ...input, key: new Uint8Array(32).fill(23), io: productionStorageIO }));
    try {
      expect(recovered.segment.read()).toEqual([{ contentHash: 'storage-crash-head', message: 'preserved' }]);
      expect(recovered.captures.read('capture:crash')).toBe(cut === 'facts' ? null : 'captured exact bytes');
      if (cut === 'exact') expect(value(recovered.persistence.readExact({ store: input.store,
        positions: ['position:crash'], access: 'registered-read', maxBytes: 4096 })))
        .toEqual(['{"contentHash":"storage-crash-head","message":"preserved"}']);
    } finally { recovered.close(); }
  } finally { rmSync(root, { recursive: true, force: true }); }
});
