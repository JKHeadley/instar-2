// Journal-host composition of Eight's four-test admission and Six's durable
// reservation/claim/consume. Like six-host-resources, the preview uses the
// fixture signing identity; this is not evidence of independently held keys.
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { canonical, consumeResult, defineDecoder, deriveThrough } from '../../src/index.js';
import type { Result } from '../../src/index.js';
import { authorAndAppend, createFactStore } from '../../src/facts/index.js';
import { createTransportAuthority, createTransportSpine, decodeLoopPolicy, registerTransportBodies,
  transportSchemas } from '../../src/transport/index.js';
import type { TransportHost } from '../../src/transport/index.js';
import { factsFixture, privateKey, json } from '../facts/fixtures.js';
import type { TelegramInboundMedia } from './telegram-media.js';
// @ts-expect-error The existing physical storage adapter lives outside pure core.
import { createTransportFileStorage } from '../../scripts/transport-file-storage.mjs';
// @ts-expect-error The live four-test effect boundary is shared with tool admission.
import { admitEffect, decodeEffectPolicy, DEFAULT_EFFECT_POLICY } from './effect-doorway.mjs';

export const MEDIA_OPERATION = Object.freeze({ operation: 'fetch-inbound-media', effect: 'telegram:fetch-inbound-media',
  target: 'api.telegram.org', custodian: 'journal-host:telegram-bot', maxBytes: 8 * 1024 * 1024,
  metadataBytes: 16 * 1024, storeBytes: 96 * 1024 * 1024, timeout: 20_000, requests: 2, retries: 0,
  consequence: 'data', reversibility: 'reversible', reach: 'world', costUsd: 0 });
export interface MediaSource {
  readonly grant: string; readonly account: string; readonly conversation: string; readonly intakeDigest: string;
}
export interface MediaDispatch {
  readonly account: string;
  current(): void;
  request<T>(stage: 'metadata' | 'bytes', invoke: () => T): T;
}
export interface MediaAdmission { admit(source: string, media: TelegramInboundMedia): MediaDispatch }
const admissions = new WeakSet<object>();
export const isMediaAdmission = (value: unknown): value is MediaAdmission =>
  typeof value === 'object' && value !== null && admissions.has(value);
const take = <T>(r: Result<T>): T => consumeResult(r, { Success: v => v, Refused: r => { throw Error(r.detail); } });
const digest = (value: unknown) => take(canonical(value)).hash;

/** `source` re-reads verified durable intake. The operator's installed conversation
 * grant covers retrieving its inbound files, never arbitrary network reads. An
 * installed policy can narrow that grant; unreadable policy refuses, including
 * after reservation. No model or caller can supply its own policy/claim. */
