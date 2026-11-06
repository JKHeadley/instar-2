// Rule 63: only Eight's current, consumed Six handoff may enter the confined driver.
// The token is live only on that synchronous call stack; JSON copies never carry it.
import type { BoundaryContext, Result } from '../index.js';
import type { ProcessControlInvocation } from './contracts.js';
import { boundary, ensure } from './boundary.js';
const active = new WeakSet<object>();
export function withProcessControlInvocation<T>(input: ProcessControlInvocation, invoke: () => T): T {
  active.add(input);
  try { return invoke(); } finally { active.delete(input); }
}
export function consumeProcessControlInvocation<T>(input: ProcessControlInvocation, context: BoundaryContext,
  consumer: (input: ProcessControlInvocation) => T): Result<T> {
  return boundary('ProcessControlInvocation', input, context, () => {
    ensure(active.has(input), 'process driver requires current Eight/Six handoff');
    active.delete(input); // one driver call even on reentry
    return consumer(input);
  });
}
