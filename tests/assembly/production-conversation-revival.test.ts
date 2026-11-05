/**
 * Carryover row 03: the 1.x lost-worker recovery discipline inside the production
 * conversation port. Each case is one decision boundary of the carried ResumeQueue /
 * ResumeQueueDrainer / SessionRecovery behavior as it now runs behind Part Ten's ports:
 * three calm ticks on the shared gauge, the one-per-interval gate, the 15-second settling
 * check with exact no-effect proof before the 3-attempt / 2-minute / 30-minute ladder, the
 * 2-per-24h resurrection ledger, the 24-hour TTL with pause freeze, the operator levers and
 * status, the 20-minute pressure-held and paused-waiting notices with durable no-duplicate
 * delivery, and the observe-only Tier-1 check. Offline over the public adapter contract;
 * no live harness or channel proof is claimed.
 */
import { createHash } from 'node:crypto';
import { expect, it } from 'vitest';
import { createConversationSessionPort } from '../../src/assembly/production-conversation-session.js';
import type { ConversationSessionConfig, ConversationState } from '../../src/assembly/production-conversation-session.js';
import type { ConversationDelivery, ConversationWorker } from '../../src/assembly/conversation-harness-adapter.js';
import type { HarnessAdapterPort } from '../../src/assembly/contracts.js';
import type { SessionWorkEdge, SessionWorkEdgeClose } from '../../src/assembly/production-session-work.js';
import { assemblyRuntimeFixture } from './runtime-fixture.js';
import { value } from '../facts/fixtures.js';

const hash = (text: string) => `sha256:${createHash('sha256').update(text).digest('hex')}`;

/** A lost worker: the first delivery observes an exact exit; capacity, pressure and the clock are levers. */
type Options = Omit<Partial<ConversationSessionConfig>, 'pressure'> & { pressure?: ConversationSessionConfig['pressure'] | undefined };
function lostWorker(options: Options = {}) {
  // `pressure: undefined` means a host without a gauge; absent means the fixture's own gauge.
  const { pressure: gauge, ...rest } = options;
  const f = assemblyRuntimeFixture();
  let clock = 1000, stopped = false, state: ConversationState | null = null, answer = '{"answer":"hello"}';
  let active: ConversationDelivery | null = null, capacity = true, pressure: 'normal' | 'moderate' | 'critical' = 'normal';
  let exits = 0, dieAfterLaunch = 0, effectsAfterDeath = false, pending = 0; const dead = new Set<string>();
  const launches: ConversationWorker[] = [], delivered: ConversationDelivery[] = [], notices: { kind: string; detail: string }[] = [];
  const audits: Record<string, unknown>[] = [], edges: (SessionWorkEdge | SessionWorkEdgeClose)[] = [], admissions: SessionWorkEdge[] = [];
  const adapter: HarnessAdapterPort<2> = {
    describe: () => ({ version: 2, subsequentInput: true, output: 'reply-and-turn-end', resume: false }),
    launch: async input => { const worker = { launch: `process-${launches.length}`, incarnation: input.incarnation, claim: input.claim }; launches.push(worker); return worker; },
    deliver: async input => { delivered.push(input); active = input; return { state: 'accepted', evidence: 'accepted' }; },
    observe: async input => {
      if (!input.delivery) {
        // The settling observation: a replacement that dies inside the window stays dead for
        // every later observation of that same launch (retirement observes it once more).
        if (dead.has(input.launch)) return { observations: [{ kind: 'exit', evidence: 'died while settling' }], cursor: 0, complete: true };
        if (dieAfterLaunch > 0) { dieAfterLaunch--; dead.add(input.launch); if (effectsAfterDeath) pending = 1; return { observations: [{ kind: 'exit', evidence: 'died while settling' }], cursor: 0, complete: true }; }
        return { observations: [], cursor: input.cursor, complete: true };
      }
      if (exits > 0) { exits--; capacity = false; return { observations: [{ kind: 'exit', evidence: 'exact worker absent' }], cursor: input.cursor, complete: true }; }
      const observations = [{ kind: 'reply' as const, delivery: active!.operation, text: answer, digest: hash(answer) },
        { kind: 'turn-end' as const, delivery: active!.operation, state: 'completed' as const }];
      return { observations: observations.slice(input.cursor), cursor: 2, complete: true };
    },
    control: async () => ({ state: 'closed', evidence: 'stop' }),
  };
  const config: ConversationSessionConfig = {
    conversation: 'operator-1', allowanceDeadline: 10_000_000_000, authorized: () => true, currentAuthority: () => 'existing-role',
    store: { load: () => structuredClone(state), save: next => { state = structuredClone(next); } },
    createAdapter: () => adapter, contextRecoveryAllowed: () => true,
    io: { clearResult: () => {}, readResult: () => null, modelCalls: () => delivered.length, wait: async ms => { clock += ms; },
      prepareAdmission: (_claim, edge) => { admissions.push(edge); }, closeAdmission: () => {},
      admissionState: () => ({ refused: false, refusalReason: null, openDelegations: [], uncertainEffects: 0, toolPreparations: pending }) },
    resources: { admit: async () => capacity ? ({ attach: async () => {}, release: async () => true }) : null },
    context: f.c, now: () => clock, stopped: () => stopped, append: row => { if (row.type !== 'SessionWorkCall') edges.push(row); },
    parent: 'run-1', owner: 'machine-1', placement: 'local', transport: 'fake', workingScope: '/scope', resultDirectory: '/scope/results',
    artifact: 'artifact', incarnation: 'incarnation', deadlineMs: 14_400_000, pollMs: 100, maxCalls: 100, maxSteps: 64, maxResultBytes: 65536,
    ...('pressure' in options ? (gauge ? { pressure: gauge } : {}) : { pressure: () => pressure }),
    notice: (kind, detail) => notices.push({ kind, detail }), audit: event => audits.push(event),
    ...rest,
  };
  const port = value(createConversationSessionPort(config));
  const request = (operation: string) => ({ operation, question: 'What do you remember?', context: '{"memory":"tea"}', authority: 'existing-role' });
  return { port, config, request, launches, delivered, notices, audits, admissions, edges,
    state: () => structuredClone(state!), restore: (next: ConversationState) => { state = structuredClone(next); },
    restart: () => value(createConversationSessionPort(config)), advance: (ms: number) => { clock += ms; }, now: () => clock,
    lose: (times = 1) => { exits = times; }, capacity: (next: boolean) => { capacity = next; },
    pressure: (next: typeof pressure) => { pressure = next; }, stop: () => { stopped = true; },
    dieWhileSettling: (times: number, withEffects = false) => { dieAfterLaunch = times; effectsAfterDeath = withEffects; },
    answer: (text: string) => { answer = text; },
  };
}

