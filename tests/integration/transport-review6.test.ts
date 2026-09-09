import { expect, it } from 'vitest';
import { canonical, consumeResult, decodeMeasurement } from '../../src/index.js';
import {
  authorAndAppend,
  createFactStore,
  decodeEnvelope,
  decodeHistoricalBody,
  factId,
  signEnvelope,
} from '../../src/facts/index.js';
import type { FactEnvelope } from '../../src/facts/index.js';
import {
  createBoundedDueScanPort,
  createTransportAuthority,
  createTransportSpine,
} from '../../src/transport/index.js';
import type { MissedRangeInput, SharedLoopRecord } from '../../src/transport/index.js';
import { json, privateKey } from '../facts/fixtures.js';
import { transportFixture } from '../transport/fixture.js';
import { transportLoopFixture, value } from '../transport/loop-fixture.js';

const pressureScope = {
  target: 'target:review',
  conversation: 'conversation:1',
  machine: 'fleet',
  pool: 'holders',
} as const;

const verdict = (result: unknown) => consumeResult(result as never, {
  Success: () => 'ACCEPT',
  Refused: refusal => `REFUSE: ${refusal.detail}`,
});

const loopRef = (loop: SharedLoopRecord) => ({
  owner: 'part-six' as const,
  name: 'LoopRecord' as const,
  id: loop.episode,
});

function setupOutcome() {
  const f = transportLoopFixture();
  expect(f.vector.map(position => position.machine)).toEqual(['machine-a', 'machine-b']);
  const token = value(f.api.acquire('lease:review', '', 1000));
  const loop = value(f.api.scheduleEpisode({
    command: 'schedule:review',
    fence: token,
    currentOwnerRun: f.run,
    policy: f.sharedPolicy,
    episodeKey: 'episode:one',
    operationFamily: 'recovery',
    pressureScope,
    sourceVector: f.vector,
  }));
  f.advance(1);
  value(f.api.admitLoopAttempt({
    command: 'admit:review',
    fence: token,
    episode: loopRef(loop),
    attempt: 'review-attempt',
    holderFamily: 'sentinel',
    worker: 'worker:review',
    machine: 'machine-a',
    resource: 1,
    sourceVector: f.vector,
  }));
  value(f.api.recordLoopOutcome({
    command: 'outcome:review',
    fence: token,
    episode: loopRef(loop),
    attempt: 'review-attempt',
    kind: 'accepted',
    failureClass: '',
    completion: f.appendOutcome('accepted', 'review-attempt'),
    jitterPermille: 1000,
    restoration: [],
    sourceVector: f.vector,
  }));
  return f;
}

function mutateLastOutcome(
  f: ReturnType<typeof transportLoopFixture>,
  transform: (record: SharedLoopRecord) => SharedLoopRecord,
) {
  const stored = value(f.store.read());
  const fact = stored.filter(candidate => candidate.kind === 'transport-LoopRecord').at(-1)!;
  const wires = f.storage.read() as FactEnvelope[];
  const wire = wires.find(candidate => candidate.id === fact.id)!;
  const context = { ...f.ctx, facts: [...f.ctx.facts, ...stored.filter(candidate => candidate.id !== fact.id)] };
  const altered = signEnvelope({
    ...wire,
    body: { record: transform((fact.body as unknown as { record: SharedLoopRecord }).record) },
  }, privateKey);
  const prefix = wires.filter(candidate => candidate.id !== fact.id);
  const replica = createFactStore(f.ctx, {
    owner: 'part-ten',
    read: () => prefix,
    append: (bytes, expected) => f.result(() => {
      expect(prefix.at(-1)?.contentHash ?? null).toBe(expected);
      prefix.push(JSON.parse(bytes) as FactEnvelope);
      return { kind: 'local-durable' as const };
    }),
  });
  return {
    context,
    frame: value(decodeEnvelope(altered, context, 'replication')),
    replicate: () => replica.append(altered, { peer: f.host.machine }),
  };
}

it('SLB-OUTCOME-REPLAY-47 V2 refuses a signed outcome that invents an episode attempt on replay and replication', () => {
  const f = setupOutcome();
  const mutation = mutateLastOutcome(f, record => ({
    ...record,
    episodeAttempts: record.episodeAttempts + 1,
  }));
  expect(verdict(decodeHistoricalBody(mutation.frame, mutation.context, mutation.context.decode))).toMatch(/^REFUSE:/);
  expect(verdict(mutation.replicate())).toMatch(/^REFUSE:/);
});

