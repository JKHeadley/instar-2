import { expect, it } from 'vitest';
import { consumeResult, decodeMeasurement } from '../../src/index.js';
import { createFactStore } from '../../src/facts/index.js';
import { createBoundedDueScanPort, createTransportAuthority, createTransportSpine, decodeLoopPolicy } from '../../src/transport/index.js';
import type { MissedRangeInput, SharedBreakerLoopPolicy, SharedLoopRecord } from '../../src/transport/index.js';
import { privateKey } from '../facts/fixtures.js';
import { transportLoopFixture, value } from '../transport/loop-fixture.js';

const pressureScope = { target: 'target:review', conversation: 'conversation:1', machine: 'fleet', pool: 'holders' } as const;
const loopRef = (loop: SharedLoopRecord) => ({ owner: 'part-six' as const, name: 'LoopRecord' as const, id: loop.episode });
const refuses = (result: unknown) => expect(consumeResult(result as never, {
  Success: () => 'ACCEPT', Refused: refusal => `REFUSE: ${refusal.detail}`,
})).toMatch(/^REFUSE:/);

for (const boundary of ['outcome-recorded', 'reopened', 'closed', 'stopped', 'missed-successor'] as const) {
  for (const side of ['before', 'after'] as const) it(`SLB-CUTS-07 CUT ${boundary} ${side} append rebuilds exactly one committed transition`, () => {
    const f = transportLoopFixture();
    const policy = boundary === 'stopped' ? value(decodeLoopPolicy({ ...f.sharedPolicy,
      id: 'cut:stopped', maxAttempts: 1 }, f.c)) as SharedBreakerLoopPolicy
      : boundary === 'closed' ? value(decodeLoopPolicy({ ...f.sharedPolicy,
        id: 'cut:closed', halfOpenTrials: 1 }, f.c)) as SharedBreakerLoopPolicy : f.sharedPolicy;
    f.registerPolicy(policy);
    const token = value(f.api.acquire(`cut:${boundary}:lease`, '', 1000));
    let loop = value(f.api.scheduleEpisode({ command: `cut:${boundary}:schedule`, fence: token,
      currentOwnerRun: f.run, policy, episodeKey: `cut:${boundary}`, operationFamily: 'recovery',
      pressureScope, sourceVector: f.vector }));
    const admit = (id: string) => value(f.api.admitLoopAttempt({ command: `cut:${boundary}:admit:${id}`,
      fence: token, episode: loopRef(loop), attempt: id, holderFamily: 'sentinel', worker: `worker:${id}`,
      machine: 'machine-a', resource: 1, sourceVector: f.vector }));
    const finish = (id: string, kind: 'accepted' | 'failed', restoration: SharedLoopRecord['closureEvidence'] = []) =>
      value(f.api.recordLoopOutcome({ command: `cut:${boundary}:outcome:${id}`, fence: token,
        episode: loopRef(loop), attempt: id, kind, failureClass: kind === 'failed' ? 'transport' : '',
        completion: f.appendOutcome(kind, id), jitterPermille: 1000, restoration, sourceVector: f.vector }));

    let operation: (api: typeof f.api) => unknown;
    let missedReference: { owner: 'part-six'; name: 'MissedRangeRecord'; id: string } | null = null;
    if (boundary === 'outcome-recorded') {
      f.advance(1); loop = admit('ordinary');
      const completion = f.appendOutcome('accepted', 'ordinary');
      operation = api => api.recordLoopOutcome({ command: 'cut:outcome-recorded:write', fence: token,
        episode: loopRef(loop), attempt: 'ordinary', kind: 'accepted', failureClass: '', completion,
        jitterPermille: 1000, restoration: [], sourceVector: f.vector });
    } else if (boundary === 'reopened' || boundary === 'closed') {
      f.advance(1); loop = admit('open:a'); loop = finish('open:a', 'failed');
      f.advance(2); loop = admit('open:b'); loop = finish('open:b', 'failed');
      f.advance(20); loop = admit('trial');
      const kind = boundary === 'reopened' ? 'failed' : 'accepted';
      const completion = f.appendOutcome(kind, 'trial');
      const restoration = boundary === 'closed'
        ? [f.restorationReference('assessment:witnessed-review')] : [];
      operation = api => api.recordLoopOutcome({ command: `cut:${boundary}:write`, fence: token,
        episode: loopRef(loop), attempt: 'trial', kind, failureClass: kind === 'failed' ? 'transport' : '',
        completion, jitterPermille: 1000, restoration, sourceVector: f.vector });
    } else if (boundary === 'stopped') {
      f.advance(1); loop = admit('only'); loop = finish('only', 'accepted'); f.advance(1);
      operation = api => api.admitLoopAttempt({ command: 'cut:stopped:write', fence: token, episode: loopRef(loop),
        attempt: 'beyond', holderFamily: 'sentinel', worker: 'worker:beyond', machine: 'machine-a', resource: 1,
        sourceVector: f.vector });
    } else {
      const page = value(createBoundedDueScanPort(f.host, f.spine, f.c).page({ scan: 'scan', generation: 'g1',
        orderedKeys: ['job:one'], cursor: null, maxItems: 1, maxDuration: 10 }));
      const lateness = (at: number) => value(decodeMeasurement('duration', { type: 'Measurement', schemaVersion: 1,
        subject: { kind: 'duration', instance: 'job:one' }, value: at - 130, unit: 'ms', at: f.clock(at), by: 'probe' },
      f.host.current().decode));
      const input: MissedRangeInput = { parentDuty: f.parentDuty, episode: loopRef(loop), scanCursor: page.cursor,
        jobInstance: 'job:one', packageDigest: `sha256:${'d'.repeat(64)}`, calendarPolicy: 'every-10', asOf: f.clock(130),
        currentLateness: lateness(130), priorExpansionCursor: f.clock(100), missedBoundary: f.clock(130), catchUpPolicy: 'none',
        dispositions: [110, 120, 130].map(at => ({ scheduledInstant: f.clock(at), kind: 'existing-run' as const,
          run: f.admittedRun(at) })), catchUpRun: null };
      missedReference = value(f.api.recordMissedRange(input));
      operation = api => api.recordMissedRange({ ...input, asOf: f.clock(131), currentLateness: lateness(131) });
    }

    const before = f.storage.read();
    const cutStorage = { ...f.storage, append: (wire: string, expected: string | null) => {
      const record = (JSON.parse(wire) as { body: { record?: { type?: string; transition?: string } } }).body.record;
      const target = boundary === 'missed-successor' ? record?.type === 'MissedRangeRecord' : record?.transition === boundary;
      if (!target) return f.storage.append(wire, expected);
      if (side === 'after') value(f.storage.append(wire, expected));
      return f.result(() => { throw new Error(`cut:${boundary}:${side}`); });
    } };
    const store = createFactStore(f.ctx, cutStorage);
    const api = createTransportAuthority(f.host, createTransportSpine(f.host, { context: f.ctx, privateKey }, store), f.c);
    refuses(operation(api));
    const after = f.storage.read();
    expect(after.slice(0, before.length)).toEqual(before);
    expect(after).toHaveLength(before.length + (side === 'after' ? 1 : 0));

    const recovered = transportLoopFixture(f.directory, `worker:cut:${boundary}:${side}`, `authority:cut:${boundary}:${side}`);
    recovered.time(f.host.loopClock!.now().value);
    if (boundary === 'missed-successor') {
      const record = value(recovered.api.readMissedRange(missedReference!)).record;
      expect(record.asOf.value).toBe(side === 'after' ? 131 : 130);
    } else {
      const record = value(recovered.api.inspect()).filter(row => row.record.type === 'LoopRecord').at(-1)!.record as SharedLoopRecord;
      expect(record.transition).toBe(side === 'after' ? boundary : loop.transition);
    }
  }, 20000);
}
