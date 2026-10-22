import { createHash } from 'node:crypto';
import { createServer, get } from 'node:http';
import { mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, expect, it } from 'vitest';
// @ts-expect-error -- host composition module is JavaScript, exercised at runtime.
import { observeInstalledSessionLogin } from '../preview/installed-harness-logins.mjs';
// @ts-expect-error Host-only JavaScript projection.
import { createWorkingActivities } from '../preview/working-activity.mjs';
import { sessionLoginNotices, type SessionLoginObservation } from '../preview/credential-reminders.js';
import { CONVERSATION_SESSION_LIMITS } from '../../src/assembly/production-conversation-session.js';
import { SESSION_WORK_LIMITS } from '../../src/assembly/production-session-work.js';
import { createSessionConversationAdapter } from '../../src/assembly/conversation-harness-adapter.js';
import { assemblyRuntimeFixture } from './runtime-fixture.js';
import { value, refused } from '../facts/fixtures.js';
import { buildLiteralSendArgs, chunkLiteralForTmux, classifyPaneIdle, classifyBlockingMenu, classifyPaneReadiness, classifyStuckSignature,
  createProductionSessionDriver } from '../../src/assembly/production-session-driver.js';
import type { ProductionSessionConfig, SessionIO, SessionJournal } from '../../src/assembly/production-session-driver.js';

const hash = (text: string) => `sha256:${createHash('sha256').update(text).digest('hex')}`;
const fixtureRoots: string[] = [];
afterEach(() => { for (const root of fixtureRoots.splice(0)) rmSync(root, { recursive: true, force: true }); });
function fixture(framework: 'claude-code' | 'codex-cli' = 'claude-code', extra: Partial<Pick<ProductionSessionConfig,
  'confinement' | 'toolAdmission' | 'modelGate' | 'turnDeadlineMs' | 'launchVia' | 'requireTurnHook' | 'observeActivity'>> = {}) {
  const f = assemblyRuntimeFixture(); let now = 1000, stopped = false, pane = '❯ ', sends = 0;
  const root = mkdtempSync(join(tmpdir(), 'instar-session-test-')); fixtureRoots.push(root);
  const homes = { a: join(root, 'login-a'), b: join(root, 'login-b') };
  mkdirSync(homes.a); mkdirSync(homes.b);
  let journal: SessionJournal = { sessions: [], deliveries: [], resumes: {} };
  const calls: string[][] = []; let failSend = false, failSpawn = false, failIdentitySave = false, armed = false, armCount = 0;
  let stamp = '321:1000', transcript = true;
  const dead = new Set<string>();
  const live = new Set<string>();
  let hooks: { kind: 'turn-closed' | 'compact'; sessionId: string; at: number; receiptId: string }[] = [];
  const io: SessionIO = {
    exclusive: run => run(),
    tmux(args) {
      calls.push([...args]);
      if (args[0] === 'new-session') { if (failSpawn) { failSpawn = false; return { code: 1, stdout: '' }; }
        live.add(`=${args[args.indexOf('-s') + 1]}:`); return { code: 0, stdout: '' }; }
      if (args[0] === 'display-message') return { code: 0, stdout: `${stamp}\n` };
      if (args[0] === 'capture-pane') return { code: 0, stdout: pane };
      if (args[0] === 'has-session') return { code: !live.has(args[2] ?? '') || dead.has(args[2] ?? '') ? 1 : 0, stdout: '' };
      if (args[0] === 'kill-session') { dead.add(args[2] ?? '');
        if (onKill) { const callback = onKill; onKill = null; callback(); }
        return { code: 0, stdout: '' }; }
      if (args[0] === 'send-keys') {
        if (failSend) { failSend = false; throw Error('simulated process death before send'); }
        sends++; if (args.includes('Enter')) {
          if (onEnter) { const callback = onEnter; onEnter = null; callback(); }
          if (journal.sessions.at(-1)?.continuation?.state === 'sending')
            pane = `continued\n${framework === 'codex-cli' ? '›' : '❯'} `;
        }
        return { code: 0, stdout: '' };
      }
      return { code: 0, stdout: '' };
    },
    sleep() {}, load: () => journal, save: next => {
      if (failIdentitySave && next.sessions.length > journal.sessions.length) { failIdentitySave = false; throw Error('identity save failed'); }
      journal = structuredClone(next);
      if (onPrepared && next.deliveries.some(row => row.state === 'prepared')) {
        const callback = onPrepared; onPrepared = null; callback();
      }
    }, armDeadline() { armed = true; armCount++; },
    readInbox: () => hooks, transcriptExists: (_framework, _id, _cwd, directory) => transcript && directory === homes.a,
  };
  let onEnter: (() => void) | null = null;
  let onKill: (() => void) | null = null;
  let onPrepared: (() => void) | null = null;
  const config = { operatorOwnUse: true as const, confinement: 'unconfined' as const,
    framework, executable: '/synthetic', cwd: '/work', home: homes.a, configHome: homes.a,
    context: f.c, io, now: () => now, stopped: () => stopped, resolveIntake: () => 'hello',
    maxSessions: 1, turnDeadlineMs: 1000, readyTimeoutMs: 1000, protectedSessions: [],
    continuation: () => ({ text: 'Agent-owned prior exchange and work', source: 'agent-root' }), ...extra };
  const driver = createProductionSessionDriver(config);
  const launch = () => value(driver.launch({ operation: 'op', claim: 'topic', artifact: 'sha256:test',
    incarnation: 'inc', workingScope: '/work', handles: [] }));
  const deliver = (identity: string) => driver.deliver({ operation: 'deliver', processIdentity: identity,
    intake: 'input', digest: hash('hello'), incarnation: 'inc' });
  return { driver, launch, deliver, calls, homes, get journal() { return journal; }, get sends() { return sends; },
    get armed() { return armed; }, get armCount() { return armCount; },
    changePane: (value: string) => { pane = value; }, failNextSend: () => { failSend = true; },
    failNextIdentitySave: () => { failIdentitySave = true; }, changeStamp: (value: string) => { stamp = value; },
    failNextSpawn: () => { failSpawn = true; },
    transcript: (value: boolean) => { transcript = value; }, onEnter: (callback: () => void) => { onEnter = callback; },
    onKill: (callback: () => void) => { onKill = callback; },
    onPrepared: (callback: () => void) => { onPrepared = callback; },
    hook: (at: number) => { hooks = [...hooks, { kind: 'turn-closed', sessionId: '12345678-1234-1234-1234-123456789abc',
      at, receiptId: `receipt-${hooks.length + 1}` }]; },
    compactHook: (at: number) => { hooks = [...hooks, { kind: 'compact', sessionId: '12345678-1234-1234-1234-123456789abc',
      at, receiptId: `compact-${hooks.length + 1}` }]; },
    markPrepared: () => { journal = { ...journal, deliveries: journal.deliveries.map(row => ({ ...row, state: 'prepared' })) }; },
    stop: () => { stopped = true; }, time: (value: number) => { now = value; }, config };
}

const rateConfig = { turnDeadlineMs: 120_000, requireTurnHook: true,
  confinement: 'admitted' as const, toolAdmission: { command: () => '/hook', timeoutSeconds: 10 },
  modelGate: () => 'http://127.0.0.1:1234/' + 'a'.repeat(32) + '/claim' };
const recordedLimit = JSON.parse(readFileSync(new URL('../fixtures/provider-failure/claude-limit-result.json', import.meta.url), 'utf8')).result as string;
const throttleFixture = JSON.parse(readFileSync(new URL('../fixtures/provider-failure/server-throttle.json', import.meta.url), 'utf8')) as {
  result: string; overloaded: string; pane: string;
};
const recordedThrottle = throttleFixture.result;
// Documented 1.x incident context, with a constructed supported quiet footer (not a new capture).
const quietThrottlePane = throttleFixture.pane.replace(' · esc to interrupt', '')
  .replace('  ⎿ Tip: Use /btw to ask a quick side question\n', '');
it.each([...[recordedThrottle, `  ⎿  ${recordedThrottle}`, throttleFixture.overloaded]
  .map(throttle => `${throttle}\n❯ `), quietThrottlePane])(
  'ports recorded 1.x server throttle %s into bounded recovery without poisoning account quota', pane => {
  const f = fixture('claude-code', rateConfig), id = f.launch(); value(f.deliver(id));
  expect(classifyPaneIdle(pane, 'claude-code')).toBe(true);
  f.changePane(pane);
  const activities = createWorkingActivities({ now: f.config.now, read: () => '' });
  activities.observe('input', 'topic', 'start');
  const observe = (driver = f.driver) => {
    const result = driver.observe({ operation: 'deliver', processIdentity: id });
    activities.observeSession(f.journal.sessions[0], result);
    return value(result);
  };
  expect(observe()).toMatchObject({ phase: 'launched', detail: 'rate-limit recovery waiting' });
  expect(classifyStuckSignature(pane)).toBe('provider-throttled');
  expect(activities.current('input')).toMatchObject({ wait: 'rate-limit', running: false });
  expect(value(f.driver.observeIdle(id))).toBeNull();
  f.hook(1001); f.time(1001);
  expect(observe().phase).toBe('launched'); // a throttle Stop is not completion
  const sends = f.sends;
  f.time(30_999); expect(observe().phase).toBe('launched'); expect(f.sends).toBe(sends);
  f.time(31_000);
  const restarted = createProductionSessionDriver(f.config);
  expect(observe(restarted).detail).toBe('rate-limit continuation submitted');
  expect(activities.current('input')).toBeNull();
  expect(f.journal.sessions[0]?.turnDeadline).toBe(121_000);
  f.time(36_000); const after = f.sends;
  expect(observe(restarted)).toMatchObject({ phase: 'pause-observed', detail: 'provider-throttled' });
  expect(observe(restarted).phase).toBe('pause-observed'); expect(f.sends).toBe(after);
  expect(f.journal.deliveries).toHaveLength(1);
});

it('does not recover server throttle quotations, native retries, old output or completed turns', () => {
  for (const pane of [`quoted: ${recordedThrottle}\n❯ `, `${recordedThrottle}\nRetrying in 7s · attempt 3/10\n❯ `,
    `${recordedThrottle}\nA completed answer.\n❯ `, `> ${recordedThrottle}\n❯ `,
    throttleFixture.pane,
    quietThrottlePane.replace(recordedThrottle, `quoted: ${recordedThrottle}`),
    quietThrottlePane.replace(recordedThrottle, `> ${recordedThrottle}`),
    quietThrottlePane.replace('✻ Churned', 'Retrying in 7s · attempt 3/10\n✻ Churned'),
    quietThrottlePane.replace('✻ Churned', 'A completed answer.\n✻ Churned'),
    quietThrottlePane.replace('✻ Churned for 7m 43s', '✻ Churned for 7m 43s\nA completed answer.'),
    quietThrottlePane.replace('✻ Churned for 7m 43s', '✻ Churned for 7m 43s — quoted output')]) {
    expect(classifyStuckSignature(pane)).toBeNull();
    const f = fixture('claude-code', rateConfig), id = f.launch(); value(f.deliver(id));
    f.changePane(pane);
    expect(value(f.driver.observe({ operation: 'deliver', processIdentity: id })).detail).toBe('session live; turn still open');
    expect(f.journal.sessions[0]?.rateRecovery).toBeNull();
  }
  const f = fixture('claude-code', rateConfig), id = f.launch(); value(f.deliver(id));
  f.changePane(quietThrottlePane); f.hook(1001); f.time(1001);
  expect(value(f.driver.observe({ operation: 'deliver', processIdentity: id, resultAvailable: true })).phase).toBe('output-observed');
  expect(f.journal.sessions[0]?.rateRecovery).toBeNull();
});

it('continues a throttled turn once after backoff, preserving its intake and original deadline across driver restart', () => {
  const f = fixture('claude-code', rateConfig);
  const id = f.launch(); value(f.deliver(id));
  const limited = JSON.parse(readFileSync(new URL('../fixtures/provider-failure/claude-limit-result.json', import.meta.url), 'utf8'));
  f.changePane(`${limited.result}\n❯ `);
  const observe = (driver = f.driver) => value(driver.observe({ operation: 'deliver', processIdentity: id }));
  expect(observe()).toMatchObject({ phase: 'launched', detail: 'rate-limit recovery waiting' });
  const deadline = f.journal.sessions[0]?.turnDeadline;
  const before = f.sends;
  f.time(30_999); expect(observe().phase).toBe('launched'); expect(f.sends).toBe(before);
  f.time(31_000);
  const restarted = createProductionSessionDriver(f.config);
  expect(observe(restarted)).toMatchObject({ phase: 'launched', detail: 'rate-limit continuation submitted' });
  expect(f.journal.sessions[0]?.turnDeadline).toBe(deadline);
  expect(f.journal.deliveries).toHaveLength(1);
  expect(f.calls.filter(call => call[0] === 'send-keys' && call.includes('hello'))).toHaveLength(1);
  const after = f.sends;
  expect(observe(restarted).phase).toBe('launched'); expect(f.sends).toBe(after);
  f.changePane(`${limited.result}\nanswer\n❯ `); f.hook(31_001); f.time(31_001);
  expect(value(restarted.observe({ operation: 'deliver', processIdentity: id, resultAvailable: true })).phase).toBe('output-observed');
});

