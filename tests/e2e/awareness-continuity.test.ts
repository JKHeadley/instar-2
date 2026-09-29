import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { expect, it } from 'vitest';
import { createAwareness, createLabelledFakeRecall, type ConversationMessage, type ObservedSession,
  type OpenCommitment } from '../../src/awareness/index.js';
// @ts-expect-error physical JS host is intentionally outside the pure core
import { createAwarenessIO } from '../../scripts/awareness-io.mjs';

// Resolve the real tmux instead of pinning one platform's install prefix: the hardcoded
// Homebrew path made this case report itself skipped on every non-macOS host, so the
// continuity proof silently did not run there. Rule 37.
const tmux = ['/opt/homebrew/bin/tmux', '/usr/local/bin/tmux', '/usr/bin/tmux', 'tmux']
  .find(candidate => spawnSync(candidate, ['-V'], { encoding: 'utf8' }).status === 0);
const available = tmux !== undefined;
const hook = resolve('scripts/session-hooks/grounding.mjs');
const harness = resolve('tests/e2e/awareness-fake-harness.mjs');
const sleep = (ms: number) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);

// Rule 37 quarantine: see docs/defects/awareness-continuity-respawn-flake.md
it.skip('a compacted or respawned session comes back with identity, recent conversation and open work, and carries on', () => {
  const root = mkdtempSync(join(tmpdir(), 'instar20-awareness-e2e-'));
  const socket = `instar20-aw-${randomUUID().slice(0, 8)}`;
  const t = (args: readonly string[]) => spawnSync(tmux!, ['-L', socket, ...args], { encoding: 'utf8', timeout: 10_000 });
  const io = createAwarenessIO({ stateDirectory: join(root, 'state'), inboxDirectory: join(root, 'inbox') });
  const claim = 'telegram:42';
  const now0 = Date.now();
  const messages: ConversationMessage[] = [
    { at: now0 - 120_000, id: 'test-message-1', from: 'user', speaker: 'Justin', text: 'Port the compaction recovery to 2.0, please.' },
    { at: now0 - 100_000, id: 'test-message-2', from: 'agent', text: 'On it. I will report back once the continuity test passes.' },
    { at: now0 - 20_000, id: 'test-message-3', from: 'user', speaker: 'Justin', text: 'Make sure a respawned session does not ask me to repeat myself.' },
  ];
  const commitments: OpenCommitment[] = [{ id: 'CMT-77', topic: '42', promise: 'report back once the continuity test passes', owner: 'agent', dueAt: null }];
  const live = new Map<string, { contextFile: string }>();
  const observer = {
    observe: (): ObservedSession[] => [...live.keys()].map(session => {
      const alive = t(['has-session', '-t', `=${session}:`]).status === 0;
      const created = alive ? Number(t(['display-message', '-p', '-t', `=${session}:`, '#{session_created}']).stdout.trim()) * 1000 : 0;
      const pane = alive ? t(['capture-pane', '-p', '-t', `=${session}:`]).stdout.trimEnd() : '';
      return { session, topic: '42', alive, startedAt: created, pane: pane.endsWith('❯') ? 'idle' as const : 'busy' as const, stuck: null };
    }),
  };
  const deliveries = new Set<string>();
  const awareness = createAwareness({
    sources: {
      identity: () => ({ name: 'Echo', identity: 'I am Echo, builder of Instar. My operator is Justin.' }),
      topics: () => [{ id: '42', name: 'port awareness', claim }],
      conversation: () => ({ messages }),
      commitments: () => commitments,
      sessions: () => [{ topic: '42', session: [...live.keys()].at(-1) ?? null, running: true, focus: 'porting awareness', updatedAt: now0 },
        { topic: '7', topicName: 'sentinels', session: 's-7', running: true, focus: 'crash watcher', updatedAt: now0 }],
    },
    recall: createLabelledFakeRecall(),
    io, observer,
    actions: {
      deliver: ({ session, text, operation }) => {
        if (deliveries.has(operation)) return; // owner-side dedupe on the operation id
        deliveries.add(operation);
        const buffer = join(root, `${operation.replace(/[^a-z0-9]/gi, '_')}.txt`);
        writeFileSync(buffer, `${text}\n`);
        t(['load-buffer', '-b', 'reground', buffer]);
        t(['paste-buffer', '-d', '-b', 'reground', '-t', `=${session}:`]);
      },
      recoverContext: () => { throw new Error('not expected in this scenario'); },
    },
    now: () => Date.now(), stopped: () => false,
    sentinel: { graceMs: 300, verifyMs: 5_000 },
  });
  const launch = (withHook: boolean) => {
    const session = `instar20-${randomUUID().replace(/-/g, '').slice(0, 24)}`;
    const contextFile = join(root, `${session}.context`);
    live.set(session, { contextFile });
    awareness.tick(); // owner writes this session's current grounding before spawn
    const env = [`INSTAR_SESSION_NAME=${session}`, `INSTAR_SESSION_INBOX=${join(root, 'inbox')}`,
      `INSTAR_SESSION_GROUNDING_FILE=${io.groundingFileFor(claim)}`, `HARNESS_HOOK=${withHook ? hook : ''}`, `HARNESS_CONTEXT_FILE=${contextFile}`];
    expect(t(['new-session', '-d', '-s', session, '-x', '200', '-y', '50', '--', '/usr/bin/env', '-i', 'PATH=/usr/bin:/bin',
      ...env, process.execPath, harness]).status).toBe(0);
    return session;
  };
  const waitFor = (session: string, needle: string) => {
    for (let i = 0; i < 100; i++) {
      if (t(['capture-pane', '-p', '-J', '-t', `=${session}:`, '-S', '-200']).stdout.includes(needle)) return;
      sleep(50);
    }
    throw new Error(`timed out waiting for ${needle}: ${t(['capture-pane', '-p', '-t', `=${session}:`]).stdout}`);
  };
  const context = (session: string) => existsSync(live.get(session)!.contextFile) ? readFileSync(live.get(session)!.contextFile, 'utf8') : '';
  const expectGrounded = (session: string) => {
    const text = context(session);
    expect(text).toContain('I am Echo, builder of Instar. My operator is Justin.');
    expect(text).toContain('Port the compaction recovery to 2.0, please.');
    expect(text).toMatch(/UNANSWERED[\s\S]*does not ask me to repeat myself/);
    expect(text).toContain('report back once the continuity test passes');
    expect(text).toContain('crash watcher');
    const pane = t(['capture-pane', '-p', '-J', '-t', `=${session}:`, '-S', '-200']).stdout;
    expect(pane).toContain('CARRYING ON: Make sure a respawned session does not ask me to repeat myself.');
  };
  const events = () => (io.readSignals() as { event: string; detail: string }[]).map(row => `${row.event}|${row.detail}`);
  try {
    awareness.tick(); // writes the grounding file before any session exists
    expect(readFileSync(io.groundingFileFor(claim), 'utf8')).toContain('=== INSTAR GROUNDING');

    // 1. Fresh session: SessionStart(startup) grounds it.
    const first = launch(true);
    waitFor(first, 'CARRYING ON');
    expectGrounded(first);
    awareness.tick();
    expect(events().some(e => e.startsWith('grounding-verified|respawn'))).toBe(true);

    // 2. Compaction: the model's context is wiped; SessionStart(compact) restores it.
    t(['send-keys', '-t', `=${first}:`, '-l', '--', '/compact']);
    t(['send-keys', '-t', `=${first}:`, 'Enter']);
    waitFor(first, 'COMPACTED');
    expectGrounded(first);
    sleep(20);
    awareness.tick();
    expect(events().some(e => e.startsWith('grounding-verified|compact'))).toBe(true);

    // 3. Respawn: a brand-new process on the same claim comes back grounded.
    t(['kill-session', '-t', `=${first}:`]);
    live.delete(first);
    sleep(1_100); // a new tmux incarnation needs a distinct session_created second
    const second = launch(true);
    waitFor(second, 'CARRYING ON');
    expectGrounded(second);
    awareness.tick();
    expect(events().filter(e => e.startsWith('grounding-verified|respawn'))).toHaveLength(2);

    // 4. Respawn whose hook is broken: nothing was injected, so the sentinel re-grounds it.
    t(['kill-session', '-t', `=${second}:`]);
    live.delete(second);
    sleep(1_100);
    const third = launch(false);
    waitFor(third, 'CARRYING ON: nothing known');
    expect(context(third)).toBe('');
    const regrounds = () => [awareness.tick(), (sleep(400), awareness.tick())].flatMap(r => r.actions).filter(a => a.kind === 'reground');
    expect(regrounds()).toHaveLength(1);
    waitFor(third, 'REGROUNDED');
    expectGrounded(third);
    sleep(20);
    awareness.tick();
    expect(events().some(e => e.startsWith('recovered-after-reground|respawn'))).toBe(true);
    awareness.tick();
    expect(deliveries.size).toBe(1); // exactly one re-ground, no duplicate sends
  } finally {
    t(['kill-server']);
    rmSync(root, { recursive: true, force: true });
  }
}, 30_000);
