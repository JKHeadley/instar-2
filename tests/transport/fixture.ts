import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { consumeResult, decode, defineDecoder, deriveThrough } from '../../src/index.js';
import type { Json, Result } from '../../src/index.js';
import { authorAndAppend, createFactStore } from '../../src/facts/index.js';
import type { SegmentStoragePort } from '../../src/facts/index.js';
import { createTransportAuthority, createTransportSpine, decodeLoopPolicy, registerTransportBodies, transportSchemas } from '../../src/transport/index.js';
import type { TransportHost, ReserveInput, FenceToken, SharedBreakerLoopPolicy } from '../../src/transport/index.js';
import { factsFixture, privateKey, value, refused } from '../facts/fixtures.js';
// @ts-expect-error Reference host is JavaScript, outside pure core compilation.
import { createTransportFileStorage } from '../../scripts/transport-file-storage.mjs';
export { value, refused };

export function transportFixture(directory = mkdtempSync(join(tmpdir(), 'p6-')), incarnation = 'worker:1', authority = 'authority:1') {
  const f = factsFixture();
  let now = 100, stopped = false, generation = 'generation:1';
  const host: TransportHost = { domain: 'conversation:1', machine: 'machine-a', incarnation,
    authorityIncarnation: authority, principal: f.alice, scope: f.scope, maxLeaseTerm: 1000, budget: 100,
    loopClock: { owner: 'part-ten', now: () => f.clock(now) },
    calendarExpansion: { owner: 'part-fifteen', expand: input => f.success(Array.from({ length: Math.floor((input.through.value - input.after.value) / 10) },
      (_, index) => f.clock(input.after.value + (index + 1) * 10))) },
    restorationEvidence: { owner: 'part-nine', verify: input => f.success(input.reference) },
    monotonic: () => now, current: () => {
      const gen = { owner: 'part-three' as const, name: 'RegisterGeneration' as const, id: generation };
      return { decode: { ...f.ctx.decode, register: { ...f.ctx.decode.register, generation: gen,
        subjects: { ...f.ctx.decode.register.subjects, duration: ['ms'] } } }, clock: f.clock(100), generation: gen, stopped };
    },
  };
  const result = <T>(run: () => T): Result<T> => {
    const decoder = value(defineDecoder<T, typeof f.c>({ name: 'FileReceipt', owner: 'part-ten', currentVersion: 1,
      versions: { 1: { validate: v => ({ ok: true, value: v }) } }, migrations: {},
      decodeCurrent: () => { try { return { ok: true, value: run() }; } catch (error) { return { ok: false, detail: String(error) }; } },
    }, f.c.preserved));
    return deriveThrough(decoder, { type: 'FileReceipt', schemaVersion: 1 }, f.c);
  };
  const storage: SegmentStoragePort = createTransportFileStorage(directory, result);
  const ctx = { ...f.ctx, schemas: [...transportSchemas(host), { ...f.schema, kind: 'fixture-result',
    fields: { result: { kind: 'constitutional' as const, type: 'Result' as const } } }],
  ownedBodies: value(registerTransportBodies(host, f.c)) };
  const store = createFactStore(ctx, storage);
  const spine = createTransportSpine(host, { context: ctx, privateKey }, store);
  const api = createTransportAuthority(host, spine, f.c);
  const policy = value(decodeLoopPolicy({ type: 'LoopPolicy', schemaVersion: 1, id: 'loop-policy:1', maxAttempts: 3,
    minDelay: 10, maxDuration: 100, timeout: 10, concurrency: 1, failDirection: 'closed', breaker: 'stub-closed' }, f.c));
  const run = { owner: 'part-five' as const, name: 'Run' as const, id: 'run:1' };
  const parentDuty = { owner: 'part-five' as const, name: 'Run' as const, id: 'run:parent-duty' };
  const sharedPolicy = value(decodeLoopPolicy({ type: 'LoopPolicy', schemaVersion: 1, id: 'shared-loop-policy:1',
    maxAttempts: 12, minDelay: 1, maxDuration: 1000, timeout: 10, concurrency: 2,
    failDirection: 'closed', breaker: 'shared-circuit-v1', initialDelay: 1, maxDelay: 40,
    backoffMultiplier: 2, jitterMinPermille: 500, jitterMaxPermille: 1000,
    failureThreshold: 2, countedFailureClasses: ['transport', 'timeout'], acceptedOutcomeWindow: 500,
    breakerCooldown: 20, maxOpenDuration: 200, halfOpenTrials: 2, halfOpenConcurrency: 1,
    closeEvidence: 'part-nine-restoration', reopenEvidence: 'counted-failure', parentDuty,
    budgetWindow: 500, parentAttemptBudget: 20, parentResourceBudget: 100 } as const, f.c)) as SharedBreakerLoopPolicy;
  const vector = [{ machine: 'machine-a', epoch: 0, position: 1 }, { machine: 'machine-b', epoch: 0, position: 1 }] as const;
  const input = (fence: FenceToken, overrides: Partial<ReserveInput> = {}): ReserveInput => ({ command: 'reserve', fence,
    request: { owner: 'part-eight', name: 'EffectRequest', id: 'request:1' }, attempt: 'attempt:1',
    payloadDigest: `sha256:${'a'.repeat(64)}`, charge: 20, run, semanticMessage: 'message:five-owned', durability: 'local-durable', replicas: 0, ...overrides });
  const prepared = () => { const token = value(api.acquire('acquire', '', 500)); value(api.schedule('schedule', token, run, policy));
    return { token, reservation: value(api.reserve(input(token))) }; };
  const head = () => value(api.inspect()).at(-1)?.fact.id ?? '';
  const appendResult = (id = 'result:missed') => {
    const recorded = value(decode('Result', f.refusedInput(), f.ctx.decode));
    const json = (input: unknown) => JSON.parse(JSON.stringify(input)) as Json;
    const receipt = value(authorAndAppend({ kind: 'fixture-result', body: json({ result: recorded }), required: [],
      schemaVersion: 1, machine: host.machine, principal: json(host.principal), provenance: json(host.principal.provenance),
      at: json(f.clock(now)) }, ctx, store, privateKey));
    return { type: 'Result' as const, id, fact: { owner: 'part-two' as const, name: 'FactEnvelope' as const,
      id: receipt.fact.id }, field: 'result' };
  };
  const detail = <T>(r: Result<T>) => consumeResult(r, { Success: () => '', Refused: r => r.detail });
  return { ...f, host, ctx, storage, store, spine, api, directory, policy, sharedPolicy, parentDuty, vector, run, result, input, prepared, head, appendResult, detail,
    advance: (n: number) => { now += n; }, time: (n: number) => { now = n; }, stop: () => { stopped = true; }, generation: (v: string) => { generation = v; } };
}
