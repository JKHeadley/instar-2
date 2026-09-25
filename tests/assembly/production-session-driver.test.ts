import { createHash } from 'node:crypto';
import { expect, it } from 'vitest';
import { assemblyRuntimeFixture } from './runtime-fixture.js';
import { value, refused } from '../facts/fixtures.js';
import { buildLiteralSendArgs, chunkLiteralForTmux, classifyPaneReadiness, classifyStuckSignature,
  createProductionSessionDriver } from '../../src/assembly/production-session-driver.js';
import type { SessionIO, SessionJournal } from '../../src/assembly/production-session-driver.js';

const hash = (text: string) => `sha256:${createHash('sha256').update(text).digest('hex')}`;
function fixture() {
  const f = assemblyRuntimeFixture(); let now = 1000, stopped = false, pane = '❯ ', sends = 0;
  let journal: SessionJournal = { sessions: [], deliveries: [], resumes: {} };
  const calls: string[][] = []; let failSend = false;
  const dead = new Set<string>();
  let hooks: { kind: 'turn-closed' | 'compact'; sessionId: string; at: number }[] = [];
  const io: SessionIO = {
    exclusive: run => run(),
    tmux(args) {
      calls.push([...args]);
      if (args[0] === 'new-session') return { code: 0, stdout: '' };
      if (args[0] === 'display-message') return { code: 0, stdout: '321:1000\n' };
      if (args[0] === 'capture-pane') return { code: 0, stdout: pane };
      if (args[0] === 'has-session') return { code: dead.has(args[2] ?? '') ? 1 : 0, stdout: '' };
      if (args[0] === 'kill-session') { dead.add(args[2] ?? ''); return { code: 0, stdout: '' }; }
      if (args[0] === 'send-keys') {
        if (failSend) { failSend = false; throw Error('simulated process death before send'); }
        sends++; return { code: 0, stdout: '' };
      }
      return { code: 0, stdout: '' };
    },
    sleep() {}, load: () => journal, save: next => { journal = structuredClone(next); }, armDeadline() {},
    readInbox: () => hooks, transcriptExists: () => true,
  };
  const config = { operatorOwnUse: true as const, confinement: 'unconfined' as const,
    framework: 'claude-code' as const, executable: '/synthetic', cwd: '/work', home: '/login', configHome: '/login',
    context: f.c, io, now: () => now, stopped: () => stopped, resolveIntake: () => 'hello',
    maxSessions: 1, turnDeadlineMs: 1000, readyTimeoutMs: 1000, protectedSessions: [] };
  const driver = createProductionSessionDriver(config);
  const launch = () => value(driver.launch({ operation: 'op', claim: 'topic', artifact: 'sha256:test',
    incarnation: 'inc', workingScope: '/work', handles: [] }));
  const deliver = (identity: string) => driver.deliver({ operation: 'deliver', processIdentity: identity,
    intake: 'input', digest: hash('hello'), incarnation: 'inc' });
  return { driver, launch, deliver, calls, get journal() { return journal; }, get sends() { return sends; },
    changePane: (value: string) => { pane = value; }, failNextSend: () => { failSend = true; },
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
  const newDriver = createProductionSessionDriver({ ...f.config, maxSessions: 2 });
  const next = value(newDriver.launch({ operation: 'next', claim: 'topic', artifact: 'sha256:test',
    incarnation: 'next', workingScope: '/work', handles: [] }));
  expect(next).not.toBe(id);
  expect(f.calls.some(row => row[0] === 'new-session' && row.includes('--resume') && row.includes(resume))).toBe(true);
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
