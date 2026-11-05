import { describe, it, expect, beforeEach, vi } from 'vitest';

import { SessionRecovery, transcriptDelta, sanitizeForPrompt,
  type RecoveryEvent, type SessionRecoveryDeps, type WorkerRecoveryState } from '../../src/assembly/worker-recovery.js';
import { detectToolCallStall, type StallInfo, type TranscriptTail } from '../../src/assembly/stall-detector.js';
import { detectCrashedSession, detectErrorLoop, type CrashInfo, type ErrorLoopInfo } from '../../src/assembly/crash-detector.js';

/**
 * WorkerRecovery tests — mechanical session crash/stall recovery.
 *
 * Carried from 1.x tests/unit/SessionRecovery.test.ts at
 * 4f88880a45f0a119aae3cfd2ccaf9ace26d405b9 for carryover row 03. The
 * detectors, the clock, the settle wait, the event log and the durable
 * state are now injected ports; the `vi.mock` of the 1.x detector modules and
 * the fake timers are replaced by those ports.
 *
 * Tests the deterministic recovery layer that runs before model triage:
 * stall detection, crash detection, truncation strategy escalation,
 * cooldowns, maxAttempts, and event logging.
 */

const stall = (over: Partial<StallInfo> = {}): StallInfo => ({
  sessionUuid: 'uuid-1', stalledAt: 1_000_000, stallDurationMs: 120000, lastToolName: 'Bash',
  lastToolInput: { command: 'npm test' }, lastToolUseId: 'tool-1', ...over,
});
const crash = (over: Partial<CrashInfo> = {}): CrashInfo => ({
  type: 'crash', sessionUuid: 'uuid-2', detectedAt: 1_000_000, errorType: 'tool_use_incomplete', lastToolName: 'Bash', ...over,
});

function world() {
  const clock = { now: 1_000_000 };
  let record: WorkerRecoveryState | null = null;
  const events: RecoveryEvent[] = [];
  const emitted: string[] = [];
  const store = { load: () => record === null ? null : structuredClone(record), save: (next: WorkerRecoveryState) => { record = Object.freeze(structuredClone(next)); } };
  function createMockDeps(overrides: Partial<SessionRecoveryDeps> = {}): SessionRecoveryDeps {
    return {
      isSessionAlive: vi.fn(() => true),
      killSession: vi.fn(),
      respawnSession: vi.fn(async () => {}),
      now: () => clock.now,
      wait: vi.fn(async (ms: number) => { clock.now += ms; }),
      store,
      logEvent: (event) => events.push(event),
      onEvent: (name) => emitted.push(name),
      ...overrides,
    };
  }
  return { clock, events, emitted, store, createMockDeps, record: () => record };
}

