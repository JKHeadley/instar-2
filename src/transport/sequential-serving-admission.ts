import type { BoundaryContext, Result } from '../index.js';
import type { FenceToken, ServingRecord, TransportAuthority, TransportHost } from './contracts.js';
import { boundary, encoded, ensure, freeze, take } from './boundary.js';

export interface ServingBinding {
  readonly installation: string; readonly conversation: string;
  readonly ceiling: number; readonly maxTurns: number; readonly maxReplies: number;
  readonly expires: number; readonly providerMax: number; readonly replyMax: number;
  readonly errorLimit: number; readonly totalErrorLimit: number;
}
export interface ServingView {
  readonly binding: ServingRecord | null; readonly slot: string | null;
  readonly retired: readonly string[];
  readonly turns: number; readonly replies: number; readonly totalErrors: number;
  readonly consecutiveErrors: number; readonly pendingAttempt: string | null;
  readonly stopped: boolean;
}
export interface SequentialServingAdmissionPort {
  readonly owner: 'part-six';
  /** Ten's current-process supervisor; absence fails closed after restart. */
  registerQuiescence(check: (run: string) => boolean): Result<void>;
  bind(command: string, fence: FenceToken, binding: ServingBinding): Result<ServingRecord>;
  admitTurn(command: string, fence: FenceToken, input: string, provider: string): Result<ServingRecord>;
  retire(command: string, fence: FenceToken, provider: string, operation: string): Result<ServingRecord>;
  start(command: string, fence: FenceToken, attempt: string, provider: string): Result<ServingRecord>;
  result(command: string, fence: FenceToken, attempt: string, outcome: 'success' | 'error', operation: string): Result<ServingRecord>;
  inspect(): Result<ServingView>;
}

const issued = new WeakSet<object>();
export const isSequentialServingAdmission = (value: object): boolean => issued.has(value);
type Issuer = Readonly<{
  registerQuiescence(check: (run: string) => boolean): Result<void>;
  bind(command: string, fence: FenceToken, binding: ServingBinding): Result<ServingRecord>;
  admit(command: string, fence: FenceToken, input: string, provider: string): Result<ServingRecord>;
  retire(command: string, fence: FenceToken, provider: string, operation: string): Result<ServingRecord>;
  start(command: string, fence: FenceToken, attempt: string, provider: string): Result<ServingRecord>;
  result(command: string, fence: FenceToken, attempt: string, outcome: 'success' | 'error', operation: string): Result<ServingRecord>;
  inspect(): Result<ServingView>;
}>;
const issuers = new WeakMap<object, Issuer>();
const tickets = new WeakMap<TransportHost, string>();
export function withServingRecord<T>(host: TransportHost, record: ServingRecord, commit: () => T): T {
  ensure(!tickets.has(host), 'serving record already active');
  tickets.set(host, encoded(record).hash);
  try { return commit(); } finally { tickets.delete(host); }
}
export function requireServingRecord(host: TransportHost, record: ServingRecord): void {
  ensure(tickets.get(host) === encoded(record).hash, 'serving record requires Six issuer');
}
export function bindServingIssuer(authority: object, issuer: Issuer): void {
  ensure(!issuers.has(authority), 'serving issuer already bound'); issuers.set(authority, issuer);
}
/** A structural lookalike cannot obtain Six's private conditional writer. */
export function createSequentialServingAdmission(authority: TransportAuthority<unknown>, context: BoundaryContext): SequentialServingAdmissionPort {
  const issuer = issuers.get(authority);
  ensure(issuer, 'genuine Six authority required');
  const port = freeze({ owner: 'part-six' as const,
    registerQuiescence: (check: (run: string) => boolean) => boundary('ServingQuiescence', null, context,
      () => take(issuer.registerQuiescence(check))),
    bind: (command: string, fence: FenceToken, binding: ServingBinding) => boundary('ServingBind', binding, context,
      () => take(issuer.bind(command, fence, binding))),
    admitTurn: (command: string, fence: FenceToken, input: string, provider: string) => boundary('ServingAdmitTurn',
      { command, input, provider }, context, () => take(issuer.admit(command, fence, input, provider))),
    retire: (command: string, fence: FenceToken, provider: string, operation: string) => boundary('ServingRetire',
      { command, provider, operation }, context, () => take(issuer.retire(command, fence, provider, operation))),
    start: (command: string, fence: FenceToken, attempt: string, provider: string) => boundary('ServingAttemptStart',
      { command, attempt, provider }, context, () => take(issuer.start(command, fence, attempt, provider))),
    result: (command: string, fence: FenceToken, attempt: string, outcome: 'success' | 'error', operation: string) =>
      boundary('ServingAttemptResult', { command, attempt, outcome }, context,
        () => take(issuer.result(command, fence, attempt, outcome, operation))),
    inspect: () => boundary('ServingInspect', null, context, () => take(issuer.inspect())),
  });
  issued.add(port); return port;
}

export function servingView(records: readonly ServingRecord[]): ServingView {
  let binding: ServingRecord | null = null, slot: string | null = null;
  const retired: string[] = [];
  let turns = 0, replies = 0, totalErrors = 0, consecutiveErrors = 0;
  let pendingAttempt: string | null = null, stopped = false;
  for (const row of records) {
    if (row.action === 'bind') binding = row;
    if (row.action === 'admit') { slot = row.provider; turns++; }
    if (row.action === 'retire') { slot = null; retired.push(row.provider); if (row.reply) replies++; }
    if (row.action === 'start') pendingAttempt = row.attempt;
    if (row.action === 'result') {
      pendingAttempt = null;
      if (row.outcome === 'error') { totalErrors++; consecutiveErrors++; }
      else consecutiveErrors = 0;
    }
    if (binding && (totalErrors >= binding.totalErrorLimit || consecutiveErrors >= binding.errorLimit)) stopped = true;
  }
  return freeze({ binding, slot, retired, turns, replies, totalErrors, consecutiveErrors, pendingAttempt, stopped });
}
