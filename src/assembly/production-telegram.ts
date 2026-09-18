import { decode } from '../index.js';
import type { BoundaryContext, DecodeContext, Result, SecretRef } from '../index.js';
import type { TelegramBotApiCustodianPort } from '../conversation/index.js';
import { boundary, encoded, ensure, take } from './boundary.js';
import { createTelegramBotApiCustodian } from './telegram-bot-api-custodian.js';
import type { TelegramBotApiCustodianOptions, TelegramBridgeReply, TelegramConfinedBridgePort } from './telegram-bot-api-custodian.js';

export interface ProductionTelegramIO {
  invoke(input: Parameters<TelegramConfinedBridgePort['invoke']>[0], credential: string): TelegramBridgeReply;
}
const issued = new WeakSet<object>();
/** Owner-internal query; a copied/proxied worker handle is not a live custodian. */
export const isProductionTelegramCustodian = (port: object): boolean => issued.has(port);

export function createProductionTelegramCustodian(input: Omit<TelegramBotApiCustodianOptions, 'bridge'> & Readonly<{
  context: BoundaryContext & DecodeContext; credential: SecretRef;
  resolveSecret(reference: SecretRef): string; io: ProductionTelegramIO;
}>): Result<TelegramBotApiCustodianPort> {
  return boundary('ProductionTelegramCustodian', null, input.context, () => {
    const reference = take(decode('SecretRef', input.credential, input.context));
    ensure(input.declaration && encoded(input.declaration.token).bytes === encoded(reference).bytes,
      'bot-credential: immutable declaration binding differs');
    let credential: string;
    try { credential = input.resolveSecret(reference); }
    catch { throw Error('bot-credential: SecretRef unresolvable'); }
    ensure(/^[0-9]+:[A-Za-z0-9_-]{20,}$/.test(credential), 'bot-credential: SecretRef unresolvable');
    const io = input.io, expected = encoded(reference).bytes;
    const bridge: TelegramConfinedBridgePort = Object.freeze({ owner: 'part-ten', invoke: (request: Parameters<TelegramConfinedBridgePort['invoke']>[0]) => {
      ensure(encoded(request.token).bytes === expected, 'bot-credential: route cannot select a different SecretRef');
      return io.invoke(request, credential);
    } });
    const custodian = take(createTelegramBotApiCustodian({ context: input.context, declaration: input.declaration,
      ...(input.identityEvidence ? { identityEvidence: input.identityEvidence } : {}), machine: input.machine,
      now: input.now, freshFor: input.freshFor, captures: input.captures, bridge }));
    issued.add(custodian); return custodian;
  });
}