describe('SessionRecovery', () => {
  let w: ReturnType<typeof world>;
  beforeEach(() => { w = world(); });

  describe('checkAndRecover returns recovered:false when disabled', () => {
    it('returns recovered:false immediately', async () => {
      const deps = w.createMockDeps();
      const recovery = new SessionRecovery({ enabled: false }, deps);

      const result = await recovery.checkAndRecover(1, 'test-session');

      expect(result.recovered).toBe(false);
      expect(result.failureType).toBeNull();
      expect(result.message).toBe('Recovery disabled');
    });
  });

  describe('checkAndRecover returns recovered:false when no transcript detector is wired', () => {
    it('returns recovered:false with "No JSONL found"', async () => {
      const deps = w.createMockDeps();
      const recovery = new SessionRecovery({ enabled: true }, deps);

      const result = await recovery.checkAndRecover(1, 'test-session');

      expect(result.recovered).toBe(false);
      expect(result.failureType).toBeNull();
      expect(result.message).toBe('No JSONL found');
    });
  });

  describe('recoverFromStall kills and respawns', () => {
    it('kills session and respawns when stall is detected', async () => {
      const deps = w.createMockDeps({ isSessionAlive: vi.fn(() => true), detectStall: () => stall() });
      const recovery = new SessionRecovery({ enabled: true }, deps);

      const result = await recovery.checkAndRecover(1, 'test-session');

      expect(result.recovered).toBe(true);
      expect(result.failureType).toBe('stall');
      expect(deps.killSession).toHaveBeenCalledWith('test-session');
      expect(deps.wait).toHaveBeenCalledWith(3000);
      expect(deps.respawnSession).toHaveBeenCalledWith(1, 'test-session', expect.stringContaining('RECOVERY'));
      expect(w.emitted).toContain('recovery:stall');
    });
  });

  describe('recoverFromCrash records the strategy and respawns', () => {
    it('uses last_exchange strategy on attempt 1 and rewinds only through a host port', async () => {
      const truncate = vi.fn();
      const deps = w.createMockDeps({ isSessionAlive: vi.fn(() => false), detectCrash: () => crash(), truncate });
      const recovery = new SessionRecovery({ enabled: true }, deps);

      const result = await recovery.checkAndRecover(2, 'crash-session');

      expect(result.recovered).toBe(true);
      expect(result.failureType).toBe('crash');
      expect(result.strategy).toBe('last_exchange');
      expect(result.attemptNumber).toBe(1);
      expect(truncate).toHaveBeenCalledWith('crash-session', 'last_exchange', undefined);
      expect(deps.killSession).toHaveBeenCalledWith('crash-session');
      expect(deps.respawnSession).toHaveBeenCalledWith(2, 'crash-session', expect.stringContaining('rewound using strategy "last_exchange"'));
    });

    it('without a rewind port the prompt never claims a rewind (Part Ten rewinds no transcript)', async () => {
      const deps = w.createMockDeps({ isSessionAlive: vi.fn(() => false), detectCrash: () => crash() });
      const recovery = new SessionRecovery({ enabled: true }, deps);
      const result = await recovery.checkAndRecover(2, 'crash-session');
      expect(result.recovered).toBe(true);
      const prompt = vi.mocked(deps.respawnSession).mock.calls[0]![2]!;
      expect(prompt).toContain('restarted without rewinding the conversation');
      expect(prompt).not.toContain('rewound');
    });

    it('escalates to last_successful_tool on attempt 2', async () => {
      const deps = w.createMockDeps({ isSessionAlive: vi.fn(() => false), detectCrash: () => crash({ sessionUuid: 'uuid-3', errorType: 'api' }) });
      const recovery = new SessionRecovery({ enabled: true, cooldownMs: 0 }, deps);

      // First attempt
      await recovery.checkAndRecover(3, 'crash-session-2');

      // Advance past cooldown
      w.clock.now += 1;

      // Second attempt
      const result = await recovery.checkAndRecover(3, 'crash-session-2');

      expect(result.recovered).toBe(true);
      expect(result.strategy).toBe('last_successful_tool');
      expect(result.attemptNumber).toBe(2);
    });
  });

  describe('work-check deferral surfaces deferred:true (false-death-report guard)', () => {
    it('stall deferral returns recovered:false + deferred:true and does NOT kill', async () => {
      // hasActiveProcesses=true -> killForRecovery vetoes the kill: the session is
      // alive and producing work. The result MUST carry deferred:true so callers
      // can distinguish "alive - leave it, say nothing" from a genuine failed
      // recovery of a dead session (the 2026-06-06 "conversation too long" flood
      // was the monitor notifying the user on deferrals).
      const deps = w.createMockDeps({ hasActiveProcesses: vi.fn(() => true), detectStall: () => stall({ sessionUuid: 'uuid-defer' }) });
      const recovery = new SessionRecovery({ enabled: true }, deps);

      const result = await recovery.checkAndRecover(1, 'defer-session');

      expect(result.recovered).toBe(false);
      expect(result.deferred).toBe(true);
      expect(result.failureType).toBe('stall');
      expect(deps.killSession).not.toHaveBeenCalled();
    });

    it('a genuine recovery result does NOT carry deferred', async () => {
      const deps = w.createMockDeps({ hasActiveProcesses: vi.fn(() => false), detectStall: () => stall({ sessionUuid: 'uuid-real' }) });
      const recovery = new SessionRecovery({ enabled: true }, deps);

      const result = await recovery.checkAndRecover(2, 'real-session');

      expect(result.recovered).toBe(true);
      expect(result.deferred).toBeUndefined();
    });
  });

  describe('cooldown prevents rapid recovery', () => {
    it('returns recovered:false within cooldown period', async () => {
      const deps = w.createMockDeps({ isSessionAlive: vi.fn(() => true), detectStall: () => stall({ sessionUuid: 'uuid-cooldown', lastToolInput: {} }) });
      const recovery = new SessionRecovery({ enabled: true, cooldownMs: 60000 }, deps);

      // First attempt succeeds
      const result1 = await recovery.checkAndRecover(10, 'cooldown-session');
      expect(result1.recovered).toBe(true);

      // Advance less than cooldown
      w.clock.now += 30000;

      // Second attempt should be blocked by cooldown
      const result2 = await recovery.checkAndRecover(10, 'cooldown-session');
      expect(result2.recovered).toBe(false);
      expect(result2.message).toContain('cooldown');
    });

    it('the source cooldown is fifteen minutes and attempts survive a host restart through the store', async () => {
      const deps = w.createMockDeps({ detectStall: () => stall({ sessionUuid: 'uuid-durable' }) });
      const recovery = new SessionRecovery({}, deps);
      expect((await recovery.checkAndRecover(11, 's')).recovered).toBe(true);
      w.clock.now += 15 * 60 * 1000 - 3000 - 1; // the 3-second settle already advanced the clock
      const reopened = new SessionRecovery({}, w.createMockDeps({ detectStall: () => stall({ sessionUuid: 'uuid-durable' }) }));
      expect((await reopened.checkAndRecover(11, 's')).message).toContain('cooldown');
      w.clock.now += 1;
      expect((await reopened.checkAndRecover(11, 's')).attemptNumber).toBe(2);
    });
  });

  describe('maxAttempts prevents infinite loops', () => {
    it('stops recovery after maxAttempts is reached', async () => {
      const deps = w.createMockDeps({ isSessionAlive: vi.fn(() => true), detectStall: () => stall({ sessionUuid: 'uuid-max', lastToolName: 'Read', lastToolInput: {} }) });
      const recovery = new SessionRecovery({ enabled: true, maxAttempts: 2, cooldownMs: 0 }, deps);

      // Attempt 1 succeeds
      const r1 = await recovery.checkAndRecover(20, 'max-session');
      expect(r1.recovered).toBe(true);
      expect(r1.attemptNumber).toBe(1);

      // Advance past cooldown (0ms)
      w.clock.now += 1;

      // Attempt 2 succeeds
      const r2 = await recovery.checkAndRecover(20, 'max-session');
      expect(r2.recovered).toBe(true);
      expect(r2.attemptNumber).toBe(2);

      // Advance past cooldown
      w.clock.now += 1;

      // Attempt 3 should be blocked
      const r3 = await recovery.checkAndRecover(20, 'max-session');
      expect(r3.recovered).toBe(false);
      expect(r3.message).toContain('exhausted');
    });

    it('the source ceiling is three attempts', async () => {
      const deps = w.createMockDeps({ detectStall: () => stall({ sessionUuid: 'uuid-three' }) });
      const recovery = new SessionRecovery({ cooldownMs: 0 }, deps);
      for (const n of [1, 2, 3]) { expect((await recovery.checkAndRecover(21, 's')).attemptNumber).toBe(n); w.clock.now += 1; }
      expect((await recovery.checkAndRecover(21, 's')).message).toContain('exhausted');
    });
  });

  describe('logEvent writes to the host event sink', () => {
    it('records recovery events', async () => {
      const deps = w.createMockDeps({ isSessionAlive: vi.fn(() => true), detectStall: () => stall({ sessionUuid: 'uuid-log', lastToolName: 'Grep', stallDurationMs: 60000 }) });
      const recovery = new SessionRecovery({ enabled: true }, deps);

      await recovery.checkAndRecover(30, 'log-session');

      expect(w.events).toHaveLength(1);
      const entry = w.events[0]!;
      expect(entry.failureType).toBe('stall');
      expect(entry.recovered).toBe(true);
      expect(entry.topicId).toBe(30);
      expect(entry.sessionName).toBe('log-session');
    });
  });

  describe('getStats aggregates from recorded events', () => {
    it('counts events by type and success', () => {
      const now = 5_000_000;
      const events: RecoveryEvent[] = [
        { timestamp: now, failureType: 'stall', recovered: true, topicId: 1, sessionName: 's1', attempt: 1 },
        { timestamp: now, failureType: 'stall', recovered: false, topicId: 2, sessionName: 's2', attempt: 1 },
        { timestamp: now, failureType: 'crash', recovered: true, topicId: 3, sessionName: 's3', attempt: 1 },
        { timestamp: now, failureType: 'error_loop', recovered: true, topicId: 4, sessionName: 's4', attempt: 1 },
        { timestamp: now, failureType: 'error_loop', recovered: true, topicId: 5, sessionName: 's5', attempt: 1 },
      ];

      const stats = SessionRecovery.getStats(events, 0); // since epoch

      expect(stats.attempts.stall).toBe(2);
      expect(stats.successes.stall).toBe(1);
      expect(stats.attempts.crash).toBe(1);
      expect(stats.successes.crash).toBe(1);
      expect(stats.attempts.errorLoop).toBe(2);
      expect(stats.successes.errorLoop).toBe(2);
    });
  });

  describe('error loops', () => {
    it('recovers an error loop with the prompt naming the repeated pattern and a DIFFERENT approach', async () => {
      const loop: ErrorLoopInfo = { type: 'error_loop', sessionUuid: 'uuid-loop', detectedAt: 1_000_000, loopCount: 3, failingPattern: 'ENOENT: no such file', failingCommand: 'cat missing' };
      const deps = w.createMockDeps({ detectErrorLoop: () => loop });
      const recovery = new SessionRecovery({}, deps);
      const result = await recovery.checkAndRecover(40, 'loop-session');
      expect(result).toMatchObject({ recovered: true, failureType: 'error_loop', strategy: 'last_exchange', attemptNumber: 1 });
      const prompt = vi.mocked(deps.respawnSession).mock.calls[0]![2]!;
      expect(prompt).toContain('repeated 3 times: "ENOENT: no such file"');
      expect(prompt).toContain('Try a DIFFERENT approach');
    });
  });

  describe('context wall: durable latch, transcript-growth deferral and the 30-minute ceiling', () => {
    const probe = (size: number) => ({ resolved: true, path: '/t/a.jsonl', size, mtime: size });
    function wall(over: Partial<SessionRecoveryDeps> = {}) {
      let size = 100;
      const deps = w.createMockDeps({
        captureSessionOutput: () => 'Context limit reached · /compact or /clear to continue',
        detectContextExhaustion: (output) => ({ matched: output.includes('Context limit reached'), pattern: 'context limit' }),
        probeTranscript: () => probe(size),
        respawnSessionFresh: vi.fn(async () => {}),
        ...over,
      });
      return { deps, grow: (by: number) => { size += by; } };
    }

    it('the first observation latches durably and defers without spending an attempt', async () => {
      const { deps } = wall();
      const recovery = new SessionRecovery({}, deps);
      const first = await recovery.checkAndRecover(50, 'wall');
      expect(first).toMatchObject({ recovered: false, deferred: true, failureType: 'context_exhaustion' });
      expect(first.message).toContain('waiting for a second transcript observation');
      expect(recovery.getContextWedgedFirstSeenAt(50)).toBe(1_000_000);
      expect(w.record()?.wedgedSeen['50']?.firstSeenAt).toBe(1_000_000);
      expect(w.record()?.attempts).toEqual({});
      // A restarted host keeps the latch.
      expect(new SessionRecovery({}, w.createMockDeps()).hasContextWedgedSeen(50)).toBe(true);
    });

    it('a growing transcript keeps deferring; a static one recovers through compaction first', async () => {
      const { deps, grow } = wall({ attemptCompaction: vi.fn(async () => ({ cleared: true })) });
      const recovery = new SessionRecovery({}, deps);
      await recovery.checkAndRecover(51, 'wall');
      grow(10); w.clock.now += 60_000;
      expect((await recovery.checkAndRecover(51, 'wall')).message).toContain('still growing');
      w.clock.now += 60_000;
      const result = await recovery.checkAndRecover(51, 'wall');
      expect(result).toMatchObject({ recovered: true, attemptNumber: 1 });
      expect(result.message).toContain('compaction');
      expect(deps.killSession).not.toHaveBeenCalled();
      expect(recovery.hasContextWedgedSeen(51)).toBe(false);
    });

    it('the 30-minute ceiling forces recovery even while the transcript still grows', async () => {
      const { deps, grow } = wall();
      const recovery = new SessionRecovery({}, deps);
      await recovery.checkAndRecover(52, 'wall');
      grow(5); w.clock.now += 30 * 60 * 1000 - 1;
      expect((await recovery.checkAndRecover(52, 'wall')).deferred).toBe(true);
      grow(5); w.clock.now += 1;
      const result = await recovery.checkAndRecover(52, 'wall');
      expect(result).toMatchObject({ recovered: true, attemptNumber: 1 });
      expect(deps.killSession).toHaveBeenCalledWith('wall');
      expect(deps.respawnSessionFresh).toHaveBeenCalled();
    });

    it('the fresh prompt carries the exact already-sent reply from the host receipt, never a polled guess', async () => {
      const { deps } = wall({ inFlightReply: async () => 'Already told you: Tuesday.' });
      const recovery = new SessionRecovery({}, deps);
      await recovery.checkAndRecover(53, 'wall'); w.clock.now += 1000;
      const result = await recovery.checkAndRecover(53, 'wall');
      expect(result.message).toContain('in-flight reply captured');
      const prompt = vi.mocked(deps.respawnSessionFresh!).mock.calls[0]![2]!;
      expect(prompt).toContain('<previous_reply>\nAlready told you: Tuesday.\n</previous_reply>');
      expect(deps.wait).not.toHaveBeenCalledWith(3000);
    });
  });

  describe('Part D ownership gate', () => {
    it('forwards to a reachable peer, withholds from an unreachable one, proceeds when the registry is unknown', async () => {
      const telemetry: string[] = [];
      const base = { ownershipFollowsLiveWork: () => true, selfMachineId: () => 'me', detectStall: () => stall(),
        emitRecoveryGateTelemetry: (row: { kind: string }) => telemetry.push(row.kind) };
      const forward = new SessionRecovery({}, w.createMockDeps({ ...base, ownerOfTopic: () => 'peer', isOwnerReachable: () => true,
        forwardPendingInboundViaRoute: async () => ({ forwarded: 1, nonePending: false }) }));
      expect((await forward.checkAndRecover(60, 's')).message).toContain('Recovery forwarded');
      const withhold = new SessionRecovery({}, w.createMockDeps({ ...base, ownerOfTopic: () => 'peer', isOwnerReachable: () => { throw new Error('mesh'); } }));
      expect((await withhold.checkAndRecover(60, 's')).message).toContain('Recovery withheld');
      const proceed = new SessionRecovery({}, w.createMockDeps({ ...base, ownerOfTopic: () => { throw new Error('registry'); } }));
      expect((await proceed.checkAndRecover(60, 's')).recovered).toBe(true);
      expect(telemetry).toEqual(['recovery-gate-reachability-unknown', 'recovery-gate-registry-unknown']);
    });
  });
});

