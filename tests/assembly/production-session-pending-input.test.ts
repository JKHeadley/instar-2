// Carryover row 14 (lanes/carryover-1028.md): accepted input starts work, while suggested ghost
// input is not submitted. The 1.x verifyInjection + StuckInputSentinel behavior through the existing
// production session driver: its tmux port, its durable session journal and its observe() cycle.
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, expect, it } from 'vitest';
import { assemblyRuntimeFixture } from './runtime-fixture.js';
import { value, refused } from '../facts/fixtures.js';
import { createProductionSessionDriver } from '../../src/assembly/production-session-driver.js';
import type { SessionIO, SessionJournal } from '../../src/assembly/production-session-driver.js';

const ESC = '\x1b';
const hash = (text: string) => `sha256:${createHash('sha256').update(text).digest('hex')}`;
const TEXT = 'Please check the deployment status for the growth site and report back.';
const MARKER = TEXT.slice(0, 40);
const chrome = ['────────────────────────────────────────', '  ⏵⏵ bypass permissions on (shift+tab to cycle)'];
const idle = (prompt: string, text = '') => ['', chrome[0]!, `${prompt} ${text}`.trimEnd() + (text ? '' : ' '), ...chrome].join('\n');
const PENDING = idle('❯', TEXT);
const PENDING_GHOST = PENDING.replace(TEXT, `${ESC}[0;2m${TEXT}${ESC}[0m`);
const PENDING_REAL = PENDING.replace('❯', `${ESC}[36m❯${ESC}[0m`);
const PENDING_ACTIVE = ['', chrome[0]!, `❯ ${TEXT}`, chrome[0]!, '  ⏵⏵ bypass permissions on · esc to interrupt'].join('\n');
const EMPTY = idle('❯');

const roots: string[] = [];
afterEach(() => { for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }); });

function fixture(framework: 'claude-code' | 'codex-cli' = 'claude-code') {
  const f = assemblyRuntimeFixture(); let now = 1000, stopped = false, pane = idle(framework === 'codex-cli' ? '›' : '❯');
  let styled: string | null | (() => string) = () => pane; // the `-e` frame; null makes the capture fail
  const root = mkdtempSync(join(tmpdir(), 'instar-pending-input-')); roots.push(root);
  const home = join(root, 'home'); mkdirSync(home);
  let journal: SessionJournal = { sessions: [], deliveries: [], resumes: {} };
  const keys: string[][] = []; let failNextKey = false; let styledCaptures = 0;
  let hooks: { kind: 'turn-closed' | 'compact'; sessionId: string; at: number; receiptId: string }[] = [];
  const live = new Set<string>();
  const io: SessionIO = {
    exclusive: run => run(),
    tmux(args) {
      if (args[0] === 'new-session') { live.add(`=${args[args.indexOf('-s') + 1]}:`); return { code: 0, stdout: '' }; }
      if (args[0] === 'display-message') return { code: 0, stdout: '321:1000\n' };
      if (args[0] === 'capture-pane') {
        if (!args.includes('-e')) return { code: 0, stdout: pane };
        styledCaptures++;
        const frame = typeof styled === 'function' ? styled() : styled;
        return frame === null ? { code: 1, stdout: '' } : { code: 0, stdout: frame };
      }
      if (args[0] === 'has-session') return { code: live.has(args[2] ?? '') ? 0 : 1, stdout: '' };
      if (args[0] === 'send-keys') {
        if (failNextKey) { failNextKey = false; throw Error('simulated cut before the key'); }
        keys.push([...args]); return { code: 0, stdout: '' };
      }
      return { code: 0, stdout: '' };
    },
    sleep() {}, load: () => journal, save: next => { journal = structuredClone(next); }, armDeadline() {},
    readInbox: () => hooks, transcriptExists: () => false,
  };
  const config = { operatorOwnUse: true as const, confinement: 'unconfined' as const, framework, executable: '/synthetic',
    cwd: '/work', home, configHome: home, context: f.c, io, now: () => now, stopped: () => stopped, resolveIntake: () => TEXT,
    maxSessions: 1, turnDeadlineMs: 60_000, readyTimeoutMs: 1000, protectedSessions: [] };
  let driver = createProductionSessionDriver(config);
  const identity = value(driver.launch({ operation: 'op', claim: 'topic', artifact: 'sha256:test', incarnation: 'inc', workingScope: '/work', handles: [] }));
  const deliver = () => driver.deliver({ operation: 'deliver', processIdentity: identity, intake: 'input', digest: hash(TEXT), incarnation: 'inc' });
  const observe = () => driver.observe({ operation: 'deliver', processIdentity: identity });
  /** The keys sent after the delivery's own Enter (two for Codex): the recovery ladder alone. */
  const recoveryKeys = () => keys.filter(row => row[0] === 'send-keys' && !row.includes('-l')).slice(framework === 'codex-cli' ? 2 : 1).map(row => row.at(-1));
  return { identity, deliver, observe, recoveryKeys, get session() { return journal.sessions[0]!; }, get keys() { return keys; },
    get styledCaptures() { return styledCaptures; },
    at: (value: number) => { now = value; }, pane: (value: string) => { pane = value; }, styled: (value: string | null | (() => string)) => { styled = value; },
    failNextKey: () => { failNextKey = true; }, stop: () => { stopped = true; }, restart: () => { driver = createProductionSessionDriver(config); },
    hook: (at: number) => { hooks = [...hooks, { kind: 'turn-closed', sessionId: '12345678-1234-1234-1234-123456789abc', at, receiptId: `receipt-${hooks.length + 1}` }]; } };
}

