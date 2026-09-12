import { createPrivateKey } from 'node:crypto';
import { expect, it } from 'vitest';
import { consumeResult } from '../../src/index.js';
import { createFactStore, decodeEnvelope, decodeHistoricalBody, factId, signEnvelope } from '../../src/facts/index.js';
import { decodeLoopPolicyA1 } from '../../src/transport/loop-a1/index.js';
import { resolveRestorationReference } from '../../src/transport/loop-a1/records.js';
import type { SharedBreakerLoopPolicy, SharedLoopRecord } from '../../src/transport/loop-a1/index.js';
import type { FenceToken } from '../../src/transport/index.js';
import { privateKey } from '../facts/fixtures.js';
import { transportLoopFixture, value } from '../transport/loop-fixture.js';

const pressureScope = { target: 'target:review', conversation: 'conversation:1', machine: 'fleet', pool: 'holders' } as const;
const excludedFields = [
  ['parentAttemptBudget', 1],
  ['parentResourceBudget', 1],
  ['resourceBudget', 1],
  ['attemptBudget', 1],
  ['budgetWindow', 1],
  ['cursor', 'cursor:excluded'],
  ['cursorKind', 'kind:excluded'],
  ['scanCursor', { owner: 'part-six', name: 'ScanCursor', id: 'cursor:excluded' }],
  ['concurrency', 1],
] as const;
const reference = (record: SharedLoopRecord) => ({
  owner: 'part-six' as const,
  name: 'LoopRecord' as const,
  id: record.episode,
});
const detail = (result: unknown) => consumeResult(result as never, {
  Success: () => '',
  Refused: refusal => refusal.detail,
});

function setup(overrides: Partial<SharedBreakerLoopPolicy> = {}) {
  const fixture = transportLoopFixture();
  const policy = value(decodeLoopPolicyA1({
    ...fixture.sharedPolicy,
    id: 'repair15-policy',
    failureThreshold: 1,
    halfOpenTrials: 1,
    halfOpenConcurrency: 1,
    ...overrides,
  }, fixture.c)) as SharedBreakerLoopPolicy;
  fixture.registerPolicy(policy);
  let token = value(fixture.api.acquire('repair15-lease', '', 1000));
  let loop = value(fixture.api.scheduleEpisode({
    command: 'repair15-schedule',
    fence: token,
    currentOwnerRun: fixture.run,
    policy,
    episodeKey: 'only',
    operationFamily: 'recovery',
    pressureScope,
    sourceVector: fixture.vector,
  }));
  const admit = (attempt: string, extra: object = {}) => fixture.api.admitLoopAttempt({
    command: `repair15-admit:${attempt}`,
    fence: token,
    episode: reference(loop),
    attempt,
    ...extra,
  } as never);
  const finish = (attempt: string, kind: 'accepted' | 'failed',
    restoration: SharedLoopRecord['closureEvidence'] = [], extra: object = {}) => fixture.api.recordLoopOutcome({
    command: `repair15-finish:${attempt}`,
    fence: token,
    episode: reference(loop),
    attempt,
    kind,
    failureClass: kind === 'failed' ? 'transport' : '',
    completion: fixture.appendOutcome(kind, attempt),
    jitterPermille: 1000,
    restoration,
    ...extra,
  } as never);
  return {
    fixture,
    policy,
    get token() { return token; },
    set token(value: FenceToken) { token = value; },
    get loop() { return loop; },
    set loop(value: SharedLoopRecord) { loop = value; },
    admit,
    finish,
  };
}

function open(state: ReturnType<typeof setup>): void {
  state.fixture.advance(1);
  state.loop = value(state.admit('opening-failure'));
  state.loop = value(state.finish('opening-failure', 'failed'));
}

