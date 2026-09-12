import { afterEach, expect, it } from 'vitest';
import { canonical, consumeResult } from '../../src/index.js';
import { createFactStore } from '../../src/facts/index.js';
import { createLoopA1Authority, createLoopA1Spine, decodeLoopPolicyA1 } from '../../src/transport/loop-a1/index.js';
import type {
  LoopOutcomeInput,
  SharedBreakerLoopPolicy,
  SharedLoopRecord,
} from '../../src/transport/loop-a1/index.js';
import { privateKey } from '../facts/fixtures.js';
import { transportLoopFixture, value } from '../transport/loop-fixture.js';

afterEach(() => new Promise<void>(resolve => setImmediate(resolve)));

const pressureScope = {
  target: 'target:review', conversation: 'conversation:1', machine: 'fleet', pool: 'holders',
} as const;
const reference = (record: SharedLoopRecord) => ({
  owner: 'part-six' as const, name: 'LoopRecord' as const, id: record.episode,
});
const bytes = (input: unknown) => value(canonical(input)).bytes;
const detail = (result: unknown) => consumeResult(result as never, {
  Success: () => '', Refused: refusal => refusal.detail,
});

function setup(overrides: Partial<SharedBreakerLoopPolicy> = {}) {
  const fixture = transportLoopFixture();
  const policy = value(decodeLoopPolicyA1({
    ...fixture.sharedPolicy,
    id: 'repair20-policy',
    failureThreshold: 1,
    halfOpenTrials: 1,
    halfOpenConcurrency: 1,
    ...overrides,
  }, fixture.c)) as SharedBreakerLoopPolicy;
  fixture.registerPolicy(policy);
  (fixture.host as { maxLeaseTerm: number }).maxLeaseTerm = 50_000;
  const fence = value(fixture.api.acquire('repair20-lease', '', 50_000));
  const schedule = {
    command: 'repair20-schedule', fence, currentOwnerRun: fixture.run, policy,
    episodeKey: 'only', operationFamily: 'recovery', pressureScope, sourceVector: fixture.vector,
  };
  let loop = value(fixture.api.scheduleEpisode(schedule));
  const completions = new Map<string, LoopOutcomeInput['completion']>();
  const admitInput = (attempt: string) => ({
    command: `repair20-admit:${attempt}`, fence, episode: reference(loop), attempt,
  });
  const admit = (attempt: string) => {
    loop = value(fixture.api.admitLoopAttempt(admitInput(attempt)));
  };
  const outcomeInput = (attempt: string, kind: 'accepted' | 'failed' = 'accepted',
    restoration: LoopOutcomeInput['restoration'] = []): LoopOutcomeInput => ({
    command: `repair20-finish:${attempt}`,
    fence,
    episode: reference(loop),
    attempt,
    kind,
    failureClass: kind === 'failed' ? 'transport' : '',
    completion: completions.get(attempt) ?? (() => {
      const completion = fixture.appendOutcome(kind, attempt);
      completions.set(attempt, completion);
      return completion;
    })(),
    jitterPermille: 1000,
    restoration,
  });
  const finish = (attempt: string, kind: 'accepted' | 'failed' = 'accepted',
    restoration: LoopOutcomeInput['restoration'] = []) => {
    const input = outcomeInput(attempt, kind, restoration);
    loop = value(fixture.api.recordLoopOutcome(input));
    return input;
  };
  fixture.time(101);
  admit('failure');
  finish('failure', 'failed');
  fixture.time(121);
  return {
    fixture, fence, schedule, admitInput, admit, outcomeInput, finish,
    get loop() { return loop; },
  };
}

function restarted(state: ReturnType<typeof setup>, storage = state.fixture.storage) {
  const store = createFactStore(state.fixture.ctx, storage);
  return createLoopA1Authority(state.fixture.host,
    createLoopA1Spine(state.fixture.host, { context: state.fixture.ctx, privateKey }, store), state.fixture.c);
}

function cutNextLoopAppend(state: ReturnType<typeof setup>, cut: 'before' | 'after') {
  let fired = false;
  return {
    owner: 'part-ten' as const,
    read: () => state.fixture.storage.read(),
    append: (raw: string, head: string | null) => {
      const type = (JSON.parse(raw) as { body?: { record?: { type?: unknown } } }).body?.record?.type;
      if (!fired && type === 'SharedLoopRecord') {
        fired = true;
        if (cut === 'after') value(state.fixture.storage.append(raw, head));
        return state.fixture.result(() => { throw new Error(`repair20-${cut}-append-cut`); });
      }
      return state.fixture.storage.append(raw, head);
    },
  };
}

function expectRefusedWithoutWrite(state: ReturnType<typeof setup>, run: () => unknown,
  expectedDetail?: string) {
  const before = bytes(state.fixture.storage.read());
  const refusal = detail(run());
  expect(refusal).not.toBe('');
  if (expectedDetail) expect(refusal).toContain(expectedDetail);
  expect(bytes(state.fixture.storage.read())).toBe(before);
}

