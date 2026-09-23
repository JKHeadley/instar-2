import type { BoundaryContext, Result, RunReference } from '../index.js';
import type { RunGraphPort } from '../rungraph/index.js';
import type { FenceToken, LoopPolicy, LoopRecord, RunPairAdmission, TransportAuthority, TransportHost } from './contracts.js';
import { boundary, encoded, ensure, take } from './boundary.js';

type Admit = (graph: RunGraphPort, command: string, fence: FenceToken, reply: RunReference, policy: LoopPolicy) => Result<LoopRecord>;
const issuers = new WeakMap<object, Admit>();
const tickets = new WeakMap<TransportHost, string>();
export function bindRunPairIssuer(authority: object, admit: Admit): void { issuers.set(authority, admit); }
export function withRunPairAdmission<T>(host: TransportHost, record: RunPairAdmission, commit: () => T): T {
  ensure(!tickets.has(host), 'pair admission already active');
  tickets.set(host, encoded(record).hash);
  try { return commit(); } finally { tickets.delete(host); }
}
export function requireRunPairAdmission(host: TransportHost, record: RunPairAdmission): void {
  ensure(tickets.get(host) === encoded(record).hash, 'pair admission requires genuine Five consumption');
}
/** The existing Six issuer alone admits Five's exact reply, in its existing store. */
export function admitAcceptedProviderReply(authority: TransportAuthority<unknown>, graph: RunGraphPort,
  command: string, fence: FenceToken, reply: RunReference, policy: LoopPolicy,
  context: BoundaryContext): Result<LoopRecord> {
  return boundary('AcceptedProviderReplyAdmission', { command, fence, reply, policy }, context, () => {
    const admit = issuers.get(authority);
    ensure(admit, 'genuine Six authority required');
    // Preserve the producer's Result without turning a refusal into a value.
    return take(admit(graph, command, fence, reply, policy));
  });
}
