import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, expect, it } from 'vitest';
import { assemblyRuntimeFixture } from './runtime-fixture.js';
import { value, refused } from '../facts/fixtures.js';
import { buildLiteralSendArgs, chunkLiteralForTmux, classifyPaneIdle, classifyPaneReadiness, classifyStuckSignature,
  createProductionSessionDriver } from '../../src/assembly/production-session-driver.js';
import type { SessionIO, SessionJournal } from '../../src/assembly/production-session-driver.js';

const hash = (text: string) => `sha256:${createHash('sha256').update(text).digest('hex')}`;
const fixtureRoots: string[] = [];
afterEach(() => { for (const root of fixtureRoots.splice(0)) rmSync(root, { recursive: true, force: true }); });
function fixture(framework: 'claude-code' | 'codex-cli' = 'claude-code', extra: Readonly<{ launchVia?: readonly string[] }> = {}) {
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
    markPrepared: () => { journal = { ...journal, deliveries: journal.deliveries.map(row => ({ ...row, state: 'prepared' })) }; },
    stop: () => { stopped = true; }, time: (value: number) => { now = value; }, config };
}

it('ports byte bounded tmux chunks, menu precedence, and tail gated stuck signatures', () => {
  expect(chunkLiteralForTmux('🙂'.repeat(3000)).every(part => Buffer.byteLength(part) <= 8000)).toBe(true);
  expect(chunkLiteralForTmux('🙂'.repeat(3000)).join('')).toBe('🙂'.repeat(3000));
  expect(buildLiteralSendArgs('instar20-' + 'a'.repeat(24), '-x')).toEqual(['send-keys', '-t', '=instar20-' + 'a'.repeat(24) + ':', '-l', '--', '-x']);
  expect(classifyPaneReadiness('❯ 1. Update\n  2. Skip')).toBe('menu');
  expect(classifyPaneReadiness('❯ ')).toBe('ready');
  expect(classifyStuckSignature('conversation is too long\n' + 'normal work\n'.repeat(20))).toBeNull();
  expect(classifyStuckSignature('conversation is too long')).toBe('context-too-long');
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
  expect(f.journal.sessions.find(row => row.identity === next)?.continuation?.state).toBe('completed');
  expect(f.calls.filter(row => row[0] === 'new-session')).toHaveLength(2);
  expect(f.journal.resumes.topic).toBeUndefined();
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
  expect(f.journal.sessions.find(row => row.identity === next)?.continuation?.state).toBe('completed');
});

it('recovers a delivered no-hook context failure, then respawns after failed compaction', () => {
  const f = fixture('codex-cli'), id = f.launch(); value(f.deliver(id));
  f.changePane('conversation is too long\n› ');
  expect(value(f.driver.observe({ operation: 'observe', processIdentity: id })).phase).toBe('pause-observed');
  expect(f.journal.sessions[0]?.turnDeadline).toBeNull();
  expect(value(f.driver.recoverContext(id))).toBe('compact-requested');
  expect(value(f.driver.observe({ operation: 'observe', processIdentity: id })).phase).toBe('pause-observed');
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
  expect(value(f.driver.observe({ operation: 'observe', processIdentity: id })).phase).toBe('pause-observed');
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
  const toolAdmission = { command: (claim: string, phase: 'pre' | 'post') => `/node /repo/hook.mjs ${phase} /state/${claim}`, timeoutSeconds: 600 };
  const modelGate = (claim: string) => `http://127.0.0.1:4100/${'a'.repeat(32)}/${claim}`;
  const driver = createProductionSessionDriver({ ...f.config, confinement: 'admitted', toolAdmission, modelGate });
  value(driver.launch({ operation: 'op', claim: 'topic', artifact: 'sha256:test', incarnation: 'inc', workingScope: '/work', handles: [] }));
  const spawned = f.calls.find(row => row[0] === 'new-session')!;
  if (framework === 'claude-code') {
    // Every tool stays (no permission prompt); the settings install the hook for every tool, before and after.
    expect(spawned).toContain('--dangerously-skip-permissions');
    const settings = JSON.parse(spawned[spawned.indexOf('--settings') + 1]!);
    expect(settings.hooks.PreToolUse).toEqual([{ matcher: '*', hooks: [{ type: 'command', command: '/node /repo/hook.mjs pre /state/topic', timeout: 600 }] }]);
    expect(settings.hooks.PostToolUse[0].hooks[0].command).toBe('/node /repo/hook.mjs post /state/topic');
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
  const plain = fixture();
  plain.launch();
  const direct = plain.calls.find(row => row[0] === 'new-session') ?? [];
  expect(direct).not.toContain('/repo/tests/preview/harness-session.mjs');
  expect(direct[direct.indexOf('/synthetic') - 1]).toMatch(/^INSTAR_SESSION_GROUNDING_FILE=/u);
  expect(() => fixture('claude-code', { launchVia: ['relative', '--'] })).toThrow(/exact launch command/u);
  expect(() => fixture('claude-code', { launchVia: [] })).toThrow(/exact launch command/u);
});
