import { expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
it('P2-NF-01 P2-NF-22 P2-NF-51 fixed canonical preimage, hash, signature and all merge-class outputs match pinned bytes', () => {
  expect(execFileSync(process.execPath, ['scripts/p2-determinism.mjs'], { encoding: 'utf8' })).toContain('P2 pinned outputs match');
});
