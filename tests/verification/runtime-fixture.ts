import { decode } from '../../src/index.js';
import { createFactStore } from '../../src/facts/index.js';
import type { FactContext, SegmentStoragePort } from '../../src/facts/index.js';
import { createVerificationRuntime, createVerificationSpine, registerVerificationBodies, verificationSchemas } from '../../src/verification/index.js';
import type { VerificationHost } from '../../src/verification/index.js';
import { factsFixture, privateKey, value } from '../facts/fixtures.js';
import { verificationInput } from './fixture.js';

export function verificationRuntimeFixture() {
  const f = factsFixture(); let now = 100; let stopped = false;
  const witnessFor = (probe = verificationInput('ProbeRecord'), id = 'evidence:witness') => value(decode('Evidence', f.evidenceInput({
    id, source: 'probe', observedAt: f.clock(probe.completedAt), freshFor: 200,
    claim: { subject: probe.subject, predicate: 'probe-passed', value: { challengeDigest: probe.challengeDigest,
      subjectDigest: verificationInput('VerificationPlan').bar.subjectDigest, plan: probe.plan, planVersion: probe.planVersion,
      arm: probe.arm, slot: probe.slot, attempt: probe.attempt, run: probe.run, operation: probe.operation,
      comparison: probe.comparison } },
  }), f.ctx.decode));
  const witness = witnessFor();
  let context: FactContext = { ...f.ctx, decode: { ...f.ctx.decode, evidence: [...f.ctx.decode.evidence ?? [], witness] } };
  const host: VerificationHost = { machine: 'machine-a', principal: f.alice, scope: f.scope, boundary: f.c,
    current: () => ({ decode: context.decode, clock: f.clock(now), generation: context.decode.register.generation.id,
      stopped, facts: context, evidence: context.decode.evidence ?? [] }) };
  const registrations = value(registerVerificationBodies(host));
  context = { ...context, schemas: [...context.schemas, ...verificationSchemas(host)], ownedBodies: registrations };
  const bytes: unknown[] = [];
  const storage: SegmentStoragePort = { owner: 'part-ten', read: () => bytes,
    append: (input, expected) => {
      const prior = bytes.at(-1) as { contentHash?: string } | undefined;
      if ((prior?.contentHash ?? null) !== expected) throw new Error('fixture compare-head mismatch');
      bytes.push(JSON.parse(input)); return f.success({ kind: 'local-durable' as const });
    } };
  const store = createFactStore(context, storage);
  const spine = createVerificationSpine(host, { context, privateKey }, store);
  const runtime = createVerificationRuntime(host, spine);
  return { ...f, host, context, store, spine, runtime, bytes, witnessFor,
    time: (value: number) => { now = value; }, stop: (value = true) => { stopped = value; },
    setGeneration: (generation: string) => { context = { ...context, decode: { ...context.decode,
      register: { ...context.decode.register, generation: { ...context.decode.register.generation, id: generation as typeof context.decode.register.generation.id } } } }; },
    setEvidence: (evidence: typeof f.evidence) => { context = { ...context, decode: { ...context.decode, evidence } }; },
    setCaptures: (captures: FactContext['captures']) => { context = { ...context, captures }; },
  };
}