/** Lose the worker mid-turn; capacity returns immediately, so only the drainer's gates hold the revival. */
async function queuedRevival(options: Options = {}) {
  const f = lostWorker(options); f.lose();
  const request = f.request('lost');
  expect(await f.port.run(request)).toMatchObject({ state: 'queued' });
  expect(f.state().inputs[0]).toMatchObject({ state: 'revival-queued', workerRecovery: 'restoring' });
  expect(f.state().revivalQueue?.entries).toHaveLength(1);
  f.capacity(true);
  return { ...f, lostRequest: request };
}

it('a lost worker waits for three consecutive calm ticks of the shared gauge; pressure resets the streak', async () => {
  const f = await queuedRevival();
  // The loss tick itself read the gauge once (calm=1). Two more calm ticks are required.
  expect(f.state().revivalBrakes?.calmTicks).toBe(1);
  f.advance(60_000); await f.port.maintain(); expect(f.launches).toHaveLength(1);
  expect((await f.port.collect('lost'))?.outcome.detail).toContain('waiting for calm host pressure');
  f.pressure('moderate'); f.advance(60_000); await f.port.maintain();
  expect(f.state().revivalBrakes?.calmTicks).toBe(0); expect(f.launches).toHaveLength(1);
  f.pressure('normal');
  for (let n = 1; n <= 2; n++) { f.advance(60_000); await f.port.maintain(); expect(f.launches).toHaveLength(1); }
  f.advance(60_000); await f.port.maintain();
  expect(f.launches).toHaveLength(2);
  expect((await f.port.collect('lost'))?.outcome).toMatchObject({ state: 'complete', text: '{"answer":"hello"}' });
  expect(f.delivered).toHaveLength(1);
  expect(f.state().revivalQueue?.entries[0]).toMatchObject({ status: 'respawned', attempts: 0 });
  expect(f.state().revivalQueue?.tombstones[0]).toMatchObject({ stableKey: 'topic:operator-1', resurrections: 0 });
  expect(f.notices.map(n => n.kind)).toEqual(['resumed']);
  await f.port.close();
});

it('the calm streak is durable across a host restart, so a restart neither resets nor skips the hysteresis', async () => {
  const f = await queuedRevival();
  f.advance(60_000); await f.port.maintain();
  expect(f.state().revivalBrakes?.calmTicks).toBe(2);
  const next = f.restart(); f.advance(60_000); await next.maintain();
  expect(f.launches).toHaveLength(2);
  expect((await next.collect('lost'))?.outcome.state).toBe('complete'); await next.close();
});