it('keeps a resumed worker busy under its original deadline despite old quota scrollback', () => {
  const captured = JSON.parse(readFileSync(new URL('../preview/fixtures/work-silence-terminal-2026-10-14.json', import.meta.url), 'utf8'));
  const f = fixture('claude-code', rateConfig), id = f.launch(); value(f.deliver(id));
  const observe = () => value(f.driver.observe({ operation: 'deliver', processIdentity: id }));
  f.changePane(`${recordedLimit}\n❯ `); expect(observe().phase).toBe('launched');
  f.time(31_000); expect(observe().phase).toBe('launched'); const sends = f.sends;
  for (const [index, at] of [36_000, 90_000].entries()) {
    f.time(at); f.changePane(`${recordedLimit}\n${captured.captures[index + 1].capture}`);
    expect(observe().phase).toBe('launched'); expect(f.sends).toBe(sends);
    expect(f.journal.sessions[0]?.turnDeadline).toBe(121_000);
  }
  f.time(100_000); f.changePane(`${recordedLimit}\nanswer\n❯ `); f.hook(100_000);
  expect(value(f.driver.observe({ operation: 'deliver', processIdentity: id, resultAvailable: true })).phase).toBe('output-observed');
  expect(f.sends).toBe(sends);
});

it('a fresh completed-turn receipt wins over quota text still visible in scrollback', () => {
  const f = fixture('claude-code', rateConfig), id = f.launch(); value(f.deliver(id));
  f.changePane(`${recordedLimit}\nanswer explaining the prior throttle\n❯ `); f.hook(1000);
  const sends = f.sends;
  expect(value(f.driver.observe({ operation: 'deliver', processIdentity: id, resultAvailable: true })).phase).toBe('output-observed');
  expect(f.journal.sessions[0]?.rateRecovery).toBeNull();
  expect(f.sends).toBe(sends);
});

it.each(['initial', 'waiting', 'accepted'] as const)('a throttle Stop without a result preserves recovery at %s', async phase => {
  const f = fixture('claude-code', rateConfig);
  const adapter = createSessionConversationAdapter({ createDriver: () => f.driver,
    resolveDelivery: () => undefined, io: {
      clearResult: () => undefined, readResult: () => null, modelCalls: () => 2,
      prepareAdmission: () => undefined, admissionState: () => ({ refused: false, openDelegations: [] }),
      closeAdmission: () => undefined, wait: async () => undefined,
    } });
  const worker = await adapter.launch({ operation: 'op', claim: 'topic', artifact: 'sha256:test',
    incarnation: 'inc', workingScope: '/work' });
  const delivery = { ...worker, operation: 'deliver', text: 'hello', digest: hash('hello'),
    resultPath: '/work/result', maxBytes: 1000 };
  await adapter.deliver(delivery);
  f.changePane(`${recordedLimit}\n❯ `);
  const observe = () => adapter.observe({ ...worker, delivery, cursor: 0, limit: 2 });
  if (phase !== 'initial') expect((await observe()).observations).toEqual([]);
  if (phase === 'accepted') { f.time(31_000); expect((await observe()).observations).toEqual([]); }
  const at = phase === 'initial' ? 1001 : phase === 'waiting' ? 2000 : 36_000;
  f.time(at); f.hook(at);
  const sends = f.sends;
  expect((await observe()).observations).toEqual(phase === 'accepted'
    ? [{ kind: 'paused', evidence: worker.launch, reason: 'rate-limited' }] : []);
  expect(value(f.driver.observe({ operation: 'deliver', processIdentity: worker.launch })))
    .toMatchObject(phase === 'accepted' ? { phase: 'pause-observed', detail: 'rate-limited' }
      : { phase: 'launched', detail: 'rate-limit recovery waiting' });
  expect(f.journal.sessions[0]).toMatchObject({ turnDeadline: 121_000, closedAt: null,
    turnCloseEvidence: null, rateRecovery: { state: phase === 'accepted' ? 'accepted' : 'waiting' } });
  expect(f.sends).toBe(sends);
  expect(f.journal.deliveries).toHaveLength(1);
});

it('a past compaction does not exclude a newly admitted input from throttle recovery', () => {
  const f = fixture('claude-code', rateConfig), id = f.launch();
  f.config.io.save({ ...f.journal, sessions: f.journal.sessions.map(row => ({ ...row, recovery: 1 })) });
  value(f.deliver(id)); f.changePane(`${recordedLimit}\n❯ `);
  expect(value(f.driver.observe({ operation: 'deliver', processIdentity: id })))
    .toMatchObject({ phase: 'launched', detail: 'rate-limit recovery waiting' });
});

it('exposes an uncompleted repeated throttle without a second nudge', () => {
  const f = fixture('claude-code', rateConfig), id = f.launch(); value(f.deliver(id));
  f.changePane(`${recordedLimit}\n❯ `);
  const observe = () => value(f.driver.observe({ operation: 'deliver', processIdentity: id }));
  expect(observe().phase).toBe('launched');
  refused(f.driver.recoverContext(id), 'idle prompt');
  f.time(31_000); expect(observe().phase).toBe('launched');
  const sends = f.sends;
  f.time(36_000);
  expect(observe()).toMatchObject({ phase: 'pause-observed', detail: 'rate-limited' });
  expect(observe().phase).toBe('pause-observed'); expect(f.sends).toBe(sends);
  expect(f.journal.sessions[0]?.turnDeadline).toBe(121_000);
});

it.each(['before-input', 'after-enter'])('never retries an uncertain continuation after restart: %s', point => {
  const f = fixture('claude-code', rateConfig), id = f.launch(); value(f.deliver(id));
  f.changePane(`${recordedLimit}\n❯ `);
  value(f.driver.observe({ operation: 'deliver', processIdentity: id }));
  f.time(31_000);
  if (point === 'before-input') f.failNextSend();
  else f.onEnter(() => { throw Error('simulated process death after Enter'); });
  refused(f.driver.observe({ operation: 'deliver', processIdentity: id }), 'simulated process death');
  expect(f.journal.sessions[0]?.rateRecovery?.state).toBe('sending');
  const sends = f.sends, restarted = createProductionSessionDriver(f.config);
  expect(value(restarted.observe({ operation: 'deliver', processIdentity: id })).phase).toBe('uncertain');
  expect(f.sends).toBe(sends);
});

it('accepts genuine completion during the wait without injecting a continuation', () => {
  const f = fixture('claude-code', rateConfig), id = f.launch(); value(f.deliver(id));
  f.changePane(`${recordedLimit}\n❯ `);
  value(f.driver.observe({ operation: 'deliver', processIdentity: id }));
  const sends = f.sends;
  f.time(2000); f.changePane('completed answer\n❯ '); f.hook(2000);
  expect(value(f.driver.observe({ operation: 'deliver', processIdentity: id })).phase).toBe('output-observed');
  expect(f.sends).toBe(sends);
});

it('the conversation adapter returns one answer for the original input after bounded throttle recovery', async () => {
  const f = fixture('claude-code', rateConfig); let result: string | null = null;
  const adapter = createSessionConversationAdapter({ createDriver: () => f.driver,
    resolveDelivery: () => undefined, io: {
      clearResult: () => { result = null; }, readResult: () => result, modelCalls: () => 2,
      prepareAdmission: () => undefined, admissionState: () => ({ refused: false, openDelegations: [] }),
      closeAdmission: () => undefined, wait: async () => undefined,
    } });
  const worker = await adapter.launch({ operation: 'op', claim: 'topic', artifact: 'sha256:test',
    incarnation: 'inc', workingScope: '/work' });
  const delivery = { ...worker, operation: 'deliver', text: 'hello', digest: hash('hello'),
    resultPath: '/work/result', maxBytes: 1000 };
  expect((await adapter.deliver(delivery)).state).toBe('accepted');
  f.changePane(`${recordedLimit}\n❯ `);
  const observe = (cursor = 0) => adapter.observe({ ...worker, delivery, cursor, limit: 2 });
  expect((await observe()).observations).toEqual([]);
  f.time(31_000); expect((await observe()).observations).toEqual([]);
  result = 'The requested result'; f.changePane(`${recordedLimit}\nanswer\n❯ `); f.time(31_001); f.hook(31_001);
  const answered = await observe();
  expect(answered.observations).toEqual([
    { kind: 'reply', delivery: 'deliver', text: result, digest: hash(result) },
    { kind: 'turn-end', delivery: 'deliver', state: 'completed' },
  ]);
  expect((await observe(answered.cursor)).observations).toEqual([]);
  expect(f.journal.deliveries).toHaveLength(1);
});

it('replays recorded summary, Jev, review, delivered and empty shapes across the Stop/result boundary', async () => {
  const recorded = JSON.parse(readFileSync(new URL('../preview/fixtures/retrospective-duty-followup-train-1-2026-10-08.json', import.meta.url), 'utf8'));
  const shapes = recorded.otherShapes as { kind: string; id: string; raw: string }[];
  expect(shapes.map(row => row.kind)).toEqual(['summary-writer', 'summary-uncertain', 'jev-undecided',
    'jev-unsure', 'reply-review', 'delivered-reply', 'empty-reply-in-recorded-context']);
  expect(shapes.map(row => row.id)).toEqual(['summary:715672480', '715672483', '715672482', '969389570',
    '969389923', 'telegram:8994258214:update:715672479', 'telegram:8994258214:update:715672550']);
  for (const row of shapes) {
    const f = fixture('claude-code', rateConfig);
    const driver = createProductionSessionDriver({ ...f.config, continuationRequired: () => true });
    const adapter = createSessionConversationAdapter({ createDriver: () => driver,
      resolveDelivery: () => undefined, io: {
        clearResult: () => undefined, readResult: () => row.raw, modelCalls: () => 2,
        prepareAdmission: () => undefined, admissionState: () => ({ refused: false, openDelegations: [] }),
        closeAdmission: () => undefined, wait: async () => { await new Promise(resolve => setImmediate(resolve)); f.hook(1000); },
      } });
    const launched = await adapter.launch({ operation: 'op', claim: 'topic', artifact: 'sha256:test', incarnation: 'inc', workingScope: '/work' });
    const id = launched.launch;
    expect(f.journal.sessions[0]?.continuation?.state).toBe('completed');
    value(f.deliver(id));
    f.changePane(row.raw); const sends = f.sends;
    value(driver.observe({ operation: 'deliver', processIdentity: id }));
    expect(f.journal.sessions[0]?.rateRecovery).toBeNull();
    expect(f.sends).toBe(sends);
    f.changePane(quietThrottlePane); f.hook(1000);
    const worker = { launch: id, incarnation: 'inc', claim: 'topic' };
    const delivery = { ...worker, operation: 'deliver', text: 'hello', digest: hash('hello'),
      resultPath: '/work/result', maxBytes: 100_000 };
    const actual = await adapter.observe({ ...worker, delivery, cursor: 0, limit: 2 });
    expect(actual.observations).toEqual(row.raw.trim()
      ? [{ kind: 'reply', delivery: 'deliver', text: row.raw, digest: hash(row.raw) },
        { kind: 'turn-end', delivery: 'deliver', state: 'completed' }] : []);
    expect(f.journal.sessions[0]?.turnDeadline).toBe(row.raw.trim() ? null : 121_000);
    expect(f.journal.sessions[0]?.rateRecovery?.state ?? null).toBe(row.raw.trim() ? null : 'waiting');
    expect(f.sends).toBe(sends);
  }
});

it.each(['stop', 'deadline', 'identity'] as const)('a waiting recovery cannot bypass %s', reason => {
  const f = fixture('claude-code', rateConfig), id = f.launch(); value(f.deliver(id));
  f.changePane(`${recordedLimit}\n❯ `);
  value(f.driver.observe({ operation: 'deliver', processIdentity: id }));
  const sends = f.sends;
  f.time(31_000);
  if (reason === 'stop') f.stop();
  if (reason === 'deadline') { f.time(121_000); f.hook(1001); }
  if (reason === 'identity') f.changeStamp('999:1000');
  const result = f.driver.observe({ operation: 'deliver', processIdentity: id });
  if (reason === 'identity') refused(result, 'identity changed');
  else expect(value(result).phase).toBe('exit-observed');
  if (reason === 'deadline') {
    expect(value(result)).toMatchObject({ safetyDeadline: 121_000 });
    expect(f.journal.sessions[0]?.deadlineHalt).toEqual({ deadline: 121_000, at: 121_000 });
    expect(value(f.driver.observe({ operation: 'again', processIdentity: id }))).toMatchObject({ safetyDeadline: 121_000 });
  }
  expect(f.sends).toBe(sends);
});

it.each(['compaction', 'uncertain-input', 'busy', 'unconfined', 'short-deadline'] as const)(
  'does not start throttle continuation for %s', reason => {
    const f = fixture('claude-code', reason === 'unconfined' ? { turnDeadlineMs: 120_000 }
      : { ...rateConfig, ...(reason === 'short-deadline' ? { turnDeadlineMs: 20_000 } : {}) });
    const id = f.launch(); value(f.deliver(id));
    if (reason === 'compaction') f.config.io.save({ ...f.journal,
      sessions: f.journal.sessions.map(row => ({ ...row, recovery: 1 })) });
    if (reason === 'uncertain-input') f.config.io.save({ ...f.journal,
      deliveries: f.journal.deliveries.map(row => ({ ...row, state: 'uncertain' })) });
    f.changePane(`${recordedLimit}\n${reason === 'busy' ? 'Working… (esc to interrupt)' : '❯ '}`);
    const sends = f.sends;
    value(f.driver.observe({ operation: 'deliver', processIdentity: id }));
    expect(f.journal.sessions[0]?.rateRecovery).toBeNull();
    expect(f.sends).toBe(sends);
  });

