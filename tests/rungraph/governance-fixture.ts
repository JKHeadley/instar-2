import { readFileSync } from 'node:fs';
import { canonical, defineDecoder } from '../../src/index.js';
import type { Result } from '../../src/index.js';
import { generateRegister, generationOf, decodeGenerationRecord, loadRegister } from '../../src/register/index.js';
import type { RegisterContext } from '../../src/register/index.js';
import type { RunDecodeContext, RunGovernance } from '../../src/rungraph/index.js';
import { setup, value, hash } from '../register/fixtures.js';

// Controlled P2/P3 installation fixture. Approval/extract witnesses are explicit
// test records, not a production generation or a bypass around P3's constructors.
export function governanceFixture(c: RunDecodeContext, modify: (declarations: any[]) => any[] = d => d): RunGovernance {
  const s = setup();
  const declarations = modify(JSON.parse(readFileSync('src/rungraph/rungraph.declarations.json', 'utf8')));
  const register = { ...s.context.types.register, entries: [...s.context.register.entries, ...declarations.map(d => d.id)] };
  const context = { ...s.context, register, types: { ...s.context.types, register }, references: [
    { provider: 'fixture', id: 'P5-NF-54' }, { provider: 'probe', id: 'P5-NF-55' },
    ...['decodeRun', 'decodeRunStep', 'decodeRunTransition', 'decodeRunExit', 'decodeSessionGrounding'].map(id => ({ provider: 'decoder', id })),
  ] };
  const input = s.input(declarations, { extract: { ...s.extract, rows: declarations.map(d => ({ id: d.id, version: 'test-version:' + d.id,
    status: 'live', since: 'fixture-installation', supersedes: [], approvedIn: { owner: 'part-two', name: 'FactEnvelope', id: 'fixture-approval:' + d.id },
    landedIn: 'fixture-installation', base: 'fixture-base', contentHash: hash(d) })) } });
  const generated = value(generateRegister(input, context)), generation = value(generationOf(generated, context));
  const record = value(decodeGenerationRecord({ type: 'GenerationRecord', schemaVersion: 1, generation, at: s.f.now }, context));
  function success<T>(payload: T): Result<T> {
    return value(defineDecoder<T, RegisterContext>({ name: 'RunGovernanceFixtureReply', owner: 'test-only', currentVersion: 1,
      versions: { 1: { validate: v => ({ ok: true, value: v }) } }, migrations: {}, decodeCurrent: () => ({ ok: true, value: payload }) }, context.preserved))
      .decode({ type: 'RunGovernanceFixtureReply', schemaVersion: 1 }, context);
  }
  const verified = value(loadRegister(generated, generation, context, { owner: 'part-two', verifyExtract: () => success({ owner: 'part-two', name: 'FactEnvelope', id: 'fixture-extract' }),
    enteringForce: () => success(record), isCurrent: () => success(true) }, s.f.now));
  return { register: verified, context, capture: { owner: 'part-two', preserve: input => {
    const encoded = value(canonical(input)), reference = 'gate-input:' + encoded.hash;
    Object.assign(c.facts.captures, { [reference]: { bytes: encoded.bytes, hash: encoded.hash, status: 'available', byteLength: Buffer.byteLength(encoded.bytes) } });
    return success(reference);
  } } };
}
