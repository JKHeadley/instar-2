import type { BoundaryContext, Json, Result } from '../index.js';
import { hashBytes } from '../facts/index.js';
import { boundary, ensure, freeze } from './boundary.js';

const legacyJournalOperations = Object.freeze([
  'mint', 'alias', 'reachability', 'bind-pin', 'bind-release', 'ambiguous-send',
  'send-retire', 'send-intent', 'send-intent-resolved',
] as const);

type LegacyJournalOperation = typeof legacyJournalOperations[number];

export interface LegacyConversationDryRunRow {
  readonly line: number;
  readonly sourceHash: string;
  readonly raw: string;
  readonly record: Readonly<Record<string, Json>>;
  readonly operation: LegacyJournalOperation;
  readonly disposition: 'unmappable';
  readonly reason: string;
  readonly missingEvidence: readonly string[];
  readonly importPermitted: false;
  readonly replayPermitted: false;
}

export interface LegacyConversationDryRunReport {
  readonly mode: 'read-only';
  readonly sourceHash: string;
  readonly records: readonly LegacyConversationDryRunRow[];
  readonly imported: 0;
  readonly replayed: 0;
  readonly providerCalls: 0;
}

export interface LegacyConversationDryRunInput {
  readonly source: string;
  readonly maxBytes: number;
  readonly maxRecords: number;
}

const sendEvidenceFields = Object.freeze([
  'payload', '2.0 run', 'OperationDefinition', 'reservation', 'dispatch claim',
  'request digest', 'provider receipt', 'Part Nine assessment', 'final charge closure',
]);

function jsonRecord(raw: string, line: number): Readonly<Record<string, Json>> {
  let parsed: unknown;
  try { parsed = JSON.parse(raw) as unknown; }
  catch { throw new Error(`legacy conversation journal line ${line} is not valid JSON`); }
  ensure(parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed),
    `legacy conversation journal line ${line} must be one exact record object`);
  return parsed as Readonly<Record<string, Json>>;
}

function operationOf(record: Readonly<Record<string, Json>>, line: number): LegacyJournalOperation {
  ensure(typeof record.op === 'string' && (legacyJournalOperations as readonly string[]).includes(record.op),
    `legacy conversation journal line ${line} has an unsupported operation`);
  return record.op as LegacyJournalOperation;
}

function reasonFor(operation: LegacyJournalOperation): Readonly<{ reason: string; missingEvidence: readonly string[] }> {
  if (operation === 'send-intent' || operation === 'ambiguous-send') return {
    reason: 'payload- and receipt-less legacy send is unsupported until the Part Four/Five/Eight import grants land',
    missingEvidence: sendEvidenceFields,
  };
  if (operation === 'send-intent-resolved' || operation === 'send-retire') return {
    reason: 'legacy send assertion is not a Part Eight settlement or non-occurrence proof',
    missingEvidence: sendEvidenceFields,
  };
  return {
    reason: 'legacy conversation route evidence cannot confer a Part Four binding before the owner import grants land',
    missingEvidence: Object.freeze(['verified operator act', 'current standing grant', 'Part Four binding']),
  };
}

/**
 * Bounded inspection of exact 1.x ConversationRegistry JSONL bytes. This boundary
 * deliberately has no owner write port or provider port: it can report records,
 * but cannot import, replay, settle, bind, or send them.
 */
export function dryRunLegacyConversationMigration(input: LegacyConversationDryRunInput,
  context: BoundaryContext): Result<LegacyConversationDryRunReport> {
  return boundary('LegacyConversationMigrationDryRun', input, context, () => {
    ensure(typeof input.source === 'string' && input.source.length > 0,
      'legacy conversation dry run requires source bytes');
    ensure(Number.isSafeInteger(input.maxBytes) && input.maxBytes > 0,
      'legacy conversation dry-run byte bound must be a positive integer');
    ensure(Number.isSafeInteger(input.maxRecords) && input.maxRecords > 0,
      'legacy conversation dry-run record bound must be a positive integer');
    ensure(new TextEncoder().encode(input.source).length <= input.maxBytes,
      'legacy conversation dry run exceeds its byte bound');
    const lines = input.source.split('\n').map((raw, index) => ({ raw, line: index + 1 }))
      .filter(row => row.raw.length > 0);
    ensure(lines.length > 0, 'legacy conversation dry run contains no records');
    ensure(lines.length <= input.maxRecords, 'legacy conversation dry run exceeds its record bound');
    const rows = lines.map(({ raw, line }) => {
      const record = jsonRecord(raw, line);
      const operation = operationOf(record, line);
      const disposition = reasonFor(operation);
      return freeze({ line, sourceHash: hashBytes(raw), raw, record, operation,
        disposition: 'unmappable' as const, reason: disposition.reason,
        missingEvidence: [...disposition.missingEvidence], importPermitted: false as const,
        replayPermitted: false as const });
    });
    return freeze({ mode: 'read-only' as const, sourceHash: hashBytes(input.source), records: rows,
      imported: 0 as const, replayed: 0 as const, providerCalls: 0 as const });
  });
}
