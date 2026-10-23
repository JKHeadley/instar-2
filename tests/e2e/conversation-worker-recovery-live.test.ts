// Opt-in real Studio proof. Each run owns a fresh workspace/profile; no bot or serving root is used.
import { execFileSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { expect, it } from 'vitest';
import { createConversationSessionPort } from '../../src/assembly/production-conversation-session.js';
import type { ConversationState } from '../../src/assembly/production-conversation-session.js';
import { createSessionConversationAdapter } from '../../src/assembly/conversation-harness-adapter.js';
import { createProductionSessionDriver } from '../../src/assembly/production-session-driver.js';
import { assemblyRuntimeFixture } from '../assembly/runtime-fixture.js';
import { value } from '../facts/fixtures.js';
// @ts-expect-error physical host module
import { createProductionSessionIO } from '../../scripts/production-session-io.mjs';
// @ts-expect-error physical host module
import { createAdmissionGate, createToolEffectOwner } from '../preview/admission-gate.mjs';
// @ts-expect-error physical host module
import { prepareSessionAdmission, sessionAdmissionCommand } from '../preview/session-admission.mjs';
// @ts-expect-error physical host module
import { admitToolCallEffect } from '../preview/tool-admission.mjs';
// @ts-expect-error physical host module
import { grantAcl, harnessAcl, grantVolume, harnessHookPath, HARNESS_SESSION_BRIDGE } from '../preview/harness-user.mjs';
// @ts-expect-error physical host module
import { hostResources } from '../../scripts/resource-owner.mjs';

const enabled = process.env.INSTAR_WORKER_RECOVERY_LIVE === '1';
it.skipIf(!enabled)('a real lost worker returns one result; a mid-tool loss retains its exact uncertainty', async () => {
  const evidence = process.env.INSTAR_WORKER_RECOVERY_EVIDENCE!;
  expect(evidence?.startsWith('/')).toBe(true);
  mkdirSync(evidence, { recursive: true, mode: 0o700 });
  const profilePath = '/Users/Shared/instar-harness/profile-justin-gmail.json';
  const profile = JSON.parse(readFileSync(profilePath, 'utf8'));
  // The desk reserves every other account for live/other-agent use. This proof cannot select one.
  expect(profile.expectedAccount).toBe('headley.justin@gmail.com');
  const root = mkdtempSync('/Users/Shared/instar-harness/turns/worker-recovery-');
  const scope = join(root, 'scope'), home = join(root, 'home'), configHome = join(root, 'config');
  const stateDirectory = join(root, 'state'), inbox = join(root, 'inbox'), admission = join(root, 'admission');
  grantAcl([root], [harnessAcl.search('_instarharness')]);
  for (const path of [scope, home, configHome, inbox]) {
    mkdirSync(path, { mode: 0o700 }); grantVolume(path, '_instarharness', 'dabombstudio');
  }
  mkdirSync(admission, { mode: 0o700 }); grantAcl([admission], [harnessAcl.search('_instarharness')]);
  const proofProfile = join(root, 'profile.json');
  writeFileSync(proofProfile, JSON.stringify({ ...profile, home, configDirectory: configHome, workingDirectory: scope }), { mode: 0o600 });
  const hook = join(root, 'stop.mjs'); copyFileSync(resolve('scripts/session-hooks/stop.mjs'), hook);
  grantAcl([hook], [harnessAcl.readOnly('_instarharness')]);
  const physical = createProductionSessionIO({ stateDirectory, home, configHome, cwd: scope, lifecycleDirectory: inbox });
  const f = assemblyRuntimeFixture();
  let state: ConversationState | null = null, stopped = false, cut = false;
  let mode: 'before-tool' | 'during-tool' = 'before-tool', priorTools = 0;
  const records: unknown[] = [], kills: object[] = [];
  const append = (record: unknown) => { records.push(record); writeFileSync(join(evidence, 'edges.json'), JSON.stringify(records, null, 2)); };
  const gate = await createAdmissionGate({ append, stopped: () => stopped, now: Date.now,
    held: () => 'clear',
    effects: createToolEffectOwner({ decide: (tool: string, input: unknown) => admitToolCallEffect(tool, input, { operations: [] }, Date.now()),
      append, prepared: () => false, stopped: () => stopped, now: Date.now }) });
  const deadline = Date.now() + 900_000;
  const io = {
    readResult: physical.readResult, clearResult: physical.clearResult,
    modelCalls: () => state?.spent ?? 0,
    prepareAdmission: (claim: string, edge: { budget: { calls: number } }) => {
      prepareSessionAdmission({ base: admission, claim, workspace: scope, maxCalls: edge.budget.calls,
        gate: gate.base(claim), harness: { user: '_instarharness', runner: 'dabombstudio' } });
      gate.open(claim, { framework: 'claude-code', allowance: edge.budget.calls, edge,
        reserveCall: (ordinal: number) => port.reserveCall(claim, ordinal) });
    },
    admissionState: (claim: string) => gate.state(claim), closeAdmission: (claim: string) => gate.close(claim),
    wait: async (ms: number) => {
      const worker = state?.worker, admitted = worker && gate.state(worker.claim);
      let sleeping: number | null = null;
      if (!cut && worker && mode === 'during-tool' && admitted.toolPreparations > priorTools) {
        const rows = execFileSync('/bin/ps', ['-axo', 'pid=,ppid=,comm='], { encoding: 'utf8' }).trim().split('\n')
          .map(line => { const [pid, parent, ...command] = line.trim().split(/\s+/); return { pid: Number(pid), parent: Number(parent), command: command.join(' ') }; });
        const descendants = new Set([Number(worker.launch.split(':')[1])]);
        for (let round = 0; round < rows.length; round++) {
          const size = descendants.size;
          for (const row of rows) if (descendants.has(row.parent)) descendants.add(row.pid);
          if (size === descendants.size) break;
        }
        sleeping = rows.find(row => descendants.has(row.pid) && /(?:^|\/)sleep$/.test(row.command))?.pid ?? null;
      }
      if (!cut && worker && admitted && (mode === 'before-tool' ? admitted.calls > 0 && admitted.toolPreparations === 0 : sleeping !== null)) {
        // Exact pane PID recorded by this driver's own launch, never a process-name match.
        const pid = Number(worker.launch.split(':')[1]);
        const observed = physical.tmux(['display-message', '-p', '-t', `=${worker.launch.split(':')[0]}:`, '#{pane_pid}']);
        expect(Number(observed.stdout.trim())).toBe(pid);
        kills.push({ pid, mode, at: Date.now(), launch: worker.launch, calls: admitted.calls, tools: admitted.toolPreparations, sleeping });
        writeFileSync(join(evidence, 'kills.json'), JSON.stringify(kills, null, 2));
        process.kill(pid, 'SIGHUP'); cut = true;
      }
      await new Promise(done => setTimeout(done, ms));
    },
  };
  const port = value(createConversationSessionPort({
    conversation: `worker-recovery-${process.pid}`, context: f.c, now: Date.now, stopped: () => stopped,
    authorized: () => true, currentAuthority: () => 'isolated worker recovery proof', contextRecoveryAllowed: () => true,
    allowanceDeadline: deadline,
    store: { load: () => state, save: next => { state = next; writeFileSync(join(evidence, 'conversation.json'), JSON.stringify(next, null, 2)); } },
    createAdapter: resolveDelivery => createSessionConversationAdapter({ io, resolveDelivery,
      createDriver: resolveIntake => createProductionSessionDriver({ operatorOwnUse: true, confinement: 'admitted',
        framework: 'claude-code', executable: profile.executable, model: 'claude-opus-5-5', cwd: scope, home, configHome,
        context: f.c, io: physical, now: Date.now, stopped: () => stopped, resolveIntake,
        toolAdmission: { command: sessionAdmissionCommand({ base: admission, script: harnessHookPath() }), timeoutSeconds: 600 },
        modelGate: (claim: string) => gate.base(claim), requireTurnHook: true, inboxDirectory: inbox, hookScript: hook,
        continuation: ({ operation, pendingDigest }) => ({ text: resolveIntake(operation, pendingDigest!), source: `proof:${operation}` }),
        launchVia: [process.execPath, HARNESS_SESSION_BRIDGE, '_instarharness', proofProfile, '--'],
        maxSessions: 1, turnDeadlineMs: 600_000, readyTimeoutMs: 60_000, protectedSessions: [] }) }),
    io, resources: { admit: async () => {
      const held = await hostResources.hold('maintenance', { timeout: 30_000, stopped: () => stopped });
      return held === null ? null : { attach: (child: string) => held.attach({ pid: Number(child.split(':')[1]), cwd: scope }),
        release: async () => (await held.release()).verified };
    } }, append,
    parent: 'proof:worker-recovery', owner: 'studio-proof', placement: 'local', transport: 'tmux',
    workingScope: scope, resultDirectory: scope, artifact: profile.artifact, incarnation: `proof-${process.pid}`,
    deadlineMs: 600_000, pollMs: 200, maxCalls: 24, maxSteps: 4, maxResultBytes: 65536,
  }));
  writeFileSync(join(evidence, 'meta.json'), JSON.stringify({ root, profile: profile.reference, account: profile.expectedAccount,
    commit: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), at: Date.now() }, null, 2));
  try {
    const request = { operation: 'proof-lost-before-tools', authority: 'isolated worker recovery proof', context: '{}',
      question: 'Use Bash to run sleep 120 in the foreground, then calculate 6*7. Return {"answer":"42"} in the requested result file. Do not start background work or send messages.' };
    const result = await port.run(request);
    writeFileSync(join(evidence, 'result.json'), JSON.stringify(result, null, 2));
    expect(cut).toBe(true); expect(result.state, JSON.stringify(result)).toBe('complete');
    if (result.state !== 'complete') throw Error('real recovery did not complete');
    expect(JSON.parse(result.text!)).toMatchObject({ answer: '42' });
    expect((state as ConversationState | null)?.inputs[0]?.workerRecovery).toBe('continued');
    expect(await port.run(request)).toEqual(result);
    expect(physical.load().deliveries).toHaveLength(1);
    mode = 'during-tool'; cut = false;
    priorTools = gate.state((state as ConversationState | null)!.claim!).toolPreparations;
    const uncertain = await port.run({ ...request, operation: 'proof-lost-during-tool',
      question: 'Use Bash to run sleep 120 in the foreground, then return {"answer":"slept"} in the requested result file. Do not start background work or send messages.' });
    writeFileSync(join(evidence, 'uncertain.json'), JSON.stringify(uncertain, null, 2));
    expect(cut).toBe(true); expect(uncertain).toMatchObject({ state: 'uncertain' });
    expect(uncertain.detail).toMatch(/prepared tools|unknown tool/);
    expect(physical.load().sessions).toHaveLength(2);
  } finally {
    stopped = true; await port.close(); await gate.stop();
    writeFileSync(join(evidence, 'physical.json'), JSON.stringify(physical.load(), null, 2));
  }
}, 1_000_000);
