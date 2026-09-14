import { consumeResult } from '../index.js';
import type { Refused, Result } from '../index.js';
import { createFactStore } from '../facts/index.js';
import type { SegmentStoragePort } from '../facts/index.js';
import { boundary, encoded, ensure, freeze, take } from './boundary.js';
import { assemblyLogicalKey, assemblyRows, compareAssemblyRecords,
  createAssemblySpine, decodeAssemblyRecord, validateAssemblyRecordReferences } from './records.js';
import type { AssemblyAuthor, AssemblyHost, AssemblyRecord, AssemblyRecordName } from './contracts.js';

export interface AssemblyRecordSubject {
  readonly type: AssemblyRecordName;
  readonly field: string;
  readonly value: string;
}

export interface AssemblySubjectFrontier {
  readonly subject: AssemblyRecordSubject;
  readonly facts: readonly string[];
}

export interface ConditionalAssemblyAppendPort {
  readonly owner: 'part-ten';
  appendIfSubjectFrontier<N extends AssemblyRecordName>(
    name: N,
    record: unknown,
    expected: AssemblySubjectFrontier,
  ): Result<Extract<AssemblyRecord, { type: N }>>;
}

export interface ConditionalAssemblyAppendDependencies {
  readonly host: AssemblyHost;
  readonly author: AssemblyAuthor;
  readonly storage: SegmentStoragePort;
}

function sameFacts(left: readonly string[], right: readonly string[]): boolean {
  return encoded([...left].sort()).bytes === encoded([...right].sort()).bytes;
}

function physicalHead(storage: SegmentStoragePort): string | null {
  const raw = storage.read().at(-1);
  if (raw === undefined) return null;
  ensure(raw !== null && typeof raw === 'object' && !Array.isArray(raw)
    && typeof (raw as { contentHash?: unknown }).contentHash === 'string',
  'physical fact head is malformed');
  return (raw as { contentHash: string }).contentHash;
}

function subjectFacts(rows: ReturnType<typeof assemblyRows>, subject: AssemblyRecordSubject): readonly string[] {
  return rows.filter(row => row.record.type === subject.type
    && (row.record as unknown as Readonly<Record<string, unknown>>)[subject.field] === subject.value)
    .map(row => row.fact.id).sort();
}

function resultParts<T>(result: Result<T>): Readonly<{ ok: true; value: T } | { ok: false; refusal: Refused }> {
  return consumeResult<T, Readonly<{ ok: true; value: T } | { ok: false; refusal: Refused }>>(result, {
    Success: value => ({ ok: true, value }),
    Refused: refusal => ({ ok: false, refusal }),
  });
}

/**
 * Part Ten's subject-scoped conditional append.
 *
 * Each attempt rebuilds through Part Two, pins the physical head that produced
 * the observed subject frontier, and lets Part Two's normal authorAndAppend path
 * cross SegmentStoragePort.append(bytes, expectedHead). A global-head race on an
 * unrelated subject is retried; a changed named subject is refused before its
 * candidate can become durable.
 */
export function createConditionalAssemblyAppendPort(
  dependencies: ConditionalAssemblyAppendDependencies,
): ConditionalAssemblyAppendPort {
  const { host, author, storage } = dependencies;
  ensure(storage.owner === 'part-ten', 'conditional assembly append requires Part Ten physical storage');
  return Object.freeze({ owner: 'part-ten' as const,
    appendIfSubjectFrontier<N extends AssemblyRecordName>(name: N, input: unknown, expected: AssemblySubjectFrontier) {
      return boundary('AssemblyConditionalAppend', { name, input, expected }, host.boundary, () => {
        ensure(expected && expected.subject && expected.subject.type === name,
          'conditional append subject type must match the record type');
        ensure(typeof expected.subject.field === 'string' && /^[A-Za-z][A-Za-z0-9]*$/.test(expected.subject.field)
          && typeof expected.subject.value === 'string' && expected.subject.value.length > 0,
        'conditional append subject is malformed');
        ensure(Array.isArray(expected.facts) && new Set(expected.facts).size === expected.facts.length
          && expected.facts.every(fact => typeof fact === 'string' && fact.length > 0),
        'conditional append frontier is malformed');

        const candidate = take(decodeAssemblyRecord(name, input, host.boundary));
        ensure((candidate as unknown as Readonly<Record<string, unknown>>)[expected.subject.field] === expected.subject.value,
          'conditional append record differs from its named subject');
        validateAssemblyRecordReferences(candidate, host.boundary);

        for (;;) {
          const observedStore = createFactStore(author.context, storage);
          const observedFacts = take(observedStore.read());
          const rows = assemblyRows(observedFacts, host.boundary);
          const current = freeze({ subject: expected.subject, facts: subjectFacts(rows, expected.subject) });
          ensure(sameFacts(current.facts, expected.facts),
            `conditional append subject frontier changed; current=${encoded(current).bytes}`);

          const existing = rows.find(row => row.record.type === name
            && (row.record.id === candidate.id || assemblyLogicalKey(row.record) === assemblyLogicalKey(candidate)));
          if (existing) {
            const comparison = take(compareAssemblyRecords(name, existing.record, candidate, host.boundary));
            ensure(comparison.equal, comparison.conflict?.detail ?? 'assembly identity conflict');
            return existing.record as Extract<AssemblyRecord, { type: N }>;
          }

          const expectedHead = observedFacts.at(-1)?.contentHash ?? null;
          let headMoved = false;
          const pinnedStorage: SegmentStoragePort = {
            owner: 'part-ten',
            read: () => storage.read(),
            append(bytes) {
              let result: Result<import('../facts/index.js').DurabilityState>;
              try { result = storage.append(bytes, expectedHead); }
              catch (error) {
                headMoved = physicalHead(storage) !== expectedHead;
                throw error;
              }
              headMoved = physicalHead(storage) !== expectedHead;
              return result;
            },
          };
          const appendStore = createFactStore(author.context, pinnedStorage);
          const appendSpine = createAssemblySpine(host, author, appendStore);
          const appended = appendSpine.append(candidate);
          const settled = resultParts(appended);
          if (settled.ok) return candidate;
          if (headMoved) continue;
          take(appended);
          return candidate;
        }
      });
    },
  });
}
