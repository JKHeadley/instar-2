import { spawnSync } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { chmodSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { assemblyRuntimeFixture } from '../assembly/runtime-fixture.js';
import { value } from '../facts/fixtures.js';
import { createProductionSessionDriver } from '../../src/assembly/production-session-driver.js';
// @ts-expect-error physical JS host is intentionally outside the pure core
import { createProductionSessionIO } from '../../scripts/production-session-io.mjs';

const tmux = '/opt/homebrew/bin/tmux';
const available = spawnSync(tmux, ['-V'], { encoding: 'utf8' }).status === 0;
it.skipIf(!available)('launches, delivers, observes, and stops a real trivial tmux process', () => {
  const root = mkdtempSync(join(tmpdir(), 'instar20-alive-'));
  const socket = `instar20-alive-${randomUUID().slice(0, 8)}`;
  const script = join(root, 'prompt.sh');
  writeFileSync(script, '#!/bin/sh\nif [ -n "${INSTAR_SESSION_TEST_CANARY+x}" ]; then printf "canary:present\\n"; else printf "canary:absent\\n"; fi\nprintf "❯ "\nwhile IFS= read -r line; do printf "\\nseen:%s\\n❯ " "$line"; done\n');
  chmodSync(script, 0o700);
  const physical = createProductionSessionIO({ stateDirectory: root, tmuxPath: tmux,
    home: root, configHome: root, cwd: root });
  const io = { ...physical, tmux: (args: readonly string[]) => physical.tmux(['-L', socket, ...args]) };
  const f = assemblyRuntimeFixture();
  const text = 'hello';
  process.env.INSTAR_SESSION_TEST_CANARY = 'harmless-parent-only';
  const driver = createProductionSessionDriver({ operatorOwnUse: true, confinement: 'unconfined', framework: 'claude-code',
    executable: script, cwd: root, home: root, configHome: root, context: f.c, io,
    now: Date.now, stopped: () => false, resolveIntake: () => text,
    maxSessions: 1, turnDeadlineMs: 3000, readyTimeoutMs: 3000, protectedSessions: [] });
  try {
    const identity = value(driver.launch({ operation: 'test-launch', claim: 'test-topic', artifact: 'sha256:test',
      incarnation: 'test-incarnation', workingScope: root, handles: [] }));
    expect(identity).toMatch(/^instar20-[a-f0-9]{24}:\d+:\d+$/);
    expect(io.tmux(['capture-pane', '-p', '-t', `=${identity.split(':')[0]}:`, '-S', '-30']).stdout).toContain('canary:absent');
    expect(value(driver.deliver({ operation: 'test-delivery', processIdentity: identity, intake: 'test-input',
      digest: `sha256:${createHash('sha256').update(text).digest('hex')}`, incarnation: 'test-incarnation' }))).toBe('tmux-input:test-delivery');
    let seen = false;
    for (let attempt = 0; attempt < 15 && !seen; attempt++) {
      seen = io.tmux(['capture-pane', '-p', '-t', `=${identity.split(':')[0]}:`, '-S', '-30']).stdout.includes('seen:hello');
      if (!seen) io.sleep(50);
    }
    expect(seen).toBe(true);
    expect(value(driver.observe({ operation: 'test-observe', processIdentity: identity })).phase).toBe('output-observed');
    expect(value(driver.stop())).toHaveLength(1);
    expect(io.tmux(['has-session', '-t', `=${identity.split(':')[0]}:`]).code).not.toBe(0);
  } finally {
    delete process.env.INSTAR_SESSION_TEST_CANARY;
    const sessions = io.load().sessions;
    for (const row of sessions) io.tmux(['kill-session', '-t', `=${row.name}:`]);
    io.tmux(['kill-server']);
    rmSync(root, { recursive: true, force: true });
  }
});
