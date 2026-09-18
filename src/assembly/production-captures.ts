import type { BoundaryContext, Result } from '../index.js';
import { hashBytes } from '../facts/index.js';
import type { CapturedContent } from '../facts/index.js';
import type { Capture, CaptureCapacity, JudgmentCapturePort } from '../judgment/index.js';
import type { TelegramDurableCapturePort } from './telegram-bot-api-custodian.js';
import { boundary, encoded, ensure } from './boundary.js';

/** Provider receipt capacity is reserved durably before dispatch. The root's
 * exclusive process lease serializes this append-only capacity journal. A dead
 * process's reservations remain charged; restart never guesses them free. */
export function createProductionJudgmentCaptures(input: Readonly<{
  custody: TelegramDurableCapturePort; context: BoundaryContext; capacity: number;
  metadata: Record<string, CapturedContent>; decodeCaptures: Record<string, string>;
}>): Result<JudgmentCapturePort> {
  return boundary('ProductionJudgmentCaptureConstruction', null, input.context, () => {
    const { custody, context, capacity, metadata, decodeCaptures } = input;
    ensure(Number.isSafeInteger(capacity) && capacity > 0, 'provider-captures: finite positive capacity required');
    const preserve = (reference: string, bytes: string) => {
      ensure(custody.preserve(reference, bytes) && custody.read(reference) === bytes,
        'provider-captures: durable custody unavailable');
    };
    preserve('production-provider-capacity-policy', encoded({ capacity }).bytes);
    const issued = new WeakMap<object, Readonly<{ id: string; maxBytes: number }>>();
    const journal = () => {
      let count = 0, used = 0;
      for (;;) {
        const bytes = custody.read(`production-provider-capacity:${count}`);
        if (bytes === null) break;
        const row = JSON.parse(bytes) as { id: string; maxBytes: number };
        ensure(row.id === String(count) && Number.isSafeInteger(row.maxBytes) && row.maxBytes >= 0,
          'provider-captures: corrupt capacity journal');
        used += row.maxBytes; count++;
        ensure(Number.isSafeInteger(used) && used <= capacity, 'provider-captures: capacity exceeded');
      }
      return { count, used };
    };
    journal();
    const reserve = (maxBytes: number): CaptureCapacity => {
      ensure(Number.isSafeInteger(maxBytes) && maxBytes > 0, 'provider-captures: positive reservation required');
      const { count, used } = journal();
      ensure(used + maxBytes <= capacity, 'provider-captures: capacity exhausted; prior liability retained');
      const slot = Object.freeze({ id: String(count), maxBytes });
      preserve(`production-provider-capacity:${count}`, encoded(slot).bytes);
      issued.set(slot, slot); return slot as CaptureCapacity;
    };
    const captureFor = (bytes: string): Capture => {
      const hash = hashBytes(bytes); return Object.freeze({ reference: `judgment-capture:${hash}`, hash });
    };
    const read = (capture: Capture): string => {
      ensure(/^sha256:[a-f0-9]{64}$/.test(capture.hash)
        && capture.reference === `judgment-capture:${capture.hash}`, 'provider-captures: invalid reference');
      const bytes = custody.read(capture.reference);
      ensure(bytes !== null && hashBytes(bytes) === capture.hash, 'provider-captures: absent or changed bytes');
      metadata[capture.reference] = { bytes, hash: capture.hash, byteLength: Buffer.byteLength(bytes), status: 'available' };
      decodeCaptures[capture.reference] = bytes;
      return bytes;
    };
    const putReserved = (token: CaptureCapacity, bytes: string): Capture => {
      const slot = issued.get(token);
      ensure(slot && typeof bytes === 'string' && Buffer.byteLength(bytes) <= slot.maxBytes,
        'provider-captures: unissued or exceeded reservation');
      const capture = captureFor(bytes);
      // Bind before writing bytes. A cut can strand reserved space, never release
      // it or permit this reservation to fund a different provider response.
      preserve(`production-provider-capacity-binding:${slot.id}`, encoded(capture).bytes);
      preserve(capture.reference, bytes); read(capture); return capture;
    };
    return Object.freeze({ owner: 'part-ten' as const,
      reserve: (maxBytes: number) => boundary('ProductionCaptureReserve', null, context, () => reserve(maxBytes)),
      putReserved: (token: CaptureCapacity, bytes: string) => boundary('ProductionCaptureReservedWrite', null, context,
        () => putReserved(token, bytes)),
      put: (bytes: string, maxBytes: number) => boundary('ProductionCaptureWrite', null, context, () => {
        ensure(typeof bytes === 'string' && Number.isSafeInteger(maxBytes) && maxBytes >= 0
          && Buffer.byteLength(bytes) <= maxBytes, 'provider-captures: byte bound exceeded');
        const capture = captureFor(bytes);
        if (custody.read(capture.reference) !== null) { read(capture); return capture; }
        return putReserved(reserve(Math.max(1, Buffer.byteLength(bytes))), bytes);
      }),
      read: (capture: Capture) => boundary('ProductionCaptureRead', null, context, () => read(capture)),
    });
  });
}
