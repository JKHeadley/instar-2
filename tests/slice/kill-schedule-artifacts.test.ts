import { afterEach, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { executionFingerprint, killScheduleRunDir, loadControl, loadPair } from './kill-schedule-artifacts.js';

const dirs: string[] = [];
afterEach(() => { for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true }); });
const scratch = (): string => { const d = mkdtempSync(join(tmpdir(), 'p11-artifact-test-')); dirs.push(d); return d; };
const sha = (s: string): string => createHash('sha256').update(s).digest('hex');

const PAIR = ['preservation', 'authentication'] as const;
const artifact = { report: { boot: 1 }, firedCuts: ['preservation', 'authentication'], boots: 3, neverReached: [] };
const control = { report: { boot: 9 } };
// Write pair + control payloads and an index whose entries carry each file's real sha.
function seed(dir: string, fingerprint: string): void {
  const pairBytes = JSON.stringify(artifact), controlBytes = JSON.stringify(control);
  writeFileSync(join(dir, 'pair-0.json'), pairBytes);
  writeFileSync(join(dir, 'control-reply.json'), controlBytes);
  writeFileSync(join(dir, 'index.json'), JSON.stringify({ fingerprint,
    pairs: { 'reply:preservation+authentication': { file: 'pair-0.json', sha: sha(pairBytes) } },
    controls: { reply: { file: 'control-reply.json', sha: sha(controlBytes) } } }));
}

it('P11-NF-44 a valid, fingerprint-current, sha-matching cache is used for pairs and controls', () => {
  const dir = scratch();
  seed(dir, executionFingerprint() as string);
  expect(loadPair('reply', PAIR, dir)).toEqual(artifact);
  expect(loadControl('reply', dir)).toEqual(control.report);
});

it('P11-NF-44 a stale fingerprint (any changed execution input, not just slice-assembly) is a cache MISS', () => {
  // astra N1 / Claude R7: the guard covers the COMPLETE report-dependency set. An artifact
  // stamped with anything other than the current comprehensive fingerprint — the old
  // slice-assembly-only hash, or a hash from before a dist/ owner or slice-worker change —
  // is not reused.
  const dir = scratch();
  seed(dir, 'stale-fingerprint-from-a-different-tree-or-dist');
  expect(loadPair('reply', PAIR, dir)).toBeNull();
  expect(loadControl('reply', dir)).toBeNull();
});

it('P11-NF-44 the fingerprint covers the owner code and worker, not slice-assembly.mjs alone', () => {
  const roots = scratch();
  writeFileSync(join(roots, 'a.mjs'), 'one');
  writeFileSync(join(roots, 'b.js'), 'two');
  const before = executionFingerprint([roots], []) as string;
  expect(executionFingerprint([roots], [])).toBe(before);       // stable when nothing changes
  writeFileSync(join(roots, 'b.js'), 'two-changed');
  expect(executionFingerprint([roots], [])).not.toBe(before);   // a changed dependency invalidates
  // Not the old narrow guard: the default is not the slice-assembly hash alone, and it
  // spans more than any single root (dist/ owner code + scripts/ + the harness).
  const assemblyOnly = sha(readFileSync('scripts/slice-assembly.mjs', 'utf8'));
  expect(executionFingerprint()).not.toBe(assemblyOnly);
  expect(executionFingerprint()).not.toBe(executionFingerprint(['scripts'], []));
});

it('P11-NF-44 the artifact directory is per-checkout, so two checkouts never share or clobber', () => {
  // Claude R7(b): distinct absolute checkout paths resolve to distinct directories.
  expect(killScheduleRunDir('/a/checkout-one')).not.toBe(killScheduleRunDir('/b/checkout-two'));
  expect(killScheduleRunDir('/a/checkout-one')).toBe(killScheduleRunDir('/a/checkout-one'));
});

it('P11-NF-44 a missing index, entry, file, torn write, or malformed payload is a cache MISS, never a throw', () => {
  const fp = executionFingerprint() as string;
  // Missing index entirely (astra N2).
  expect(loadPair('reply', PAIR, scratch())).toBeNull();
  expect(loadControl('reply', scratch())).toBeNull();
  // Valid, current manifest but the named entry is absent from the index.
  const noEntry = scratch();
  writeFileSync(join(noEntry, 'index.json'), JSON.stringify({ fingerprint: fp, pairs: {}, controls: {} }));
  expect(loadPair('reply', PAIR, noEntry)).toBeNull();
  expect(loadControl('reply', noEntry)).toBeNull();
  // Entry present, current fingerprint, but the FILE it points at is absent — the exact
  // ENOENT that used to throw at read time instead of falling back (astra N2).
  const missingFile = scratch();
  writeFileSync(join(missingFile, 'index.json'), JSON.stringify({ fingerprint: fp,
    pairs: { 'reply:preservation+authentication': { file: 'pair-0.json', sha: sha('x') } },
    controls: { reply: { file: 'control-reply.json', sha: sha('y') } } }));
  expect(loadPair('reply', PAIR, missingFile)).toBeNull();
  expect(loadControl('reply', missingFile)).toBeNull();
  // A TORN/partial write: the file exists and is valid JSON of the right shape, but its
  // bytes do not match the sha the manifest recorded — refused, not asserted (Claude R7(c)).
  const torn = scratch();
  seed(torn, fp);
  writeFileSync(join(torn, 'pair-0.json'), JSON.stringify({ ...artifact, boots: 999 })); // different bytes, sha now wrong
  expect(loadPair('reply', PAIR, torn)).toBeNull();
  // Unparseable or wrong-shape payloads (with matching sha) are misses too.
  const bad = scratch();
  const junk = 'not json {', wrongShape = JSON.stringify({ firedCuts: [] });
  writeFileSync(join(bad, 'pair-0.json'), junk);
  writeFileSync(join(bad, 'control-reply.json'), wrongShape);
  writeFileSync(join(bad, 'index.json'), JSON.stringify({ fingerprint: fp,
    pairs: { 'reply:preservation+authentication': { file: 'pair-0.json', sha: sha(junk) } },
    controls: { reply: { file: 'control-reply.json', sha: sha(wrongShape) } } }));
  expect(loadPair('reply', PAIR, bad)).toBeNull();
  expect(loadControl('reply', bad)).toBeNull();
  // A malformed / partial index is a miss, not a throw.
  const badIndex = scratch();
  writeFileSync(join(badIndex, 'index.json'), '{ this is not valid json');
  expect(loadPair('reply', PAIR, badIndex)).toBeNull();
  const partialIndex = scratch();
  writeFileSync(join(partialIndex, 'index.json'), JSON.stringify({ pairs: {}, controls: {} }));
  expect(loadPair('reply', PAIR, partialIndex)).toBeNull();
});
