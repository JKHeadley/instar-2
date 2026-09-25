import { describe, expect, it } from 'vitest';
import { decideContext, type SentinelState, type SessionObservation } from '../../src/awareness/sentinel.js';

const T = 1_790_000_000_000;
const obs = (over: Partial<SessionObservation> = {}): SessionObservation => ({
  session: 's1', topic: '42', alive: true, startedAt: T, pane: 'idle', stuck: null,
  compactions: [], grounded: [], turnsClosed: [], ...over,
  contextConsumed: over.contextConsumed ?? over.grounded ?? [],
});
const empty: SentinelState = { sessions: [] };
const run = (now: number, state: SentinelState, observations: SessionObservation[], extra: Partial<Parameters<typeof decideContext>[0]> = {}) =>
  decideContext({ now, stopped: false, state, observations, groundings: [{ topic: '42', current: 'd', file: 'd' }], ...extra });
const kinds = (r: ReturnType<typeof decideContext>) => r.actions.map(a => a.kind === 'signal' ? `signal:${a.event}` : a.kind);

describe('context sentinel', () => {
  it('rewrites a stale grounding file, and leaves a fresh one alone', () => {
    const stale = run(T, empty, [], { groundings: [{ topic: '42', current: 'sha256:b', file: 'sha256:a' }, { topic: '7', current: 'sha256:c', file: 'sha256:c' }] });
    expect(stale.actions).toEqual([{ kind: 'write-grounding', topic: '42' }]);
    expect(run(T, empty, [], { groundings: [{ topic: '9', current: 'sha256:x', file: null }] }).actions).toEqual([{ kind: 'write-grounding', topic: '9' }]);
  });

  it('closes a respawn episode on the hook receipt without acting', () => {
    const r = run(T + 1_000, empty, [obs({ grounded: [{ at: T + 500, source: 'startup', digest: 'd' }] })]);
    expect(kinds(r)).toEqual(['signal:grounding-verified']);
    expect(r.state.sessions[0]!.episode).toMatchObject({ kind: 'respawn', status: 'recovered' });
    expect(kinds(run(T + 2_000, r.state, [obs({ grounded: [{ at: T + 500, source: 'startup', digest: 'd' }] })]))).toEqual([]);
  });

  it('waits out the grace window, then re-grounds an idle compacted session exactly once per attempt', () => {
    const compacted = obs({ compactions: [T + 20_000] });
    const r0 = run(T + 5_000, empty, [obs({ grounded: [{ at: T, source: 'startup', digest: 'd' }] })]);
    const early = run(T + 30_000, r0.state, [{ ...compacted, grounded: [{ at: T, source: 'startup', digest: 'd' }] }]);
    expect(kinds(early)).toEqual([]);
    expect(early.state.sessions[0]!.episode).toMatchObject({ kind: 'compact', status: 'awaiting-receipt' });
    const late = run(T + 80_000, early.state, [{ ...compacted, grounded: [{ at: T, source: 'startup', digest: 'd' }] }]);
    expect(late.actions[0]).toEqual({ kind: 'reground', session: 's1', topic: '42', operation: `awareness-reground:s1:compact:${T + 20_000}` });
    expect(kinds(late)).toEqual(['reground', 'signal:reground-requested']);
    // Inside the verify window: no second send.
    expect(kinds(run(T + 100_000, late.state, [{ ...compacted, grounded: [{ at: T, source: 'startup', digest: 'd' }] }]))).toEqual([]);
    // The session processed the delivery: recovered.
    const done = run(T + 120_000, late.state, [obs({ ...compacted, grounded: [{ at: T, source: 'startup', digest: 'd' }],
      deliveriesConsumed: [{ at: T + 110_000, operation: `awareness-reground:s1:compact:${T + 20_000}`, lastInboundMessageId: null }] })]);
    expect(kinds(done)).toEqual(['signal:recovered-after-reground']);
    expect(done.state.sessions[0]!.episode).toMatchObject({ status: 'recovered', attempts: 1 });
  });

  it('accepts a compact grounding receipt a few ms before the compaction receipt (two hooks, one SessionStart)', () => {
    const r = run(T + 200_000, { sessions: [{ session: 's1', topic: '42', startedAt: T, recoveries: [], lastSignal: null,
      episode: { kind: 'respawn', openedAt: T, status: 'recovered', attempts: 0, lastAttemptAt: null, closedAt: T } }] },
    [obs({ compactions: [T + 100_000], resets: [{ at: T + 99_990, source: 'compact', id: 'reset-1' }],
      contextConsumed: [{ at: T + 99_990, source: 'compact', digest: 'd', resetId: 'reset-1' }] })]);
    expect(kinds(r)).toEqual(['signal:grounding-verified']);
  });

  it('never lets a startup receipt just before a compaction verify that compaction', () => {
    const settled = run(T + 1_000, empty, [obs({ grounded: [{ at: T + 5, source: 'startup', digest: 'd' }] })]).state;
    const r = run(T + 80_000, settled, [obs({ compactions: [T + 8_000], grounded: [{ at: T + 5, source: 'startup', digest: 'd' }] })]);
    expect(kinds(r)).toEqual(['reground', 'signal:reground-requested']);
  });

  it('does not reuse a same-digest receipt across close clear generations', () => {
    const first = obs({ resets: [{ at: T + 100, source: 'clear', id: 'clear-1', sessionId: 'owner' }],
      contextConsumed: [{ at: T + 101, source: 'clear', digest: 'd', resetId: 'clear-1', sessionId: 'owner' }] });
    const settled = run(T + 200, empty, [first]);
    expect(kinds(settled)).toEqual(['signal:grounding-verified']);
    const second = obs({ resets: [...first.resets!, { at: T + 5_100, source: 'clear', id: 'clear-2', sessionId: 'owner' }],
      contextConsumed: first.contextConsumed ?? [] });
    const pending = run(T + 5_200, settled.state, [second]);
    expect(kinds(pending)).toEqual([]);
    expect(pending.state.sessions[0]!.episode).toMatchObject({ kind: 'clear', status: 'awaiting-receipt' });
    expect(kinds(run(T + 70_000, pending.state, [second]))).toContain('reground');
  });

  it('does not certify a reset with a different digest or session identity', () => {
    const observation = obs({ sessionId: 'current-owner', resets: [{ at: T + 10, source: 'clear', id: 'one', sessionId: 'current-owner' }],
      contextConsumed: [{ at: T + 11, source: 'clear', digest: 'wrong', resetId: 'one', sessionId: 'current-owner' },
        { at: T + 12, source: 'clear', digest: 'd', resetId: 'one', sessionId: 'old-owner' }] });
    const pending = run(T + 100, empty, [observation]);
    expect(kinds(pending)).toEqual([]);
    expect(pending.state.sessions[0]!.episode).toMatchObject({ status: 'awaiting-receipt' });
    const matched = run(T + 200, pending.state, [obs({ ...observation, contextConsumed: [
      ...observation.contextConsumed!, { at: T + 150, source: 'clear', digest: 'd', resetId: 'one', sessionId: 'current-owner' }] })]);
    expect(kinds(matched)).toEqual(['signal:grounding-verified']);
  });

  it('keeps a reserved but unperformed delivery unconfirmed despite an unrelated turn-close', () => {
    const reserved = run(T + 80_000, empty, [obs()]);
    expect(kinds(reserved)).toContain('reground');
    const crash = run(T + 90_000, reserved.state, [obs({ turnsClosed: [T + 85_000] })]);
    expect(kinds(crash)).toEqual([]);
    expect(crash.state.sessions[0]!.episode).toMatchObject({ status: 'verifying' });
  });

  it('defers while the session is busy without spending an attempt, then caps attempts loudly', () => {
    let state = run(T, empty, [obs()]).state;
    state = run(T + 70_000, state, [obs({ pane: 'busy' })]).state;
    expect(state.sessions[0]!.episode).toMatchObject({ status: 'deferring', attempts: 0 });
    const first = run(T + 80_000, state, [obs()]);
    expect(kinds(first)).toEqual(['reground', 'signal:reground-requested']);
    const second = run(T + 80_000 + 180_000, first.state, [obs()]);
    expect(kinds(second)).toEqual(['reground', 'signal:reground-requested']);
    expect(second.actions[0]).toMatchObject({ operation: `awareness-reground:s1:respawn:${T}` });
    const exhausted = run(T + 80_000 + 360_000, second.state, [obs()]);
    expect(kinds(exhausted)).toEqual(['signal:reground-exhausted']);
    expect(kinds(run(T + 900_000, exhausted.state, [obs()]))).toEqual([]);
  });

  it('adopts an old incarnation first seen after a sentinel restart instead of re-grounding it', () => {
    const r = run(T + 3_600_000, empty, [obs()]);
    expect(r.actions).toEqual([]);
    expect(r.state.sessions[0]!.episode).toMatchObject({ status: 'recovered' });
  });

  it('a new incarnation (respawn) re-opens an episode', () => {
    const settled = run(T + 1_000, empty, [obs({ grounded: [{ at: T + 10, source: 'startup', digest: 'd' }] })]).state;
    const respawned = run(T + 500_000, settled, [obs({ startedAt: T + 400_000 })]);
    expect(kinds(respawned)).toEqual(['reground', 'signal:reground-requested']);
  });

  it('hands an idle context wall to the driver, bounded per cooldown, and never a busy one', () => {
    const settled = run(T + 1_000, empty, [obs({ grounded: [{ at: T + 10, source: 'startup', digest: 'd' }] })]).state;
    expect(kinds(run(T + 2_000, settled, [obs({ stuck: 'context-too-long', pane: 'busy' })]))).toEqual([]);
    const a = run(T + 2_000, settled, [obs({ stuck: 'context-too-long' })]);
    expect(kinds(a)).toEqual(['recover-context', 'signal:context-wall']);
    const b = run(T + 3_000, a.state, [obs({ stuck: 'context-wedge' })]);
    expect(kinds(b)).toEqual([]);
    const second = run(T + 700_000, b.state, [obs({ stuck: 'context-wedge' })]);
    expect(kinds(second)).toContain('recover-context');
    const c = run(T + 701_000, second.state, [obs({ stuck: 'context-wedge' })]);
    expect(kinds(c)).toEqual(['signal:recovery-exhausted']);
    expect(kinds(run(T + 1_300_000, c.state, [obs({ stuck: 'context-wedge' })]))).toEqual([]);
    expect(kinds(run(T + 2_000_000, c.state, [obs({ stuck: 'context-wedge' })]))).toEqual([]);
    const replacement = run(T + 2_100_000, c.state, [obs({ session: 's2', startedAt: T + 2_100_000, stuck: 'context-wedge' })]);
    expect(kinds(replacement)).not.toContain('recover-context');
    const recovered = run(T + 2_100_100, replacement.state, [obs({ session: 's2', startedAt: T + 2_100_000,
      resets: [{ at: T + 2_100_050, source: 'compact', id: 'new' }],
      contextConsumed: [{ at: T + 2_100_060, source: 'compact', digest: 'd', resetId: 'new' }] })]);
    expect(kinds(recovered)).toContain('signal:grounding-verified');
    expect(recovered.state.sessions[0]!.recoveries).toEqual([]);
    expect(kinds(run(T + 2_101_000, recovered.state, [obs({ session: 's2', startedAt: T + 2_100_000,
      stuck: 'context-wedge', resets: [{ at: T + 2_100_050, source: 'compact', id: 'new' }],
      contextConsumed: [{ at: T + 2_100_060, source: 'compact', digest: 'd', resetId: 'new' }] })]))).toContain('recover-context');
  });

  it('treats rate limits and policy wedges as signal-only', () => {
    const settled = run(T + 1_000, empty, [obs({ grounded: [{ at: T + 10, source: 'startup', digest: 'd' }] })]).state;
    expect(kinds(run(T + 2_000, settled, [obs({ stuck: 'rate-limited' })]))).toEqual(['signal:stuck']);
  });

  it('stop suppresses every action but keeps signals', () => {
    const r = decideContext({ now: T + 80_000, stopped: true, state: empty, observations: [obs({ stuck: 'context-too-long' })],
      groundings: [{ topic: '42', current: 'a', file: 'b' }] });
    expect(r.actions.filter(a => a.kind !== 'signal')).toEqual([]);
  });

  it('bounds actions per tick', () => {
    const many = Array.from({ length: 10 }, (_, i) => obs({ session: `s${i}`, topic: `${i}` }));
    const r = decideContext({ now: T + 80_000, stopped: false, state: empty, observations: many, groundings: [], config: { maxActionsPerTick: 3 } });
    expect(r.actions.filter(a => a.kind === 'reground')).toHaveLength(3);
    const next = decideContext({ now: T + 80_001, stopped: false, state: r.state, observations: many, groundings: [], config: { maxActionsPerTick: 3 } });
    expect(next.actions.filter(a => a.kind === 'reground').map(a => a.kind === 'reground' && a.session)).toEqual(['s3', 's4', 's5']);
  });

  it('never lets stale-file rewrites starve a re-ground', () => {
    const groundings = Array.from({ length: 10 }, (_, i) => ({ topic: `t${i}`, current: 'new', file: 'old' }));
    const r = decideContext({ now: T + 80_000, stopped: false, state: empty, observations: [obs()], groundings, config: { maxActionsPerTick: 1 } });
    expect(r.actions.filter(a => a.kind === 'write-grounding')).toHaveLength(1);
    expect(r.actions.filter(a => a.kind === 'reground')).toHaveLength(1);
  });

  it('closes an open episode when the session dies (crash handling is not ours)', () => {
    const open = run(T + 5_000, empty, [obs()]).state;
    const r = run(T + 6_000, open, [obs({ alive: false })]);
    expect(kinds(r)).toEqual(['signal:session-gone']);
    expect(r.state.sessions[0]!.episode).toMatchObject({ status: 'session-gone' });
  });
});
