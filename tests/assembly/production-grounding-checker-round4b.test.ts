import { expect, it } from 'vitest';
import { mkdtempSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
// @ts-expect-error Owner checker is executable ESM tooling.
import { checkProductionGroundingAssemblyEvidence } from '../../scripts/check-assembly-contracts.mjs';

it('PG-R4B F9 six executed empty matching tests and rewritten rooted reports never certify behavior', () => {
  const directory = mkdtempSync(join(tmpdir(), 'grounding-empty-'));
  const manifest = JSON.parse(readFileSync('tests/assembly/production-grounding-inventory.json', 'utf8'));
  const six = manifest.cases.filter((row: any) => row.sourceFile?.startsWith('tests/')).slice(0, 6);
  expect(six).toHaveLength(6);
  writeFileSync(join(directory, 'empty.test.ts'), `import {it} from ${JSON.stringify(resolve('node_modules/vitest/dist/index.js'))};\n`
    + six.map((row: any) => `it(${JSON.stringify(row.fullName)},()=>{});`).join('\n'));
  writeFileSync(join(directory, 'vitest.config.mjs'), `export default {test:{include:['empty.test.ts'],pool:'forks',maxWorkers:1}};`);
  const result = join(directory, 'report.json');
  execFileSync(process.execPath, [resolve('node_modules/vitest/vitest.mjs'), 'run', '--root', directory,
    '--config', join(directory, 'vitest.config.mjs'), '--reporter=json', '--outputFile', result], { stdio: 'pipe' });
  const report = JSON.parse(readFileSync(result, 'utf8'));
  expect(report.numPassedTests).toBe(6); expect(report.numFailedTests).toBe(0);
  expect(() => checkProductionGroundingAssemblyEvidence(report)).toThrow();
  const rootSpoof = { ...report, testResults: six.map((row: any, i: number) => ({ ...report.testResults[0],
    name: resolve(row.landedFile), assertionResults: [report.testResults[0].assertionResults[i]] })) };
  expect(() => checkProductionGroundingAssemblyEvidence(rootSpoof)).toThrow();
  const fullSpoof = { ...report, testResults: manifest.cases.map((row: any) => ({ ...report.testResults[0], name: resolve(row.landedFile),
    assertionResults: [{ fullName: row.fullName, status: 'passed' }] })) };
  expect(() => checkProductionGroundingAssemblyEvidence(fullSpoof)).toThrow();
}, 30000);