it('records the sent text durably before Enter and clears it once the prompt is empty again', () => {
  const f = fixture();
  expect(value(f.deliver())).toBe('tmux-input:deliver');
  expect(f.session.pendingInput).toMatchObject({ marker: MARKER, sentAt: 1000, observations: 0, attempts: 0, pressing: false, undelivered: false });
  f.at(1100); // the prompt is empty: the input was consumed
  expect(value(f.observe())).toMatchObject({ phase: 'launched', detail: 'session live; turn still open' });
  expect(f.session.pendingInput).toBeNull();
  expect(f.recoveryKeys()).toEqual([]);
});

it('re-presses Enter for the exact accepted input left at an idle prompt, then the turn proceeds (1.x verifyInjection)', () => {
  const f = fixture(); value(f.deliver());
  f.pane(PENDING); f.styled(PENDING_REAL);
  f.at(1100);
  expect(value(f.observe())).toMatchObject({ phase: 'launched', detail: 'input still at the prompt; awaiting a second capture' });
  expect(f.recoveryKeys()).toEqual([]);
  f.at(1499); // second capture agrees, but rung 0 is due 500 ms after the send
  expect(value(f.observe()).detail).toBe('input still at the prompt; recovery rung 0 not yet due');
  expect(f.recoveryKeys()).toEqual([]);
  f.at(1500);
  expect(value(f.observe())).toMatchObject({ phase: 'launched', detail: 'pending input recovery rung 0 sent' });
  expect(f.recoveryKeys()).toEqual(['Enter']);
  expect(f.styledCaptures).toBe(1);
  expect(f.session.pendingInput).toMatchObject({ attempts: 1, pressing: false, presentation: 'real', promptText: TEXT });
  // The key worked: the prompt cleared, the turn runs and closes on its own receipt.
  f.pane(EMPTY); f.at(1600);
  expect(value(f.observe())).toMatchObject({ phase: 'launched', detail: 'session live; turn still open' });
  expect(f.session.pendingInput).toBeNull();
  f.hook(1700); f.at(1700);
  expect(value(f.observe()).phase).toBe('output-observed');
  expect(f.recoveryKeys()).toEqual(['Enter']);
});

it('never presses a key at a dim model-suggested ghost of the same text (live finding F2)', () => {
  const f = fixture(); value(f.deliver());
  f.pane(PENDING); f.styled(PENDING_GHOST);
  for (const at of [1100, 1500, 1600, 2000, 4000, 7000, 10_000]) {
    f.at(at);
    const observed = value(f.observe());
    expect(observed.phase).toBe('launched');
    expect(observed.detail).not.toContain('sent');
  }
  expect(f.recoveryKeys()).toEqual([]);
  expect(f.session.pendingInput).toMatchObject({ presentation: 'ghost', attempts: 0, undelivered: false });
  // The gate ran once for this text (this is not a detection miss) and ghost is sticky.
  expect(f.styledCaptures).toBe(1);
  expect(value(f.observe()).detail).toBe('suggested input at the prompt; not submitted');
});

