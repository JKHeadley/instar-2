import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { canonical, consumeResult } from '../../src/index.js';
import { createFactStore } from '../../src/facts/index.js';
import {
  createLoopA1Authority,
  createLoopA1Spine,
  decodeLoopPolicyA1,
  storeSharedLoopRecord,
} from '../../src/transport/loop-a1/index.js';
import type { LoopOutcomeInput, SharedBreakerLoopPolicy, SharedLoopRecord } from '../../src/transport/loop-a1/index.js';
import { privateKey } from '../facts/fixtures.js';
import { transportLoopFixture, value } from '../transport/loop-fixture.js';

const mode = process.env.SLB_A1_REPAIR20_E2E_MODE;
const directory = process.env.SLB_A1_REPAIR20_E2E_DIR;
if (!directory) throw new Error('SLB_A1_REPAIR20_E2E_DIR is required');
const detail = (result: unknown) => consumeResult(result as never, {
  Success: () => '', Refused: refusal => refusal.detail,
});
const reference = (record: SharedLoopRecord) => ({
  owner: 'part-six' as const, name: 'LoopRecord' as const, id: record.episode,
});
const encodedRecord = (record: SharedLoopRecord) => value(canonical(storeSharedLoopRecord(record))).bytes;

it.skipIf(mode !== 'produce')('produces an ordinary durable close whose acknowledgment is lost', () => {
  const fixture = transportLoopFixture(directory);
  const policy = value(decodeLoopPolicyA1({
    ...fixture.sharedPolicy,
    id: 'repair20-e2e-policy',
    failureThreshold: 1,
    halfOpenTrials: 1,
    halfOpenConcurrency: 1,
    maxDuration: 50_000,
  }, fixture.c)) as SharedBreakerLoopPolicy;
  fixture.registerPolicy(policy);
  (fixture.host as { maxLeaseTerm: number }).maxLeaseTerm = 50_000;
  const fence = value(fixture.api.acquire('repair20-e2e-lease', '', 50_000));
  let loop = value(fixture.api.scheduleEpisode({
    command: 'repair20-e2e-schedule', fence, currentOwnerRun: fixture.run, policy,
    episodeKey: 'only', operationFamily: 'recovery',
    pressureScope: { target: 'target:review', conversation: 'conversation:1', machine: 'fleet', pool: 'holders' },
    sourceVector: fixture.vector,
  }));
  fixture.time(101);
  loop = value(fixture.api.admitLoopAttempt({
    command: 'repair20-e2e-admit-failure', fence, episode: reference(loop), attempt: 'failure',
  }));
  loop = value(fixture.api.recordLoopOutcome({
    command: 'repair20-e2e-open', fence, episode: reference(loop), attempt: 'failure', kind: 'failed',
    failureClass: 'transport', completion: fixture.appendOutcome('failed', 'failure'),
    jitterPermille: 1000, restoration: [],
  }));
  fixture.time(121);
  loop = value(fixture.api.admitLoopAttempt({
    command: 'repair20-e2e-admit-trial', fence, episode: reference(loop), attempt: 'trial',
  }));
  const input: LoopOutcomeInput = {
    command: 'repair20-e2e-close', fence, episode: reference(loop), attempt: 'trial', kind: 'accepted',
    failureClass: '', completion: fixture.appendOutcome('accepted', 'trial'), jitterPermille: 1000,
    restoration: [fixture.restorationReference('assessment:witnessed-review')],
  };
  let cut = false;
  const storage = {
    owner: 'part-ten' as const,
    read: () => fixture.storage.read(),
    append: (raw: string, head: string | null) => {
      const result = fixture.storage.append(raw, head);
      const transition = (JSON.parse(raw) as { body?: { record?: { transition?: unknown } } })
        .body?.record?.transition;
      if (!cut && transition === 'closed') {
        cut = true;
        value(result);
        return fixture.result(() => { throw new Error('repair20-lost-ack'); });
      }
      return result;
    },
  };
  const store = createFactStore(fixture.ctx, storage);
  const authority = createLoopA1Authority(fixture.host,
    createLoopA1Spine(fixture.host, { context: fixture.ctx, privateKey }, store), fixture.c);
  expect(detail(authority.recordLoopOutcome(input))).toContain('repair20-lost-ack');
  const durable = value(fixture.api.inspect()).at(-1)!.record as SharedLoopRecord;
  expect(durable.state).toBe('closed');
  writeFileSync(join(directory, 'request.json'), JSON.stringify(input));
  writeFileSync(join(directory, 'expected.json'), JSON.stringify(storeSharedLoopRecord(durable)));
});

it.skipIf(mode !== 'recover')('returns the exact ordinary close after expiry in a fresh process', () => {
  const file = join(directory, 'facts.json');
  const before = readFileSync(file, 'utf8');
  const expected = value(canonical(JSON.parse(readFileSync(join(directory, 'expected.json'), 'utf8')))).bytes;
  const fixture = transportLoopFixture(directory);
  (fixture.host as { maxLeaseTerm: number }).maxLeaseTerm = 50_000;
  const durable = value(fixture.api.inspect()).at(-1)!.record as SharedLoopRecord;
  expect(encodedRecord(durable)).toBe(expected);
  fixture.time(10_100);
  const input = JSON.parse(readFileSync(join(directory, 'request.json'), 'utf8')) as LoopOutcomeInput;
  const retry = fixture.api.recordLoopOutcome(input);
  expect(detail(retry)).toBe('');
  expect(encodedRecord(value(retry))).toBe(encodedRecord(durable));
  expect(readFileSync(file, 'utf8')).toBe(before);
});
