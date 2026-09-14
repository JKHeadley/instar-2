import { describe, expect, it } from 'vitest';
import ts from 'typescript';
import { resolve } from 'node:path';
import { createProgram } from '../../scripts/check-architecture.mjs';
import { decodeNormalRegisterWorkflow } from '../../src/register/index.js';
import { detail, json, setup, value } from './fixtures.js';

describe.skip('round-two data validation review regressions SKIPPED: HELD-BY-SCOPE:SEAM-LEDGER-row-124', () => {
  it('P3-NF-03 completely decodes workflow payloads and refuses missing/mistyped nested fields', () => {
    const s = setup();
    const workflow = json('RegisterWorkflow', { mode: 'normal', branch: 'round-two', parent: { commit: 'a'.repeat(40),
      register: 'generated/register.json', source: 'generated/source.json', conversion: 'generated/conversion.json' },
      extract: s.extract, runs: [], catalog: { fixtures: [], probes: [], sentinels: [], semanticReviews: [] },
      landedParts: [], references: [], claims: [], instances: {} });
    expect(value(decodeNormalRegisterWorkflow(workflow, s.context)).extract.type).toBe('ChainExtract');
    const noVector = { ...workflow, extract: { ...workflow.extract } } as Record<string, unknown>;
    delete (noVector.extract as Record<string, unknown>).vector;
    expect(detail(decodeNormalRegisterWorkflow(noVector, s.context))).toMatch(/vector|object/);
    expect(detail(decodeNormalRegisterWorkflow({ ...workflow, extract: { ...workflow.extract, schemaVersion: 2 } }, s.context))).toContain('schema version');
    expect(detail(decodeNormalRegisterWorkflow({ ...workflow, catalog: { ...workflow.catalog, fixtures: 'wrong' } }, s.context))).toContain('array');
  });

  it('P3-NF-03 nominal workflow type cannot be constructed from open JSON', () => {
    const path = 'tests/virtual-register-workflow-closed.ts';
    const program = createProgram({ [path]: `
      import type { NormalRegisterWorkflow } from '../src/register/index.js';
      const invalid: NormalRegisterWorkflow = { type: 'RegisterWorkflow', schemaVersion: 1, mode: 'normal', branch: 'x',
        parent: { commit: 'x', register: 'generated/register.json', source: 'generated/source.json', conversion: 'generated/conversion.json' },
        extract: {} as never, runs: [], catalog: { fixtures: [], probes: [], sentinels: [], semanticReviews: [] },
        landedParts: [], references: [], claims: [] };
      void invalid;
    ` });
    const errors = ts.getPreEmitDiagnostics(program).filter(d => d.category === ts.DiagnosticCategory.Error
      && d.file?.fileName === resolve(path));
    expect(errors.map(d => ts.flattenDiagnosticMessageText(d.messageText, '\n')).join('\n')).toContain('registerValue');
  });
});
