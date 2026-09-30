import { execFileSync, spawn, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { RECALL_CASES, runRealModelRecallSample } from './real-model-recall-sample.js';

// Child-process cost, measured on this runner (load about 43), because every budget below is sized from it and
// not guessed. A preview child starts with `--loader ./scripts/slice-ts-loader.mjs`, which re-transpiles the whole
// TypeScript graph it imports on EVERY start with no cache (scripts/slice-ts-loader.mjs, 19 lines):
//   bare node -e 0                                 0.11 s
//   loader hooks active, nothing TypeScript loaded  1.3-1.6 s
//   the journal-agent graph, one process at a time  12.5-14.8 s
//   the same child inside this 5-worker suite       about 50 s (measured: a provider child's first heartbeat
//                                                   arrived after 48 288 ms, and a 60 s child budget still fired)
// So roughly 90% of a cold child is uncached transpilation, and that — not this case's subject — is what host load
// scales. The real repair is a transpile cache in that shared loader, which unit U6 does not own; see
// docs/defects/full-suite-load-timeouts.md. Until then these budgets are watchdogs sized to the measured cost with
// headroom, never bounds on the behaviour asserted here, and the observed child cost is printed on every run.
it('skips the command without both the live flag and preview login profile', () => {
  const command = ['--no-warnings', '--loader', './scripts/slice-ts-loader.mjs',
    'tests/preview/real-model-recall-sample.mjs'];
  for (const flags of [[], ['--live'], ['--login-profile', '/missing/profile.json']]) {
    const output = execFileSync(process.execPath, [...command, ...flags], { encoding: 'utf8' });
    expect(output).toContain('SKIP real model recall sample');
  }
  const refused = spawnSync(process.execPath, [...command, '--live', '--login-profile', '/missing/profile.json',
    '--activation-record', '/missing/activation.json', '--output', '/tmp/new-recall-report.json'], { encoding: 'utf8' });
  expect(refused.status).not.toBe(0);
  expect(refused.stdout).not.toContain('SKIP');
}, 600000); // Four cold `--loader` children at about 50 s each in this suite (see the measurement above the file's
// SIGTERM case): the 10 s default was below the cost of starting one. The refusal assertions are unchanged.

it('scores 20 one-shot answers from a replayed 120-turn fixture and records packet evidence for misses', async () => {
  const packets: string[] = [];
  const report = await runRealModelRecallSample('claude-sonnet-5', async prepared => {
    const envelope = JSON.parse(prepared) as { messages: { role: string; content: string }[] };
    const context = envelope.messages.find(item => item.role === 'context')?.content;
    expect(context).toBeTruthy();
    const packet = JSON.parse(context!) as { packet: { historyMode: string; summary: { through: number } } };
    expect(packet.packet.historyMode).toBe('summary-plus-recent');
    expect(packet.packet.summary.through).toBe(120);
    packets.push(context!);
    const item = RECALL_CASES[packets.length - 1]!;
    if (item.id === 'stable-14') return { state: 'rejected' } as const;
    if (item.id === 'corrected-01') return { state: 'complete', text: 'ORIGINAL-01' } as const;
    if (item.id === 'forgotten-09') return { state: 'uncertain' } as const;
    return { state: 'complete', text: item.expected ?? 'UNKNOWN' } as const;
  });
  expect(report.fixture).toMatchObject({ turns: 120, facts: 30, corrections: 8, forgets: 5 });
  expect(report.calls).toBe(20);
  expect(report.total).toBe(20);
  expect(report.correct).toBe(17);
  expect(report.accuracy).toBe(0.85);
  expect(report.misses.map(item => item.id)).toEqual(['stable-14', 'corrected-01', 'forgotten-09']);
  expect(report.misses[0]?.state).toBe('rejected');
  expect(report.misses[1]?.packet).toMatchObject({ mode: 'summary-plus-recent', summaryThrough: 120,
    expectedVisible: true, staleVisible: true });
  expect(report.misses[2]?.packet).toMatchObject({ expectedVisible: false, staleVisible: false });
  expect(report.misses.every(item => item.packet.sha256.length === 64 && item.packet.bytes > 0)).toBe(true);
  expect(report.misses.every(item => createHash('sha256').update(item.packet.raw).digest('hex') === item.packet.sha256)).toBe(true);
  expect(report.cases.every(item => createHash('sha256').update(item.packet).digest('hex') === item.packetSha256)).toBe(true);
  expect(packets).toHaveLength(20);
}, 120_000);

it('credits only the asserted label or explicit unknown, including structured journal replies', async () => {
  let index = 0;
  const report = await runRealModelRecallSample('claude-sonnet-5', async () => {
    const item = RECALL_CASES[index++]!;
    if (item.id === 'stable-14') return { state: 'complete', text: 'INVENTED-99. It is not ORIGINAL-14.' } as const;
    if (item.id === 'corrected-01') return { state: 'complete', text: 'INVENTED-99. It is not REVISED-01.' } as const;
    if (item.id === 'forgotten-09') return { state: 'complete', text: 'I do not know; the label is INVENTED-99.' } as const;
    if (item.id === 'stable-15') return { state: 'complete', text: JSON.stringify({ reply: 'ORIGINAL-15', memory: [] }) } as const;
    if (item.id === 'stable-16') return { state: 'complete', text: '{"reply":"ORIGINAL-16","memory":[]' } as const;
    if (item.id === 'stable-17') return { state: 'complete', text: JSON.stringify({ reply: 'INVENTED-99. It is not ORIGINAL-17.', memory: [] }) } as const;
    return { state: 'complete', text: item.expected ?? 'UNKNOWN' } as const;
  });
  expect(report.correct).toBe(15);
  expect(report.misses.map(item => item.id)).toEqual(['stable-14', 'stable-16', 'stable-17', 'corrected-01', 'forgotten-09']);
  expect(report.cases.find(item => item.id === 'stable-15')).toMatchObject({ correct: true, answer: 'ORIGINAL-15',
    rawOutput: '{"reply":"ORIGINAL-15","memory":[]}' });
  expect(report.misses[0]?.rawOutput).toContain('not ORIGINAL-14');
}, 120_000);

it('reaps a physical provider child on SIGTERM and starts no next question', async () => {
  const root = mkdtempSync(join(tmpdir(), 'recall-stop-test-'));
  const heartbeat = join(root, 'heartbeat'), invocations = join(root, 'invocations');
  const script = `import { appendFileSync } from 'node:fs';
import { productionProviderIO } from './scripts/production-boot-io.mjs';
import { installRecallStopSignals, runRealModelRecallSample } from './tests/preview/real-model-recall-sample.ts';
const [heartbeat, invocations] = process.argv.slice(1);
const stop = installRecallStopSignals();
try {
  await runRealModelRecallSample('claude-sonnet-5', async () => {
    appendFileSync(invocations, 'x');
    await productionProviderIO.execute({ executable: process.execPath,
      args: ['-e', "const fs=require('node:fs');setInterval(()=>fs.appendFileSync(process.argv[1],'.'),20)", heartbeat],
      cwd: process.cwd(), env: process.env, stdin: '', timeout: 30000, maxBytes: 1024, stopped: stop.stopped });
    return { state: 'uncertain' };
  }, 'grant:stop-test', stop.stopped);
  process.exitCode = 2;
} catch (error) {
  if (!String(error).includes('stopped')) process.exitCode = 3;
} finally { stop.close(); }`;
  const child = spawn(process.execPath, ['--no-warnings', '--loader', './scripts/slice-ts-loader.mjs',
    '--input-type=module', '-e', script, heartbeat, invocations], { cwd: process.cwd(), stdio: ['ignore', 'ignore', 'pipe'] });
  const exited = new Promise<number | null>(resolve => child.once('exit', code => resolve(code)));
  let stderr = '';
  child.stderr.on('data', chunk => { stderr += String(chunk); });
  try {
    // Rule 37 repair (docs/defects/real-model-recall-sigterm-timing-flake.md): this wait is child START-UP, not
    // the behaviour under test, and the old fixed 15 s constant made host load decide the case. Measured in this
    // suite at load about 42, the provider child's first heartbeat arrived after 48 288 ms (12.4 s in isolation),
    // so the wait now ends as soon as the child is alive, carries a budget with about 5x headroom over that
    // measurement, prints what it observed, and stops early if the child dies. Every assertion about the reaping
    // itself — the 5 s exit race, the frozen heartbeat, the single invocation — keeps its original bound, so a slow
    // start delays this case instead of failing it.
    const started = Date.now();
    while (!existsSync(heartbeat) && child.exitCode === null && Date.now() - started < 240000)
      await new Promise(resolve => setTimeout(resolve, 25));
    const startup = Date.now() - started;
    process.stdout.write(`real-model recall SIGTERM: provider child heartbeat after ${startup} ms\n`);
    expect(existsSync(heartbeat), `${stderr}[no provider heartbeat after ${startup} ms]`).toBe(true);
    child.kill('SIGTERM');
    let timeout: ReturnType<typeof setTimeout> | undefined;
    const exit = await Promise.race([exited,
      new Promise<never>((_, reject) => { timeout = setTimeout(() => reject(Error('sample did not stop')), 5000); })]);
    if (timeout) clearTimeout(timeout);
    expect(exit, stderr).toBe(0);
    const before = readFileSync(heartbeat, 'utf8');
    await new Promise(resolve => setTimeout(resolve, 150));
    expect(readFileSync(heartbeat, 'utf8')).toBe(before);
    expect(readFileSync(invocations, 'utf8')).toBe('x');
  } finally { if (child.exitCode === null) child.kill('SIGKILL'); rmSync(root, { recursive: true, force: true }); }
}, 600000); // The 240 s start-up budget above, plus the retained 5 s exit race and 150 ms quiescence check.
