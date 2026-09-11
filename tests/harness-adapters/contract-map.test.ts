import { expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
// @ts-expect-error the executable repository checker is intentionally plain ESM
import { checkP13Architecture, p13Dispositions } from '../../scripts/check-p13-contract-map.mjs';

interface Disposition { id: string; number: number; status: string; heldArms?: string }

it('R5-STRUCTURAL-SLICE all 52 governing P13 rows have an executable or exact non-executable disposition', () => {
  const rows: Disposition[] = p13Dispositions();
  expect(rows).toHaveLength(52);
  expect(new Set(rows.map(row => row.id)).size).toBe(52);
  expect(rows.some(row => row.id === 'P13-NF-53')).toBe(false);
  expect(rows.filter(row => row.status === 'EXECUTABLE')).toHaveLength(13);
  expect(rows.filter(row => row.heldArms === 'NON-EXECUTABLE-UNTIL-slice-A2')).toHaveLength(8);
});

it('P13-ADDITIVITY R5-F10 permanent scope and structural A2-removal gate checks every main-to-HEAD path', () => {
  const checked = checkP13Architecture();
  expect(checked.sourceFiles).toEqual(['admission.ts', 'contracts.ts', 'index.ts', 'records.ts']);
  expect(checked.changed).not.toContain('package.json');
  expect(checked.changed).not.toContain('scripts/slice-p13-state-storage.mjs');
});

it('R5-F1 pending-work and completion witnesses are structurally NON-EXECUTABLE-UNTIL-slice-A2', () => {
  const rows: Disposition[] = p13Dispositions();
  expect(rows.find(row => row.id === 'P13-NF-21')?.status).toBe('NON-EXECUTABLE-UNTIL-slice-A2');
  expect(rows.find(row => row.id === 'P13-NF-32')?.status).toBe('NON-EXECUTABLE-UNTIL-slice-A2');
  expect(readFileSync('src/harness-adapters/index.ts', 'utf8')).not.toMatch(/completion|turnState|EvidenceHolder/);
});

it('R5-F2 journal reading and rotation are structurally NON-EXECUTABLE-UNTIL-slice-A2', () => {
  const checked = checkP13Architecture();
  expect(checked.sourceFiles).not.toContain('holder.ts');
  expect(checked.sourceFiles).not.toContain('adapter.ts');
  expect(readFileSync('src/harness-adapters/index.ts', 'utf8')).not.toMatch(/StateStore|RuntimeHandleHolder/);
});

it('R5-F3 liveness probes are structurally NON-EXECUTABLE-UNTIL-slice-A2', () => {
  const rows: Disposition[] = p13Dispositions();
  expect(rows.find(row => row.id === 'P13-NF-29')?.heldArms).toBe('NON-EXECUTABLE-UNTIL-slice-A2');
  expect(readFileSync('src/harness-adapters/index.ts', 'utf8')).not.toMatch(/liveness|probeProcess/);
});
