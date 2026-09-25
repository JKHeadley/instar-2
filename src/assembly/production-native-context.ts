import type { Hash, Result } from '../index.js';
import { consumeResult } from '../index.js';
import type { FactStorePort } from '../facts/index.js';
import { hashBytes } from '../facts/index.js';
import type { EffectHost, OperationAdapterPort } from '../effects/index.js';
import type { TransportAuthority } from '../transport/index.js';
import type { TelegramDurableCapturePort } from './telegram-bot-api-custodian.js';
import { boundary, encoded, ensure, take } from './boundary.js';

export interface ProductionNativeContextIO {
  current(): Readonly<{ identity: string; artifact: Hash }>;
  /** The installed process reads the exact serialized delivery, including every
   * captured message and briefing body, before returning its readback digest. */
  consume(reference: string, bytes: string): Readonly<{ identity: string; digest: Hash }>;
}

/** A physical native context boundary for the in-process Eleven worker. It is
 * callable only behind Eight's actual consumed Six claim. */
export function createProductionNativeContextAdapter(input: Readonly<{
  id: string; harness: string; incarnation: string; artifact: Hash; maxCharge: number; timeout: number;
  host: EffectHost; authority: TransportAuthority; store: FactStorePort;
  captures: TelegramDurableCapturePort; io: ProductionNativeContextIO;
}>): OperationAdapterPort {
  const configured = Object.freeze({ ...input });
  return Object.freeze({ owner: 'part-ten' as const, id: configured.id,
    describe: () => Object.freeze({ contract: 'production-native-context:v1', account: configured.harness,
      conversation: configured.incarnation, maxCharge: configured.maxCharge, timeout: configured.timeout, hiddenRetries: 0 as const }),
    invoke: (request: Parameters<OperationAdapterPort['invoke']>[0]) => boundary('ProductionNativeContext', null, configured.host.boundary, () => {
      const authority = take(configured.authority.inspect());
      const claim = authority.find(row => row.fact.id === request.claim && row.record.type === 'AdmissionReservation'
        && row.record.operation === request.operation && row.record.state === 'dispatch-claimed'
        && row.record.digest === request.digest);
      const reservation = authority.filter(row => row.record.type === 'AdmissionReservation'
        && row.record.operation === request.operation).at(-1);
      ensure(claim && reservation?.record.type === 'AdmissionReservation' && reservation.record.state === 'consumed'
        && reservation.record.digest === request.digest,
      'native-context: exact consumed Six claim required');
      const message = request.message;
      ensure(message.purpose === 'context-delivery' && message.account === configured.harness
        && message.conversation === configured.incarnation && message.context, 'native-context: typed delivery required');
      const observedProcess = configured.io.current();
      ensure(observedProcess.identity.length > 0 && observedProcess.artifact === configured.artifact, 'native-context: process artifact changed');
      const snapshot = take(configured.store.readForProjection());
      const contents = message.context.manifest.map(row => {
        if (row.class === 'message') {
          const bytes = configured.captures.read(row.reference);
          ensure(bytes !== null && hashBytes(bytes) === row.digest, 'native-context: input bytes unavailable');
          return { ...row, bytes };
        }
        const fact = snapshot.entries.find(entry => entry.fact.id === row.reference);
        ensure(fact && !fact.taint.length && !fact.conflicts.length && fact.fact.contentHash === row.digest,
          'native-context: briefing unavailable');
        return { ...row, bytes: encoded(fact.fact.body).bytes };
      });
      const bytes = encoded({ operation: request.operation, digest: request.digest,
        processIdentity: observedProcess.identity, input: message.context.input, text: message.text, contents }).bytes;
      const received = configured.io.consume(`native-context:${request.operation}`, bytes);
      ensure(received.identity === observedProcess.identity && received.digest === hashBytes(bytes)
        && encoded(configured.io.current()).bytes === encoded(observedProcess).bytes, 'native-context: worker readback differs');
      return encoded({ type: 'harness-context-consumed', operation: request.operation,
        digest: request.digest, processIdentity: observedProcess.identity }).bytes;
    }),
    observe: (): Result<string> => boundary('ProductionNativeContextObservation', null, configured.host.boundary, () => {
      throw Error('native-context: observation must resolve Eight\'s recorded original operation');
    }),
  });
}