it('ports byte bounded tmux chunks, menu precedence, and tail gated stuck signatures', () => {
  expect(chunkLiteralForTmux('🙂'.repeat(3000)).every(part => Buffer.byteLength(part) <= 8000)).toBe(true);
  expect(chunkLiteralForTmux('🙂'.repeat(3000)).join('')).toBe('🙂'.repeat(3000));
  expect(buildLiteralSendArgs('instar20-' + 'a'.repeat(24), '-x')).toEqual(['send-keys', '-t', '=instar20-' + 'a'.repeat(24) + ':', '-l', '--', '-x']);
  expect(classifyPaneReadiness('❯ 1. Update\n  2. Skip')).toBe('menu');
  expect(classifyPaneReadiness('❯ ')).toBe('ready');
  expect(classifyStuckSignature('conversation is too long\n' + 'normal work\n'.repeat(20))).toBeNull();
  expect(classifyStuckSignature('conversation is too long')).toBe('context-too-long');
});

it('keeps recorded weekly usage warnings advisory while preserving real quota walls', () => {
  const recorded = JSON.parse(readFileSync(new URL('../fixtures/claude-usage-warning.json', import.meta.url), 'utf8'));
  const exhausted = JSON.parse(readFileSync(new URL('../fixtures/provider-failure/claude-limit-result.json', import.meta.url), 'utf8'));
  expect(recorded.captures.map((row: { updateId: number }) => row.updateId)).toEqual([840343021, 840343022]);
  expect(classifyStuckSignature(exhausted.result)).toBe('rate-limited');
  for (const row of recorded.captures) {
    const warning = row.capture.split('\n').find((line: string) => line.includes("You've used 76%"));
    expect(warning).toBeDefined();
    expect(classifyStuckSignature(warning)).toBeNull();
    expect(classifyStuckSignature(row.capture)).toBeNull();
    expect(classifyStuckSignature(`${row.capture}\n${exhausted.result}`)).toBe('rate-limited');
    const f = fixture(); const identity = f.launch(); value(f.deliver(identity));
    f.changePane(row.capture);
    expect(value(f.driver.observe({ operation: 'warning', processIdentity: identity })).phase).toBe('launched');
    expect(f.journal.sessions[0]?.turnDeadline).not.toBeNull();
    f.changePane(`${row.capture}\n${exhausted.result}`);
    expect(value(f.driver.observe({ operation: 'wall', processIdentity: identity })))
      .toMatchObject({ phase: 'pause-observed', detail: 'rate-limited' });
  }
});

it.each([
  "You've hit your session limit", "You've reached your usage limit", "You've hit your 5-hour limit",
  "You've reached your weekly limit", "You've hit your limit", 'Usage limit reached',
])('continues detecting exhausted quota: %s', message => {
  expect(classifyStuckSignature(message)).toBe('rate-limited');
});

it('reports the recorded first-run startup menu even when its syntax preview hides the options', () => {
  const recorded = JSON.parse(readFileSync(new URL('../fixtures/claude-first-run-2.1.280.json', import.meta.url), 'utf8'));
  expect(recorded.updateId).toBe(840342689);
  expect(classifyPaneReadiness(recorded.pane.capture)).toBe('menu');
  expect(classifyPaneIdle(recorded.pane.capture, 'claude-code')).toBe(false);
  const f = fixture(); f.changePane(recorded.pane.capture);
  refused(f.driver.launch({ operation: 'op', claim: 'topic', artifact: 'sha256:test',
    incarnation: 'inc', workingScope: '/work', handles: [] }), 'startup menu');
  expect(f.sends).toBe(0);
  // Old menu scrollback cannot suppress a later actual idle prompt.
  expect(classifyPaneReadiness(recorded.pane.capture + '\n❯ \n? for shortcuts')).toBe('ready');
  expect(classifyPaneIdle(recorded.pane.capture + '\n❯ \n? for shortcuts', 'claude-code')).toBe(true);
});

it.each(['workspace-trust', 'permission-mode'])('reports the recorded unnumbered %s startup menu without delivering input into it', name => {
  const recorded = JSON.parse(readFileSync(new URL(`../fixtures/claude-${name}-2.1.280.json`, import.meta.url), 'utf8'));
  expect(classifyPaneReadiness(recorded.pane.capture)).toBe('menu');
  expect(classifyPaneIdle(recorded.pane.capture, 'claude-code')).toBe(false);
  const f = fixture(); f.changePane(recorded.pane.capture);
  refused(f.driver.launch({ operation: 'op', claim: 'topic', artifact: 'sha256:test',
    incarnation: 'inc', workingScope: '/work', handles: [] }), 'startup menu');
  expect(f.sends).toBe(0);
  expect(classifyPaneReadiness(recorded.pane.capture + '\n❯ ')).toBe('ready');
});

it('accepts the genuine native idle-prompt neighbour captured after the live tool-bearing input', () => {
  const recorded = JSON.parse(readFileSync(new URL('../fixtures/claude-idle-2.1.280.json', import.meta.url), 'utf8'));
  expect(recorded.updateId).toBe(840342692);
  expect(classifyPaneReadiness(recorded.pane.capture)).toBe('ready');
});

it.each(['claude-code', 'codex-cli'] as const)('keeps focused menu refusal for %s and accepts numbered output above a prompt', framework => {
  const cursor = framework === 'claude-code' ? '❯' : '›';
  for (const delimiter of ['.', ')']) {
    expect(classifyPaneReadiness(`${cursor} 1${delimiter} Yes\n  2${delimiter} No\nEsc to cancel`)).toBe('menu');
    expect(classifyPaneReadiness(`1${delimiter} First\n2${delimiter} Second\n${cursor} `)).toBe('ready');
  }
  const f = fixture(framework);
  f.changePane(`${cursor} 1) Yes\n  2) No\nEsc to cancel`);
  refused(f.driver.launch({ operation: 'op', claim: 'topic', artifact: 'sha256:test',
    incarnation: 'inc', workingScope: '/work', handles: [] }), 'menu');
  expect(f.sends).toBe(0);
});

it.each(['claude-code', 'codex-cli'] as const)('distinguishes busy and unchanged input from idle completion for %s', framework => {
  const cursor = framework === 'claude-code' ? '❯' : '›';
  const active = `${cursor} hello\n✻ Working… (esc to interrupt)\nbypass permissions on (shift+tab to cycle)`;
  expect(classifyPaneReadiness(active)).toBe('ready');
  expect(classifyPaneIdle(active, framework)).toBe(false);
  const echo = `${cursor} hello${framework === 'claude-code' ? '\nbypass permissions on (shift+tab to cycle)' : ''}`;
  expect(classifyPaneIdle(echo, framework)).toBe(false);
  expect(classifyPaneIdle(`answer\n${cursor} `, framework)).toBe(true);
  const f = fixture(framework), id = f.launch();
  value(f.deliver(id));
  expect(value(f.driver.observe({ operation: 'observe', processIdentity: id })).phase).toBe('launched');
  expect(f.journal.sessions[0]?.turnDeadline).not.toBeNull();
  f.changePane(echo);
  expect(value(f.driver.observe({ operation: 'observe', processIdentity: id })).phase).toBe('launched');
  expect(f.journal.sessions[0]?.turnDeadline).not.toBeNull();
  f.changePane(active);
  expect(value(f.driver.observe({ operation: 'observe', processIdentity: id })).phase).toBe('launched');
  expect(f.journal.sessions[0]?.turnDeadline).not.toBeNull();
  f.changePane(`answer\n${cursor} `);
  expect(value(f.driver.observe({ operation: 'observe', processIdentity: id })).phase).toBe('output-observed');
  expect(f.journal.sessions[0]?.turnDeadline).toBeNull();
});

it('arms the deadline before Enter and accepts only a current-turn Stop receipt', () => {
  const f = fixture(), id = f.launch();
  f.onPrepared(() => f.hook(1000));
  f.onEnter(() => { expect(f.armed).toBe(true); expect(f.journal.sessions[0]?.turnDeadline).toBe(2000); });
  value(f.deliver(id));
  expect(f.journal.sessions[0]?.turnReceiptIds).toEqual(['receipt-1']);
  expect(value(f.driver.observe({ operation: 'observe', processIdentity: id })).phase).toBe('launched');
  expect(f.journal.sessions[0]?.turnDeadline).toBe(2000);
  f.hook(1000);
  expect(value(f.driver.observe({ operation: 'observe', processIdentity: id })).phase).toBe('output-observed');
  expect(f.journal.sessions[0]?.turnDeadline).toBeNull();
});

it('accepts a current-turn Stop receipt written synchronously with Enter', () => {
  const f = fixture(), id = f.launch();
  f.hook(1000);
  f.onEnter(() => f.hook(1000));
  value(f.deliver(id));
  expect(value(f.driver.observe({ operation: 'observe', processIdentity: id })).evidence).toContain('turn-closed:');
  expect(f.journal.sessions[0]?.turnDeadline).toBeNull();
});

it('keeps a deadline and uncertain delivery after a cut immediately following Enter', () => {
  const f = fixture(), id = f.launch();
  f.onEnter(() => { expect(f.journal.sessions[0]?.turnDeadline).toBe(2000); throw Error('cut after Enter'); });
  refused(f.deliver(id), 'cut after Enter');
  expect(f.journal.deliveries[0]?.state).toBe('sending');
  expect(f.armCount).toBe(1);
  expect(value(f.driver.bootSweep())).toEqual(['deliver:uncertain']);
  expect(f.journal.sessions[0]?.turnDeadline).toBe(2000);
});

it('arms before boot redelivery and compaction submission', () => {
  const f = fixture(), id = f.launch(); f.failNextSend(); refused(f.deliver(id)); f.markPrepared();
  f.onEnter(() => { expect(f.armCount).toBe(2); expect(f.journal.sessions[0]?.turnDeadline).toBe(2000); });
  expect(value(f.driver.bootSweep())).toEqual(['deliver:redelivered']);
  f.changePane('conversation is too long\n❯ ');
  value(f.driver.observe({ operation: 'observe', processIdentity: id }));
  f.onEnter(() => { expect(f.armCount).toBe(3); expect(f.journal.sessions[0]?.recovery).toBe(1); });
  expect(value(f.driver.recoverContext(id))).toBe('compact-requested');
});

it('counts a spawned reservation after identity-save failure and includes it in stop', () => {
  const f = fixture(); f.failNextIdentitySave();
  refused(f.driver.launch({ operation: 'op', claim: 'topic', artifact: 'sha256:test',
    incarnation: 'inc', workingScope: '/work', handles: [] }), 'identity save failed');
  expect(f.journal.reservations).toHaveLength(1);
  refused(f.driver.launch({ operation: 'other', claim: 'other', artifact: 'sha256:test',
    incarnation: 'other', workingScope: '/work', handles: [] }), 'cap');
  expect(f.calls.filter(row => row[0] === 'new-session')).toHaveLength(1);
  expect(f.journal.sessions).toHaveLength(1);
  expect(value(f.driver.stop())).toHaveLength(1);
});

it('releases a durable reservation when tmux launch itself fails', () => {
  const f = fixture(); f.failNextSpawn();
  refused(f.driver.launch({ operation: 'op', claim: 'topic', artifact: 'sha256:test',
    incarnation: 'inc', workingScope: '/work', handles: [] }), 'new-session failed');
  expect(f.journal.reservations).toEqual([]);
  expect(f.launch()).toMatch(/^instar20-/);
});

it('redelivers a prepared no-arrival record once and refuses duplicate operation', () => {
  const f = fixture(), id = f.launch(); f.failNextSend();
  refused(f.deliver(id), 'simulated process death');
  f.markPrepared();
  expect(value(f.driver.bootSweep())).toEqual(['deliver:redelivered']);
  expect(f.sends).toBe(2);
  expect(value(f.deliver(id))).toBe('tmux-input:deliver');
  expect(f.sends).toBe(2);
  expect(f.calls.filter(row => row[0] === 'send-keys').every(row => row[2]?.endsWith(':'))).toBe(true);
});

it('reports changed-pane crash windows as uncertain and never silently sends again', () => {
  const f = fixture(), id = f.launch(); f.failNextSend(); refused(f.deliver(id));
  f.changePane('❯ output happened');
  expect(value(f.driver.bootSweep())).toEqual(['deliver:uncertain']);
  expect(f.sends).toBe(0);
  refused(f.deliver(id), 'uncertain');
});

it('treats even an unchanged pane as ambiguous once injection started', () => {
  const f = fixture(), id = f.launch(); f.failNextSend(); refused(f.deliver(id));
  expect(value(f.driver.bootSweep())).toEqual(['deliver:uncertain']);
  expect(f.sends).toBe(0);
});

it('recovers a Part 13 pending attempt only when no driver send was recorded', () => {
  const f = fixture(), id = f.launch();
  const input = { operation: 'deliver', processIdentity: id, intake: 'input', digest: hash('hello'), incarnation: 'inc' };
  expect(value(f.driver.recoverDelivery(input))).toBe('tmux-input:deliver');
  expect(f.sends).toBe(2);
  expect(value(f.driver.recoverDelivery(input))).toBe('tmux-input:deliver');
  expect(f.sends).toBe(2);
});