it('without a gauge the host cannot count calm ticks and the resource owner alone gates the revival', async () => {
  const f = lostWorker({ pressure: undefined });
  f.lose();
  expect(await f.port.run(f.request('lost'))).toMatchObject({ state: 'queued' });
  f.capacity(true); f.advance(60_000); await f.port.maintain();
  expect(f.launches).toHaveLength(2); expect((await f.port.collect('lost'))?.outcome.state).toBe('complete');
  await f.port.close();
});

it('the fifteen-second settling check retires a replacement that died with proven no effect and climbs the ladder: 2 min, 4 min, then gave-up', async () => {
  const f = await queuedRevival({ pressure: undefined });
  f.dieWhileSettling(3);
  const attempts: number[] = [];
  for (let n = 1; n <= 3; n++) {
    f.advance(60_000); const before = f.now(); await f.port.maintain();
    const entry = f.state().revivalQueue!.entries[0]!;
    attempts.push(entry.attempts);
    if (n < 3) {
      expect(entry).toMatchObject({ status: 'queued', attempts: n });
      expect(entry.nextAttemptAt).toBe(before + 15_000 + 2 * 60_000 * 2 ** (n - 1));
      expect(f.state().inputs[0]?.state).toBe('revival-queued');
      expect(f.state().worker).toBeNull();
      // Backoff holds the next tick: no launch until nextAttemptAt.
      f.advance(60_000); await f.port.maintain(); expect(f.launches).toHaveLength(1 + n);
      f.advance(2 * 60_000 * 2 ** (n - 1));
    }
  }
  expect(attempts).toEqual([1, 2, 3]);
  expect(f.state().revivalQueue!.entries[0]).toMatchObject({ status: 'gave-up:max-attempts', attempts: 3 });
  expect((await f.port.collect('lost'))?.outcome).toMatchObject({ state: 'failed' });
  expect((await f.port.collect('lost'))?.outcome.detail).toContain('gave up: gave-up:max-attempts after 3 attempt(s)');
  expect(f.launches).toHaveLength(4); expect(f.delivered).toHaveLength(1);
  expect(f.notices.map(n => n.kind)).toContain('gave-up');
  // Three consecutive failures opened the 30-minute breaker, durably.
  expect(f.state().revivalBrakes).toMatchObject({ consecutiveFailures: 0 });
  expect(f.state().revivalBrakes!.breakerOpenUntil).toBeGreaterThan(f.now());
  expect(f.notices.filter(n => n.kind === 'breaker')).toHaveLength(1);
  await f.port.close();
});

it('an open breaker holds the next lost worker for its 30-minute cooldown, across restart, then drains', async () => {
  const f = await queuedRevival({ pressure: undefined });
  f.dieWhileSettling(3);
  for (const wait of [60_000, 2 * 60_000 + 60_000, 4 * 60_000 + 60_000]) { f.advance(wait); await f.port.maintain(); }
  expect(f.state().revivalQueue!.entries[0]!.status).toBe('gave-up:max-attempts');
  const opened = f.state().revivalBrakes!.breakerOpenUntil; expect(opened - f.now()).toBe(30 * 60_000);
  // A new message loses its worker too; the breaker, not capacity, holds its revival.
  f.lose();
  expect(await f.port.run(f.request('second'))).toMatchObject({ state: 'queued' });
  f.capacity(true);
  const next = f.restart(); f.advance(60_000); await next.maintain();
  expect((await next.collect('second'))?.outcome.detail).toContain('the revival breaker is open');
  expect(f.launches).toHaveLength(5);
  f.advance(30 * 60_000); await next.maintain();
  expect((await next.collect('second'))?.outcome.state).toBe('complete');
  expect(f.launches).toHaveLength(6); await next.close();
});

it('a replacement that died with effects the host cannot prove absent is invalidated and never retried', async () => {
  const f = await queuedRevival({ pressure: undefined });
  f.dieWhileSettling(1, true);
  f.advance(60_000); await f.port.maintain();
  expect(f.state().revivalQueue!.entries[0]).toMatchObject({ status: 'invalidated:uncertain-after-spawn', attempts: 0 });
  expect((await f.port.collect('lost'))?.outcome).toMatchObject({ state: 'uncertain' });
  expect((await f.port.collect('lost'))?.outcome.detail).toContain('invalidated: invalidated:uncertain-after-spawn');
  expect(f.state().revivalBrakes?.consecutiveFailures).toBe(0);
  f.advance(10 * 60_000); await f.port.maintain();
  expect(f.launches).toHaveLength(2); expect(f.delivered).toHaveLength(1);
  await f.port.close();
});

