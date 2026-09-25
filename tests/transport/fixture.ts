import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { consumeResult, defineDecoder, deriveThrough } from '../../src/index.js';
import type { Result } from '../../src/index.js';
import { authorAndAppend, createFactStore, registerOwnedBody } from '../../src/facts/index.js';
import type { SegmentStoragePort } from '../../src/facts/index.js';
import { createTransportAuthority, createTransportSpine, decodeLoopPolicy, registerTransportBodies, transportSchemas } from '../../src/transport/index.js';
import type { TransportHost, ReserveInput, FenceToken } from '../../src/transport/index.js';
import { factsFixture, privateKey, value, refused, json } from '../facts/fixtures.js';
// @ts-expect-error Reference host is JavaScript, outside pure core compilation.
import { createTransportFileStorage } from '../../scripts/transport-file-storage.mjs';
export { value, refused };

export function transportFixture(directory = mkdtempSync(join(tmpdir(), 'p6-')), incarnation = 'worker:1', authority = 'authority:1', servingFacts = false) {
  const f = factsFixture();
  let now = 100, stopped = false, generation = 'generation:1';
  const active = new Set<string>();
  const host: TransportHost = { domain: 'conversation:1', machine: 'machine-a', incarnation,
    authorityIncarnation: authority, principal: f.alice, scope: f.scope, maxLeaseTerm: 1000, budget: 100,
    executionQuiescent: run => !active.has(run),
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
  const short = { kind: 'text' as const, maxLength: 256 };
  const shared = { version: 1, machineScope: 'shared' as const, standing: 'requester' as const,
    action: 'work', scope: f.scope, causallyBound: false, requiredReferences: [], authority: 'none' as const };
  const fixtureSchemas = servingFacts ? [
    { ...shared, kind: 'assembly-ProductionInstallation', fields: { record: { kind: 'owned' as const, owner: 'part-ten', name: 'TestServingInstallation' } } },
    { ...shared, kind: 'conversation-binding', fields: { channel: short, sender: short, identityEpoch: short } },
    { ...shared, kind: 'intake-receipt', fields: {} },
    { ...shared, kind: 'intake-admitted', fields: { logicalId: short, receipt: { kind: 'reference' as const },
      binding: { kind: 'reference' as const }, channel: short, sender: short, identityEpoch: short, eventId: short } },
    { ...shared, kind: 'run-opening', fields: { run: short,
      record: { kind: 'owned' as const, owner: 'part-five', name: 'TestServingRun' } } },
    { ...shared, kind: 'run-transition', fields: { run: short,
      record: { kind: 'owned' as const, owner: 'part-five', name: 'TestServingRunTransition' } } },
    { ...shared, kind: 'effect-provider-ProviderEffectRequest', fields: {
      record: { kind: 'owned' as const, owner: 'part-eight', name: 'TestServingProviderRequest' } } },
    { ...shared, kind: 'judgment-provider-ProviderJudgmentRequest', fields: {
      record: { kind: 'owned' as const, owner: 'part-seven', name: 'TestServingJudgmentRequest' } } },
    { ...shared, kind: 'judgment-provider-ProviderAnswerAcceptance', fields: {
      record: { kind: 'owned' as const, owner: 'part-seven', name: 'TestServingAcceptance' } } },
    { ...shared, kind: 'effect-EffectRequest', fields: {
      record: { kind: 'owned' as const, owner: 'part-eight', name: 'TestServingEffectRequest' } } },
    { ...shared, kind: 'effect-OutboundMessage', fields: {
      record: { kind: 'owned' as const, owner: 'part-eight', name: 'TestServingOutboundMessage' } } },
  ] : [];
  const owned = servingFacts ? [
    value(registerOwnedBody({ name: 'TestServingInstallation', owner: 'part-ten', currentVersion: 1,
      versions: { 1: { validate: v => ({ ok: true, value: v }) } }, migrations: {},
      decodeCurrent: v => ({ ok: true, value: v }),
    }, { kind: 'object', fields: { type: short, schemaVersion: { kind: 'integer' },
      id: short, generation: short } }, f.c)),
    value(registerOwnedBody({ name: 'TestServingRun', owner: 'part-five', currentVersion: 1,
      versions: { 1: { validate: v => ({ ok: true, value: v }) } }, migrations: {},
      decodeCurrent: v => ({ ok: true, value: v }),
    }, { kind: 'object', fields: { type: short, schemaVersion: { kind: 'integer' },
      id: short, opening: { kind: 'object', fields: { id: short } }, owner: short,
      scope: short, generation: short, resultDestination: short } }, f.c)),
    value(registerOwnedBody({ name: 'TestServingProviderRequest', owner: 'part-eight', currentVersion: 1,
      versions: { 1: { validate: v => ({ ok: true, value: v }) } }, migrations: {},
      decodeCurrent: v => ({ ok: true, value: v }),
    }, { kind: 'object', fields: { type: short, schemaVersion: { kind: 'integer' }, id: short,
      obligation: short } }, f.c)),
    value(registerOwnedBody({ name: 'TestServingRunTransition', owner: 'part-five', currentVersion: 1,
      versions: { 1: { validate: v => ({ ok: true, value: v }) } }, migrations: {},
      decodeCurrent: v => ({ ok: true, value: v }),
    }, { kind: 'object', fields: { type: short, schemaVersion: { kind: 'integer' },
      id: short, to: short } }, f.c)),
    ...[
      ['TestServingJudgmentRequest', 'part-seven', { id: short, run: short,
        predecessor: short, effectRequest: short }],
      ['TestServingAcceptance', 'part-seven', { id: short, request: short,
        operation: short, answerDigest: short }],
      ['TestServingEffectRequest', 'part-eight', { id: short, run: short,
        message: short, digest: short, attempt: short }],
      ['TestServingOutboundMessage', 'part-eight', { id: short, run: short,
        text: short, purpose: short, sourceResult: short, semanticMessage: short }],
    ].map(([name, owner, fields]) => value(registerOwnedBody({ name: name as string,
      owner: owner as string, currentVersion: 1,
      versions: { 1: { validate: v => ({ ok: true, value: v }) } }, migrations: {},
      decodeCurrent: v => ({ ok: true, value: v }),
    }, { kind: 'object', fields: { type: short, schemaVersion: { kind: 'integer' },
      ...(fields as Record<string, typeof short>) } }, f.c))),
  ] : [];
  const ctx = { ...f.ctx, schemas: [...transportSchemas(host), ...fixtureSchemas],
    ownedBodies: [...value(registerTransportBodies(host, f.c)), ...owned] };
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
  const append = (kind: string, body: Record<string, unknown>, required: readonly string[] = []) =>
    value(authorAndAppend({ kind, schemaVersion: 1, machine: host.machine, principal: json(host.principal),
      provenance: json(host.principal.provenance), at: json(f.clock(now)), body: json(body), required },
    ctx, store, privateKey)).fact;
  const detail = <T>(r: Result<T>) => consumeResult(r, { Success: () => '', Refused: r => r.detail });
  return { ...f, host, ctx, storage, store, spine, api, directory, policy, run, result, input, prepared, head, detail,
    append, active,
    advance: (n: number) => { now += n; }, time: (n: number) => { now = n; }, stop: () => { stopped = true; }, generation: (v: string) => { generation = v; } };
}
