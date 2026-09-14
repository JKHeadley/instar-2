import { execFileSync } from 'node:child_process';
import { expect, it } from 'vitest';

const base = '2bd8256db8341134209ef7412b9b161c37296063';
const landing = 'f144f1435a11914b79ffcb6c1cfb19444f70e3ef';
const index = 'src/assembly/index.ts';
const additiveIndexSuffix = "export { createConditionalAssemblyAppendPort } from './conditional-append.js';\n"
  + "export type { AssemblyRecordSubject, AssemblySubjectFrontier, ConditionalAssemblyAppendPort,\n"
  + "  ConditionalAssemblyAppendDependencies } from './conditional-append.js';\n";

it('P10-SEAM-CONDITIONAL-APPEND-58 [behavior:appendIfSubjectFrontier] [case:strict-additivity] preserves every pre-existing src/ and scripts/ path byte-for-byte', () => {
  expect(() => execFileSync('git', ['merge-base', '--is-ancestor', landing, 'HEAD'])).not.toThrow();
  const paths = execFileSync('git', ['ls-tree', '-r', '--name-only', base, '--', 'src', 'scripts'], { encoding: 'utf8' })
    .trim().split('\n').filter(Boolean);
  expect(paths.length).toBeGreaterThan(0);
  for (const path of paths.filter(path => path !== index)) {
    const original = execFileSync('git', ['show', `${base}:${path}`]);
    const landed = execFileSync('git', ['show', `${landing}:${path}`]);
    expect(landed.equals(original), path).toBe(true);
  }
  const originalIndex = execFileSync('git', ['show', `${base}:${index}`]);
  const landedIndex = execFileSync('git', ['show', `${landing}:${index}`]);
  expect(landedIndex.subarray(0, originalIndex.length).equals(originalIndex)).toBe(true);
  expect(landedIndex.subarray(originalIndex.length).toString('utf8')).toBe(additiveIndexSuffix);
});