it('enforces cap, stop authority, and per-turn deadline', () => {
  const f = fixture(), id = f.launch();
  refused(f.driver.launch({ operation: 'other', claim: 'other', artifact: 'sha256:test',
    incarnation: 'other', workingScope: '/work', handles: [] }), 'cap');
  value(f.deliver(id)); f.changePane('working'); f.time(2001);
  expect(value(f.driver.observe({ operation: 'observe', processIdentity: id })).detail).toContain('deadline');
  f.stop(); refused(f.deliver(id), 'stop authority');
  expect(f.calls.some(row => row[0] === 'kill-session' && row[2]?.endsWith(':'))).toBe(true);
});

it('enforces emergency stop when launch reattaches an existing session', () => {
  const f = fixture(), id = f.launch();
  f.stop();
  refused(f.driver.launch({ operation: 'op', claim: 'topic', artifact: 'sha256:test',
    incarnation: 'inc', workingScope: '/work', handles: [] }), 'stop authority');
  expect(f.calls.filter(row => row[0] === 'kill-session' && row[2] === `=${id.split(':')[0]}:`)).toHaveLength(1);
  expect(f.calls.filter(row => row[0] === 'new-session')).toHaveLength(1);
});

it.each(['claude-code', 'codex-cli'] as const)('uses a native %s resume only for a cache hit on the matching topic', framework => {
  const f = fixture(framework), id = f.launch();
  const resume = '12345678-1234-1234-1234-123456789abc';
  expect(value(f.driver.saveResume(id, resume))).toBe(resume);
  expect(f.journal.resumes.topic).toBe(resume);
  const newDriver = createProductionSessionDriver({ ...f.config, maxSessions: 3 });
  value(newDriver.launch({ operation: 'unrelated', claim: 'different-topic', artifact: 'sha256:test',
    incarnation: 'other', workingScope: '/work', handles: [] }));
  expect(f.calls.filter(row => row[0] === 'new-session')[1]).not.toContain('--resume');
  const next = value(newDriver.launch({ operation: 'next', claim: 'topic', artifact: 'sha256:test',
    incarnation: 'next', workingScope: '/work', handles: [] }));
  expect(next).not.toBe(id);
  expect(f.calls.some(row => row[0] === 'new-session' && row.includes(resume)
    && row.includes(framework === 'claude-code' ? '--resume' : 'resume'))).toBe(true);
  expect(f.journal.sessions.at(-1)?.continuation).toBeUndefined();
});

it.each(['claude-code', 'codex-cli'] as const)('reconstructs once from agent-owned context after a %s login swap', framework => {
  const f = fixture(framework), id = f.launch();
  const resume = '12345678-1234-1234-1234-123456789abc';
  value(f.driver.saveResume(id, resume));
  const supplied: string[] = [];
  const driver = createProductionSessionDriver({ ...f.config, home: f.homes.b, configHome: f.homes.b,
    maxSessions: 2, continuation: input => { supplied.push(input.reason); return {
      text: 'Prior user: Lisbon talk. Prior agent: I will prepare slides.', source: 'agent-root/facts',
    }; } });
  const next = value(driver.launch({ operation: 'next', claim: 'topic', artifact: 'sha256:test',
    incarnation: 'next', workingScope: '/work', handles: [] }));
  expect(supplied).toEqual(['cache-miss']);
  expect(f.calls.filter(row => row[0] === 'new-session')).toHaveLength(2);
  expect(f.calls.at(-1)).toBeDefined();
  expect(f.calls.filter(row => row[0] === 'new-session')[1]).not.toContain(resume);
  expect(value(f.driver.continuationReady(next))).toBe(true);
  expect(f.journal.sessions.find(row => row.identity === next)?.continuation?.state).toBe('completed');
  expect(value(driver.launch({ operation: 'next', claim: 'topic', artifact: 'sha256:test',
    incarnation: 'next', workingScope: '/work', handles: [] }))).toBe(next);
  expect(supplied).toEqual(['cache-miss']);
  const input = { operation: 'next-input', processIdentity: next, intake: 'input',
    digest: hash('hello'), incarnation: 'next' };
  expect(value(driver.deliver(input))).toBe('tmux-input:next-input');
  const sent = f.calls.filter(row => row[0] === 'send-keys' && row.includes('Enter')).length;
  expect(value(driver.deliver(input))).toBe('tmux-input:next-input');
  expect(f.calls.filter(row => row[0] === 'send-keys' && row.includes('Enter'))).toHaveLength(sent);
  expect(f.journal.deliveries.filter(row => row.operation === 'next-input')).toHaveLength(1);
  expect(f.journal.sessions.find(row => row.identity === next)?.continuation?.text).toContain('Prior user: Lisbon');
  const literals = f.calls.filter(row => row[0] === 'send-keys' && row.includes('-l'))
    .map(row => row.at(-1) ?? '').join('');
  expect(literals.split('Prior user: Lisbon').length - 1).toBe(1);
  expect(literals.split('hello').length - 1).toBe(1);
});

it('does not repeat an uncertain continuation or admit the next input', () => {
  const f = fixture(), id = f.launch();
  value(f.driver.saveResume(id, '12345678-1234-1234-1234-123456789abc'));
  const driver = createProductionSessionDriver({ ...f.config, home: f.homes.b, configHome: f.homes.b,
    maxSessions: 2 });
  const launch = { operation: 'next', claim: 'topic', artifact: 'sha256:test',
    incarnation: 'next', workingScope: '/work', handles: [] };
  f.onEnter(() => { throw Error('cut after continuation Enter'); });
  refused(driver.launch(launch), 'cut after continuation Enter');
  const next = f.journal.sessions.at(-1)?.identity;
  expect(next).toBeDefined();
  expect(f.journal.sessions.at(-1)?.continuation?.state).toBe('sending');
  refused(driver.launch(launch), 'continuation delivery uncertain');
  if (next) refused(driver.deliver({ operation: 'next-input', processIdentity: next, intake: 'input',
    digest: hash('hello'), incarnation: 'next' }), 'continuation delivery uncertain');
  value(driver.stop());
  refused(driver.launch(launch), 'no automatic respawn');
  expect(f.calls.filter(row => row[0] === 'new-session')).toHaveLength(2);
  expect(f.journal.deliveries).toHaveLength(0);
});

it('keeps a prepared continuation when startup menu persists across launch retry', () => {
  const f = fixture(), id = f.launch();
  value(f.driver.saveResume(id, '12345678-1234-1234-1234-123456789abc'));
  const driver = createProductionSessionDriver({ ...f.config, home: f.homes.b, configHome: f.homes.b,
    maxSessions: 2 });
  const launch = { operation: 'next', claim: 'topic', artifact: 'sha256:test',
    incarnation: 'next', workingScope: '/work', handles: [] };
  f.changePane('❯ 1. Update\n  2. Skip');
  refused(driver.launch(launch), 'menu');
  const next = f.journal.sessions.at(-1)?.identity;
  expect(f.journal.sessions.at(-1)?.continuation?.state).toBe('prepared');
  refused(driver.launch(launch), 'idle prompt');
  expect(f.journal.sessions.at(-1)?.continuation?.state).toBe('prepared');
  expect(f.sends).toBe(0);
  f.changePane('❯ ');
  expect(value(driver.launch(launch))).toBe(next);
  expect(value(driver.continuationReady(f.journal.sessions.at(-1)!.identity))).toBe(true);
  expect(f.journal.sessions.at(-1)?.continuation?.state).toBe('completed');
});

it('checks readiness after reconciling a prepared continuation reservation', () => {
  const f = fixture(), id = f.launch();
  value(f.driver.saveResume(id, '12345678-1234-1234-1234-123456789abc'));
  const driver = createProductionSessionDriver({ ...f.config, home: f.homes.b, configHome: f.homes.b,
    maxSessions: 2 });
  const launch = { operation: 'next', claim: 'topic', artifact: 'sha256:test',
    incarnation: 'next', workingScope: '/work', handles: [] };
  f.failNextIdentitySave();
  refused(driver.launch(launch), 'identity save failed');
  expect(f.journal.reservations?.at(-1)?.continuation?.state).toBe('prepared');
  f.changePane('❯ 1. Update\n  2. Skip');
  refused(driver.launch(launch), 'idle prompt');
  expect(f.journal.reservations).toEqual([]);
  expect(f.journal.sessions.at(-1)?.continuation?.state).toBe('prepared');
  expect(f.sends).toBe(0);
  f.changePane('❯ ');
  value(driver.launch(launch));
  expect(value(driver.continuationReady(f.journal.sessions.at(-1)!.identity))).toBe(true);
  expect(f.journal.sessions.at(-1)?.continuation?.state).toBe('completed');
});

it('records a visible refusal and starts no fresh session when continuation is unavailable', () => {
  const f = fixture(), id = f.launch();
  value(f.driver.saveResume(id, '12345678-1234-1234-1234-123456789abc'));
  const driver = createProductionSessionDriver({ ...f.config, home: f.homes.b, configHome: f.homes.b,
    continuation: undefined });
  refused(driver.launch({ operation: 'next', claim: 'topic', artifact: 'sha256:test',
    incarnation: 'next', workingScope: '/work', handles: [] }), 'continuation provider unavailable');
  expect(f.calls.filter(row => row[0] === 'new-session')).toHaveLength(1);
  expect(f.journal.continuationRefusals?.[0]?.reason).toContain('cache-miss');
});

it('also refuses a prior topic with no recorded native resume', () => {
  const f = fixture(); f.launch();
  f.config.io.save({ ...f.journal, resumes: {} }); // Exercise a legacy journal lacking native handles.
  const driver = createProductionSessionDriver({ ...f.config, maxSessions: 2, continuation: undefined });
  refused(driver.launch({ operation: 'next', claim: 'topic', artifact: 'sha256:test',
    incarnation: 'next', workingScope: '/work', handles: [] }), 'continuation provider unavailable');
  expect(f.calls.filter(row => row[0] === 'new-session')).toHaveLength(1);
  expect(f.journal.continuationRefusals?.[0]?.claim).toBe('topic');
});

it('refuses an unbounded continuation before launching a replacement', () => {
  const f = fixture(), id = f.launch();
  value(f.driver.saveResume(id, '12345678-1234-1234-1234-123456789abc'));
  const driver = createProductionSessionDriver({ ...f.config, home: f.homes.b, configHome: f.homes.b,
    continuation: () => ({ text: 'x'.repeat(128_001), source: 'agent-root' }) });
  refused(driver.launch({ operation: 'next', claim: 'topic', artifact: 'sha256:test',
    incarnation: 'next', workingScope: '/work', handles: [] }), 'bounded context');
  expect(f.calls.filter(row => row[0] === 'new-session')).toHaveLength(1);
  expect(f.journal.continuationRefusals?.[0]?.reason).toContain('bounded context');
});

it('keeps the current session when context-wall continuation is unavailable', () => {
  const f = fixture(), id = f.launch();
  const driver = createProductionSessionDriver({ ...f.config, continuation: undefined });
  f.changePane('conversation is too long\n❯ ');
  expect(value(driver.recoverContext(id))).toBe('compact-requested');
  f.hook(1000);
  value(driver.observe({ operation: 'observe', processIdentity: id }));
  refused(driver.recoverContext(id), 'continuation provider unavailable');
  expect(f.calls.filter(row => row[0] === 'kill-session')).toHaveLength(0);
  expect(f.calls.filter(row => row[0] === 'new-session')).toHaveLength(1);
  expect(f.journal.continuationRefusals?.[0]?.reason).toContain('context-wall');
});

it('uses Codex resume and double-Enter only for Codex', () => {
  const f = fixture('codex-cli'), id = f.launch();
  value(f.driver.saveResume(id, '12345678-1234-1234-1234-123456789abc'));
  value(createProductionSessionDriver({ ...f.config, maxSessions: 2 }).launch({ operation: 'next', claim: 'topic',
    artifact: 'sha256:test', incarnation: 'next', workingScope: '/work', handles: [] }));
  expect(f.calls.some(row => row[0] === 'new-session' && row.includes('resume')
    && row.includes('12345678-1234-1234-1234-123456789abc'))).toBe(true);
  value(f.deliver(id));
  expect(f.calls.filter(row => row[0] === 'send-keys' && row.includes('Enter'))).toHaveLength(2);
  const claude = fixture(), claudeId = claude.launch(); value(claude.deliver(claudeId));
  expect(claude.calls.filter(row => row[0] === 'send-keys' && row.includes('Enter'))).toHaveLength(1);
});

it('compacts an idle context wall once and then respawns through agent-owned continuation', () => {
  const f = fixture(), id = f.launch();
  f.changePane('conversation is too long\n❯ ');
  expect(value(f.driver.recoverContext(id))).toBe('compact-requested');
  expect(f.calls.some(row => row[0] === 'send-keys' && row.includes('/compact'))).toBe(true);
  f.changePane('conversation is too long\n❯ ');
  f.time(1001); f.hook(1001);
  value(f.driver.observe({ operation: 'observe', processIdentity: id }));
  const next = value(f.driver.recoverContext(id));
  expect(next).not.toBe(id);
  expect(f.calls.some(row => row[0] === 'kill-session' && row[2]?.endsWith(':'))).toBe(true);
  expect(value(f.driver.continuationReady(next))).toBe(true);
  expect(f.journal.sessions.find(row => row.identity === next)?.continuation?.state).toBe('completed');
  expect(f.calls.filter(row => row[0] === 'new-session')).toHaveLength(2);
  expect(f.journal.resumes.topic).toBe(f.journal.sessions.find(row => row.identity === next)?.resumeId);
  expect(f.journal.resumes.topic).toMatch(/^[a-f0-9-]{36}$/u);
});

