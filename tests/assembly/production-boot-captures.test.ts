import { mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { expect, it } from 'vitest';
import { createProductionJudgmentCaptures } from '../../src/assembly/production-captures.js';
import { openProductionStorage } from '../../src/assembly/production-storage.js';
import { factsFixture, value, refused } from '../facts/fixtures.js';
// @ts-expect-error The physical host is JavaScript outside the pure core.
import { productionStorageIO } from '../../scripts/production-boot-io.mjs';

it('production provider capture custody keeps reserved capacity and exact bytes across encrypted-root restart', () => {
  const f = factsFixture(), root = realpathSync(mkdtempSync(join(tmpdir(), 'boot-captures-')));
  const options = { root, machine: 'machine-a', key: new Uint8Array(32).fill(17), policy: 'policy', store: 'store',
    context: f.c, io: productionStorageIO };
  let storage = value(openProductionStorage(options));
  try {
    const construct = (capacity = 64) => createProductionJudgmentCaptures({ custody: storage.captures,
      context: f.c, capacity, metadata: {}, decodeCaptures: {} });
    const first = value(construct()), token = value(first.reserve(48));
    const receipt = value(first.putReserved(token, 'exact provider receipt'));
    expect(value(first.read(receipt))).toBe('exact provider receipt');
    refused(first.putReserved({ ...token }, 'forged'), 'unissued');
    refused(first.putReserved(token, 'a different receipt'), 'durable custody');
    storage.close(); storage = value(openProductionStorage(options));
    const rebuilt = value(construct());
    expect(value(rebuilt.read(receipt))).toBe('exact provider receipt');
    refused(rebuilt.putReserved(token, 'exact provider receipt'), 'unissued');
    refused(rebuilt.reserve(17), 'capacity exhausted');
    value(rebuilt.reserve(16));
    refused(construct(65), 'durable custody');
  } finally { storage.close(); rmSync(root, { recursive: true, force: true }); }
});
