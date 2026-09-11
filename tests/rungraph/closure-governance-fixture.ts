import { readFileSync } from 'node:fs';
import { canonical, defineDecoder } from '../../src/index.js';
import type { Result } from '../../src/index.js';
import { decodeGenerationRecord, generateRegister, generationOf, loadRegister } from '../../src/register/index.js';
import type { RegisterContext } from '../../src/register/index.js';
import type { RunDecodeContext, RunGovernance } from '../../src/rungraph/index.js';
import { hash, setup, value } from '../register/fixtures.js';

/** Additive P2/P3 installation used only by closure-record tests. The original
 * Part Five governance fixture keeps loading the original declaration bytes. */
export function closureGovernanceFixture(
  c: RunDecodeContext,
  modify: (declarations: any[]) => any[] = declarations => declarations,
): RunGovernance {
  const s = setup();
  const declarations = modify([
    ...JSON.parse(readFileSync('src/rungraph/rungraph.declarations.json', 'utf8')),
    ...JSON.parse(readFileSync('src/rungraph/closure.declarations.json', 'utf8')),
  ]);
  const register = { ...s.context.types.register, entries: [...s.context.register.entries, ...declarations.map(d => d.id)] };
  const context = { ...s.context, register, types: { ...s.context.types, register }, references: [
    { provider: 'fixture', id: 'P5-NF-54' },
    { provider: 'fixture', id: 'P5-SEAM-RC-R10-F3-ADDITIVE-REGISTRATION' },
    { provider: 'probe', id: 'P5-NF-55' },
    ...['decodeRun', 'decodeRunStep', 'decodeRunTransition', 'decodeRunExit', 'decodeSessionGrounding',
      'decodeExhaustionRecord', 'decodeUnreachableRunExit']
      .map(id => ({ provider: 'decoder', id })),
  ] };
  const input = s.input(declarations, { extract: { ...s.extract, rows: declarations.map(d => ({
    id: d.id,
    version: `test-version:${d.id}`,
    status: 'live',
    since: 'fixture-installation',
    supersedes: [],
    approvedIn: { owner: 'part-two', name: 'FactEnvelope', id: `fixture-approval:${d.id}` },
    landedIn: 'fixture-installation',
    base: 'fixture-base',
    contentHash: hash(d),
  })) } });
  const generated = value(generateRegister(input, context));
  const generation = value(generationOf(generated, context));
  const record = value(decodeGenerationRecord({ type: 'GenerationRecord', schemaVersion: 1, generation, at: s.f.now }, context));
  function success<T>(payload: T): Result<T> {
    return value(defineDecoder<T, RegisterContext>({
      name: 'ClosureGovernanceFixtureReply',
      owner: 'test-only',
      currentVersion: 1,
      versions: { 1: { validate: v => ({ ok: true, value: v }) } },
      migrations: {},
      decodeCurrent: () => ({ ok: true, value: payload }),
    }, context.preserved)).decode({ type: 'ClosureGovernanceFixtureReply', schemaVersion: 1 }, context);
  }
  const verified = value(loadRegister(generated, generation, context, {
    owner: 'part-two',
    verifyExtract: () => success({ owner: 'part-two', name: 'FactEnvelope', id: 'fixture-extract' }),
    enteringForce: () => success(record),
    isCurrent: () => success(true),
  }, s.f.now));
  return { register: verified, context, capture: { owner: 'part-two', preserve: input => {
    const encoded = value(canonical(input));
    const reference = `gate-input:${encoded.hash}`;
    Object.assign(c.facts.captures, { [reference]: {
      bytes: encoded.bytes,
      hash: encoded.hash,
      status: 'available',
      byteLength: Buffer.byteLength(encoded.bytes),
    } });
    return success(reference);
  } } };
}
