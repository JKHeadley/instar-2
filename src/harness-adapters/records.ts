import { canonical, consumeResult, defineDecoder } from '../index.js';
import type { Hash, Json, Result, VersionedDecoder } from '../index.js';
import type {
  HarnessAdapterComparison,
  HarnessAdapterDecodeContext,
  HarnessAdapterIdentity,
  HarnessAdapterRecord,
  HarnessAdapterRecordName,
  HarnessAdapterStateSnapshot,
  HarnessHandleSnapshot,
  HarnessOperationAttempt,
  HarnessRuntimeEvent,
  HarnessRuntimeHandle,
} from './contracts.js';

type ObjectValue = Readonly<Record<string, unknown>>;

const hashPattern = /^sha256:[a-f0-9]{64}$/;
const eventKinds = [
  'process-started', 'probe-live', 'probe-failed', 'input-accepted',
  'context-consumed', 'heartbeat', 'work-transition', 'output-chunk',
  'turn-closed', 'process-exited', 'diagnostic',
] as const;

function object(value: unknown, label: string): ObjectValue {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${label}: expected object`);
  return value as ObjectValue;
}
function exact(value: ObjectValue, keys: readonly string[], label: string): void {
  const actual = Object.keys(value);
  if (actual.length !== keys.length || actual.some(key => !keys.includes(key))) throw new Error(`${label}: closed fields required`);
}
function text(value: unknown, label: string, allowEmpty = false): string {
  if (typeof value !== 'string' || (!allowEmpty && value.length === 0) || value.length > 4096 || value.includes('\0'))
    throw new Error(`${label}: invalid text`);
  return value;
}
function hash(value: unknown, label: string): Hash {
  const result = text(value, label);
  if (!hashPattern.test(result)) throw new Error(`${label}: malformed SHA-256`);
  return result as Hash;
}
function integer(value: unknown, label: string, minimum = 0): number {
  if (!Number.isSafeInteger(value) || (value as number) < minimum) throw new Error(`${label}: finite safe integer required`);
  return value as number;
}
function stringList(value: unknown, label: string): readonly string[] {
  if (!Array.isArray(value)) throw new Error(`${label}: expected list`);
  const result = value.map(item => text(item, label));
  if (new Set(result).size !== result.length) throw new Error(`${label}: duplicate member`);
  return result;
}
function hashList(value: unknown, label: string): readonly Hash[] {
  if (!Array.isArray(value)) throw new Error(`${label}: expected list`);
  const result = value.map(item => hash(item, label));
  if (new Set(result).size !== result.length) throw new Error(`${label}: duplicate member`);
  return result;
}
function one<T extends string>(value: unknown, choices: readonly T[], label: string): T {
  const result = text(value, label);
  if (!choices.includes(result as T)) throw new Error(`${label}: unsupported value`);
  return result as T;
}
function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const child of Object.values(value as object)) deepFreeze(child);
    Object.freeze(value);
  }
  return value;
}

const eventFields = [
  'type', 'schemaVersion', 'id', 'harness', 'artifactDigest', 'platform', 'machine',
  'launch', 'run', 'step', 'input', 'incarnation', 'processIdentity', 'operation',
  'kind', 'sourceClock', 'observedAt', 'freshFor', 'sourceEvidence', 'predecessor',
  'workSubject', 'workPhase', 'output', 'streamState', 'childrenState',
  'unresolvedOperations', 'exitStatus', 'diagnosticCode',
] as const;
const eventV1Fields: readonly string[] = [
  ...eventFields.filter(field => !['sourceClock', 'observedAt', 'freshFor'].includes(field)),
  'at',
];

function validateEvent(value: unknown): HarnessRuntimeEvent {
  const event = object(value, 'HarnessRuntimeEvent');
  exact(event, eventFields, 'HarnessRuntimeEvent');
  if (event.type !== 'HarnessRuntimeEvent' || event.schemaVersion !== 2) throw new Error('HarnessRuntimeEvent: type/version');
  for (const field of ['id', 'harness', 'platform', 'machine', 'launch', 'run', 'step', 'input', 'incarnation', 'processIdentity', 'operation'] as const)
    text(event[field], field);
  hash(event.artifactDigest, 'artifactDigest');
  const kind = one(event.kind, eventKinds, 'kind');
  const sourceClock = integer(event.sourceClock, 'sourceClock');
  const observedAt = integer(event.observedAt, 'observedAt');
  if (observedAt < sourceClock) throw new Error('HarnessRuntimeEvent: local observation cannot predate its source clock');
  integer(event.freshFor, 'freshFor');
  const evidence = stringList(event.sourceEvidence, 'sourceEvidence');
  if (evidence.length === 0) throw new Error('sourceEvidence: witnessed event required');
  const predecessor = text(event.predecessor, 'predecessor', true);
  const workSubject = text(event.workSubject, 'workSubject', true);
  const workPhase = text(event.workPhase, 'workPhase', true);
  one(event.streamState, ['open', 'closed', 'unknown'] as const, 'streamState');
  one(event.childrenState, ['none', 'closed', 'pending', 'unknown'] as const, 'childrenState');
  stringList(event.unresolvedOperations, 'unresolvedOperations');
  if (event.exitStatus !== null && (!Number.isSafeInteger(event.exitStatus) || Math.abs(event.exitStatus as number) > 65535))
    throw new Error('exitStatus: invalid');
  const diagnostic = text(event.diagnosticCode, 'diagnosticCode', true);
  if (diagnostic.length > 256) throw new Error('diagnosticCode: compact code required');

  if (kind === 'work-transition') {
    if (!predecessor || !workSubject || !workPhase) throw new Error('work-transition: subject, predecessor and phase required');
  } else if (predecessor || workSubject || workPhase) {
    throw new Error('non-progress event cannot carry work-transition authority');
  }

  if (kind === 'output-chunk') {
    const output = object(event.output, 'output');
    exact(output, ['start', 'end', 'byteCount', 'digest', 'captureReference', 'truncated'], 'output');
    const start = integer(output.start, 'output.start');
    const end = integer(output.end, 'output.end');
    const count = integer(output.byteCount, 'output.byteCount');
    if (end < start || end - start !== count || count === 0) throw new Error('output: range/count mismatch');
    hash(output.digest, 'output.digest');
    text(output.captureReference, 'output.captureReference');
    if (typeof output.truncated !== 'boolean') throw new Error('output.truncated: boolean required');
  } else if (event.output !== null) throw new Error('output: only output-chunk may carry a range');

  if (kind !== 'process-exited' && event.exitStatus !== null) throw new Error('exitStatus: only process-exited may carry status');
  return deepFreeze(event as unknown as HarnessRuntimeEvent);
}

const handleFields = [
  'type', 'schemaVersion', 'id', 'harness', 'artifactDigest', 'platform', 'machine',
  'launch', 'run', 'step', 'input', 'inputDigest', 'incarnation', 'processIdentity',
  'launchOperation', 'launchClaim', 'acquiredAt', 'contextDigests', 'dependencyFacts',
] as const;

function validateHandle(value: unknown): HarnessRuntimeHandle {
  const handle = object(value, 'HarnessRuntimeHandle');
  exact(handle, handleFields, 'HarnessRuntimeHandle');
  if (handle.type !== 'HarnessRuntimeHandle' || handle.schemaVersion !== 1) throw new Error('HarnessRuntimeHandle: type/version');
  for (const field of ['id', 'harness', 'platform', 'machine', 'launch', 'run', 'step', 'input', 'incarnation', 'processIdentity', 'launchOperation', 'launchClaim'] as const)
    text(handle[field], field);
  hash(handle.artifactDigest, 'artifactDigest');
  hash(handle.inputDigest, 'inputDigest');
  integer(handle.acquiredAt, 'acquiredAt');
  hashList(handle.contextDigests, 'contextDigests');
  stringList(handle.dependencyFacts, 'dependencyFacts');
  return deepFreeze(handle as unknown as HarnessRuntimeHandle);
}

function validateSnapshot(value: unknown): HarnessHandleSnapshot {
  const snapshot = object(value, 'HarnessHandleSnapshot');
  exact(snapshot, ['type', 'schemaVersion', 'id', 'adapter', 'machine', 'capturedAt', 'maxHandles', 'handles'], 'HarnessHandleSnapshot');
  if (snapshot.type !== 'HarnessHandleSnapshot' || snapshot.schemaVersion !== 1) throw new Error('HarnessHandleSnapshot: type/version');
  text(snapshot.id, 'id'); text(snapshot.adapter, 'adapter'); text(snapshot.machine, 'machine');
  integer(snapshot.capturedAt, 'capturedAt');
  const maximum = integer(snapshot.maxHandles, 'maxHandles', 1);
  if (!Array.isArray(snapshot.handles) || snapshot.handles.length > maximum) throw new Error('handles: capacity exceeded');
  const handles = snapshot.handles.map(validateHandle);
  if (handles.some(handle => handle.machine !== snapshot.machine || handle.harness !== snapshot.adapter)) throw new Error('handles: snapshot subject mismatch');
  if (new Set(handles.map(handle => handle.launch)).size !== handles.length) throw new Error('handles: duplicate launch');
  return deepFreeze({ ...snapshot, handles } as unknown as HarnessHandleSnapshot);
}

function validateAttempt(value: unknown): HarnessOperationAttempt {
  const attempt = object(value, 'HarnessOperationAttempt');
  exact(attempt, ['kind', 'operation', 'launch', 'incarnation', 'subjectDigest', 'state', 'evidence', 'attemptedAt', 'observedAt'], 'HarnessOperationAttempt');
  one(attempt.kind, ['launch', 'delivery'] as const, 'attempt.kind');
  for (const field of ['operation', 'launch', 'incarnation'] as const) text(attempt[field], `attempt.${field}`);
  hash(attempt.subjectDigest, 'attempt.subjectDigest');
  one(attempt.state, ['pending', 'observed'] as const, 'attempt.state');
  text(attempt.evidence, 'attempt.evidence', true);
  const attemptedAt = integer(attempt.attemptedAt, 'attempt.attemptedAt');
  const observedAt = attempt.observedAt === null ? null : integer(attempt.observedAt, 'attempt.observedAt');
  if (attempt.state === 'pending' && (attempt.evidence !== '' || attempt.observedAt !== null))
    throw new Error('HarnessOperationAttempt: pending attempt cannot claim an observation');
  if (attempt.state === 'observed' && (attempt.evidence === '' || attempt.observedAt === null))
    throw new Error('HarnessOperationAttempt: observed attempt requires evidence and time');
  if (observedAt !== null && observedAt < attemptedAt)
    throw new Error('HarnessOperationAttempt: observation cannot predate the attempted operation');
  return deepFreeze(attempt as unknown as HarnessOperationAttempt);
}

function validateStateSnapshot(value: unknown): HarnessAdapterStateSnapshot {
  const snapshot = object(value, 'HarnessAdapterStateSnapshot');
  exact(snapshot, ['type', 'schemaVersion', 'id', 'adapter', 'machine', 'revision', 'maxHandles', 'maxAttempts',
    'maxEvents', 'maxCaptureBytes', 'handles', 'attempts', 'events'], 'HarnessAdapterStateSnapshot');
  if (snapshot.type !== 'HarnessAdapterStateSnapshot' || snapshot.schemaVersion !== 1)
    throw new Error('HarnessAdapterStateSnapshot: type/version');
  text(snapshot.id, 'id'); text(snapshot.adapter, 'adapter'); text(snapshot.machine, 'machine');
  integer(snapshot.revision, 'revision');
  const maxHandles = integer(snapshot.maxHandles, 'maxHandles');
  const maxAttempts = integer(snapshot.maxAttempts, 'maxAttempts');
  const maxEvents = integer(snapshot.maxEvents, 'maxEvents');
  const maxCaptureBytes = integer(snapshot.maxCaptureBytes, 'maxCaptureBytes');
  if (!Array.isArray(snapshot.handles) || snapshot.handles.length > maxHandles) throw new Error('handles: capacity exceeded');
  if (!Array.isArray(snapshot.attempts) || snapshot.attempts.length > maxAttempts) throw new Error('attempts: capacity exceeded');
  if (!Array.isArray(snapshot.events) || snapshot.events.length > maxEvents) throw new Error('events: capacity exceeded');
  const handles = snapshot.handles.map(validateHandle);
  const attempts = snapshot.attempts.map(validateAttempt);
  const events = snapshot.events.map(validateEvent);
  if (handles.some(handle => handle.machine !== snapshot.machine || handle.harness !== snapshot.adapter)
    || events.some(event => event.machine !== snapshot.machine || event.harness !== snapshot.adapter))
    throw new Error('journal entries: snapshot subject mismatch');
  if (new Set(handles.map(handle => handle.launch)).size !== handles.length) throw new Error('handles: duplicate launch');
  if (new Set(attempts.map(attempt => attempt.operation)).size !== attempts.length)
    throw new Error('attempts: duplicate operation');
  if (new Set(events.map(event => event.id)).size !== events.length)
    throw new Error('events: duplicate immutable event identity');
  const captured = events.reduce((sum, event) => sum + (event.output?.byteCount ?? 0), 0);
  if (captured > maxCaptureBytes) throw new Error('events: capture capacity exceeded');
  return deepFreeze({ ...snapshot, handles, attempts, events } as unknown as HarnessAdapterStateSnapshot);
}

function decoderFor<N extends HarnessAdapterRecordName>(name: N, context: HarnessAdapterDecodeContext): VersionedDecoder<Extract<HarnessAdapterRecord, { type: N }>, HarnessAdapterDecodeContext> {
  const versions = name === 'HarnessRuntimeEvent'
    ? {
        1: { validate: (input: Json) => ({ ok: true as const, value: input }) },
        2: { validate: (input: Json) => ({ ok: true as const, value: input }) },
      }
    : { 1: { validate: (input: Json) => ({ ok: true as const, value: input }) } };
  const migrations = name === 'HarnessRuntimeEvent'
    ? { 1: (input: Json) => {
        const prior = object(input, 'HarnessRuntimeEvent v1');
        exact(prior, eventV1Fields, 'HarnessRuntimeEvent v1');
        const { at, ...rest } = prior;
        return { ...rest, schemaVersion: 2, sourceClock: integer(at, 'at'), observedAt: integer(at, 'at'), freshFor: 0 } as Json;
      } }
    : {};
  const decoded = defineDecoder<Extract<HarnessAdapterRecord, { type: N }>, HarnessAdapterDecodeContext>({
    name,
    owner: 'part-thirteen',
    currentVersion: name === 'HarnessRuntimeEvent' ? 2 : 1,
    versions,
    migrations,
    decodeCurrent: value => {
      try {
        const record = name === 'HarnessRuntimeEvent' ? validateEvent(value)
          : name === 'HarnessRuntimeHandle' ? validateHandle(value)
          : name === 'HarnessHandleSnapshot' ? validateSnapshot(value)
            : validateStateSnapshot(value);
        return { ok: true, value: record as Extract<HarnessAdapterRecord, { type: N }> };
      } catch (error) {
        return { ok: false, detail: error instanceof Error ? error.message : 'harness adapter decode failed' };
      }
    },
  }, context.preserved);
  return consumeResult(decoded, {
    Success: value => value,
    Refused: refusal => { throw new Error(refusal.detail); },
  });
}

export function decodeHarnessAdapterRecord<N extends HarnessAdapterRecordName>(
  name: N,
  input: unknown,
  context: HarnessAdapterDecodeContext,
): Result<Extract<HarnessAdapterRecord, { type: N }>> {
  return decoderFor(name, context).decode(input, context);
}

export const decodeHarnessRuntimeEvent = (input: unknown, context: HarnessAdapterDecodeContext) =>
  decodeHarnessAdapterRecord('HarnessRuntimeEvent', input, context);
export const decodeHarnessRuntimeHandle = (input: unknown, context: HarnessAdapterDecodeContext) =>
  decodeHarnessAdapterRecord('HarnessRuntimeHandle', input, context);
export const decodeHarnessHandleSnapshot = (input: unknown, context: HarnessAdapterDecodeContext) =>
  decodeHarnessAdapterRecord('HarnessHandleSnapshot', input, context);
export const decodeHarnessAdapterStateSnapshot = (input: unknown, context: HarnessAdapterDecodeContext) =>
  decodeHarnessAdapterRecord('HarnessAdapterStateSnapshot', input, context);

/** Total decoder for the nested package-local attempt record. */
export function decodeHarnessOperationAttempt(input: unknown,
  context: HarnessAdapterDecodeContext): Result<HarnessOperationAttempt> {
  const definition = defineDecoder<HarnessOperationAttempt, HarnessAdapterDecodeContext>({
    name: 'HarnessOperationAttempt', owner: 'part-thirteen', currentVersion: 1,
    versions: { 1: { validate: value => ({ ok: true, value }) } }, migrations: {},
    decodeCurrent: value => {
      try {
        const envelope = object(value, 'HarnessOperationAttempt envelope');
        exact(envelope, ['type', 'schemaVersion', 'attempt'], 'HarnessOperationAttempt envelope');
        return { ok: true, value: validateAttempt(envelope.attempt) };
      } catch (error) {
        return { ok: false, detail: error instanceof Error ? error.message : 'attempt decode failed' };
      }
    },
  }, context.preserved);
  return consumeResult(definition, {
    Refused: refusal => refusal,
    Success: decoder => decoder.decode({
      type: 'HarnessOperationAttempt', schemaVersion: 1, attempt: input,
    }, context),
  });
}

export function harnessAdapterLogicalKey(record: HarnessAdapterRecord): string {
  const tuple = (values: readonly string[]) => consumeResult(canonical(values), {
    Success: encoded => encoded.bytes,
    Refused: refusal => { throw new Error(refusal.detail); },
  });
  switch (record.type) {
    case 'HarnessRuntimeEvent': return `runtime-event:${tuple([record.harness, record.artifactDigest, record.machine, record.id])}`;
    case 'HarnessRuntimeHandle': return `runtime-handle:${tuple([record.launch, record.machine, record.incarnation, record.processIdentity])}`;
    case 'HarnessHandleSnapshot': return `handle-snapshot:${tuple([record.adapter, record.machine, record.id])}`;
    case 'HarnessAdapterStateSnapshot': return `adapter-state:${tuple([record.adapter, record.machine])}`;
  }
}

function canonicalHash(value: unknown): Hash {
  return consumeResult(canonical(value), {
    Success: encoded => encoded.hash,
    Refused: refusal => { throw new Error(refusal.detail); },
  });
}

export function harnessAdapterIdentity(record: HarnessAdapterRecord): HarnessAdapterIdentity {
  return deepFreeze({ id: record.id, logicalKey: harnessAdapterLogicalKey(record), canonicalHash: canonicalHash(record) });
}

export function compareHarnessAdapterRecords<N extends HarnessAdapterRecordName>(
  name: N,
  left: unknown,
  right: unknown,
  context: HarnessAdapterDecodeContext,
): Result<HarnessAdapterComparison> {
  return consumeResult(decodeHarnessAdapterRecord(name, left, context), {
    Refused: refusal => refusal,
    Success: a => consumeResult(decodeHarnessAdapterRecord(name, right, context), {
      Refused: refusal => refusal,
      Success: b => {
        const ai = harnessAdapterIdentity(a);
        const bi = harnessAdapterIdentity(b);
        const comparison: HarnessAdapterComparison = ai.canonicalHash === bi.canonicalHash
          ? { equal: true }
          : ai.logicalKey !== bi.logicalKey && ai.id !== bi.id
            ? { equal: false }
            : { equal: false, conflict: { logicalKey: ai.logicalKey, kind: 'immutable-disagreement', hashes: [ai.canonicalHash, bi.canonicalHash].sort() } };
        const comparisonDecoder = defineDecoder<HarnessAdapterComparison, HarnessAdapterDecodeContext>({
          name: 'HarnessAdapterComparison', owner: 'part-thirteen', currentVersion: 1,
          versions: { 1: { validate: input => ({ ok: true, value: input }) } }, migrations: {},
          decodeCurrent: input => {
            try {
              const value = object(input, 'HarnessAdapterComparison');
              if (typeof value.equal !== 'boolean') throw new Error('comparison equal flag required');
              return { ok: true, value: deepFreeze(comparison) };
            } catch (error) { return { ok: false, detail: error instanceof Error ? error.message : 'comparison decode failed' }; }
          },
        }, context.preserved);
        return consumeResult(comparisonDecoder, {
          Refused: refusal => refusal,
          Success: decoder => decoder.decode({ type: 'HarnessAdapterComparison', schemaVersion: 1, ...comparison }, context),
        });
      },
    }),
  });
}