it('fails toward not pressing when the styled capture fails, and recovers once it works', () => {
  const f = fixture(); value(f.deliver());
  f.pane(PENDING); f.styled(null);
  f.at(1100); value(f.observe()); f.at(1500);
  expect(value(f.observe()).detail).toBe('prompt presentation inconclusive; no key sent');
  f.at(1600); value(f.observe());
  expect(f.recoveryKeys()).toEqual([]);
  expect(f.session.pendingInput).toMatchObject({ presentation: 'inconclusive', attempts: 0 });
  expect(f.styledCaptures).toBe(2); // inconclusive is re-assessed, not sticky
  f.styled(PENDING_REAL); f.at(1700);
  expect(value(f.observe()).detail).toBe('pending input recovery rung 0 sent');
  expect(f.recoveryKeys()).toEqual(['Enter']);
});

it('escalates Enter, Enter, C-m, Enter+Enter on the 1.x schedule, then reports the input undelivered and stops', () => {
  const f = fixture(); value(f.deliver());
  f.pane(PENDING); f.styled(PENDING_REAL);
  f.at(1100); value(f.observe());
  for (const [at, detail] of [[1500, 'pending input recovery rung 0 sent'], [2500, 'pending input recovery rung 1 sent'],
    [4500, 'pending input recovery rung 2 sent'], [7500, 'pending input recovery rung 3 sent']] as const) {
    f.at(at); expect(value(f.observe()).detail).toBe(detail);
  }
  expect(f.recoveryKeys()).toEqual(['Enter', 'Enter', 'C-m', 'Enter', 'Enter']);
  f.at(9999); // every rung spent, still pending, before the verify-only instant
  expect(value(f.observe()).detail).toBe('recovery ladder spent; verifying');
  f.at(10_000);
  expect(value(f.observe())).toMatchObject({ phase: 'pause-observed', detail: 'input-undelivered' });
  expect(f.session.pendingInput).toMatchObject({ attempts: 4, undelivered: true });
  f.at(20_000);
  expect(value(f.observe())).toMatchObject({ phase: 'pause-observed', detail: 'input-undelivered' });
  expect(f.recoveryKeys()).toEqual(['Enter', 'Enter', 'C-m', 'Enter', 'Enter']);
  expect(f.session.turnDeadline).toBe(61_000); // the original deadline and delivery are untouched
  expect(f.session.pendingInput?.sentAt).toBe(1000);
});

it('consumes a rung recorded before a cut and never resends it after the driver restarts', () => {
  const f = fixture(); value(f.deliver());
  f.pane(PENDING); f.styled(PENDING_REAL);
  f.at(1100); value(f.observe());
  f.at(1500); f.failNextKey();
  refused(f.observe(), 'simulated cut');
  expect(f.session.pendingInput).toMatchObject({ attempts: 1, pressing: true });
  expect(f.recoveryKeys()).toEqual([]);
  f.restart(); f.at(1600);
  expect(value(f.observe()).detail).toBe('input still at the prompt; recovery rung 1 not yet due');
  expect(f.session.pendingInput).toMatchObject({ attempts: 1, pressing: false });
  f.at(2500);
  expect(value(f.observe()).detail).toBe('pending input recovery rung 1 sent');
  expect(f.recoveryKeys()).toEqual(['Enter']);
});

it('does not press while the pane is actively working: queued input is not stuck input', () => {
  const f = fixture(); value(f.deliver());
  f.pane(PENDING_ACTIVE); f.styled(PENDING_ACTIVE);
  for (const at of [1100, 1500, 2500, 4500]) { f.at(at); expect(value(f.observe()).detail).toBe('session live; turn still open'); }
  expect(f.recoveryKeys()).toEqual([]);
  expect(f.session.pendingInput).toMatchObject({ observations: 0, attempts: 0 });
});

it('uses the marker alone for a Codex composer and never captures its styling', () => {
  const f = fixture('codex-cli'); value(f.deliver());
  f.pane(idle('›', TEXT));
  f.at(1100); value(f.observe()); f.at(1500);
  expect(value(f.observe()).detail).toBe('pending input recovery rung 0 sent');
  expect(f.recoveryKeys()).toEqual(['Enter']);
  expect(f.styledCaptures).toBe(0);
  f.pane(idle('›', 'Explain this codebase')); f.at(1600); // the placeholder hint is not the sent text
  value(f.observe());
  expect(f.session.pendingInput).toBeNull();
});

it('presses nothing once stop authority is active', () => {
  const f = fixture(); value(f.deliver());
  f.pane(PENDING); f.styled(PENDING_REAL);
  f.at(1100); value(f.observe()); f.stop(); f.at(1500);
  expect(value(f.observe()).phase).toBe('exit-observed');
  expect(f.recoveryKeys()).toEqual([]);
});