export function createMediaAdmission(options: {
  root: string; incarnation: string; now(): number; monotonic(): number; stopped(): boolean;
  source(source: string, media: TelegramInboundMedia): MediaSource;
  policy(): unknown;
}): MediaAdmission {
  const admission: MediaAdmission = { admit(source, media) {
    const origin = options.source(source, media);
    if (!origin.grant || !origin.account || !origin.conversation || !origin.intakeDigest || !media.fileId)
      throw Error('media admission: exact source required');
    const plan = { ...MEDIA_OPERATION, source, ...origin, file: digest(media.fileId), size: media.size };
    const identity = createHash('sha256').update(source).digest('hex'), started = options.monotonic();
    const decision = () => {
      if (options.stopped() || options.monotonic() - started >= MEDIA_OPERATION.timeout
        || digest(options.source(source, media)) !== digest(origin)) throw Error('media admission: revoked');
      const policy = decodeEffectPolicy(options.policy());
      // The exact installed operation is classified, never a caller's network tool.
      // A configured registration may narrow it, and configured sensitivity/grants
      // are read afresh at each physical boundary.
      const effective = { ...policy,
        registered: [...policy.registered, { effect: MEDIA_OPERATION.effect, target: MEDIA_OPERATION.target,
          consequence: MEDIA_OPERATION.consequence, reversibility: MEDIA_OPERATION.reversibility,
          reach: MEDIA_OPERATION.reach, costUsd: 0, source: 'operation:fetch-inbound-media:v1' }],
        grants: [...policy.grants, { id: origin.grant, effect: MEDIA_OPERATION.effect, target: MEDIA_OPERATION.target,
          approves: ['scope'], source: origin.intakeDigest, custodian: MEDIA_OPERATION.custodian,
          recovery: 'Retain intake and encrypted custody; an uncertain claimed fetch is not retried.' }] };
      const verdict = admitEffect({ effect: MEDIA_OPERATION.effect, target: MEDIA_OPERATION.target }, effective, [], { now: options.now() });
      if (!verdict.admitted) throw Error('media admission: effect policy refused');
      return { policy: effective, verdict };
    };
    const admitted = decision();
    const current = () => {
      if (digest(decision()) !== digest(admitted)) throw Error('media admission: recorded policy changed');
    };
    const f = factsFixture(), generation = f.ctx.decode.register.generation;
    const host: TransportHost = { domain: `media:${identity}`, machine: 'machine-a', incarnation: options.incarnation,
      authorityIncarnation: options.incarnation, principal: f.alice, scope: f.scope, maxLeaseTerm: MEDIA_OPERATION.timeout,
      budget: 0, monotonic: () => Math.floor(options.monotonic()),
      current: () => ({ decode: f.ctx.decode, clock: f.clock(100), generation, stopped: options.stopped() }) };
    const context = { ...f.ctx, schemas: [...transportSchemas(host), { ...f.schema, kind: 'media-request',
      fields: { request: { kind: 'text' as const, maxLength: 65536 } } }],
      ownedBodies: take(registerTransportBodies(host, f.c)) };
    const result = <T>(run: () => T): Result<T> => {
      const decoder = take(defineDecoder<T, typeof f.c>({ name: 'MediaFileReceipt', owner: 'part-ten', currentVersion: 1,
        versions: { 1: { validate: v => ({ ok: true, value: v }) } }, migrations: {}, decodeCurrent: () => {
          try { return { ok: true, value: run() }; } catch { return { ok: false, detail: 'media claim storage refused' }; }
        } }, f.c.preserved));
      return deriveThrough(decoder, { type: 'MediaFileReceipt', schemaVersion: 1 }, f.c);
    };
    const store = createFactStore(context, createTransportFileStorage(join(options.root, 'media-claims', identity), result));
    const six = createTransportAuthority(host, createTransportSpine(host, { context, privateKey }, store), f.c);
    // A crash can leave an uncertain request. Reuse of already encrypted bytes is
    // handled by custody before admission; absent bytes never mint another claim.
    if (take(store.read()).length) throw Error('media admission: prior attempt retained; no retry');
    take(authorAndAppend({ kind: 'media-request', schemaVersion: 1, machine: host.machine,
      principal: json(host.principal), provenance: json(host.principal.provenance), at: json(f.now),
      body: { request: JSON.stringify({ plan, ...admitted }) }, required: [] }, context, store, privateKey));
    const fence = take(six.acquire(`acquire:${identity}`, '', MEDIA_OPERATION.timeout));
    const run = { owner: 'part-five' as const, name: 'Run' as const, id: `media:${identity}` };
    const policy = take(decodeLoopPolicy({ type: 'LoopPolicy', schemaVersion: 1, id: 'fetch-inbound-media', maxAttempts: 1,
      minDelay: 1, maxDuration: MEDIA_OPERATION.timeout, timeout: MEDIA_OPERATION.timeout, concurrency: 1,
      failDirection: 'closed', breaker: 'stub-closed' }, f.c));
    take(six.schedule(`schedule:${identity}`, fence, run, policy));
    const reservation = take(six.reserve({ command: `reserve:${identity}`, fence,
      request: { owner: 'part-eight', name: 'EffectRequest', id: `fetch-inbound-media:${digest(plan)}` },
      attempt: 'attempt:1', payloadDigest: digest(plan), charge: 0, run, semanticMessage: source,
      durability: 'local-durable', replicas: 0 }));
    current();
    const claim = take(six.claim(`claim:${identity}`, fence, reservation.operation));
    let stage = 0;
    return Object.freeze({ account: origin.account, current, request: <T>(next: 'metadata' | 'bytes', invoke: () => T): T => {
      current();
      if (next !== (stage === 0 ? 'metadata' : stage === 1 ? 'bytes' : null)) throw Error('media admission: request already consumed');
      if (stage === 0) take(six.consume(claim, fence));
      current(); stage++;
      return invoke();
    } });
  } };
  admissions.add(admission);
  return Object.freeze(admission);
}

export { DEFAULT_EFFECT_POLICY };
