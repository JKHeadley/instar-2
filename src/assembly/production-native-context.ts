import type { Hash, Result } from '../index.js';
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
