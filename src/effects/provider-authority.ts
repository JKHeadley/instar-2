import type { BoundaryContext, OwnedReference, Result } from '../index.js';
import type { Capture } from '../judgment/index.js';
import { boundary, ensure } from './boundary.js';
export interface ProviderReceipt {
  readonly request: OwnedReference<'part-seven', 'JudgmentRequest'>;
  readonly effectRequest: string; readonly attempt: string; readonly digest: string; readonly operation: string;
  readonly reservation: string; readonly claim: string; readonly observation: string; readonly capture: Capture;
}
const receipts = new WeakSet<object>();
export function withProviderReceipt<T>(value: ProviderReceipt, use: () => T): T {
  receipts.add(value); try { return use(); } finally { receipts.delete(value); }
}
export function consumeProviderReceipt<T>(value: ProviderReceipt, c: BoundaryContext, use: (value: ProviderReceipt) => T): Result<T> {
  return boundary('ConsumeGuardedProviderReceipt', null, c, () => {
    ensure(receipts.has(value), 'receipt requires guarded Eight executor'); receipts.delete(value); return use(value);
  });
}
