import type { BoundaryContext, Result } from '../index.js';
import type { DispatchClaim, FenceToken, TransportAuthority } from './contracts.js';
import { boundary, ensure, take } from './boundary.js';

type Invocation = <T>(claim: DispatchClaim, fence: FenceToken, invoke: () => T) => Result<T>;
const issuers = new WeakMap<object, Invocation>();
export function bindDispatchInvocation(authority: object, invoke: Invocation): void { issuers.set(authority, invoke); }
/** Final one-use Six check; the consumer must invoke directly without intervening callbacks. */
export function invokeConsumedDispatch<T>(authority: TransportAuthority<unknown>, claim: DispatchClaim,
  fence: FenceToken, context: BoundaryContext, invoke: () => T): Result<T> {
  return boundary('ConsumedDispatchInvocation', { operation: claim?.operation, fence }, context, () => {
    const issuer = issuers.get(authority);
    ensure(issuer, 'genuine Six invocation authority required');
    return take(issuer(claim, fence, invoke));
  });
}
