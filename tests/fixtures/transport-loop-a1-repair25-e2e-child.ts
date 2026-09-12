import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { consumeResult } from '../../src/index.js';
import { factId, signEnvelope } from '../../src/facts/index.js';
import type { FactEnvelope } from '../../src/facts/index.js';
import { decodeLoopPolicyA1 } from '../../src/transport/loop-a1/index.js';
import type { SharedBreakerLoopPolicy, SharedLoopRecord } from '../../src/transport/loop-a1/index.js';
import { privateKey } from '../facts/fixtures.js';
import { transportLoopFixture, value } from '../transport/loop-fixture.js';

const mode = process.env.SLB_A1_REPAIR25_E2E_MODE;
const directory = process.env.SLB_A1_REPAIR25_E2E_DIR;
if (!directory) throw new Error('SLB_A1_REPAIR25_E2E_DIR is required');
const scenario = mode?.split('-').at(-1);
const detail = (result: unknown): string => consumeResult(result as never, {
  Success: () => '', Refused: refusal => refusal.detail,
});
const pressureScope = {
  target: 'target:review', conversation: 'conversation:1', machine: 'fleet', pool: 'holders',
} as const;

it.skipIf(!mode?.startsWith('produce-'))('produces signed valid or duplicated-invalid durable history', () => {
  const fixture = transportLoopFixture(directory);
  const policy = value(decodeLoopPolicyA1({
    ...fixture.sharedPolicy,
    id: `repair25-e2e-policy:${scenario}`,
    failureThreshold: 1,
    halfOpenTrials: 1,
    halfOpenConcurrency: 1,
  }, fixture.c)) as SharedBreakerLoopPolicy;
  fixture.registerPolicy(policy);
  const fence = value(fixture.api.acquire(`repair25-e2e-lease:${scenario}`, '', 1000));
  const loop = value(fixture.api.scheduleEpisode({
    command: `repair25-e2e-schedule:${scenario}`, fence, currentOwnerRun: fixture.run, policy,
    episodeKey: 'one', operationFamily: 'recovery', pressureScope, sourceVector: fixture.vector,
  }));
  expect(loop.state).toBe('scheduled');
  if (scenario !== 'invalid') return;

  const file = join(directory, 'facts.json');
  const wires = JSON.parse(readFileSync(file, 'utf8')) as FactEnvelope[];
  const original = wires.at(-1)!;
  const body = { record: { ...(original.body as { record: Record<string, unknown> }).record,
    state: 'closed', transition: 'closed' } };
  const first = signEnvelope({ ...original, body }, privateKey) as FactEnvelope;
  const segment = { ...first.segment, position: first.segment.position + 1 };
  const second = signEnvelope({
    ...first,
    id: factId(segment),
    segment,
    prevInSegment: first.contentHash,
    predecessors: { ...first.predecessors, inSegment: first.id },
  }, privateKey) as FactEnvelope;
  writeFileSync(file, JSON.stringify([...wires.slice(0, -1), first, second]));
});

it.skipIf(!mode?.startsWith('recover-'))('reconstructs valid history and refuses duplicated-invalid history', () => {
  const file = join(directory, 'facts.json');
  const before = readFileSync(file, 'utf8');
  const fixture = transportLoopFixture(directory);
  const result = fixture.api.inspect();
  if (scenario === 'invalid') expect(detail(result)).not.toBe('');
  else {
    expect(detail(result)).toBe('');
    expect((value(result).at(-1)!.record as SharedLoopRecord).state).toBe('scheduled');
  }
  expect(readFileSync(file, 'utf8')).toBe(before);
});