it('retains context-wall continuation intent across a cut immediately after kill', () => {
  const f = fixture(), id = f.launch();
  const resume = '12345678-1234-1234-1234-123456789abc';
  value(f.driver.saveResume(id, resume));
  f.changePane('conversation is too long\n❯ ');
  expect(value(f.driver.recoverContext(id))).toBe('compact-requested');
  f.time(1001); f.hook(1001);
  value(f.driver.observe({ operation: 'observe', processIdentity: id }));
  f.onKill(() => { throw Error('cut after kill'); });
  refused(f.driver.recoverContext(id), 'cut after kill');
  expect(f.journal.resumes.topic).toBeUndefined();
  const next = f.launch();
  expect(next).not.toBe(id);
  const spawned = f.calls.filter(row => row[0] === 'new-session');
  expect(spawned).toHaveLength(2);
  expect(spawned[1]).not.toContain('--resume');
  expect(spawned[1]).not.toContain(resume);
  expect(value(f.driver.continuationReady(next))).toBe(true);
  expect(f.journal.sessions.find(row => row.identity === next)?.continuation?.state).toBe('completed');
});

it('recovers a delivered no-hook context failure, then respawns after failed compaction', () => {
  const f = fixture('codex-cli'), id = f.launch(); value(f.deliver(id));
  f.changePane('conversation is too long\n› ');
  expect(value(f.driver.observe({ operation: 'observe', processIdentity: id })).phase).toBe('pause-observed');
  expect(f.journal.sessions[0]?.turnDeadline).toBeNull();
  expect(value(f.driver.recoverContext(id))).toBe('compact-requested');
  expect(value(f.driver.observe({ operation: 'observe', processIdentity: id })).phase).toBe('launched');
  expect(f.journal.sessions[0]?.turnDeadline).not.toBeNull();
  refused(f.driver.recoverContext(id), 'idle prompt');
  f.changePane('error during compaction: too long\n› ');
  expect(value(f.driver.observe({ operation: 'observe', processIdentity: id })).phase).toBe('pause-observed');
  expect(f.journal.sessions[0]?.turnDeadline).toBeNull();
  expect(value(f.driver.recoverContext(id))).not.toBe(id);
});

it('refuses context recovery while the failed turn is still busy', () => {
  const f = fixture(), id = f.launch(); value(f.deliver(id));
  f.changePane('conversation is too long\n❯ hello\n✻ Working… (esc to interrupt)');
  // A context signal during work cannot begin idle compaction.
  expect(value(f.driver.observe({ operation: 'observe', processIdentity: id })).phase).toBe('launched');
  refused(f.driver.recoverContext(id), 'idle prompt');
  expect(f.journal.sessions[0]?.turnDeadline).not.toBeNull();
});

it('refuses changed identity and protects named sessions from stop', () => {
  const f = fixture(), id = f.launch(), name = id.split(':')[0]!;
  f.changeStamp('999:1001');
  refused(f.driver.stop(), 'identity changed');
  expect(f.calls.filter(row => row[0] === 'kill-session')).toHaveLength(0);
  const protectedDriver = createProductionSessionDriver({ ...f.config, protectedSessions: [name] });
  expect(value(protectedDriver.stop())).toEqual([]);
  expect(f.calls.filter(row => row[0] === 'kill-session')).toHaveLength(0);
});

it.each(['claude-code', 'codex-cli'] as const)('an admitted %s session launches with every tool, the admission hook and the model-dispatch checkpoint', framework => {
  const f = fixture(framework);
  const toolAdmission = { command: (claim: string, phase: 'pre' | 'post' | 'permission') => `/node /repo/hook.mjs ${phase} /state/${claim}`, timeoutSeconds: 600 };
  const modelGate = (claim: string) => `http://127.0.0.1:4100/${'a'.repeat(32)}/${claim}`;
  const driver = createProductionSessionDriver({ ...f.config, confinement: 'admitted', toolAdmission, modelGate });
  value(driver.launch({ operation: 'op', claim: 'topic', artifact: 'sha256:test', incarnation: 'inc', workingScope: '/work', handles: [] }));
  const spawned = f.calls.find(row => row[0] === 'new-session')!;
  if (framework === 'claude-code') {
    // Every tool stays (no permission prompt); the settings install the hook for every tool, before and after.
    expect(spawned).toContain('--dangerously-skip-permissions');
    const settings = JSON.parse(spawned[spawned.indexOf('--settings') + 1]!);
    expect(settings.hooks.PreToolUse).toEqual([{ matcher: '*', hooks: [{ type: 'command', command: '/node /repo/hook.mjs pre /state/topic', timeout: 600 }] }]);
    expect(settings.hooks.PermissionRequest[0].hooks[0].command).toBe('/node /repo/hook.mjs permission /state/topic');
    expect(settings.hooks.PostToolUse[0].hooks[0].command).toBe('/node /repo/hook.mjs post /state/topic');
    expect(settings.hooks.PostToolUseFailure).toEqual(settings.hooks.PostToolUse);
    // No background model traffic, and every model call the session makes goes to this claim's checkpoint.
    expect(spawned).toContain('DISABLE_NON_ESSENTIAL_MODEL_CALLS=1');
    expect(spawned).toContain(`ANTHROPIC_BASE_URL=${modelGate('topic')}`);
  } else {
    expect(spawned).toEqual(expect.arrayContaining(['--dangerously-bypass-approvals-and-sandbox', '--dangerously-bypass-hook-trust',
      `hooks.PreToolUse=[{matcher='*',hooks=[{type='command',command='/node /repo/hook.mjs pre /state/topic',timeout=600}]}]`,
      `hooks.PostToolUse=[{matcher='*',hooks=[{type='command',command='/node /repo/hook.mjs post /state/topic',timeout=600}]}]`,
      'model_provider=instar-gate', `model_providers.instar-gate={name="OpenAI",base_url="${modelGate('topic')}/backend-api/codex",`
        + 'wire_api="responses",requires_openai_auth=true}']));
    expect(spawned).not.toContain('DISABLE_NON_ESSENTIAL_MODEL_CALLS=1');
  }
  // An admitted mode without its hook, an unconfined one with a hook, or a hook command that is not plain, is refused.
  expect(() => createProductionSessionDriver({ ...f.config, confinement: 'admitted', modelGate })).toThrow(/admission hook/u);
  expect(() => createProductionSessionDriver({ ...f.config, toolAdmission })).toThrow(/admission hook/u);
  // An admitted session without its model-dispatch checkpoint, or an unconfined one with it, is refused too.
  expect(() => createProductionSessionDriver({ ...f.config, confinement: 'admitted', toolAdmission })).toThrow(/model-dispatch checkpoint/u);
  expect(() => createProductionSessionDriver({ ...f.config, modelGate })).toThrow(/model-dispatch checkpoint|admission hook/u);
  const quoted = createProductionSessionDriver({ ...f.config, confinement: 'admitted', modelGate,
    toolAdmission: { ...toolAdmission, command: () => "/node 'x'" } });
  expect(quoted.launch({ operation: 'op2', claim: 'topic2', artifact: 'sha256:test', incarnation: 'inc2', workingScope: '/work', handles: [] }).kind)
    .not.toBe('Success');
});

it('runs the harness through the configured launch command (the harness-user bridge), and only then', () => {
  const via = ['/usr/local/bin/node', '/repo/tests/preview/harness-session.mjs', '_instarharness', '/h/profile.json', '--'];
  const bridged = fixture('claude-code', { launchVia: via });
  bridged.launch();
  const pane = bridged.calls.find(row => row[0] === 'new-session') ?? [];
  const at = pane.indexOf('/synthetic');
  expect(pane.slice(at - via.length, at)).toEqual(via);
  // The bridge receives the same clean environment the harness would: it precedes the bridge, never follows it.
  expect(pane.slice(0, at - via.length)).toContain(`CLAUDE_CONFIG_DIR=${bridged.homes.a}`);
  // Studio's Node is installed here; lifecycle hooks invoke node in this clean environment.
  expect(pane.slice(0, at - via.length)).toContain('PATH=/usr/bin:/bin:/usr/local/bin:/opt/homebrew/bin');
  const plain = fixture();
  plain.launch();
  const direct = plain.calls.find(row => row[0] === 'new-session') ?? [];
  expect(direct).not.toContain('/repo/tests/preview/harness-session.mjs');
  expect(direct[direct.indexOf('/synthetic') - 1]).toMatch(/^INSTAR_SESSION_GROUNDING_FILE=/u);
  expect(() => fixture('claude-code', { launchVia: ['relative', '--'] })).toThrow(/exact launch command/u);
  expect(() => fixture('claude-code', { launchVia: [] })).toThrow(/exact launch command/u);
});

it('conversation mode rejects pane-idle completion and replays only its correlated Stop evidence', () => {
  const f = fixture('claude-code', { requireTurnHook: true }), id = f.launch();
  value(f.deliver(id)); f.changePane('answer\n❯ ');
  expect(value(f.driver.observe({ operation: 'observe', processIdentity: id })).phase).toBe('launched');
  expect(f.journal.sessions[0]?.turnDeadline).toBe(2000);
  f.hook(1000);
  const ended = value(f.driver.observe({ operation: 'observe', processIdentity: id }));
  expect(ended.evidence).toContain('turn-closed:');
  expect(value(f.driver.observe({ operation: 'observe', processIdentity: id }))).toMatchObject({ evidence: ended.evidence });
  value(f.driver.deliver({ operation: 'second', processIdentity: id, intake: 'second', digest: hash('hello'), incarnation: 'inc' }));
  expect(value(f.driver.observe({ operation: 'observe', processIdentity: id })).phase).toBe('launched');
});

it('public control can retire only the admitted claim and incarnation, never another worker', () => {
  const f = fixture(), id = f.launch();
  expect(value(f.driver.stop({ claim: 'other', incarnation: 'inc' }))).toEqual([]);
  expect(value(f.driver.observe({ operation: 'observe', processIdentity: id })).phase).toBe('launched');
  expect(value(f.driver.stop({ claim: 'topic', incarnation: 'old-incarnation' }))).toEqual([]);
  expect(value(f.driver.stop({ claim: 'topic', incarnation: 'inc', processIdentity: id }))).toHaveLength(1);
  expect(value(f.driver.observe({ operation: 'observe', processIdentity: id })).phase).toBe('exit-observed');
});

it.each(['claude-code', 'codex-cli'] as const)('prepared connectors launch on the admitted %s worker with the hook intact', framework => {
  const f = fixture(framework);
  const driver = createProductionSessionDriver({ ...f.config, confinement: 'admitted',
    toolAdmission: { command: (claim, phase) => `/node /repo/hook.mjs ${phase} /state/${claim}`, timeoutSeconds: 600 },
    modelGate: claim => `http://127.0.0.1:4100/${'a'.repeat(32)}/${claim}`,
    connectors: claim => { expect(claim).toBe('topic'); return { config: '/private/mcp.json', servers: ['mail'],
      launch: { mail: { command: '/node', args: ['/mcp-launch.mjs', '/socket', 'mail', 'nonce', '/fake-connector'] } } }; } });
  value(driver.launch({ operation: 'op', claim: 'topic', artifact: 'sha256:test', incarnation: 'inc', workingScope: '/work', handles: [] }));
  const command = f.calls.find(row => row[0] === 'new-session')!;
  expect(command.join(' ')).toContain('PreToolUse');
  if (framework === 'claude-code') expect(command).toEqual(expect.arrayContaining(['--strict-mcp-config', '--mcp-config', '/private/mcp.json']));
  else expect(command.join(' ')).toContain('mcp_servers.mail=');
});


it('retains a fresh native transcript handle without a lifecycle hook for later topic replacement', () => {
  const f = fixture(), id = f.launch();
  const launched = f.calls.find(row => row[0] === 'new-session')!;
  const native = launched[launched.indexOf('--session-id') + 1];
  expect(native).toMatch(/^[a-f0-9-]{36}$/u);
  expect(f.journal.resumes.topic).toBe(native);
  expect(f.journal.sessions.find(row => row.identity === id)?.resumeId).toBe(native);
});

it('a new topic claim with prior history requires continuation even without a native handle', () => {
  const f = fixture();
  const driver = createProductionSessionDriver({ ...f.config, continuationRequired: () => true });
  const id = value(driver.launch({ operation: 'new-claim', claim: 'new-claim', artifact: 'sha256:test',
    incarnation: 'next', workingScope: '/work', handles: [] }));
  expect(value(driver.continuationReady(id))).toBe(true);
  expect(f.journal.sessions.find(row => row.identity === id)?.continuation?.state).toBe('completed');
  expect(f.calls.some(row => row.includes('--resume'))).toBe(false);
  const missing = createProductionSessionDriver({ ...f.config, maxSessions: 2, continuationRequired: () => true, continuation: undefined });
  refused(missing.launch({ operation: 'another', claim: 'another', artifact: 'sha256:test', incarnation: 'next', workingScope: '/work', handles: [] }),
    'continuation provider unavailable');
});