it('the resurrection ledger caps the third loss in 24 hours and the cap is loud; the window reset admits it again', async () => {
  const f = lostWorker({ pressure: undefined });
  for (const id of ['one', 'two']) {
    f.lose(); expect(await f.port.run(f.request(id))).toMatchObject({ state: 'queued' });
    f.capacity(true); f.advance(60_000); await f.port.maintain();
    expect((await f.port.collect(id))?.outcome.state).toBe('complete');
  }
  expect(f.state().revivalQueue?.tombstones[0]).toMatchObject({ resurrections: 1 });
  f.lose(); expect(await f.port.run(f.request('three'))).toMatchObject({ state: 'failed' });
  expect((await f.port.collect('three'))?.outcome.detail).toContain('revival refused: resurrection-cap');
  expect(f.notices.filter(n => n.kind === 'resurrection-cap')).toHaveLength(1);
  expect(f.state().inputs[2]?.request).toEqual(f.request('three'));
  f.capacity(true); f.advance(60_000); await f.port.maintain(); expect(f.launches).toHaveLength(3);
  // Outside the 24-hour window the ledger resets.
  f.advance(24 * 3600_000); f.lose(); expect(await f.port.run(f.request('four'))).toMatchObject({ state: 'queued' });
  f.capacity(true); f.advance(60_000); await f.port.maintain();
  expect((await f.port.collect('four'))?.outcome.state).toBe('complete');
  await f.port.close();
});

it('the TTL expires a held revival with the pressure-starved marker and one notice; a pause freezes that clock', async () => {
  // The conversation's admitted lifetime (at most four hours) is the tighter brake in 2.0, so the
  // source 24-hour TTL is exercised here on the same clock at a one-hour setting inside that lifetime.
  const f = await queuedRevival({ revival: { entryTtlHours: 1 } });
  f.pressure('critical');
  f.port.revival!.pause('operator hold');
  f.advance(70 * 60_000); await f.port.maintain();
  expect(f.state().revivalQueue!.entries[0]!.status).toBe('queued');
  expect(f.notices.filter(n => n.kind === 'paused-waiting')).toHaveLength(1);
  expect((await f.port.collect('lost'))?.outcome.detail).toContain('the revival queue is paused');
  f.port.revival!.unpause();
  f.advance(60_000); await f.port.maintain();
  expect(f.state().revivalQueue!.entries[0]!.status).toBe('queued'); // the pause was excluded from the age
  f.advance(60 * 60_000); await f.port.maintain();
  expect(f.state().revivalQueue!.entries[0]).toMatchObject({ status: 'gave-up:ttl', pressureStarved: true });
  expect((await f.port.collect('lost'))?.outcome).toMatchObject({ state: 'failed' });
  expect(f.notices.filter(n => n.kind === 'ttl-expired')).toHaveLength(1);
  expect(f.notices.find(n => n.kind === 'ttl-expired')?.detail).toContain('1 pressure-starved');
  // The operator lever reopens the retained input through the same gates.
  f.pressure('normal');
  expect(f.port.revival!.requeue('lost')).toEqual({ ok: true });
  expect(f.state().inputs[0]?.state).toBe('revival-queued');
  for (let n = 0; n < 3; n++) { f.advance(60_000); await f.port.maintain(); }
  expect((await f.port.collect('lost'))?.outcome.state).toBe('complete');
  expect(f.launches).toHaveLength(2); expect(f.delivered).toHaveLength(1);
  await f.port.close();
});

it('cancel settles the retained input without a launch and requeue of a cancelled entry is refused', async () => {
  const f = await queuedRevival({ pressure: undefined });
  expect(f.port.revival!.cancel('lost')).toBe(true);
  f.advance(60_000); await f.port.maintain();
  expect((await f.port.collect('lost'))?.outcome.detail).toContain('cancelled by the operator');
  expect(f.port.revival!.requeue('lost')).toEqual({ ok: false, why: 'not-gave-up' });
  expect(f.launches).toHaveLength(1);
  expect(f.port.revival!.status()).toMatchObject({ paused: false, breakerOpen: false, consecutiveFailures: 0 });
  expect(f.port.revival!.status().entries[0]!.status).toBe('cancelled');
  await f.port.close();
});