it('SLB-A1-PLAN-SUBJECT-105 V10 V17 refuse signed restoration whose plan governs another pressure subject', () => {
  const state = setup();
  open(state);
  state.fixture.advance(20);
  state.loop = value(state.admit('trial'));
  state.loop = value(state.finish('trial', 'accepted',
    [state.fixture.restorationReference('assessment:witnessed-review')]));

  const assessment = state.fixture.assessmentFact('assessment:witnessed-review')!;
  const history = [...state.fixture.ctx.facts, ...value(state.fixture.store.read())];
  const request = history.find(fact => (fact.body as { record?: { id?: string } }).record?.id
    === (assessment.body as { record: { request: string } }).record.request)!;
  const plan = history.find(fact => (fact.body as { record?: { id?: string } }).record?.id
    === (request.body as { record: { plan: string } }).record.plan)!;
  const replaced = [] as typeof history;
  const hashes = new Map<string, string>();
  for (const fact of history) {
    if (fact.machine !== 'machine-a') {
      replaced.push(fact);
      continue;
    }
    const body = fact.id === plan.id
      ? { record: { ...(fact.body as { record: object }).record,
        subject: { ...((fact.body as { record: { subject: object } }).record.subject), governed: 'wrong-pressure' } } }
      : fact.body;
    const rewrittenPredecessor = fact.predecessors.inSegment === null
      ? undefined
      : hashes.get(fact.predecessors.inSegment);
    const wire = signEnvelope({ ...fact, body,
      prevInSegment: rewrittenPredecessor ?? fact.prevInSegment }, privateKey);
    const decoded = value(decodeEnvelope(wire, { ...state.fixture.ctx, facts: replaced }, 'replication'));
    hashes.set(fact.id, decoded.contentHash);
    replaced.push(decoded);
  }

  const restoration = state.fixture.restorationReference('assessment:witnessed-review');
  expect(() => resolveRestorationReference(restoration, replaced, { ...state.fixture.ctx, facts: replaced },
    state.loop.transitionAt, state.loop.pressureKey, state.loop.operationFamily, state.fixture.host)).toThrow();
  const origin = replaced.at(-1)!;
  const context = { ...state.fixture.ctx, facts: replaced.slice(0, -1) };
  expect(detail(decodeHistoricalBody(origin, context, context.decode))).not.toBe('');
});

it('SLB-A1-EXCLUDED-INVENTORY-106 V11 typed-refuses every excluded field on requests and signed replay', () => {
  const state = setup();
  const originalStorage = state.fixture.storage.read() as object[];
  const original = originalStorage.at(-1)! as { body: { record: object } };
  const facts = value(state.fixture.store.read());
  const context = { ...state.fixture.ctx, facts: [...state.fixture.ctx.facts, ...facts.slice(0, -1)] };

  for (const [field, supplied] of excludedFields) {
    const altered = signEnvelope({ ...original,
      body: { record: { ...original.body.record, [field]: supplied } } } as never, privateKey);
    const decoded = value(decodeEnvelope(altered, context, 'replication'));
    expect(detail(decodeHistoricalBody(decoded, context, context.decode)), `signed ${field}`)
      .toBe('unsupported-in-slice-a1');
    const prefix = originalStorage.slice(0, -1);
    const store = createFactStore(state.fixture.ctx, {
      owner: 'part-ten',
      read: () => prefix,
      append: (bytes, expected) => state.fixture.result(() => {
        expect((prefix.at(-1) as { contentHash?: string } | undefined)?.contentHash ?? null).toBe(expected);
        prefix.push(JSON.parse(bytes));
        return { kind: 'local-durable' as const };
      }),
    });
    expect(detail(store.append(altered, { peer: state.fixture.host.machine })), `replication ${field}`)
      .toBe('unsupported-in-slice-a1');

    const before = JSON.stringify(state.fixture.storage.read());
    expect(detail(state.fixture.api.scheduleEpisode({
      command: `repair15-schedule-${field}`,
      fence: state.token,
      currentOwnerRun: state.fixture.run,
      policy: state.policy,
      episodeKey: 'only',
      operationFamily: 'recovery',
      pressureScope,
      sourceVector: state.fixture.vector,
      [field]: supplied,
    } as never)), `schedule ${field}`).toBe('unsupported-in-slice-a1');
    expect(detail(state.admit(`request-${field}`, { [field]: supplied })), `admission ${field}`)
      .toBe('unsupported-in-slice-a1');
    expect(JSON.stringify(state.fixture.storage.read())).toBe(before);
  }

  state.fixture.advance(1);
  state.loop = value(state.admit('outcome-exclusions'));
  const completion = state.fixture.appendOutcome('accepted', 'outcome-exclusions');
  for (const [field, supplied] of excludedFields) {
    const before = JSON.stringify(state.fixture.storage.read());
    expect(detail(state.fixture.api.recordLoopOutcome({
      command: `repair15-outcome-${field}`,
      fence: state.token,
      episode: reference(state.loop),
      attempt: 'outcome-exclusions',
      kind: 'accepted',
      failureClass: '',
      completion,
      jitterPermille: 1000,
      restoration: [],
      [field]: supplied,
    } as never)), `outcome ${field}`).toBe('unsupported-in-slice-a1');
    expect(JSON.stringify(state.fixture.storage.read())).toBe(before);
  }
});