it('reports recorded pane activity per owned claim without treating activity or empty captures as completion', () => {
  const recorded = JSON.parse(readFileSync(new URL('../preview/fixtures/work-silence-terminal-2026-10-14.json', import.meta.url), 'utf8'));
  const observations: Parameters<NonNullable<ProductionSessionConfig['observeActivity']>>[0][] = [];
  const f = fixture('claude-code', { requireTurnHook: true, observeActivity: row => observations.push(row) });
  const identity = f.launch(); value(f.deliver(identity));
  for (const row of recorded.captures) {
    f.changePane(row.capture);
    expect(value(f.driver.observe({ operation: 'work', processIdentity: identity })).phase).toBe('launched');
  }
  expect(observations[0]).toMatchObject({ subject: 'topic', progress: null, wait: null });
  expect(observations[1]).toMatchObject({ subject: 'topic', progress: hash(recorded.captures[1].capture.trim()), wait: null });
  expect(observations[2]?.progress).not.toBe(observations[1]?.progress);
  expect(JSON.stringify(observations)).not.toContain('Hullaballooing');
  expect(f.calls.filter(call => call[0] === 'kill-session')).toHaveLength(0);
});

it('an unavailable advisory activity sink cannot interrupt the observed worker', () => {
  const f = fixture('claude-code', { observeActivity: () => { throw Error('observer unavailable'); } });
  const identity = f.launch(); value(f.deliver(identity));
  expect(value(f.driver.observe({ operation: 'work', processIdentity: identity })).phase).toBe('launched');
  expect(f.calls.filter(call => call[0] === 'kill-session')).toHaveLength(0);
});

// Run the shipped journal configuration closure, not a copy of its timeout arithmetic.
function journalDriverConfiguration(conversationSession: boolean, base: ReturnType<typeof fixture>['config']) {
  const host = readFileSync(new URL('../preview/journal-agent.mjs', import.meta.url), 'utf8');
  const body = host.split('const driverConfiguration = resolveIntake => (')[1]!.split('\n        return ({')[0]!;
  const scope = {
    conversationSession, sessionLimits: conversationSession ? CONVERSATION_SESSION_LIMITS : SESSION_WORK_LIMITS,
    sessionAdmissionCommand: () => () => '/fixture/admission', admissionBase: '/fixture/admission', layout: null,
    gate: { base: () => ({}) }, framework: base.framework, project: base.cwd,
    binding: { entry: () => ({ profile: { executable: base.executable, home: base.home, configDirectory: base.configHome } }),
      physical: () => ({ ...base.io, inboxDirectory: '/fixture/inbox' }), stopped: base.stopped },
    required: () => 'fixture-model', options: {}, context: base.context, wallNow: base.now, handoff: null,
    contextGrounding: () => '/fixture/grounding.txt', workActivity: new Map(), fileURLToPath: () => '/fixture/stop.mjs', URL,
  };
  // import.meta.url is only used to resolve the lifecycle hook's physical script path.
  const source = body.replaceAll('import.meta.url', JSON.stringify(import.meta.url));
  return Function(...Object.keys(scope), `return resolveIntake => (${source}`)(...Object.values(scope))(() => 'hello') as ProductionSessionConfig;
}

it.each([false, true])('constructs the real journal session driver and eager conversation adapter (conversation=%s)', conversation => {
  const f = fixture();
  const config = journalDriverConfiguration(conversation, f.config);
  expect(config.turnDeadlineMs).toBe(conversation ? 14_400_000 : 600_000);
  expect(() => createSessionConversationAdapter({
    createDriver: () => createProductionSessionDriver(config), resolveDelivery: () => undefined,
    io: { clearResult: () => {}, readResult: () => null, wait: async () => {}, modelCalls: () => 0,
      prepareAdmission: () => {}, closeAdmission: () => {}, admissionState: () => ({ refused: false, openDelegations: [] }) },
  })).not.toThrow();
  expect(config.toolAdmission?.timeoutSeconds).toBe(conversation ? 3600 : 600);
});

it.each([3600, 3601])('holds the admission hook boundary at %s seconds', timeoutSeconds => {
  const config = journalDriverConfiguration(true, fixture().config);
  const build = () => createProductionSessionDriver({ ...config,
    toolAdmission: { ...config.toolAdmission!, timeoutSeconds } });
  if (timeoutSeconds === 3600) expect(build).not.toThrow();
  else expect(build).toThrow('bounded admission hook required');
});

it('joins the recorded live worker captures to missing login custody, with no alarm from a dead or changed process', () => {
  const recorded = JSON.parse(readFileSync(new URL('../preview/fixtures/work-silence-terminal-2026-10-14.json', import.meta.url), 'utf8'));
  const health: SessionLoginObservation[] = [];
  const f = fixture('claude-code', { requireTurnHook: true, observeActivity: activity => {
    health.push(observeInstalledSessionLogin({ reference: 'approved-login', activationReference: 'grant' }, activity,
      () => { throw Object.assign(Error('synthetic removed login accompanying real worker bytes'), { code: 'ENOENT' }); }));
  } });
  const identity = f.launch(); value(f.deliver(identity));
  expect(health).toEqual([]);
  for (const row of recorded.captures) {
    f.changePane(row.capture);
    expect(value(f.driver.observe({ operation: 'work', processIdentity: identity })).phase).toBe('launched');
    expect(sessionLoginNotices([health.at(-1)!], 1000)).toHaveLength(1);
  }
  const samples = health.length;
  f.changeStamp('999:1001');
  expect(f.driver.observe({ operation: 'work', processIdentity: identity }).kind).toBe('Refused');
  expect(health).toHaveLength(samples);
  f.stop();
  expect(value(f.driver.observe({ operation: 'work', processIdentity: identity })).phase).toBe('exit-observed');
  expect(health).toHaveLength(samples);
});

it('idle reaping uses recorded ready bytes plus a closed turn and revalidates the frame at close', () => {
  const recorded = JSON.parse(readFileSync(new URL('../fixtures/claude-idle-2.1.280.json', import.meta.url), 'utf8'));
  const f = fixture('claude-code', { requireTurnHook: true }); const identity = f.launch();
  expect(value(f.driver.observeIdle(identity))).toBeNull();
  value(f.deliver(identity)); f.time(1100); f.hook(1100); f.changePane(recorded.pane.capture);
  value(f.driver.observe({ operation: 'deliver', processIdentity: identity }));
  const evidence = value(f.driver.observeIdle(identity)); expect(evidence).toMatch(/^sha256:/);
  f.changePane(recorded.pane.capture + '\nWorking… esc to interrupt');
  expect(value(f.driver.observeIdle(identity))).toBeNull();
  expect(value(f.driver.stop({ claim: 'topic', incarnation: 'inc', processIdentity: identity, idleEvidence: evidence! })))
    .toEqual({ state: 'refused', evidence: 'idle evidence changed; worker kept' });
  expect(f.calls.some(row => row[0] === 'kill-session')).toBe(false);
  f.changePane(recorded.pane.capture);
  expect(value(f.driver.stop({ claim: 'topic', incarnation: 'inc', processIdentity: identity, idleEvidence: evidence! }))).toHaveLength(1);
});

it.each(['unchanged', 'changed', 'unreadable', 'after-kill'] as const)(
  'adapter preserves action-time refusal, but not unknown or post-actuation failure (%s)', async mode => {
    const recorded = JSON.parse(readFileSync(new URL('../fixtures/claude-idle-2.1.280.json', import.meta.url), 'utf8'));
    const f = fixture('claude-code', { requireTurnHook: true }); const identity = f.launch();
    value(f.deliver(identity)); f.time(1100); f.hook(1100); f.changePane(recorded.pane.capture);
    value(f.driver.observe({ operation: 'deliver', processIdentity: identity }));
    const evidence = value(f.driver.observeIdle(identity))!;
    const adapter = createSessionConversationAdapter({
      createDriver: () => ({ ...f.driver, observeIdle: (id: string) => {
        const result = f.driver.observeIdle(id);
        if (mode === 'changed') f.changePane(recorded.pane.capture + '\nWorking… esc to interrupt');
        if (mode === 'unreadable') {
          const tmux = f.config.io.tmux;
          f.config.io.tmux = args => {
            if (args[0] === 'capture-pane') throw Error('idle evidence changed; worker kept');
            return tmux(args);
          };
        }
        if (mode === 'after-kill') f.onKill(() => { throw Error('idle evidence changed; worker kept'); });
        return result;
      } }),
      io: { clearResult: () => {}, readResult: () => null, modelCalls: () => 0, wait: async () => {},
        prepareAdmission: () => {}, closeAdmission: () => {}, admissionState: () => ({ refused: false, openDelegations: [] }) },
      resolveDelivery: () => undefined,
    });
    const control = adapter.control({ launch: identity, claim: 'topic', incarnation: 'inc',
      action: 'close', authority: 'grant', reason: 'idle', idleEvidence: evidence });
    if (mode === 'changed') await expect(control).resolves.toMatchObject({ state: 'refused' });
    else if (mode === 'unchanged') await expect(control).resolves.toMatchObject({ state: 'closed' });
    else await expect(control).rejects.toThrow('idle evidence changed; worker kept');
    expect(f.calls.some(row => row[0] === 'kill-session')).toBe(mode === 'after-kill' || mode === 'unchanged');
  });

it('recognizes the captured context wall and quiet prompt from proof update 1016001', () => {
  const recorded = JSON.parse(readFileSync(new URL('../preview/fixtures/context-wall-worker-1016001-2026-10-16.json', import.meta.url), 'utf8'));
  expect(recorded.source.updateIds).toEqual([1016001, 1016002]);
  expect(recorded.deliveredAnswer).toBeNull();
  expect(classifyStuckSignature(recorded.wall.stdout)).toBe('context-too-long');
  expect(classifyPaneIdle(recorded.wall.stdout, 'claude-code')).toBe(true);
  expect(classifyPaneIdle(recorded.transientWall.stdout, 'claude-code')).toBe(false);
  expect(classifyPaneIdle(recorded.compactFailure.stdout, 'claude-code')).toBe(true);
  expect(classifyPaneIdle(`${recorded.wall.stdout}\nesc to interrupt`, 'claude-code')).toBe(false);
});

it('replays the captured wall through adapter compact control before requesting owner retirement', async () => {
  const recorded = JSON.parse(readFileSync(new URL('../preview/fixtures/context-wall-worker-1016001-2026-10-16.json', import.meta.url), 'utf8'));
  const f = fixture('claude-code', { requireTurnHook: true });
  let delivery: import('../../src/assembly/contracts.js').HarnessInputDelivery | undefined;
  const adapter = createSessionConversationAdapter({
    createDriver: resolveIntake => createProductionSessionDriver({ ...f.config, resolveIntake,
      continuation: ({ operation, pendingDigest }) => ({ text: resolveIntake(operation, pendingDigest!), source: 'journal:1016001' }) }),
    resolveDelivery: () => delivery,
    io: { clearResult: () => {}, readResult: () => null, modelCalls: () => 1,
      wait: async ms => f.time(f.config.now() + ms), prepareAdmission: () => {}, closeAdmission: () => {},
      admissionState: () => ({ refused: false, uncertainEffects: 0, openDelegations: [] }) },
  });
  const worker = await adapter.launch({ operation: 'claim', claim: 'topic', artifact: 'sha256:test', incarnation: 'inc', workingScope: '/work' });
  delivery = { ...worker, operation: 'telegram:12345678:update:1016001', text: 'copper finch', digest: hash('copper finch'), resultPath: '/work/answer', maxBytes: 4096 };
  await adapter.deliver(delivery);
  f.changePane(recorded.wall.stdout);
  expect((await adapter.observe({ ...worker, delivery, cursor: 0, limit: 16 })).observations)
    .toEqual([{ kind: 'paused', evidence: worker.launch, reason: 'context-too-long' }]);
  f.onEnter(() => f.changePane(recorded.compactFailure.stdout));
  const result = await adapter.control({ ...worker, action: 'compact', authority: 'role', reason: 'context-too-long', delivery, deadline: 1900 });
  expect(result.state).toBe('replace-required');
  expect(f.calls.filter(call => call.includes('/compact'))).toHaveLength(1);
  expect(f.calls.filter(call => call[0] === 'kill-session')).toHaveLength(0);
  expect(f.journal.deliveries).toHaveLength(1);
  expect(f.journal.sessions[0]?.continuation).toMatchObject({ state: 'prepared', pending: { operation: delivery.operation, deadline: 1900 } });
});