it('SLB-OUTCOME-FRONTIER-48 V3 refuses a signed outcome that shrinks its admitted source vector on replay and replication', () => {
  const f = setupOutcome();
  const mutation = mutateLastOutcome(f, record => {
    const outcomeLog = record.outcomeLog.map(outcome => ({
      ...outcome,
      sourceVector: outcome.sourceVector.slice(0, 1),
    }));
    return {
      ...record,
      sourceVector: record.sourceVector.slice(0, 1),
      outcomeLog,
      outcomeWindowDigest: value(canonical(outcomeLog)).hash,
    };
  });
  expect(verdict(decodeHistoricalBody(mutation.frame, mutation.context, mutation.context.decode))).toMatch(/^REFUSE:/);
  expect(verdict(mutation.replicate())).toMatch(/^REFUSE:/);
});

it('SLB-MISSED-BETWEEN-49 V13 accepts exact owner-witnessed calendar membership through a boundary between members', () => {
  const f = transportLoopFixture(undefined, undefined, undefined, { existingInstants: [] });
  const token = value(f.api.acquire('lease:missed-between', '', 1000));
  const loop = value(f.api.scheduleEpisode({
    command: 'schedule:missed-between',
    fence: token,
    currentOwnerRun: f.run,
    policy: f.sharedPolicy,
    episodeKey: 'episode:missed-between',
    operationFamily: 'recovery',
    pressureScope,
    sourceVector: f.vector,
  }));
  const page = value(createBoundedDueScanPort(f.host, f.spine, f.c).page({
    scan: 'scan',
    generation: 'g1',
    orderedKeys: ['job:one'],
    cursor: null,
    maxItems: 1,
    maxDuration: 10,
  }));
  const after = f.clock(100);
  const through = f.clock(135);
  const members = [110, 120, 130].map(f.clock);
  const proof = value(authorAndAppend({
    kind: 'calendar-range-proof',
    schemaVersion: 1,
    machine: f.host.machine,
    principal: json(f.host.principal),
    provenance: json(f.host.principal.provenance),
    at: json(f.host.current().clock),
    body: json({ binding: value(canonical([f.parentDuty.id, 'job:one', 'every-10', after, through, members])).hash }),
    required: [],
  }, f.ctx, f.store, privateKey)).fact;
  const calendar = f.host.calendarExpansion!;
  Object.assign(f.host, {
    calendarExpansion: {
      ...calendar,
      range: () => f.result(() => ({
        after,
        through,
        members,
        witness: { owner: 'part-two', name: 'FactEnvelope', id: proof.id },
      })),
    },
  });
  const result = f.appendResult('result:missed-between');
  const input: MissedRangeInput = {
    parentDuty: f.parentDuty,
    episode: loopRef(loop),
    scanCursor: page.cursor,
    jobInstance: 'job:one',
    packageDigest: `sha256:${'d'.repeat(64)}`,
    calendarPolicy: 'every-10',
    asOf: through,
    currentLateness: value(decodeMeasurement('duration', {
      type: 'Measurement',
      schemaVersion: 1,
      subject: { kind: 'duration', instance: 'job:one' },
      value: 0,
      unit: 'ms',
      at: through,
      by: 'probe',
    }, f.host.current().decode)),
    priorExpansionCursor: after,
    missedBoundary: through,
    catchUpPolicy: 'none',
    dispositions: members.map(scheduledInstant => ({
      scheduledInstant,
      kind: 'missed-no-execution' as const,
      result,
    })),
    catchUpRun: null,
  };
  expect(verdict(f.api.recordMissedRange(input))).toBe('ACCEPT');
});

it('SLB-LEGACY-INSPECT-50 V22 preserves legacy inspect population with verified installation history and an empty local suffix', () => {
  const f = transportFixture();
  const token = value(f.api.acquire('legacy:lease', '', 500));
  value(f.api.schedule('legacy:schedule', token, f.run, f.policy));
  value(f.api.reserve(f.input(token)));
  value(createBoundedDueScanPort(f.host, f.spine, f.c).page({
    scan: 'legacy',
    generation: 'g1',
    orderedKeys: ['a', 'b'],
    cursor: null,
    maxItems: 1,
    maxDuration: 10,
  }));
  const stored = value(f.store.read());
  const context = { ...f.ctx, facts: [...f.ctx.facts, ...stored] };
  const emptyStore = createFactStore(context, {
    owner: 'part-ten',
    read: () => [],
    append: () => f.result(() => { throw new Error('read-only preservation probe'); }),
  });
  const authority = createTransportAuthority(f.host,
    createTransportSpine(f.host, { context, privateKey }, emptyStore), f.c);
  expect(value(authority.inspect())).toEqual([]);
});