/** Ten's physical host for the one inherited worker channel (fd 3 in the
 * worker). Non-blocking: `read` returns null when nothing is ready and an empty
 * buffer at end of stream. No path, reconnect or second endpoint exists. */
export interface WorkerChannelIO {
  read(max: number): Uint8Array | null;
  /** Non-blocking: bytes accepted (possibly fewer than offered), or null when
   * the worker is not draining. The adapter owns every wait and its bound. */
  write(bytes: Uint8Array): number | null;
  close(): void;
  now(): number;
  wait(ms: number): void;
}

export const WORKER_CHANNEL_LIMITS = Object.freeze({ frame: 65_536, requests: 32, bytes: 1_048_576, chunk: 32_768, lapseMs: 250 });

type ChannelRequest = Readonly<{ v: 1; sequence: number; handle: string; method: 'loadContext' | 'observeContext';
  authorityReference: string; body: Readonly<{ delivery: string; offset?: number; readback?: string | null }> }>;

/**
 * MUST-FIX 2: the existing native-context IO bound to the one installed worker
 * channel. It serves exactly ONE admitted delivery (the bytes Eight's consumed
 * claim handed to `consume`), streamed in bounded chunks the worker pulls; a
 * chunk never re-dispatches the delivery. Current authority is checked at every
 * actual dispatch and again immediately before returning data; a failed or late
 * (> lapse) check, the original deadline, any protocol deviation or a limit
 * overrun closes the channel permanently, so a retained or queued handle can
 * never regain standing.
 *
 * Every wait (for a worker frame, or for a worker that stops draining replies)
 * consumes the same immutable deadline and the same last-good-authority lapse:
 * once `lapseMs` passes without a successful check, the wait re-checks current
 * authority, so a revocation closes the channel within the lapse even while the
 * worker is silent. `progress` is called only after a successful check; the
 * installed composition forwards it as the native guard heartbeat, so an owner
 * check that never returns stops the heartbeat and the guard (not this
 * callback) enforces the lapse.
 */