it('restores the real refused recipe envelope byte-for-byte as the admitted task', async () => {
  const recorded = JSON.parse(readFileSync(new URL('../preview/fixtures/context-recovery-envelope-1016106-2026-10-16.json', import.meta.url), 'utf8')) as {
    operation: string; pendingText: string; digest: string; wall: string; compactFailure: string };
  const f = fixture('claude-code', { requireTurnHook: true });
  let delivery: import('../../src/assembly/contracts.js').HarnessInputDelivery | undefined;
  const adapter = createSessionConversationAdapter({
    createDriver: resolveIntake => createProductionSessionDriver({ ...f.config, resolveIntake,
      continuation: ({ operation, pendingDigest }) => ({ text: resolveIntake(operation, pendingDigest!), source: 'journal:1016106' }) }),
    resolveDelivery: () => delivery,
    io: { clearResult: () => {}, readResult: () => null, modelCalls: () => 1,
      wait: async ms => f.time(f.config.now() + ms), prepareAdmission: () => {}, closeAdmission: () => {},
      admissionState: () => ({ refused: false, uncertainEffects: 0, openDelegations: [] }) },
  });
  const old = await adapter.launch({ operation: 'claim', claim: 'topic', artifact: 'sha256:test', incarnation: 'inc', workingScope: '/work' });
  delivery = { ...old, operation: recorded.operation, text: recorded.pendingText, digest: recorded.digest, resultPath: '/work/answer', maxBytes: 4096 };
  expect(recorded.digest).toBe(hash(recorded.pendingText));
  await adapter.deliver(delivery); f.changePane(recorded.wall);
  await adapter.observe({ ...old, delivery, cursor: 0, limit: 16 });
  f.onEnter(() => f.changePane(recorded.compactFailure));
  expect((await adapter.control({ ...old, action: 'compact', authority: 'role', reason: 'context-too-long', delivery, deadline: 1900 })).state).toBe('replace-required');
  await adapter.control({ ...old, action: 'close', authority: 'role', reason: 'failed compact' }); f.changePane('❯ ');
  const start = f.calls.length;
  await adapter.launch({ operation: 'next', claim: 'next', artifact: 'sha256:test', incarnation: 'next', workingScope: '/work',
    restore: { operation: recorded.operation, digest: recorded.digest, deadline: 1900 } });
  const text = f.calls.slice(start).filter(call => call[0] === 'send-keys' && call.includes('-l')).map(call => call.at(-1)).join('');
  expect(text).toBe(recorded.pendingText);
  expect(text).toContain(recorded.operation);
  expect(f.calls.filter(call => call.includes('/compact'))).toHaveLength(1);
});

it.each(['busy', 'unknown', 'menu', 'policy', 'rate', 'stop', 'history', 'uncertain', 'deadline'] as const)(
  'never compacts or replaces an unsafe context recovery neighbor: %s', mode => {
    const f = fixture(), identity = f.launch(); value(f.deliver(identity));
    f.changePane('conversation is too long\n❯ ');
    value(f.driver.observe({ operation: 'deliver', processIdentity: identity }));
    if (mode === 'busy') f.changePane('conversation is too long\nesc to interrupt\n❯ ');
    if (mode === 'unknown') f.changePane('unknown terminal frame');
    if (mode === 'menu') f.changePane('❯ 1. Yes\n2. No');
    if (mode === 'policy') f.changePane('appears to violate our Usage Policy\nappears to violate our Usage Policy\n❯ ');
    if (mode === 'rate') f.changePane("You've hit your limit\n❯ ");
    if (mode === 'stop') f.stop();
    if (mode === 'uncertain') f.markPrepared();
    const driver = mode === 'history' ? createProductionSessionDriver({ ...f.config, continuation: undefined }) : f.driver;
    expect(driver.recoverContext(identity, { operation: 'deliver', digest: hash('hello'), deadline: mode === 'deadline' ? 999 : 1900 }).kind).toBe('Refused');
    expect(f.calls.some(call => call.includes('/compact'))).toBe(false);
    expect(f.calls.filter(call => call[0] === 'new-session')).toHaveLength(1);
    expect(f.calls.filter(call => call[0] === 'kill-session')).toHaveLength(mode === 'stop' ? 1 : 0);
  });

it('restores only after exact retirement, submits once without blocking the checkpoint, and retains the deadline', () => {
  const f = fixture('claude-code', { requireTurnHook: true }), old = f.launch(); value(f.deliver(old));
  const pending = { operation: 'deliver', digest: hash('hello'), deadline: 1900 };
  f.changePane('conversation is too long\n❯ ');
  value(f.driver.observe({ operation: 'deliver', processIdentity: old }));
  expect(value(f.driver.recoverContext(old, pending))).toBe('compact-requested');
  f.changePane('❯ /compact\nNot enough messages to compact.\n❯ ');
  expect(value(f.driver.recoverContext(old, pending))).toBe('replace-required');
  const next = { operation: 'next', claim: 'topic-next', artifact: 'sha256:test', incarnation: 'next', workingScope: '/work', handles: [], restore: pending };
  refused(f.driver.launch(next), 'retired original worker');
  value(f.driver.stop({ claim: 'topic', incarnation: 'inc', processIdentity: old })); f.changePane('❯ ');
  const identity = value(f.driver.launch(next));
  expect(identity).not.toBe(old);
  expect(f.journal.sessions.at(-1)).toMatchObject({ turnDeadline: 1900, continuation: { state: 'accepted', pending } });
  const submits = f.calls.filter(call => call[0] === 'send-keys' && call.includes('-l')
    && call.at(-1) === f.journal.sessions.at(-1)!.continuation!.text);
  expect(submits).toHaveLength(1);
  const restored = submits[0]!.at(-1)!;
  expect(restored).toBe(f.journal.sessions.at(-1)!.continuation!.text);
  expect(value(f.driver.launch(next))).toBe(identity);
  refused(f.driver.launch({ ...next, operation: 'third', claim: 'topic-third', incarnation: 'third' }), 'already submitted');
  expect(value(f.driver.observe({ operation: 'deliver', processIdentity: identity })).phase).toBe('launched');
  f.time(1001); f.hook(1001);
  expect(value(f.driver.observe({ operation: 'deliver', processIdentity: identity })).phase).toBe('output-observed');
  expect(value(f.driver.continuationReady(f.journal.sessions.at(-1)!.identity))).toBe(true);
  expect(f.journal.sessions.at(-1)?.continuation?.state).toBe('completed');
});

it('resumes the same worker only with a fresh compact receipt and a quiet prompt', () => {
  const f = fixture('claude-code', { requireTurnHook: true }), identity = f.launch(); value(f.deliver(identity));
  const pending = { operation: 'deliver', digest: hash('hello'), deadline: 1900 };
  f.compactHook(999);
  f.changePane('Prompt is too long\n❯ ');
  value(f.driver.observe({ operation: 'deliver', processIdentity: identity }));
  expect(value(f.driver.recoverContext(identity, pending))).toBe('compact-requested');
  f.changePane('Conversation compacted\n❯ ');
  expect(value(f.driver.recoverContext(identity, pending))).toBe('compacting');
  f.time(1001); f.compactHook(1001); f.changePane('Working…\nesc to interrupt\n❯ ');
  expect(value(f.driver.recoverContext(identity, pending))).toBe('compacting');
  f.changePane('Conversation compacted\n❯ ');
  expect(value(f.driver.recoverContext(identity, pending))).toBe(identity);
  expect(f.journal.sessions[0]).toMatchObject({ turnDeadline: 1900, continuation: { state: 'accepted', pending } });
  expect(f.calls.filter(call => call[0] === 'new-session')).toHaveLength(1);
  refused(f.driver.recoverContext(identity, pending), 'already submitted');
  expect(f.journal.deliveries).toHaveLength(1);
});

it('a correlated completed turn takes precedence over context-wall words left in the pane', () => {
  const f = fixture('claude-code', { requireTurnHook: true }), identity = f.launch(); value(f.deliver(identity));
  f.changePane('The previous error was: Prompt is too long\n❯ ');
  f.time(1001); f.hook(1001);
  expect(value(f.driver.observe({ operation: 'deliver', processIdentity: identity })).phase).toBe('output-observed');
  expect(value(f.driver.observe({ operation: 'deliver', processIdentity: identity })).phase).toBe('output-observed');
  expect(f.calls.some(call => call.includes('/compact'))).toBe(false);
});

const socketCapture = JSON.parse(readFileSync(new URL('../preview/fixtures/socket-drop-worker-1016101-2026-10-16.json', import.meta.url), 'utf8'));
const socketRun = socketCapture.runs.find((run: { name: string }) => run.name === 'persistent');
const socketExhausted: string = socketRun.panes.at(-1).stdout;

it('replays the real exhausted native retry without another input or a false completion', () => {
  const f = fixture('claude-code', { requireTurnHook: true }), id = f.launch(); value(f.deliver(id));
  const sends = f.sends, deadline = f.journal.sessions[0]!.turnDeadline;
  for (const frame of socketRun.panes.filter((frame: { stdout: string }) => frame.stdout.includes('Retrying in'))) {
    f.changePane(frame.stdout);
    expect(value(f.driver.observe({ operation: 'deliver', processIdentity: id })).phase).toBe('launched');
    expect(f.journal.sessions[0]!.turnDeadline).toBe(deadline);
  }
  f.changePane(socketExhausted);
  expect(value(f.driver.observe({ operation: 'deliver', processIdentity: id })))
    .toMatchObject({ phase: 'pause-observed', detail: 'connection-exhausted' });
  expect(f.sends).toBe(sends);
  expect(f.journal.deliveries[0]!.state).toBe('accepted');
  expect(f.journal.sessions[0]!.turnCloseEvidence).toBeNull();
  expect(f.journal.sessions[0]!.turnDeadline).toBe(deadline);
});

const socketRetry: string = socketRun.panes.find((frame: { stdout: string }) => frame.stdout.includes('attempt 10/10')).stdout;
function retryingSocket() {
  const f = fixture('claude-code', { requireTurnHook: true }), id = f.launch(); value(f.deliver(id));
  f.changePane(socketRetry); value(f.driver.observe({ operation: 'deliver', processIdentity: id }));
  return { f, id };
}

it.each(['quoted', 'stale', 'working', 'menu', 'unknown-footer'] as const)('does not retire the %s socket-error neighbour', mode => {
  const { f, id } = retryingSocket();
  const pane = mode === 'quoted' ? socketExhausted.split('\n').map(line => `  ${line}`).join('\n')
    : mode === 'stale' ? `${socketExhausted}\n⏺ Later ordinary answer\n❯ `
      : mode === 'working' ? socketRetry
        : mode === 'menu' ? `${socketExhausted}\n❯ 1. Continue\n  2. Cancel`
          : `${socketExhausted}\nunknown state`;
  f.changePane(pane);
  expect(value(f.driver.observe({ operation: 'deliver', processIdentity: id })).phase).toBe('launched');
  expect(f.journal.sessions[0]!.turnDeadline).toBe(2000);
});

it('requires a native retry in this exact turn, and a changed pane, before exhausted-error retirement', () => {
  const f = fixture('claude-code', { requireTurnHook: true }), id = f.launch(); value(f.deliver(id));
  f.changePane(socketExhausted);
  expect(value(f.driver.observe({ operation: 'deliver', processIdentity: id })).phase).toBe('launched');
  const { f: g, id: other } = retryingSocket();
  g.hook(1100); g.time(1100); value(g.driver.observe({ operation: 'deliver', processIdentity: other }));
  g.changePane(socketExhausted);
  value(g.driver.deliver({ operation: 'second', processIdentity: other, intake: 'second', digest: hash('hello'), incarnation: 'inc' }));
  expect(g.journal.sessions[0]!.connectionRetry).toBeNull();
  expect(value(g.driver.observe({ operation: 'second', processIdentity: other })).phase).toBe('launched');
});

it('persists native retry pressure across driver restart without resetting the deadline or sending again', () => {
  const { f, id } = retryingSocket(), sends = f.sends;
  expect(f.journal.sessions[0]!.connectionRetry).toEqual({ turnStartedAt: 1000, attempt: 10 });
  const restarted = createProductionSessionDriver(f.config);
  f.changePane(socketExhausted);
  expect(value(restarted.observe({ operation: 'deliver', processIdentity: id })).detail).toBe('connection-exhausted');
  expect(f.sends).toBe(sends); expect(f.journal.sessions[0]!.turnDeadline).toBe(2000);
});

it.each(['stop', 'identity', 'deadline', 'receipt', 'context'] as const)('preserves %s precedence over socket recovery', mode => {
  const { f, id } = retryingSocket(); f.changePane(socketExhausted);
  if (mode === 'identity') {
    f.changeStamp('999:1001'); refused(f.driver.observe({ operation: 'deliver', processIdentity: id }), 'identity changed'); return;
  }
  if (mode === 'stop') f.stop();
  if (mode === 'deadline') f.time(2000);
  if (mode === 'receipt') { f.time(1100); f.hook(1100); }
  if (mode === 'context') f.changePane('conversation is too long\n❯ ');
  const observation = value(f.driver.observe({ operation: 'deliver', processIdentity: id }));
  expect(observation.phase).toBe(mode === 'receipt' ? 'output-observed' : mode === 'context' ? 'pause-observed' : 'exit-observed');
  expect(observation.detail).not.toBe('connection-exhausted');
});

it('retains the infrastructure deadline cause after the exact process has gone', () => {
  const f = fixture(), id = f.launch(); value(f.deliver(id)); f.changePane('working'); f.time(2001);
  const first = value(f.driver.observe({ operation: 'observe', processIdentity: id }));
  expect(first.evidence).toBe(`safety-ceiling:deadline:${id}`);
  expect(value(f.driver.observe({ operation: 'again', processIdentity: id })).evidence).toBe(first.evidence);
});

