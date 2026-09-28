import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { consumeResult, defineDecoder, deriveThrough } from '../../src/index.js';
import type { Result } from '../../src/index.js';
import { createFactStore } from '../../src/facts/index.js';
import type { SegmentStoragePort } from '../../src/facts/index.js';
import { createResourceSetAuthority, createResourceSetSpine, createTransportAuthority, createTransportSpine, decodeLoopPolicy,
  registerResourceSetBodies, registerTransportBodies, resourceDomainHead, resourceSetRows, resourceSetSchemas, transportSchemas } from '../../src/transport/index.js';
import type { FenceToken, ResourceDemand, ResourceDomainPolicy, ResourceSetHost, ResourceSetSpine } from '../../src/transport/index.js';
import { factsFixture, privateKey, value } from '../facts/fixtures.js';
// @ts-expect-error Reference host is JavaScript, outside pure core compilation.
import { createTransportFileStorage } from '../../scripts/transport-file-storage.mjs';

/** One Six authority with the resource-set addendum over real P2 file storage. */
export function resourceSetFixture(directory = mkdtempSync(join(tmpdir(), 'p6-rs-')), authority = 'authority:1',
  policies: ResourceDomainPolicy[] = []) {
  const f = factsFixture();
  let now = 100;
  const domains = { list: policies };
  /** Each launch keeps its ordinary AdmissionReservation in its own single-run Six domain and store. */
  const launches = new Map<string, ReturnType<typeof createTransportAuthority>>();
  const host: ResourceSetHost = { domain: 'host-resources', machine: 'machine-a', incarnation: `worker:${authority}`,
    authorityIncarnation: authority, principal: f.alice, scope: f.scope, maxLeaseTerm: 100000, budget: 0,
    monotonic: () => now, resourceDomains: () => domains.list,
    resolveReservation: reference => {
      for (const authority of launches.values()) {
        const found = value(authority.inspect()).filter(v => v.record.type === 'AdmissionReservation'
          && v.record.operation === reference.id).at(-1);
        if (!found || found.record.type !== 'AdmissionReservation') continue;
        const unresolved = value(authority.inspect()).some(v => v.record.type === 'SettlementApplication'
          && v.record.operation === reference.id && v.record.unresolved !== 0);
        return { reservation: found.record, fact: found.fact.id, settlementUnresolved: unresolved };
      }
      return undefined;
    },
    current: () => {
      const gen = { owner: 'part-three' as const, name: 'RegisterGeneration' as const, id: 'generation:1' };
      return { decode: { ...f.ctx.decode, register: { ...f.ctx.decode.register, generation: gen } }, clock: f.clock(100), generation: gen, stopped: false };
    } };
  const result = <T>(run: () => T): Result<T> => {
    const decoder = value(defineDecoder<T, typeof f.c>({ name: 'FileReceipt', owner: 'part-ten', currentVersion: 1,
      versions: { 1: { validate: v => ({ ok: true, value: v }) } }, migrations: {},
      decodeCurrent: () => { try { return { ok: true, value: run() }; } catch (error) { return { ok: false, detail: String(error) }; } },
    }, f.c.preserved));
    return deriveThrough(decoder, { type: 'FileReceipt', schemaVersion: 1 }, f.c);
  };
  const storage: SegmentStoragePort = createTransportFileStorage(directory, result);
  /** One launch's own Six domain: lease, loop, and its ordinary prepared reservation. */
  const launch = (id: string) => {
    const lh = { ...host, domain: `launch:${id}` };
    const lctx = { ...f.ctx, schemas: transportSchemas(lh), ownedBodies: value(registerTransportBodies(lh, f.c)) };
    const lstore = createFactStore(lctx, createTransportFileStorage(join(directory, `launch-${id}`), result));
    const authority = createTransportAuthority(lh, createTransportSpine(lh, { context: lctx, privateKey }, lstore), f.c);
    launches.set(id, authority);
    const fence = value(authority.acquire(`acquire:${id}`, '', 90000));
    const op = reservationIn(authority, fence, id);
    return { authority, fence, op };
  };
  const ctx = { ...f.ctx, schemas: [...transportSchemas(host), ...resourceSetSchemas(host)],
    ownedBodies: [...value(registerTransportBodies(host, f.c)), ...value(registerResourceSetBodies(host, f.c))] };
  const store = createFactStore(ctx, storage);
  const six = createTransportAuthority(host, createTransportSpine(host, { context: ctx, privateKey }, store), f.c);
  const base = createResourceSetSpine(host, { context: ctx, privateKey }, store);
  /** Appends allowed before a simulated crash; Infinity means no crash. */
  const crash = { after: Infinity };
  const spine: ResourceSetSpine = { store, append: (record, required) => {
    if (crash.after <= 0) throw Error('simulated crash before append');
    crash.after--;
    return base.append(record, required);
  } };
  const sets = createResourceSetAuthority(host, spine, f.c);
  const policy = value(decodeLoopPolicy({ type: 'LoopPolicy', schemaVersion: 1, id: 'loop-policy:host', maxAttempts: 1,
    minDelay: 1, maxDuration: 100000, timeout: 100000, concurrency: 1, failDirection: 'closed', breaker: 'stub-closed' }, f.c));
  const facts = () => value(store.read());
  const rowsNow = () => resourceSetRows(facts(), host.domain);
  const head = (domain: string) => resourceDomainHead(rowsNow(), domain);
  const demand = (dimension: ResourceDemand['dimension'], domain: string, resource: string, amount: number, policyRef = `policy:${domain}`): ResourceDemand =>
    ({ dimension, domain, resource, amount, policy: policyRef, expectedPredecessor: head(domain) });
  const acquire = (command = `acquire:${authority}`): FenceToken =>
    value(six.acquire(command, value(six.inspect()).at(-1)?.fact.id ?? '', 90000));
  const request = (id: string) => ({ owner: 'part-eight' as const, name: 'EffectRequest' as const, id });
  const run = (id: string) => ({ owner: 'part-five' as const, name: 'Run' as const, id });
  /** The ordinary AdmissionReservation for one launch (charge zero: resources, not spend). */
  function reservationIn(authority: ReturnType<typeof createTransportAuthority>, fence: FenceToken, id: string) {
    value(authority.schedule(`schedule:${id}`, fence, run(id), policy));
    return value(authority.reserve({ command: `reserve:${id}`, fence, request: request(id), attempt: 'attempt:1',
      payloadDigest: `sha256:${'b'.repeat(64)}`, charge: 0, run: run(id), semanticMessage: `message:${id}`,
      durability: 'local-durable', replicas: 0 }));
  }
  const reservation = (fence: FenceToken, id: string) => reservationIn(six, fence, id);
  return { ...f, host, six, sets, launch, store, ctx, crash, domains, directory, demand, head, acquire, request, run, reservation, rowsNow,
    advance: (n: number) => { now += n; } };
}
export const setRef = (id: string) => ({ owner: 'part-six' as const, name: 'ResourceAllocationSet' as const, id });
export const reservationRef = (id: string) => ({ owner: 'part-six' as const, name: 'AdmissionReservation' as const, id });
