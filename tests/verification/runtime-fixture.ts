import { createFactStore } from '../../src/facts/index.js';
import type { FactContext, SegmentStoragePort } from '../../src/facts/index.js';
import { createVerificationRuntime, createVerificationSpine, registerVerificationBodies, verificationSchemas } from '../../src/verification/index.js';
import type { VerificationHost } from '../../src/verification/index.js';
import { factsFixture, privateKey, value } from '../facts/fixtures.js';

export function verificationRuntimeFixture() {
  const f = factsFixture(); let now = 100; let stopped = false; let context: FactContext = f.ctx;
  const host: VerificationHost = { machine: 'machine-a', principal: f.alice, scope: f.scope, boundary: f.c,
    current: () => ({ decode: context.decode, clock: f.clock(now), generation: context.decode.register.generation.id,
      stopped, facts: context, evidence: context.decode.evidence ?? [] }) };
  const registrations = value(registerVerificationBodies(host));
  context = { ...f.ctx, schemas: [...f.ctx.schemas, ...verificationSchemas(host)], ownedBodies: registrations };
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
  return { ...f, host, context, store, spine, runtime, bytes,
    time: (value: number) => { now = value; }, stop: (value = true) => { stopped = value; },
    setEvidence: (evidence: typeof f.evidence) => { context = { ...context, decode: { ...context.decode, evidence } }; },
    setCaptures: (captures: FactContext['captures']) => { context = { ...context, captures }; },
  };
}
