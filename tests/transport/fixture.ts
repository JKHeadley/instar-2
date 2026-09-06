import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { consumeResult, defineDecoder, deriveThrough } from '../../src/index.js';
import type { Result } from '../../src/index.js';
import { createFactStore } from '../../src/facts/index.js';
import type { SegmentStoragePort } from '../../src/facts/index.js';
import { createTransportAuthority, createTransportSpine, decodeLoopPolicy, registerTransportBodies, transportSchemas } from '../../src/transport/index.js';
import type { TransportHost, ReserveInput, FenceToken } from '../../src/transport/index.js';
import { factsFixture, privateKey, value, refused } from '../facts/fixtures.js';
// @ts-expect-error Reference host is JavaScript, outside pure core compilation.
import { createTransportFileStorage } from '../../scripts/transport-file-storage.mjs';
export { value, refused };

export function transportFixture(directory = mkdtempSync(join(tmpdir(), 'p6-')), incarnation = 'worker:1', authority = 'authority:1') {
  const f = factsFixture();
  let now = 100, stopped = false, generation = 'generation:1';
  const host: TransportHost = { domain: 'conversation:1', machine: 'machine-a', incarnation,
    authorityIncarnation: authority, principal: f.alice, scope: f.scope, maxLeaseTerm: 1000, budget: 100,
    monotonic: () => now, current: () => {
      const gen = { owner: 'part-three' as const, name: 'RegisterGeneration' as const, id: generation };
      return { decode: { ...f.ctx.decode, register: { ...f.ctx.decode.register, generation: gen } }, clock: f.clock(100), generation: gen, stopped };
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
  const ctx = { ...f.ctx, schemas: transportSchemas(host), ownedBodies: value(registerTransportBodies(host, f.c)) };
  const store = createFactStore(ctx, storage);
  const spine = createTransportSpine(host, { context: ctx, privateKey }, store);
  const api = createTransportAuthority(host, spine, f.c);
  const policy = value(decodeLoopPolicy({ type: 'LoopPolicy', schemaVersion: 1, id: 'loop-policy:1', maxAttempts: 3,
    minDelay: 10, maxDuration: 100, timeout: 10, concurrency: 1, failDirection: 'closed', breaker: 'stub-closed' }, f.c));
  const run = { owner: 'part-five' as const, name: 'Run' as const, id: 'run:1' };
  const input = (fence: FenceToken, overrides: Partial<ReserveInput> = {}): ReserveInput => ({ command: 'reserve', fence,
    request: { owner: 'part-eight', name: 'EffectRequest', id: 'request:1' }, attempt: 'attempt:1',
    payloadDigest: `sha256:${'a'.repeat(64)}`, charge: 20, run, semanticMessage: 'message:five-owned', durability: 'local-durable', replicas: 0, ...overrides });
  const prepared = () => { const token = value(api.acquire('acquire', '', 500)); value(api.schedule('schedule', token, run, policy));
    return { token, reservation: value(api.reserve(input(token))) }; };
  const head = () => value(api.inspect()).at(-1)?.fact.id ?? '';
  const detail = <T>(r: Result<T>) => consumeResult(r, { Success: () => '', Refused: r => r.detail });
  return { ...f, host, ctx, storage, store, spine, api, directory, policy, run, result, input, prepared, head, detail,
    advance: (n: number) => { now += n; }, time: (n: number) => { now = n; }, stop: () => { stopped = true; }, generation: (v: string) => { generation = v; } };
}