it.each(['before', 'after'] as const)(
  'SLB-A1-ORDINARY-REPLAY-124 V18 ordinary close retry after a %s-append cut returns the durable result after proof expiry',
  cut => {
    const state = setup({ maxDuration: 50_000 });
    state.admit('trial');
    const proof = state.fixture.restorationReference('assessment:witnessed-review');
    const input = state.outcomeInput('trial', 'accepted', [proof]);
    expect(detail(restarted(state, cutNextLoopAppend(state, cut)).recordLoopOutcome(input)))
      .toContain(`repair20-${cut}-append-cut`);
    if (cut === 'before') expect(value(restarted(state).recordLoopOutcome(input)).state).toBe('closed');

    const durable = value(restarted(state).inspect()).at(-1)!.record as SharedLoopRecord;
    const before = bytes(state.fixture.storage.read());
    state.fixture.time(10_100);
    const retry = restarted(state).recordLoopOutcome(input);
    expect(detail(retry)).toBe('');
    expect(bytes(value(retry))).toBe(bytes(durable));
    expect(bytes(state.fixture.storage.read())).toBe(before);

    const assessment = (state.fixture.assessmentFact('assessment:witnessed-review')!.body as unknown as {
      record: { captureStatuses: readonly { reference: string }[] };
    }).record;
    const capture = assessment.captureStatuses[0]!.reference;
    const captures = state.fixture.ctx.captures as Record<string,
      NonNullable<(typeof state.fixture.ctx.captures)[string]>>;
    const available = captures[capture]!;
    captures[capture] = { ...available, status: 'missing' };
    expectRefusedWithoutWrite(state, () => restarted(state).recordLoopOutcome(input));
    captures[capture] = available;
  },
  20_000,
);

it('SLB-A1-CURRENT-PROOF-125 V20 fresh complete proof closes the final trial after earlier proof expiry', () => {
  const state = setup({ halfOpenTrials: 2, maxDuration: 50_000, maxOpenDuration: 20_000 });
  state.admit('trial-1');
  const old = state.fixture.restorationReference('assessment:witnessed-review');
  state.finish('trial-1', 'accepted', [old]);
  expect(state.loop).toMatchObject({ state: 'half-open', halfOpenSucceeded: 1, closureEvidence: [old] });

  state.fixture.time(10_101);
  state.fixture.addAssessment('repair20-fresh');
  state.admit('trial-2');
  const fresh = state.fixture.restorationReference('repair20-fresh');
  const result = state.fixture.api.recordLoopOutcome(state.outcomeInput('trial-2', 'accepted', [fresh]));
  expect(detail(result)).toBe('');
  expect(value(result)).toMatchObject({ state: 'closed', closureEvidence: [fresh] });
});

it.each(['none', 'partial'] as const)(
  'SLB-A1-CURRENT-PROOF-125 V34 final accepted trial retains %s evidence without closing after earlier proof expiry',
  kind => {
    const state = setup({ halfOpenTrials: 2, maxDuration: 50_000, maxOpenDuration: 20_000 });
    state.admit('trial-1');
    state.finish('trial-1', 'accepted', [
      state.fixture.restorationReference('assessment:witnessed-review'),
    ]);
    state.fixture.time(10_101);
    state.admit('trial-2');
    let restoration: LoopOutcomeInput['restoration'] = [];
    if (kind === 'partial') {
      state.fixture.addAssessment('repair20-partial-base');
      state.fixture.addPartialAssessment('repair20-partial', 'repair20-partial-base');
      restoration = [state.fixture.restorationReference('repair20-partial')];
    }
    const result = state.fixture.api.recordLoopOutcome(
      state.outcomeInput('trial-2', 'accepted', restoration));
    expect(detail(result)).toBe('');
    expect(value(result)).toMatchObject({
      state: 'half-open', halfOpenSucceeded: 2, pendingAttempts: [], closureEvidence: [],
    });
    expect(value(result).outcomeLog.at(-1)!.restoration).toEqual(restoration);
  },
);

it('SLB-A1-CLOSED-REFERENCES-126 V24 refuses an extra field in a repeated schedule Run reference', () => {
  const state = setup();
  expectRefusedWithoutWrite(state, () => state.fixture.api.scheduleEpisode({
    ...state.schedule,
    currentOwnerRun: { ...state.fixture.run, extra: true },
  } as never), 'closed Run reference');
});

it.each(['admission', 'outcome'] as const)(
  'SLB-A1-CLOSED-REFERENCES-126 V24b refuses an extra field in an %s LoopRecord reference',
  mode => {
    const state = setup();
    if (mode === 'admission') {
      expectRefusedWithoutWrite(state, () => state.fixture.api.admitLoopAttempt({
        ...state.admitInput('trial'),
        episode: { ...reference(state.loop), extra: true },
      } as never), 'closed LoopRecord reference');
      return;
    }
    state.admit('trial');
    const input = state.outcomeInput('trial');
    expectRefusedWithoutWrite(state, () => state.fixture.api.recordLoopOutcome({
      ...input,
      episode: { ...reference(state.loop), extra: true },
    } as never), 'closed LoopRecord reference');
  },
);