describe('carried detectors over adapter-supplied transcript entries', () => {
  const tail = (entries: TranscriptTail['entries']): TranscriptTail => ({ sessionUuid: 'uuid-t', entries });
  const toolUse = (at: number, name = 'Bash', id = 'tu-1') => ({ type: 'assistant', timestampMs: at,
    message: { stop_reason: 'tool_use', content: [{ type: 'tool_use', id, name, input: { command: 'npm test' } }] } });
  const toolResult = (id = 'tu-1', isError = false, content = 'ok') => ({ type: 'user',
    message: { content: [{ type: 'tool_result', tool_use_id: id, is_error: isError, content }] } });

  it('detectToolCallStall: a tool_use without a result past its per-tool threshold is a stall', () => {
    const at = 1_000_000;
    expect(detectToolCallStall(tail([toolUse(at)]), at + 10 * 60_000 - 1)).toBeNull();
    expect(detectToolCallStall(tail([toolUse(at)]), at + 10 * 60_000)).toMatchObject({ lastToolName: 'Bash', stallDurationMs: 10 * 60_000, sessionUuid: 'uuid-t' });
    expect(detectToolCallStall(tail([toolUse(at, 'Read')]), at + 60_000)).toMatchObject({ lastToolName: 'Read' });
    expect(detectToolCallStall(tail([toolUse(at), toolResult()]), at + 3600_000)).toBeNull();
    expect(detectToolCallStall(tail([]), at)).toBeNull();
  });

  it('detectCrashedSession: dead process with an incomplete tool_use or an error result; a clean end_turn is not a crash', () => {
    const now = 2_000_000;
    expect(detectCrashedSession(tail([toolUse(1)]), true, now)).toBeNull();
    expect(detectCrashedSession(tail([toolUse(1)]), false, now)).toMatchObject({ errorType: 'tool_use_incomplete', lastToolName: 'Bash', detectedAt: now });
    expect(detectCrashedSession(tail([toolUse(1), toolResult('tu-1', true, 'API rate limit 429')]), false, now)).toMatchObject({ errorType: 'api' });
    expect(detectCrashedSession(tail([{ type: 'assistant', message: { stop_reason: 'end_turn', content: [] } }]), false, now)).toBeNull();
  });

  it('detectErrorLoop: three normalized identical errors name the loop and its command', () => {
    const entries = [1, 2, 3].flatMap(n => [toolUse(n, 'Bash', `tu-${n}`), toolResult(`tu-${n}`, true, `boom at 2026-11-04T10:0${n}:00Z pid=${n}`)]);
    expect(detectErrorLoop(tail(entries), 9)).toMatchObject({ loopCount: 3, failingPattern: 'boom at <TIMESTAMP> pid:<PID>', failingCommand: 'npm test' });
    expect(detectErrorLoop(tail(entries.slice(0, 4)), 9)).toBeNull();
  });

  it('transcriptDelta: growth, static and unknown', () => {
    const a = { resolved: true, path: '/p', size: 1, mtime: 1 };
    expect(transcriptDelta(a, { ...a, size: 2 })).toBe('grew');
    expect(transcriptDelta(a, a)).toBe('static');
    expect(transcriptDelta(a, { ...a, path: '/q' })).toBe('unknown');
    expect(transcriptDelta({ ...a, resolved: false }, a)).toBe('unknown');
  });

  it('sanitizeForPrompt strips overrides and control characters and truncates', () => {
    expect(sanitizeForPrompt('a‮b\x00c')).toBe('abc');
    expect(sanitizeForPrompt('x'.repeat(5000)).length).toBe(2000);
  });
});