it('SLB-A1-HISTORICAL-TIME-107 V18 preserves a closure valid at transition time after its proof window expires', () => {
  const state = setup({ maxDuration: 100_000, maxOpenDuration: 20_000 });
  open(state);
  state.fixture.advance(20);
  state.loop = value(state.admit('trial'));
  state.loop = value(state.finish('trial', 'accepted',
    [state.fixture.restorationReference('assessment:witnessed-review')]));
  const leaseHead = value(state.fixture.api.legacy.inspect()).at(-1)!.fact.id;

  state.fixture.time(10_101);
  expect(value(state.fixture.api.inspect()).filter(row => row.record.type === 'LoopRecord').at(-1)!.record)
    .toMatchObject({ state: 'closed', attempts: 2, totalFailures: 1 });
  state.token = value(state.fixture.api.acquire('repair15-later-lease', leaseHead, 1000));
  expect(value(state.fixture.api.admitLoopAttempt({
    command: 'repair15-later-cycle',
    fence: state.token,
    episode: reference(state.loop),
    attempt: 'later-cycle',
  })).state).toBe('running');
});

it('SLB-A1-SHARED-HISTORY-108 V23 V24 combines two signed machine contributors in one durable population', () => {
  const state = setup({ failureThreshold: 2 });
  state.fixture.advance(1);
  state.loop = value(state.admit('holder-family-one:worker-one'));
  state.loop = value(state.finish('holder-family-one:worker-one', 'failed'));
  expect(state.loop).toMatchObject({ state: 'waiting', failureCount: 1 });

  state.fixture.advance(2);
  state.loop = value(state.admit('holder-family-two:worker-two'));
  const completion = state.fixture.appendOutcome('failed', 'holder-family-two:worker-two');
  const raw = (state.fixture.storage.read() as object[]).at(-1)! as {
    segment: { epoch: number; position: number };
    predecessors: { inSegment: string };
  };
  const peer = state.fixture.ctx.facts.filter(fact => fact.machine === 'machine-b').at(-1)!;
  const segment = { ...peer.segment, position: peer.segment.position + 1 };
  const machineBKey = createPrivateKey({
    key: Buffer.from(`302e020100300506032b657004220420${'22'.repeat(32)}`, 'hex'),
    format: 'der',
    type: 'pkcs8',
  }).export({ format: 'pem', type: 'pkcs8' }).toString();
  const wire = signEnvelope({ ...raw, id: factId(segment), machine: 'machine-b', segment,
    prevInSegment: peer.contentHash, predecessors: { ...raw.predecessors, inSegment: peer.id } } as never, machineBKey);
  const receipt = value(state.fixture.store.append(wire, { peer: 'machine-b' }));
  state.loop = value(state.fixture.api.recordLoopOutcome({
    command: 'repair15-shared-second-failure',
    fence: state.token,
    episode: reference(state.loop),
    attempt: 'holder-family-two:worker-two',
    kind: 'failed',
    failureClass: 'transport',
    completion: { ...completion, fact: { ...completion.fact, id: receipt.fact.id } },
    jitterPermille: 1000,
    restoration: [],
  }));

  expect(state.loop).toMatchObject({ state: 'open-breaker', failureCount: 2 });
  const history = value(state.fixture.store.read());
  const contributors = new Set(state.loop.outcomeLog.map(outcome =>
    history.find(fact => fact.id === outcome.completion.fact.id)!.machine));
  expect(contributors).toEqual(new Set(['machine-a', 'machine-b']));
  for (const contender of ['holder-family-one:worker-one', 'holder-family-two:worker-two'])
    expect(detail(state.admit(`${contender}:cooldown`))).toContain('cooldown');

  state.fixture.advance(20);
  state.loop = value(state.admit('failed-trial'));
  state.loop = value(state.finish('failed-trial', 'failed'));
  expect(state.loop).toMatchObject({ state: 'open-breaker', breakerOpenCount: 2 });
  state.fixture.advance(20);
  state.loop = value(state.admit('passing-trial'));
  state.loop = value(state.finish('passing-trial', 'accepted',
    [state.fixture.restorationReference('assessment:witnessed-review')]));
  expect(state.loop).toMatchObject({ state: 'closed', totalFailures: 3 });

  const before = JSON.stringify(state.fixture.storage.read());
  const restarted = transportLoopFixture(state.fixture.directory, 'worker:restart', 'authority:restart');
  const rebuilt = value(restarted.api.inspect()).filter(row => row.record.type === 'LoopRecord').at(-1)!.record;
  expect(rebuilt).toEqual(state.loop);
  expect(JSON.stringify(restarted.storage.read())).toBe(before);
  const restartedHistory = value(restarted.store.read());
  const restartedContributors = new Set((rebuilt as SharedLoopRecord).outcomeLog.map(outcome =>
    restartedHistory.find(fact => fact.id === outcome.completion.fact.id)!.machine));
  expect(restartedContributors).toEqual(new Set(['machine-a', 'machine-b']));
}, 20_000);
