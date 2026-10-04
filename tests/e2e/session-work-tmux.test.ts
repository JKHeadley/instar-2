// Rules 60, 61, 114 on a real tmux server, with no model: a synthetic harness stands in for the
// CLI (it shows a prompt, takes the delivered task, starts a long-lived helper process of its own,
// and writes its result where the task says). Two successive scheduled items run through the real
// session driver, the session work port and the host resource owner; after each step the session
// AND the helper it started are physically gone, and a stopped step ends its child the same way.
import { execFileSync } from 'node:child_process';
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, expect, it } from 'vitest';
import { createProductionSessionDriver } from '../../src/assembly/production-session-driver.js';
import { createSessionWorkPort } from '../../src/assembly/production-session-work.js';
import type { SessionWorkEdge, SessionWorkEdgeClose } from '../../src/assembly/production-session-work.js';
import { assemblyRuntimeFixture } from '../assembly/runtime-fixture.js';
import { value } from '../facts/fixtures.js';
// @ts-expect-error physical JS host is intentionally outside the pure core
import { createProductionSessionIO } from '../../scripts/production-session-io.mjs';
// @ts-expect-error the admission hook and its state stay plain JavaScript: the harness runs them without a loader
import { prepareSessionAdmission, sessionAdmissionCommand } from '../preview/session-admission.mjs';
// @ts-expect-error the host admission checkpoint stays plain JavaScript
import { createAdmissionGate, createToolEffectOwner } from '../preview/admission-gate.mjs';
// @ts-expect-error the hook's decision stays plain JavaScript
import { admitToolCallEffect } from '../preview/tool-admission.mjs';
// @ts-expect-error physical JS host is intentionally outside the pure core
import { createResourceOwner } from '../../scripts/resource-owner.mjs';

const tmuxPath = ['/opt/homebrew/bin/tmux', '/usr/bin/tmux', '/usr/local/bin/tmux'].find(path => existsSync(path)) ?? null;
const tmuxWorks = tmuxPath !== null
  && (() => { try { execFileSync(tmuxPath, ['-V'], { stdio: 'ignore' }); return true; } catch { return false; } })();
const roots: string[] = [];
const helpers: number[] = [];
const gates: { stop(): Promise<void> }[] = [];
afterEach(async () => {
  for (const gate of gates.splice(0)) await gate.stop();
  for (const pid of helpers.splice(0)) try { process.kill(pid, 'SIGKILL'); } catch { /* already gone */ }
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});
const alive = (pid: number) => { try { process.kill(pid, 0); return true; } catch { return false; } };