it('a pause is never cleared by elapsed time; the paused-waiting notice is sent once and not again after restart', async () => {
  const f = await queuedRevival();
  f.port.revival!.pause('message-sentinel emergency stop');
  for (let n = 0; n < 3; n++) { f.advance(61 * 60_000); await f.port.maintain(); }
  expect(f.state().revivalQueue?.paused).toBe(true);
  expect(f.notices.filter(n => n.kind === 'paused-waiting')).toHaveLength(1);
  const next = f.restart(); f.advance(60_000); await next.maintain();
  expect(f.notices.filter(n => n.kind === 'paused-waiting')).toHaveLength(1);
  expect(f.launches).toHaveLength(1);
  await next.close();
});

it('a revival held by pressure for twenty minutes raises one pressure-held notice, not repeated across restart, re-armed after it clears', async () => {
  const f = await queuedRevival();
  f.pressure('moderate');
  f.advance(20 * 60_000 - 60_000); await f.port.maintain();
  expect(f.notices.filter(n => n.kind === 'pressure-held')).toHaveLength(0);
  f.advance(60_000); await f.port.maintain();
  expect(f.notices.filter(n => n.kind === 'pressure-held')).toHaveLength(1);
  expect(f.notices[0]!.detail).toContain('under memory/CPU pressure');
  const next = f.restart(); f.advance(60_000); await next.maintain();
  expect(f.notices.filter(n => n.kind === 'pressure-held')).toHaveLength(1);
  f.pressure('normal');
  for (let n = 0; n < 3; n++) { f.advance(60_000); await next.maintain(); }
  expect((await next.collect('lost'))?.outcome.state).toBe('complete');
  expect(f.state().revivalBrakes?.pressureHeldNotified).toBe(false);
  await next.close();
});

it('the observe-only Tier-1 check is audited with identity-only provenance and never defers the revival; a hung check sheds at five seconds', async () => {
  const f = await queuedRevival({ pressure: undefined, sanityCheck: async () => ({ sensible: false, reasoning: 'reads as a crash loop' }) });
  f.advance(60_000); await f.port.maintain();
  expect((await f.port.collect('lost'))?.outcome.state).toBe('complete');
  const verdict = f.audits.filter(a => a.event === 'tier1-verdict').at(-1);
  expect(verdict).toMatchObject({ supervision: 'verdict', sensible: false, reasoning: 'reads as a crash loop' });
  const g = await queuedRevival({ pressure: undefined, sanityCheck: () => new Promise(() => {}) });
  g.advance(60_000); const before = g.now(); await g.port.maintain();
  expect((await g.port.collect('lost'))?.outcome.state).toBe('complete');
  expect(g.audits.filter(a => a.event === 'tier1-verdict').at(-1)).toMatchObject({ supervision: 'shed' });
  expect(g.now()).toBeGreaterThanOrEqual(before + 5_000);
  await f.port.close(); await g.port.close();
});

it('the cross-topic one-per-interval gate holds a second revival as a quota hold without consuming an attempt', async () => {
  let allowed = false;
  const f = await queuedRevival({ pressure: undefined, revivalGate: () => allowed });
  f.advance(60_000); await f.port.maintain();
  expect(f.launches).toHaveLength(1);
  expect(f.state().revivalQueue!.entries[0]).toMatchObject({ status: 'queued', attempts: 0 });
  expect(f.audits.some(a => a.event === 'gates-blocked' && a.gate === 'quota')).toBe(true);
  allowed = true; f.advance(60_000); await f.port.maintain();
  expect((await f.port.collect('lost'))?.outcome.state).toBe('complete');
  await f.port.close();
});

it('stop during the settling window retains the input and launches nothing further', async () => {
  const f = await queuedRevival({ pressure: undefined });
  const wait = f.config.io.wait;
  f.config.io.wait = async ms => { await wait(ms); f.stop(); };
  f.advance(60_000); await f.port.maintain();
  expect(f.launches).toHaveLength(2); expect(f.delivered).toHaveLength(1);
  expect((await f.port.collect('lost'))?.outcome.state).not.toBe('complete');
  expect(f.state().inputs[0]?.request).toEqual(f.lostRequest);
});

it('a queue entry whose input was settled by a restart is invalidated, never drained as fresh work', async () => {
  const f = await queuedRevival({ pressure: undefined });
  f.restore({ ...f.state(), inputs: f.state().inputs.map(row => ({ ...row, state: 'dispatching' as const })) });
  const next = f.restart(); f.advance(60_000); await next.maintain();
  expect((await next.collect('lost'))?.outcome.state).toBe('uncertain');
  expect(f.state().revivalQueue!.entries[0]!.status).toBe('invalidated:input-settled');
  expect(f.launches).toHaveLength(1); await next.close();
});
