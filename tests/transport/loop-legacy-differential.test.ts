import { expect, it } from 'vitest';
import { canonical, consumeResult } from '../../src/index.js';
import { decodeEnvelope, decodeHistoricalBody, signEnvelope } from '../../src/facts/index.js';
import { privateKey } from '../facts/fixtures.js';
import { transportFixture } from './fixture.js';
import { value } from './loop-fixture.js';

const refusal = (detail: string) => ({
  refused: {
    type: 'Result',
    schemaVersion: 1,
    kind: 'Refused',
    reason: 'decode',
    detail,
    site: 'facts.admit',
    failDirection: 'closed',
    preserved: 'refusal:metadata',
  },
});

it('SLB-LEGACY-DIFFERENTIAL-53 V23 matches main Result bytes for signed legacy LoopRecord mutations', () => {
  const f = transportFixture();
  f.prepared();
  const records = value(f.store.read());
  const fact = records.find(row => row.kind === 'transport-LoopRecord')!;
  const wire = (f.storage.read() as any[]).find(row => row.id === fact.id)!;
  const context = { ...f.ctx, facts: [...f.ctx.facts, ...records.filter(row => row.id !== fact.id)] };
  const mutations = {
    extra: (record: Record<string, unknown>) => ({ ...record, unknown: 1 }),
    missing: (record: Record<string, unknown>) => {
      const next = { ...record };
      delete next.pending;
      return next;
    },
    policyMissing: (record: Record<string, unknown>) => {
      const policy = { ...(record.policy as Record<string, unknown>) };
      delete policy.timeout;
      return { ...record, policy };
    },
    wrongRun: (record: Record<string, unknown>) => ({ ...record, run: '' }),
    wrongEpisode: (record: Record<string, unknown>) => ({ ...record, episode: '' }),
    invalidState: (record: Record<string, unknown>) => ({ ...record, state: 'bad' }),
  } as const;
  const mainBaseline = {
    extra: refusal('unknown field'),
    missing: refusal('missing required field'),
    policyMissing: refusal('missing required field'),
    wrongRun: refusal('stable loop episode'),
    wrongEpisode: refusal('stable loop episode'),
    invalidState: refusal('loop state or count'),
  };

  for (const [name, mutate] of Object.entries(mutations)) {
    const altered = signEnvelope({ ...wire, body: { record: mutate((fact.body as any).record as Record<string, unknown>) } }, privateKey);
    const decoded = decodeHistoricalBody(value(decodeEnvelope(altered, context, 'replication')), context, context.decode);
    const actual: any = consumeResult(decoded, {
      Success: (accepted: any) => ({ accepted }),
      Refused: (refused: any) => ({ refused }),
    } as any);
    expect(value(canonical(actual)).bytes).toBe(value(canonical(mainBaseline[name as keyof typeof mainBaseline])).bytes);
  }
});