// Incident 969390559: a restored native session must reach the host's model
// checkpoint before it can emit Stop. Its previous synchronous wait starved both.
it.each(['reply', 'stop', 'deadline'] as const)('restoration yields to the real host event loop: %s', async outcome => {
  const incident = JSON.parse(readFileSync(new URL('../preview/fixtures/fastswitch-incident-1017.json', import.meta.url), 'utf8'));
  expect(incident.continuation.state).toBe('accepted');
  expect(incident.restoration.closedAt).toBeNull();
  expect(incident.restoration.turnDeadline - incident.restoration.turnStartedAt).toBe(14_400_000);
  const f = fixture('claude-code', { ...rateConfig, turnDeadlineMs: 1000 });
  let requested = false, completed = false;
  const server = createServer((_request, response) => {
    requested = true;
    if (outcome === 'stop') f.stop();
    else if (outcome === 'deadline') f.time(2001);
    else { f.time(1001); f.hook(1001); completed = true; }
    response.end('recorded restoration acknowledged');
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw Error('test endpoint missing');
  const driver = createProductionSessionDriver({ ...f.config, continuationRequired: () => true,
    continuation: () => ({ text: 'Recorded history retained privately in incident evidence', source: incident.continuation.source }) });
  f.onEnter(() => { get(`http://127.0.0.1:${address.port}`, response => response.resume()).on('error', () => undefined); });
  const adapter = createSessionConversationAdapter({ createDriver: () => driver,
    resolveDelivery: () => ({ launch: 'unused-by-fixture', incarnation: 'inc', claim: 'topic', operation: 'operator', text: 'hello', digest: hash('hello'), resultPath: '/work/result', maxBytes: 1000 }),
    io: { clearResult() {}, readResult: () => null, modelCalls: () => 1, prepareAdmission() {},
      admissionState: () => ({ refused: false, openDelegations: [] }), closeAdmission() {},
      wait: async ms => { expect(f.journal.deliveries).toHaveLength(0); await new Promise(resolve => setTimeout(resolve, ms)); } } });
  try {
    const launch = adapter.launch({ operation: 'op', claim: 'topic', artifact: 'sha256:test', incarnation: 'inc', workingScope: '/work' });
    if (outcome === 'reply') {
      const worker = await launch;
      expect(completed).toBe(true);
      await adapter.deliver({ ...worker, operation: 'operator', text: 'hello', digest: hash('hello'), resultPath: '/work/result', maxBytes: 1000 });
      expect(f.journal.deliveries).toHaveLength(1);
    } else {
      await expect(launch).rejects.toThrow(outcome === 'stop' ? /stop/ : /deadline/);
      expect(f.journal.deliveries).toHaveLength(0);
    }
    expect(requested).toBe(true);
    expect(f.calls.filter(row => row[0] === 'send-keys' && row.includes('Enter'))).toHaveLength(outcome === 'reply' ? 2 : 1);
  } finally { await new Promise<void>(resolve => server.close(() => resolve())); }
});


it.each([recordedLimit, recordedThrottle])('restarts throttle corroboration when recorded working frames interrupt %s', throttle => {
  const captured = JSON.parse(readFileSync(new URL('../preview/fixtures/work-silence-terminal-2026-10-14.json', import.meta.url), 'utf8'));
  const f = fixture('claude-code', rateConfig), id = f.launch(); value(f.deliver(id));
  const observe = () => value(f.driver.observe({ operation: 'deliver', processIdentity: id }));
  const quiet = `${throttle}\n❯ `;
  f.changePane(quiet); observe(); const sends = f.sends;
  f.time(30_000); f.changePane(`${throttle}\n${captured.captures[1].capture}`);
  expect(observe().phase).toBe('launched'); expect(f.sends).toBe(sends);
  f.time(31_000); f.changePane(quiet);
  expect(observe().phase).toBe('launched'); expect(f.sends).toBe(sends);
  f.time(60_999); observe(); expect(f.sends).toBe(sends);
  f.time(61_000); expect(observe().detail).toBe('rate-limit continuation submitted');
  expect(f.sends).toBeGreaterThan(sends);
  expect(f.journal.sessions[0]?.turnDeadline).toBe(121_000);
  expect(f.journal.deliveries).toHaveLength(1);
});

it('exports active and idle corroboration from recorded frames without claiming a result', () => {
  const captures = JSON.parse(readFileSync(new URL('../preview/fixtures/work-silence-terminal-2026-10-14.json', import.meta.url), 'utf8')).captures;
  const idle = JSON.parse(readFileSync(new URL('../fixtures/claude-idle-2.1.280.json', import.meta.url), 'utf8')).pane.capture;
  const observations: Parameters<NonNullable<ProductionSessionConfig['observeActivity']>>[0][] = [];
  const f = fixture('claude-code', { requireTurnHook: true, observeActivity: row => observations.push(row) });
  const id = f.launch(); value(f.deliver(id));
  for (const pane of [captures[0].capture, captures[1].capture, idle]) {
    f.changePane(pane);
    expect(value(f.driver.observe({ operation: 'deliver', processIdentity: id })).phase).toBe('launched');
  }
  expect(observations).toMatchObject([{ activity: 'unknown' }, { activity: 'active' }, { activity: 'idle' }]);
});


it.each([recordedLimit, recordedThrottle])('replays real journal results through corroborated %s recovery without counting an empty bubble as recovered', async throttle => {
  const recorded = JSON.parse(readFileSync(new URL('../preview/fixtures/retrospective-duty-followup-train-1-2026-10-08.json', import.meta.url), 'utf8'));
  const captures = JSON.parse(readFileSync(new URL('../preview/fixtures/work-silence-terminal-2026-10-14.json', import.meta.url), 'utf8')).captures;
  for (const row of recorded.otherShapes as { kind: string; id: string; raw: string }[]) {
    const f = fixture('claude-code', rateConfig); let result: string | null = null;
    const adapter = createSessionConversationAdapter({ createDriver: () => f.driver, resolveDelivery: () => undefined,
      io: { clearResult: () => undefined, readResult: () => result, modelCalls: () => 2,
        prepareAdmission: () => undefined, admissionState: () => ({ refused: false, openDelegations: [] }),
        closeAdmission: () => undefined, wait: async () => undefined } });
    const worker = await adapter.launch({ operation: 'op', claim: 'topic', artifact: 'sha256:test', incarnation: 'inc', workingScope: '/work' });
    const delivery = { ...worker, operation: 'deliver', text: 'hello', digest: hash('hello'), resultPath: '/work/result', maxBytes: 100_000 };
    await adapter.deliver(delivery);
    const observe = () => adapter.observe({ ...worker, delivery, cursor: 0, limit: 2 });
    const quiet = `${throttle}\n❯ `;
    f.changePane(quiet); await observe(); const sends = f.sends;
    f.time(30_000); f.changePane(`${throttle}\n${captures[1].capture}`);
    expect((await observe()).observations, row.id).toEqual([]);
    f.time(31_000); f.changePane(quiet); await observe();
    expect(f.sends, row.id).toBe(sends);
    f.time(61_000); expect((await observe()).observations, row.id).toEqual([]);
    expect(f.journal.sessions[0]?.rateRecovery?.state, row.id).toBe('accepted');
    expect(f.sends, row.id).toBe(sends + 2); // one literal continuation and its Enter
    result = row.raw; f.time(61_001); f.hook(61_001);
    expect((await observe()).observations, row.id).toEqual(row.raw.trim()
      ? [{ kind: 'reply', delivery: 'deliver', text: row.raw, digest: hash(row.raw) },
        { kind: 'turn-end', delivery: 'deliver', state: 'completed' }] : []);
    expect(f.journal.sessions[0]?.turnDeadline, row.id).toBe(row.raw.trim() ? null : 121_000);
    expect(f.journal.deliveries, row.id).toHaveLength(1);
  }
});

it.each(['changed', 'legacy', 'absent'] as const)('requires fresh unchanged throttle evidence after %s output', state => {
  const f = fixture('claude-code', rateConfig), id = f.launch(); value(f.deliver(id));
  const observe = (driver = f.driver) => value(driver.observe({ operation: 'deliver', processIdentity: id }));
  const quiet = `${recordedLimit}\n❯ `;
  f.changePane(quiet); observe(); const sends = f.sends;
  if (state === 'legacy') f.config.io.save({ ...f.journal, sessions: f.journal.sessions.map(row => ({ ...row,
    rateRecovery: { dueAt: 31_000, state: 'waiting' } })) });
  f.time(31_000); f.changePane(state === 'absent' ? '' : state === 'changed' ? `new line\n${quiet}` : quiet);
  observe(); expect(f.sends).toBe(sends);
  f.time(32_000); f.changePane(quiet); observe(); expect(f.sends).toBe(sends);
  f.time(62_000); expect(observe(createProductionSessionDriver(f.config)).detail).toBe('rate-limit continuation submitted');
  expect(f.journal.sessions[0]?.turnDeadline).toBe(121_000);
});


it('a different adapter pause after throttle waiting is preserved without a continuation', () => {
  const f = fixture('claude-code', rateConfig), id = f.launch(); value(f.deliver(id));
  const observe = () => value(f.driver.observe({ operation: 'deliver', processIdentity: id }));
  f.changePane(`${recordedLimit}\n❯ `); observe(); const sends = f.sends;
  f.time(31_000);
  f.changePane('appears to violate our Usage Policy\nappears to violate our Usage Policy\n❯ ');
  expect(observe()).toMatchObject({ phase: 'pause-observed', detail: 'policy-wedge' });
  expect(f.sends).toBe(sends);
});

// Rule 36: inherited real render, no authority inferred from its prose or selected Yes.
it('surfaces a recorded unresolved approval menu without typing or claiming completion', () => {
  const recorded = JSON.parse(readFileSync(new URL('../fixtures/permission-menu-1x.json', import.meta.url), 'utf8'));
  const f = fixture('claude-code', { ...rateConfig, turnDeadlineMs: 300000 }), id = f.launch(); value(f.deliver(id));
  const sends = f.sends, deadline = f.journal.sessions[0]?.turnDeadline;
  f.changePane(recorded.capture);
  for (const at of [1000, 2000, 4000]) { f.time(at); value(f.driver.observe({ operation: 'deliver', processIdentity: id })); }
  f.time(6000);
  expect(value(f.driver.observe({ operation: 'deliver', processIdentity: id }))).toMatchObject({
    phase: 'launched', detail: 'harness menu needs exact authorization; no input sent',
  });
  expect(f.sends).toBe(sends);
  expect(f.journal.sessions[0]?.turnDeadline).toBe(deadline);
});

it('menu observation never submits keys, ends work, resets deadlines or survives changed evidence', () => {
  const menu = JSON.parse(readFileSync(new URL('../fixtures/permission-menu-1x.json', import.meta.url), 'utf8')).capture;
  const f = fixture('claude-code', rateConfig), id = f.launch(); value(f.deliver(id));
  f.changePane(menu);
  const observe = (driver = f.driver) => value(driver.observe({ operation: 'deliver', processIdentity: id }));
  for (let i = 0; i < 10; i++) observe(); // same-clock observations cannot manufacture persistence
  expect(f.journal.sessions[0]?.promptWait?.samples).toBe(1);
  for (const at of [2000, 3000, 6000]) { f.time(at); observe(); }
  const restarted = createProductionSessionDriver(f.config), sends = f.sends;
  expect(observe(restarted).detail).toContain('harness menu');
  expect(value(restarted.observeIdle(id))).toBeNull();
  f.changePane(`${menu}\n❯ `); observe(restarted);
  expect(f.journal.sessions[0]?.promptWait).toBeNull();
  f.changePane(menu); f.time(7000); expect(observe(restarted).detail).toBe('session live; turn still open');
  f.time(121000); expect(observe(restarted).phase).toBe('exit-observed');
  expect(f.sends).toBe(sends);
  for (const pane of [`${menu}\n❯ `, `${menu}\nWorking… (esc to interrupt)`, '1. Yes\n2. No', 'Some answer.'])
    expect(classifyBlockingMenu(pane)).toBe(false);
  const recorded = JSON.parse(readFileSync(new URL('../fixtures/permission-menu-1x.json', import.meta.url), 'utf8'));
  for (const capture of recorded.radioCaptures) expect(classifyBlockingMenu(capture)).toBe(true);
  expect(classifyBlockingMenu(menu.replace('Yes', 'Always allow'))).toBe(true); // visible, never answered
});

it('replays recorded summary, uncertain, Jev, review and empty reply shapes beside an unresolved menu', () => {
  const recorded = JSON.parse(readFileSync(new URL('../preview/fixtures/retrospective-duty-followup-train-1-2026-10-08.json', import.meta.url), 'utf8'));
  const menu = JSON.parse(readFileSync(new URL('../fixtures/permission-menu-1x.json', import.meta.url), 'utf8')).capture;
  for (const row of recorded.otherShapes) {
    const f = fixture('claude-code', rateConfig), id = f.launch(); value(f.deliver(id));
    f.changePane(row.raw); value(f.driver.observe({ operation: 'deliver', processIdentity: id }));
    expect(f.journal.sessions[0]?.promptWait ?? null).toBeNull();
    const sends = f.sends;
    f.changePane(`${row.raw}\n${menu}`);
    for (const at of [1000, 2000, 3000]) { f.time(at); value(f.driver.observe({ operation: 'deliver', processIdentity: id })); }
    f.time(6000);
    expect(value(f.driver.observe({ operation: 'deliver', processIdentity: id })).detail).toContain('harness menu');
    expect(f.sends).toBe(sends);
  }
});
