import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';

const base = '2bd8256db8341134209ef7412b9b161c37296063';
const index = 'src/assembly/index.ts';
const partTwelveOwnerReferences = 'scripts/register-owner-references.mjs';
const additiveIndexSuffix = "export { createConditionalAssemblyAppendPort } from './conditional-append.js';\n"
  + "export type { AssemblyRecordSubject, AssemblySubjectFrontier, ConditionalAssemblyAppendPort,\n"
  + "  ConditionalAssemblyAppendDependencies } from './conditional-append.js';\n";

it('P10-SEAM-CONDITIONAL-APPEND-58 [behavior:appendIfSubjectFrontier] [case:strict-additivity] preserves every pre-existing src/ and scripts/ path byte-for-byte', () => {
  const paths = execFileSync('git', ['ls-tree', '-r', '--name-only', base, '--', 'src', 'scripts'], { encoding: 'utf8' })
    .trim().split('\n').filter(Boolean);
  expect(paths.length).toBeGreaterThan(0);
  for (const path of paths.filter(path => path !== index && path !== partTwelveOwnerReferences)) {
    const original = execFileSync('git', ['show', `${base}:${path}`]);
    expect(readFileSync(path).equals(original), path).toBe(true);
  }
  const originalIndex = execFileSync('git', ['show', `${base}:${index}`]);
  const currentIndex = readFileSync(index);
  expect(currentIndex.subarray(0, originalIndex.length).equals(originalIndex)).toBe(true);
  expect(currentIndex.subarray(originalIndex.length).toString('utf8')).toBe(additiveIndexSuffix);
  const originalOwnerReferences = execFileSync('git', ['show', `${base}:${partTwelveOwnerReferences}`], { encoding: 'utf8' });
  const expectedOwnerReferences = originalOwnerReferences
    .replace("['part-four', 'part-five']", "['part-four', 'part-five', 'part-twelve']")
    .replace("};\nconst exact =", "  'part-twelve': { decoders: {},\n"
      + "    fixture: id => id === 'P12-TELEGRAM-REPLY-CAPTURE', probe: () => false,\n"
      + "    test: (kind, path) => kind === 'fixture' && path === 'tests/conversation/fixtures/telegram/reply.json' },\n"
      + "};\nconst exact =")
    .replace("result.catalog[kind + 's'].push(row); result.references.push({ provider: kind, id: row.id });",
      "result.catalog[kind + 's'].push(row); result.references.push({ provider: kind, id: row.id,\n"
      + "        ...(manifest.owner === 'part-twelve' && kind === 'fixture' ? { kind: 'captured-bytes' } : {}) });");
  expect(readFileSync(partTwelveOwnerReferences, 'utf8')).toBe(expectedOwnerReferences);
});