async function world(writes: boolean) {
  const f = assemblyRuntimeFixture();
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'swt-'))); roots.push(root);
  const scope = join(root, 'scope'), home = join(root, 'home'), login = join(root, 'login');
  for (const path of [scope, home, login]) mkdirSync(path, { recursive: true, mode: 0o700 });
  const harness = join(root, 'harness.mjs'), pids = join(root, 'helpers.txt');
  // The synthetic harness: a prompt glyph, line input, one long-lived helper, and the result file.
  writeFileSync(harness, `#!${process.execPath}
import { appendFileSync, writeFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
const helper = spawn('/bin/sleep', ['300'], { stdio: 'ignore' });
appendFileSync(${JSON.stringify(pids)}, helper.pid + '\\n');
process.stdout.write('ready\\n❯ ');
let text = '';
process.stdin.on('data', chunk => {
  text += chunk.toString();
  const path = /(\\/[^\\s]+\\/work-[0-9a-f]{32}\\.json)/.exec(text)?.[1];
  if (path && ${writes}) { writeFileSync(path, '{"outcome":"report","report":"done"}'); process.stdout.write('\\ndone\\n❯ '); text = ''; }
});
`);
  chmodSync(harness, 0o700);
  const physical = createProductionSessionIO({ stateDirectory: join(root, 'state'), tmuxPath: tmuxPath!, home, configHome: login, cwd: scope });
  const admission = join(root, 'admission');
  const owner = createResourceOwner();
  const rows: (SessionWorkEdge | SessionWorkEdgeClose)[] = [];
  let stopped = false;
  const append = (record: SessionWorkEdge | SessionWorkEdgeClose) => { rows.push(record); };
  const gate = await createAdmissionGate({ append, stopped: () => stopped, now: Date.now,
    effects: createToolEffectOwner({ decide: (tool: string, input: unknown) => admitToolCallEffect(tool, input, { operations: [] }, Date.now()),
      append, stopped: () => stopped, now: Date.now, prepared: () => false }) });
  gates.push(gate);
  const port = value(createSessionWorkPort({
    createDriver: resolveIntake => createProductionSessionDriver({ operatorOwnUse: true, confinement: 'admitted',
      toolAdmission: { command: sessionAdmissionCommand({ base: admission }), timeoutSeconds: 600 },
      modelGate: (claim: string) => gate.base(claim),
      framework: 'claude-code', executable: harness, cwd: scope, home, configHome: login, context: f.c, io: physical,
      now: Date.now, stopped: () => stopped, resolveIntake, maxSessions: 1, turnDeadlineMs: 60_000,
      readyTimeoutMs: 15_000, protectedSessions: [] }),
    io: { readResult: (path, maxBytes) => physical.readResult(path, maxBytes), clearResult: path => physical.clearResult(path),
      modelCalls: since => physical.modelCalls('claude-code', scope, login, since),
      wait: ms => new Promise(done => setTimeout(done, ms)),
      prepareAdmission: (claim: string, edge: SessionWorkEdge) => { prepareSessionAdmission({ base: admission, claim, workspace: scope,
        maxCalls: 8, gate: gate.base(claim) }); gate.open(claim, { framework: 'claude-code', allowance: 8, edge }); },
      admissionState: (claim: string) => gate.state(claim), closeAdmission: (claim: string) => { gate.close(claim); } },
    resources: { admit: async () => {
      const held = await owner.hold('maintenance', { timeout: 5_000, stopped: () => stopped });
      return held === null ? null : { attach: (child: string) => held.attach({ pid: Number(child.split(':')[1]), cwd: scope }),
        release: async () => (await held.release()).verified };
    } },
    context: f.c, now: Date.now, stopped: () => stopped, append: record => rows.push(record),
    parent: 'launch:tmux-case', owner: 'this-machine', placement: 'machine:this-machine', transport: 'tmux',
    workingScope: scope, resultDirectory: scope, artifact: 'doorway:synthetic', incarnation: 'tmux-1',
    deadlineMs: 30_000, pollMs: 200, maxResultBytes: 4096, maxSteps: 4, maxCalls: 8 }));
  const helperPids = () => { try { return readFileSync(pids, 'utf8').trim().split('\n').filter(Boolean).map(Number); } catch { return []; } };
  const request = (operation: string) => ({ operation, question: 'Do the due work.', context: '{}', authority: 'a test grant' });
  return { port, rows, physical, request, helperPids, stop: () => { stopped = true; } };
}
const sessionGone = (w: Awaited<ReturnType<typeof world>>, child: string | null) =>
  child !== null && w.physical.tmux(['has-session', '-t', `=${child.split(':')[0]}:`]).code !== 0;

it.skipIf(!tmuxWorks)('two successive scheduled items each run as a fresh session that is physically gone afterwards', async () => {
  const w = await world(true);
  for (const operation of ['obligation-a-1', 'obligation-b-1']) {
    const outcome = await w.port.run(w.request(operation));
    expect(outcome, JSON.stringify(outcome)).toMatchObject({ state: 'complete' });
    expect(sessionGone(w, outcome.child)).toBe(true);
  }
  helpers.push(...w.helperPids());
  expect(w.helperPids()).toHaveLength(2);
  // The helper each session started is reclaimed with it, not left running.
  for (const pid of w.helperPids()) expect(alive(pid), `helper ${pid}`).toBe(false);
  expect(w.rows.filter(row => row.type === 'SessionWorkEdgeClose').map(row => (row as SessionWorkEdgeClose).state))
    .toEqual(['complete', 'complete']);
}, 120_000);

it.skipIf(!tmuxWorks)('a stop ends the open step, and its session and helper are physically gone', async () => {
  const w = await world(false);
  setTimeout(() => w.stop(), 3_000);
  const outcome = await w.port.run(w.request('obligation-c-1'));
  expect(outcome.state).toBe('uncertain');
  expect(sessionGone(w, outcome.child)).toBe(true);
  helpers.push(...w.helperPids());
  for (const pid of w.helperPids()) expect(alive(pid), `helper ${pid}`).toBe(false);
}, 120_000);
