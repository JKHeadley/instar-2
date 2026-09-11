import { describe, expect, it } from 'vitest';
import ts from 'typescript';
import { resolve } from 'node:path';
import { canonical, defineDecoder } from '../../src/index.js';
import type { Result } from '../../src/index.js';
import { createProgram } from '../../scripts/check-architecture.mjs';
import { decodeDeclaration, decodeGenerationRecord, decodeNormalRegisterWorkflow, decodeShape,
  decodeShapeChangeDocument, generateAgainstParent, generationOf, loadRegister, shapeDifferences } from '../../src/register/index.js';
import type { FactReference, RegisterContext, ShapeChangeBinding, SpineReadPort } from '../../src/register/index.js';
import { detail, hash, json, setup, value } from './fixtures.js';

function reply<T>(payload: T, context: RegisterContext): Result<T> {
  return value(defineDecoder<T, RegisterContext>({ name: 'RoundTwoReply', owner: 'test-only', currentVersion: 1,
    versions: { 1: { validate: input => ({ ok: true, value: input }) } }, migrations: {},
    decodeCurrent: () => ({ ok: true, value: payload }) }, context.preserved)).decode(json('RoundTwoReply', {}), context);
}

describe('round-two data validation review regressions', () => {
  it('P3-NF-09 refuses a decoded document whose canonical bytes differ from the approved hash', () => {
    const s = setup(), built = s.build(), generation = value(generationOf(built, s.context));
    const fact: FactReference = { owner: 'part-two', name: 'FactEnvelope', id: 'approval:round-two' };
    const spine: SpineReadPort = { owner: 'part-two', verifyExtract: () => reply(fact, s.context),
      enteringForce: () => reply(value(decodeGenerationRecord(json('GenerationRecord', { generation, at: s.f.now }), s.context)), s.context),
      isCurrent: () => reply(true, s.context) };
    const parent = value(loadRegister(built, generation, s.context, spine, s.f.now));
    const raw = JSON.parse(JSON.stringify(s.context.shape)); raw.parts.push(14);
    const candidate = value(decodeShape(raw, s.context));
    const document = value(decodeShapeChangeDocument(json('ShapeChangeDocument', { id: 'approved-document', parent: generation.id,
      candidateShape: hash(candidate), changes: shapeDifferences(parent.shape, candidate), ownerReferences: [], approvedIn: fact }), s.context));
    const binding: ShapeChangeBinding = { parent: generation.id, candidateShape: hash(candidate),
      document: { path: 'register-source/shape-changes/round-two.json', hash: hash(document) }, approval: fact };
    const approvals = { owner: 'part-two' as const, verifyShapeChange: () => reply(fact, s.context) };
    expect(value(generateAgainstParent(s.input(), parent, candidate, binding, approvals, s.context, document)).shape).toEqual(candidate);
    const changed = value(decodeShapeChangeDocument({ ...document, id: 'different-document' }, s.context));
    expect(detail(generateAgainstParent(s.input(), parent, candidate, binding, approvals, s.context, changed))).toContain('bytes differ');
  });

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

  it('P3-NF-02 refuses malformed nested rule and adjective values at the declaration decoder', () => {
    const s = setup();
    expect(detail(decodeDeclaration(s.rule(-1), s.context))).toContain('positive integer');
    expect(detail(decodeDeclaration(s.rule(7, { termRefs: 42 }), s.context))).toMatch(/array|format/);
    expect(detail(decodeDeclaration(s.rule(7, { termRefs: [''] }), s.context))).toContain('nonempty string');
    const adjective = s.declaration('term:derived', 'terms', { name: 'urgent', kind: 'adjective', definition: 'Derived.',
      allowedValues: [], termRefs: [], derivedFrom: { any: 42 } });
    expect(detail(decodeDeclaration(adjective, s.context))).toContain('array');
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
