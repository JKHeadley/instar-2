// Plan rows #399/#401, the live half: one long work item really does run through
// src/assembly/production-session-driver.ts and come back with its result. A full harness session
// is launched in tmux, the work step is delivered to it, the session does the work with its own
// tools, writes its result to the one declared destination, and the session work port returns it
// with its Rule 114 edge and close in hand.
//
// It runs only where the pieces exist: tmux, the harness CLI named by INSTAR_SESSION_WORK_EXECUTABLE
// (a subscription CLI; no API key is passed), and a login home to copy credentials from. Everywhere
// else it skips, because a session this test cannot launch is not a result it may assert.
import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { createProductionSessionDriver } from '../../src/assembly/production-session-driver.js';
import { createSessionWorkPort } from '../../src/assembly/production-session-work.js';
import type { SessionWorkEdge, SessionWorkEdgeClose } from '../../src/assembly/production-session-work.js';
import { assemblyRuntimeFixture } from '../assembly/runtime-fixture.js';
import { value } from '../facts/fixtures.js';
// @ts-expect-error physical JS host is intentionally outside the pure core
import { createProductionSessionIO } from '../../scripts/production-session-io.mjs';

const tmuxPath = ['/usr/bin/tmux', '/opt/homebrew/bin/tmux', '/usr/local/bin/tmux']
  .find(path => existsSync(path)) ?? null;
/** The harness CLI and the login home its credentials come from, both named by the host. */
const executable = process.env.INSTAR_SESSION_WORK_EXECUTABLE ?? null;
const loginHome = process.env.INSTAR_SESSION_WORK_LOGIN_HOME ?? null;
const framework = process.env.INSTAR_SESSION_WORK_FRAMEWORK ?? 'codex-cli';
const tmuxWorks = tmuxPath !== null
  && (() => { try { execFileSync(tmuxPath, ['-V'], { stdio: 'ignore' }); return true; } catch { return false; } })();
const ready = tmuxWorks && executable !== null && existsSync(executable) && loginHome !== null && existsSync(loginHome);

it.skipIf(!ready)('runs one long work item through the session driver and returns its result', async () => {
  const f = assemblyRuntimeFixture();
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'sw-live-')));
  const scope = join(root, 'scope'), home = join(root, 'home'), configHome = join(root, 'login');
  for (const path of [scope, home, configHome]) mkdirSync(path, { recursive: true, mode: 0o700 });
  // The agent's own subscription login, copied into this run's login home. No API key is set.
  for (const name of ['auth.json', '.credentials.json']) {
    const source = join(loginHome!, name);
    if (existsSync(source)) copyFileSync(source, join(configHome, name));
  }
  // A Rule 59 stall class for this harness: a Codex session's first launch in an unknown directory
  // shows a directory-trust menu, and the driver refuses a startup menu rather than answering one
  // for the operator. The host declares its own scratch scope trusted at setup instead.
  writeFileSync(join(configHome, 'config.toml'),
    `[projects."${scope}"]\ntrust_level = "trusted"\n`, { mode: 0o600 });
  const physical = createProductionSessionIO({ stateDirectory: join(root, 'state'), tmuxPath: tmuxPath!,
    home, configHome, cwd: scope });
  const rows: (SessionWorkEdge | SessionWorkEdgeClose)[] = [];
  const port = value(createSessionWorkPort({
    createDriver: resolveIntake => createProductionSessionDriver({ operatorOwnUse: true, confinement: 'unconfined',
      framework: framework as 'claude-code' | 'codex-cli', executable: executable!, cwd: scope, home, configHome,
      context: f.c, io: physical, now: Date.now, stopped: () => false, resolveIntake,
      maxSessions: 1, turnDeadlineMs: 600_000, readyTimeoutMs: 60_000, protectedSessions: [] }),
    io: { readResult: path => { try { return readFileSync(path, 'utf8'); } catch { return null; } },
      clearResult: path => { try { rmSync(path, { force: true }); } catch { /* nothing to clear */ } },
      wait: ms => new Promise(done => setTimeout(done, ms)) },
    context: f.c, now: Date.now, stopped: () => false, append: record => rows.push(record),
    parent: 'launch:session-work-live', owner: 'test-machine', placement: 'machine:test-machine',
    transport: 'tmux session on this machine', workingScope: scope, resultDirectory: scope,
    artifact: 'doorway:live', incarnation: 'live-1',
    deadlineMs: 600_000, pollMs: 2_000, maxResultBytes: 65536, maxSteps: 1 }));
  try {
    const outcome = await port.run({ operation: 'obligation-live-1', claim: 'session-work-live',
      question: 'Return exactly {"outcome":"report","report":"session work reached the result file"} '
        + 'as the JSON object this step asks for. Do no other work.',
      context: '{"obligation":{"kind":"request","quote":"prove the session work path end to end"}}',
      authority: 'one scheduled work step for the verified operator: the operator\'s own tools, no outbound send, result returned by file' });
    expect(outcome.state).toBe('complete');
    expect(JSON.parse(outcome.text!)).toMatchObject({ outcome: 'report' });
    // The Rule 114 edge and its close are both in hand, in that order.
    expect(rows.map(row => row.type)).toEqual(['SessionWorkEdge', 'SessionWorkEdgeClose']);
    const edge = rows[0] as SessionWorkEdge;
    expect(edge.resultDestination.startsWith(`${scope}/`)).toBe(true);
    expect(edge.budget).toMatchObject({ steps: 1, tokens: null });
    expect(rows[1]).toMatchObject({ state: 'complete', edge: edge.id });
    expect((rows[1] as SessionWorkEdgeClose).resultBytes).toBeGreaterThan(0);
    // The child really was a live session of the named harness, identified exactly.
    expect(outcome.child).toMatch(/^instar20-[a-f0-9]{24}:\d+:\d+$/);
  } finally {
    try { value(port.stop()); } catch { /* reported by the sweep below */ }
    for (const row of physical.load().sessions) physical.tmux(['kill-session', '-t', `=${row.name}:`]);
    rmSync(root, { recursive: true, force: true });
  }
}, 900_000);