export function createInstalledChannelNativeContextIO(input: Readonly<{
  io: WorkerChannelIO; identity: string; artifact: Hash; handle: string;
  /** Genuine current-authority verdict (the fixed monitor recheck). */
  currency(): Result<unknown>;
  /** Original immutable deadline on io.now()'s clock; never extended. */
  deadline: number;
  /** Owner-service progress (the guard heartbeat source); called after each successful check. */
  progress?(): void;
}>): ProductionNativeContextIO & Readonly<{ close(): void; readonly closed: boolean }> {
  const limits = WORKER_CHANNEL_LIMITS;
  let closed = false, sequence = 0, requests = 0, bytesUsed = 0, served: string | undefined;
  let pending = new Uint8Array(0);
  let lastGood = input.io.now();          // lapse is measured from the admission that created the channel
  const close = () => { if (!closed) { closed = true; input.io.close(); } };
  const fail = (detail: string): never => { close(); throw new Error(`worker-channel: ${detail}`); };
  const current = () => {
    if (closed) fail('closed after revocation or expiry');
    const started = input.io.now();
    if (started >= input.deadline) fail('original deadline reached');
    consumeResult(input.currency(), { Success: () => undefined,
      Refused: refusal => fail(`current authority refused: ${refusal.detail}`) });
    const finished = input.io.now();
    if (finished - started > limits.lapseMs || finished >= input.deadline) fail('current-authority check exceeded the lapse bound');
    lastGood = finished;
    input.progress?.();
  };
  // One bounded wait step, shared by frame reads and reply backpressure.
  const waitBounded = (what: string) => {
    const now = input.io.now();
    if (now >= input.deadline) fail(`original deadline reached while ${what}`);
    if (now - lastGood >= limits.lapseMs) current();   // revocation lands within the lapse while idle
    input.io.wait(1);
  };
  const debit = (count: number) => {
    bytesUsed += count;
    if (bytesUsed > limits.bytes) fail('channel byte budget exhausted');
  };
  const readFrame = (): ChannelRequest => {
    for (;;) {
      if (pending.length >= 4) {
        const length = new DataView(pending.buffer, pending.byteOffset, 4).getUint32(0);
        if (length === 0 || length > limits.frame) fail('invalid worker frame length');
        if (pending.length >= 4 + length) {
          const payload = Buffer.from(pending.subarray(4, 4 + length)).toString('utf8');
          pending = pending.slice(4 + length);
          if (pending.length) fail('worker sent more than one outstanding request');
          let parsed: unknown;
          try { parsed = JSON.parse(payload); } catch { return fail('worker frame is not JSON'); }
          if (encoded(parsed).bytes !== payload) fail('noncanonical worker frame');
          return parsed as ChannelRequest;
        }
      }
      if (input.io.now() >= input.deadline) fail('original deadline reached while waiting');
      const chunk = input.io.read(limits.frame + 4 - pending.length);
      if (chunk === null) { waitBounded('waiting'); continue; }
      if (chunk.length === 0) fail('worker closed the channel');
      debit(chunk.length);
      const next = new Uint8Array(pending.length + chunk.length);
      next.set(pending); next.set(chunk, pending.length); pending = next;
    }
  };
  const reply = (value: unknown) => {
    const payload = Buffer.from(encoded(value).bytes, 'utf8');
    if (payload.length > limits.frame) fail('reply frame too large');
    debit(payload.length + 4);
    const out = Buffer.alloc(payload.length + 4);
    out.writeUInt32BE(payload.length); payload.copy(out, 4);
    let offset = 0;
    while (offset < out.length) {
      const accepted = input.io.write(out.subarray(offset));
      if (accepted === null || accepted === 0) { waitBounded('the worker is not draining replies'); continue; }
      offset += accepted;
    }
  };
  const request = (reference: string): ChannelRequest => {
    const value = readFrame();
    if (++requests > limits.requests) fail('channel request budget exhausted');
    const keys = value && typeof value === 'object' ? Object.keys(value).sort().join(',') : '';
    if (keys !== 'authorityReference,body,handle,method,sequence,v' || value.v !== 1) fail('closed request shape required');
    if (value.sequence !== ++sequence) fail('out-of-order or duplicate frame');
    if (value.handle !== input.handle) fail('handle is not this launch\'s channel');
    if (value.method !== 'loadContext' && value.method !== 'observeContext') fail('method not in the fixed allowlist');
    if (value.authorityReference !== reference || value.body?.delivery !== reference) fail('request names another delivery');
    return value;
  };
  return Object.freeze({
    get closed() { return closed; },
    close,
    current: () => { if (closed) fail('closed after revocation or expiry'); return Object.freeze({ identity: input.identity, artifact: input.artifact }); },
    consume(reference: string, bytes: string) {
      if (served !== undefined) fail('a second initial delivery refuses');
      served = reference;
      const payload = Buffer.from(bytes, 'utf8'), total = payload.length, digest = hashBytes(bytes);
      let offset = 0;
      for (;;) {
        const next = request(reference);
        if (next.method !== 'loadContext') fail('delivery must complete before observation');
        const body = next.body;
        if (Object.keys(body).sort().join(',') !== 'delivery,offset,readback' || body.offset !== offset)
          fail('rewind, skip or malformed load request');
        current();                                   // at the actual dispatch
        if (offset < total) {
          if (body.readback !== null) fail('readback before complete input');
          const end = Math.min(total, offset + limits.chunk);
          const data = payload.subarray(offset, end);
          current();                                 // again before returning data
          reply({ v: 1, sequence: next.sequence, disposition: 'data', body: { delivery: reference, offset,
            totalBytes: total, digest, bytes: data.toString('base64') } });
          offset = end;
          continue;
        }
        if (typeof body.readback !== 'string') fail('final request must carry the complete-input readback');
        current();
        reply({ v: 1, sequence: next.sequence, disposition: 'accepted',
          body: { delivery: reference, evidenceReference: `native-context:${reference}:${body.readback}` } });
        return Object.freeze({ identity: input.identity, digest: body.readback as Hash });
      }
    },
  });
}
