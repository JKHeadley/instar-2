// Rules 60, 75 (the live half of tests/preview/admission-gate.test.ts): the real Claude Code and Codex CLIs, on the
// operator's subscriptions, reach their model only through the host's model-dispatch checkpoint. With an allowance of one
// call, a one-call answer is forwarded and answered; a turn that needs a second call (a shell command, then the answer)
// has that second call refused at the checkpoint, never dispatched.
//
// It runs only when asked (INSTAR_MODEL_GATE_LIVE=1) with both CLIs signed in: every run spends subscription calls.
import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { homedir } from 'node:os';
import { expect, it } from 'vitest';
import { modelGateLaunch } from '../../src/assembly/production-session-driver.js';
// @ts-expect-error the host checkpoint stays plain JavaScript
import { createAdmissionGate, createToolEffectOwner } from '../preview/admission-gate.mjs';

const ready = process.env.INSTAR_MODEL_GATE_LIVE === '1' && existsSync('/usr/local/bin/claude') && existsSync('/usr/local/bin/codex');
const run = (command: string, args: readonly string[], env: Record<string, string>, cwd: string) =>
  new Promise<{ stdout: string; status: number | null }>(resolve => {
    // The operator's own sign-ins: the login lookup needs the user and, where set, the Claude configuration home.
    const login = Object.fromEntries(['USER', 'CLAUDE_CONFIG_DIR', 'CODEX_HOME'].flatMap(name => process.env[name] ? [[name, process.env[name]!]] : []));
    const child = spawn(command, args, { cwd, env: { PATH: '/usr/bin:/bin:/usr/local/bin:/opt/homebrew/bin', HOME: homedir(), ...login, ...env },
      stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = ''; child.stdout.on('data', chunk => { stdout += chunk; }); child.stderr.on('data', chunk => { stdout += chunk; });
    const timer = setTimeout(() => child.kill('SIGTERM'), 150_000);
    child.on('exit', status => { clearTimeout(timer); resolve({ stdout, status }); });
  });

it.skipIf(!ready)('both harnesses: one allowed call is forwarded and answered, a call past the allowance is refused before dispatch', async () => {
  const gate = await createAdmissionGate({ append: () => undefined, stopped: () => false, now: Date.now,
    effects: createToolEffectOwner({ operations: [], append: () => undefined, stopped: () => false, now: Date.now, prepared: () => false }) });
  const cwd = realpathSync(mkdtempSync('/private/tmp/mgl-'));
  const edge = { id: 'model-gate-live', child: 'model-gate-live' };
  try {
    const harnesses = {
      'claude-code': (claim: string, prompt: string) => run('/usr/local/bin/claude', ['-p', prompt, '--dangerously-skip-permissions',
        '--model', 'claude-haiku-4-5-20251001'], Object.fromEntries(modelGateLaunch('claude-code', gate.base(claim)).env.map(line =>
        [line.slice(0, line.indexOf('=')), line.slice(line.indexOf('=') + 1)])), cwd),
      'codex-cli': (claim: string, prompt: string) => run('/usr/local/bin/codex', ['exec', '--json', '--skip-git-repo-check', '--ephemeral',
        '--dangerously-bypass-approvals-and-sandbox', ...modelGateLaunch('codex-cli', gate.base(claim)).args, prompt], {}, cwd),
    } as const;
    for (const [framework, launch] of Object.entries(harnesses)) {
      gate.open(`${framework}-one`, { framework, allowance: 1, edge });
      const one = await launch(`${framework}-one`, 'Reply with the single word: pong');
      expect(one.stdout, framework).toMatch(/pong/iu);
      expect(gate.state(`${framework}-one`), framework).toMatchObject({ calls: 1, refused: false });
      gate.open(`${framework}-two`, { framework, allowance: 1, edge });
      await launch(`${framework}-two`, 'Use your shell to run: echo gate-check. Then reply with its output.');
      expect(gate.state(`${framework}-two`), framework).toMatchObject({ calls: 1, refused: true });
    }
  } finally { await gate.stop(); rmSync(cwd, { recursive: true, force: true }); }
}, 600_000);
