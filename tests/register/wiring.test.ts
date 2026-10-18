import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { createProgram } from '../../scripts/check-architecture.mjs';
import { inspectSource, checkWiring } from '../../scripts/check-register-wiring.mjs';
import { decodeShape, checkGovernedState, generateRegister, verifyGenerated } from '../../src/register/index.js';
import { setup, detail, value, shapeInput, hash, wiringSources, withoutBasis } from './fixtures.js';

describe('source and shape wiring', () => {
  it('P3-NF-04 real source sweep follows import aliases and finds undeclared ports', () => {
    const s = setup(); const code = "import { constructGoverned as create } from './register/index.js'; create('stores', 'missing', register, context);";
    expect(inspectSource('src/client.ts', code, wiringSources()).constructs[0]?.id).toBe('missing');
    expect(checkWiring(s.build(), { ...wiringSources(), 'src/client.ts': code }).issues[0]).toContain('P3-NF-04');
    expect(checkWiring(s.build(), { ...wiringSources(), 'src/client.ts': code.replace('missing', 'store') }).issues).toEqual([]);
  }, 30_000);
  it('P3-NF-04 missing declaration argument and open construction fail TypeScript', () => {
    const source = "import { constructGoverned } from './src/register/index.js'; import type { Declaration } from './src/register/index.js'; constructGoverned(); const forged: Declaration = { type: 'Declaration', schemaVersion: 1 };";
    const program = createProgram({ 'register-negative.ts': source });
    const file = program.getSourceFiles().find(f => f.fileName.endsWith('register-negative.ts'));
    expect(file).toBeDefined();
    const diagnostics = program.getSemanticDiagnostics(file);
    expect(diagnostics.some(d => d.code === 2554)).toBe(true); expect(diagnostics.some(d => d.code === 2322)).toBe(true);
  }, 30_000); // A real compiler invocation, not a five-second runtime-latency assertion.
  it('P3-NF-09 kind validation consumes generated shape instead of independent constants', () => {
    const s = setup(); const raw = shapeInput(); const canonicalShape = value(decodeShape(raw, s.context));
    expect(value(verifyGenerated(canonicalShape, s.context.shape, s.context))).toBe(true);
    const changed = structuredClone(raw) as { kinds: { name: string; fields: unknown[] }[] };
    changed.kinds.find(k => k.name === 'stores')!.fields = [];
    expect(detail(verifyGenerated(changed, s.context.shape, s.context))).toContain('P3-NF-01');
    const context = { ...s.context, shape: value(decodeShape(changed, s.context)) };
    expect(detail(generateRegister(s.input(), context))).toContain('undeclared field');
  });
  it('P3-NF-26 a governed-state site must invoke the named decoder and read the approved record', () => {
    const s = setup(); const declaration = s.holder([]); const guarded = { ...declaration, requiredFacts: { ...withoutBasis(declaration.requiredFacts),
      decidesAlone: 'governed-state', enforces: { record: 'store', decoder: 'decode:Profile' } } };
    const row = { id: 'store', version: 'v1', status: 'live', since: 'commit:old', supersedes: [], approvedIn: { owner: 'part-two', name: 'FactEnvelope', id: 'approval:1' },
      landedIn: 'commit:old', base: 'base:old', contentHash: hash(s.declaration()) };
    const register = s.build([s.declaration(), guarded], { extract: { ...s.extract, rows: [row] } });
    expect(detail(checkGovernedState([], register, s.context))).toContain('P3-NF-26');
    expect(value(checkGovernedState([{ site: 'holder', record: 'store', decoder: 'decode:Profile', reads: ['store'], invokes: ['decode:Profile'] }], register, s.context))).toBe(true);
    const missingCall = "import { readRegisterEntry } from './register/index.js'; import { decode } from './index.js'; function example() { readRegisterEntry('store', register, context); }";
    expect(checkWiring(register, { ...wiringSources(), 'src/example.ts': missingCall }).issues[0]).toContain('P3-NF-26');
    const wired = missingCall.replace('context); }', "context); decode('Profile', input, context); }");
    expect(checkWiring(register, { ...wiringSources(), 'src/example.ts': wired }).issues).toEqual([]);
  }, 30_000);
});
