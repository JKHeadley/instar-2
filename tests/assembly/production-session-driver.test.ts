import { createHash } from 'node:crypto';
import { expect, it } from 'vitest';
import { assemblyRuntimeFixture } from './runtime-fixture.js';
import { value, refused } from '../facts/fixtures.js';
import { buildLiteralSendArgs, chunkLiteralForTmux, classifyPaneIdle, classifyPaneReadiness, classifyStuckSignature,
  createProductionSessionDriver } from '../../src/assembly/production-session-driver.js';
import type { SessionIO, SessionJournal } from '../../src/assembly/production-session-driver.js';

const hash = (text: string) => `sha256:${createHash('sha256').update(text).digest('hex')}`;
function fixture(framework: 'claude-code' | 'codex-cli' = 'claude-code') {
  const f = assemblyRuntimeFixture(); let now = 1000, stopped = false, pane = '❯ ', sends = 0;
  let journal: SessionJournal = { sessions: [], deliveries: [], resumes: {} };
  const calls: string[][] = []; let failSend = false, failSpawn = false, failIdentitySave = false, armed = false, armCount = 0;
  let stamp = '321:1000', transcript = true;
  const dead = new Set<string>();
  const live = new Set<string>();
  let hooks: { kind: 'turn-closed' | 'compact'; sessionId: string; at: number }[] = [];
  const io: SessionIO = {
    exclusive: run => run(),
    tmux(args) {
      calls.push([...args]);
      if (args[0] === 'new-session') { if (failSpawn) { failSpawn = false; return { code: 1, stdout: '' }; }
        live.add(`=${args[args.indexOf('-s') + 1]}:`); return { code: 0, stdout: '' }; }
      if (args[0] === 'display-message') return { code: 0, stdout: `${stamp}\n` };
      if (args[0] === 'capture-pane') return { code: 0, stdout: pane };
      if (args[0] === 'has-session') return { code: !live.has(args[2] ?? '') || dead.has(args[2] ?? '') ? 1 : 0, stdout: '' };
      if (args[0] === 'kill-session') { dead.add(args[2] ?? ''); return { code: 0, stdout: '' }; }
      if (args[0] === 'send-keys') {
        if (failSend) { failSend = false; throw Error('simulated process death before send'); }
        sends++; if (args.includes('Enter') && onEnter) onEnter(); return { code: 0, stdout: '' };
      }
      return { code: 0, stdout: '' };
    },
    sleep() {}, load: () => journal, save: next => {
      if (failIdentitySave && next.sessions.length > journal.sessions.length) { failIdentitySave = false; throw Error('identity save failed'); }
      journal = structuredClone(next);
    }, armDeadline() { armed = true; armCount++; },
    readInbox: () => hooks, transcriptExists: () => transcript,
  };
  let onEnter: (() => void) | null = null;
  const config = { operatorOwnUse: true as const, confinement: 'unconfined' as const,
    framework, executable: '/synthetic', cwd: '/work', home: '/login', configHome: '/login',
    context: f.c, io, now: () => now, stopped: () => stopped, resolveIntake: () => 'hello',
    maxSessions: 1, turnDeadlineMs: 1000, readyTimeoutMs: 1000, protectedSessions: [] };
  const driver = createProductionSessionDriver(config);
  const launch = () => value(driver.launch({ operation: 'op', claim: 'topic', artifact: 'sha256:test',
    incarnation: 'inc', workingScope: '/work', handles: [] }));
  const deliver = (identity: string) => driver.deliver({ operation: 'deliver', processIdentity: identity,
    intake: 'input', digest: hash('hello'), incarnation: 'inc' });
  return { driver, launch, deliver, calls, get journal() { return journal; }, get sends() { return sends; },
    get armed() { return armed; }, get armCount() { return armCount; },
    changePane: (value: string) => { pane = value; }, failNextSend: () => { failSend = true; },
    failNextIdentitySave: () => { failIdentitySave = true; }, changeStamp: (value: string) => { stamp = value; },
    failNextSpawn: () => { failSpawn = true; },
    transcript: (value: boolean) => { transcript = value; }, onEnter: (callback: () => void) => { onEnter = callback; },
    hook: (at: number) => { hooks = [{ kind: 'turn-closed', sessionId: '12345678-1234-1234-1234-123456789abc', at }]; },
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
  expect(classifyPaneIdle(`answer\n${cursor} `, framework)).toBe(true);
  const f = fixture(framework), id = f.launch();
  value(f.deliver(id));
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
  f.hook(999);
  f.onEnter(() => { expect(f.armed).toBe(true); expect(f.journal.sessions[0]?.turnDeadline).toBe(2000); });
  value(f.deliver(id));
  expect(value(f.driver.observe({ operation: 'observe', processIdentity: id })).phase).toBe('launched');
  f.hook(1000);
  expect(value(f.driver.observe({ operation: 'observe', processIdentity: id })).phase).toBe('output-observed');
  expect(f.journal.sessions[0]?.turnDeadline).toBeNull();
});

it('accepts a current-turn Stop receipt written synchronously with Enter', () => {
  const f = fixture(), id = f.launch();
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

it('validates an exact resume transcript and uses it only for the matching topic', () => {
  const f = fixture(), id = f.launch();
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
  expect(f.calls.some(row => row[0] === 'new-session' && row.includes('--resume') && row.includes(resume))).toBe(true);
  f.transcript(false);
  refused(newDriver.launch({ operation: 'missing', claim: 'topic', artifact: 'sha256:test',
    incarnation: 'missing', workingScope: '/work', handles: [] }), 'transcript missing');
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

it('compacts an idle context wall once and then freshly respawns without the resume uuid', () => {
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
  expect(f.journal.resumes.topic).toBeUndefined();
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
