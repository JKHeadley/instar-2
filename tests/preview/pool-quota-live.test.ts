// @ts-nocheck -- opt-in copy proof: two allocated test profiles, real quota and
// real admitted Claude sessions. No bot, chat or serving installation is opened.
import { expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { appendFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createHarnessLoginPool } from './harness-login-pool.mjs';
import { createClaudePoolQuota } from '../../scripts/claude-pool-quota.mjs';
import { createTopicLoginHandoff } from '../../scripts/topic-login-pool.mjs';
import { createProductionSessionIO } from '../../scripts/production-session-io.mjs';
import { createConversationHostStore } from '../../scripts/conversation-host-store.mjs';
import { createConversationSessionPort } from '../../src/assembly/production-conversation-session.js';
import { createProductionSessionDriver, createProductionConversationAdapter } from '../../src/assembly/production-session-driver.js';
import { createAdmissionGate, createToolEffectOwner } from './admission-gate.mjs';
import { prepareSessionAdmission, sessionAdmissionCommand } from './session-admission.mjs';
import { readHarnessLogin, grantVolume, HARNESS_USER, HARNESS_TMP, HARNESS_SESSION_BRIDGE, harnessHookPath } from './harness-user.mjs';
import { lifecycleHookPath } from '../../scripts/conversation-lifecycle-io.mjs';
import { hostResources } from '../../scripts/resource-owner.mjs';
import { assemblyRuntimeFixture } from '../assembly/runtime-fixture.js';
import { value } from '../facts/fixtures.js';

const proof = process.env.INSTAR_POOL_COPY_PROOF;
it.skipIf(!proof)('two real test logins: live windows, injected pre-wall pressure, same model and native conversation', async () => {
  const input = JSON.parse(readFileSync(proof, 'utf8'));
  // Fixed operator exclusions plus a positive two-test-account allowlist. No caller
  // flag can turn this fixture into a serving-login or arbitrary-account probe.
  const allowed = ['headley.justin@gmail.com', 'justin@sagemindai.io'];
  const entries = input.logins.map((row, index) => ({ ...row, index, profile: JSON.parse(readFileSync(row.profile, 'utf8')) }));
  expect(entries).toHaveLength(2);
  expect(entries.map(e => e.profile.expectedAccount).sort()).toEqual([...allowed].sort());
  expect(input.model).toBe('claude-opus-5-5');
  expect(input.root.startsWith('/Users/dabombstudio/.instar/agents/echo/.instar/lanes/pool-port-1021/')).toBe(true);
  const root = input.root; mkdirSync(root, { recursive: true, mode: 0o700 });
  expect(existsSync(join(root, 'started.json'))).toBe(false);
  writeFileSync(join(root, 'started.json'), JSON.stringify({ at: Date.now(), pid: process.pid, model: input.model }), { mode: 0o600 });
  const area = realpathSync(mkdtempSync(join(HARNESS_TMP, 'pool-proof-')));
  const project = join(area, 'work'), lifecycle = join(area, 'lifecycle'), admission = join(area, 'admission');
  for (const path of [project, lifecycle, admission]) mkdirSync(path, { mode: 0o700 });
  grantVolume(area, HARNESS_USER, 'dabombstudio');
  const hook = lifecycleHookPath(harnessHookPath()); expect(existsSync(hook)).toBe(true);
  const deadline = Date.now() + 300_000;
  let stopped = false, pressure = false, port;
  const isStopped = () => stopped || Date.now() >= deadline;
  const tokens = entries.flatMap(entry => [readHarnessLogin(entry.profile), readHarnessLogin(entry.profile, entry.quotaLogin)]);
  const held = text => tokens.some(token => text.includes(token)) ? 'matched' : 'clear';
  const append = row => appendFileSync(join(root, 'edges.jsonl'), JSON.stringify(row) + '\n', { mode: 0o600 });
  const quota = createClaudePoolQuota({ entries, now: Date.now, stopped: isStopped,
    validate: entry => { expect(allowed).toContain(entry.profile.expectedAccount); },
    credential: entry => readHarnessLogin(entry.profile, entry.quotaLogin) });
  await quota.refresh();
  const live = quota.read();
  writeFileSync(join(root, 'live-quota.json'), JSON.stringify(live, null, 2) + '\n', { mode: 0o600 });
  expect(live.accounts.every(a => a.lastQuota?.fiveHour?.utilizationPct < 65 && a.lastQuota?.sevenDay?.utilizationPct < 65)).toBe(true);
  // No quota-burning test: perturb only the source's measured weekly value on a
  // copy. Destination readings and model/credential/session paths remain real.
  const reader = { refresh: quota.refresh, read: () => {
    const doc = structuredClone(quota.read());
    if (pressure) doc.accounts[0].lastQuota.sevenDay.utilizationPct = 80;
    return doc;
  } };
  const pool = createHarnessLoginPool({ configuration: { entries, threshold: 95, identity: 'pool-live-copy', current: () => true },
    statePath: join(root, 'pool.json'), now: Date.now, quotaReader: reader,
    validate: entry => { readHarnessLogin(entry.profile); } });
  const physical = entry => createProductionSessionIO({ stateDirectory: join(root, 'physical'),
    home: entry.profile.home, configHome: entry.profile.configDirectory, cwd: project, lifecycleDirectory: lifecycle });
  const key = new Uint8Array(32).fill(19);
  const handoff = createTopicLoginHandoff({ topic: 'copy', pool, entries,
    store: createConversationHostStore(join(root, 'login.json'), key), physical, project, framework: 'claude-code',
    admit: async entry => { readHarnessLogin(entry.profile); } });
  const gate = await createAdmissionGate({ append, stopped: isStopped, now: Date.now, held,
    effects: createToolEffectOwner({ decide: () => ({ decision: 'deny', reason: 'copy proof is text only' }),
      append, stopped: isStopped, now: Date.now, prepared: () => false }) });
  const io = {
    readResult: (...args) => physical(handoff.current()).readResult(...args),
    clearResult: path => physical(handoff.current()).clearResult(path),
    modelCalls: since => physical(handoff.current()).modelCalls('claude-code', project, handoff.current().profile.configDirectory, since),
    wait: ms => new Promise(resolve => setTimeout(resolve, ms)),
    prepareAdmission: (claim, edge) => {
      prepareSessionAdmission({ base: admission, claim, workspace: project, maxCalls: edge.budget.calls, gate: gate.base(claim),
        harness: { user: HARNESS_USER, runner: 'dabombstudio' } });
      gate.open(claim, { framework: 'claude-code', allowance: edge.budget.calls, edge, reserveCall: ordinal => port.reserveCall(claim, ordinal) });
    }, admissionState: claim => gate.state(claim), closeAdmission: claim => gate.close(claim),
  };
  const context = assemblyRuntimeFixture().c;
  const configuration = resolveIntake => {
    const entry = handoff.current(), disk = physical(entry);
    return { operatorOwnUse: true, confinement: 'admitted', framework: 'claude-code',
      executable: entry.profile.executable, cwd: project, home: entry.profile.home, configHome: entry.profile.configDirectory,
      model: input.model, context, io: disk, now: Date.now, stopped: isStopped, resolveIntake,
      toolAdmission: { command: sessionAdmissionCommand({ base: admission, script: harnessHookPath() }), timeoutSeconds: 120 },
      modelGate: claim => gate.base(claim), maxSessions: 1, turnDeadlineMs: 120000, readyTimeoutMs: 30000, protectedSessions: [],
      requireTurnHook: true, inboxDirectory: lifecycle, hookScript: hook,
      launchVia: [process.execPath, HARNESS_SESSION_BRIDGE, HARNESS_USER, realpathSync(entry.profilePath), '--'] };
  };
  const createDriver = resolveIntake => {
    let driver = createProductionSessionDriver(configuration(resolveIntake));
    return { owner: 'part-ten', launch: request => {
      handoff.bindClaim(request.claim); driver = createProductionSessionDriver(configuration(resolveIntake));
      const result = driver.launch(request); if (result.kind === 'Success') handoff.launched(); return result;
    }, continuationReady: identity => driver.continuationReady(identity), deliver: request => driver.deliver(request),
      observe: request => driver.observe(request), observeIdle: identity => driver.observeIdle(identity), stop: request => driver.stop(request) };
  };
  port = value(createConversationSessionPort({ context, conversation: 'pool-copy', io,
    createAdapter: resolveDelivery => createProductionConversationAdapter({ createDriver, io, resolveDelivery,
      configuration: () => configuration(() => null), transport: () => { throw Error('wrong harness'); } }),
    store: createConversationHostStore(join(root, 'conversation.json'), key), prepareTurn: handoff.prepareTurn,
    now: Date.now, stopped: isStopped, authorized: () => true, currentAuthority: () => 'operator-requested two-test-login copy proof',
    allowanceDeadline: deadline, deadlineMs: 120000, pollMs: 250, maxSteps: 4, maxCalls: 8, maxResultBytes: 65536,
    parent: 'pool-copy', owner: 'copy-machine', placement: 'local-copy', transport: 'tmux', workingScope: project,
    resultDirectory: project, artifact: entries[0].profile.artifact, incarnation: randomUUID(), append,
    resources: { admit: async () => {
      const lease = await hostResources.hold('maintenance', { timeout: 30000, stopped: isStopped });
      return lease && { attach: child => lease.attach({ pid: Number(child.split(':')[1]), cwd: project }), release: async () => (await lease.release()).verified };
    } } }));
  const request = (operation, question) => ({ operation, question, context: '{}', authority: 'operator-requested two-test-login copy proof' });
  try {
    const marker = `amber-${randomUUID().slice(0, 8)}`;
    const first = await port.run(request('copy-first', `Remember this private test word for our next turn: ${marker}. Reply with that word only. No tools.`));
    writeFileSync(join(root, 'first.json'), JSON.stringify(first, null, 2) + '\n');
    expect(first.state).toBe('complete'); expect(first.text).toContain(marker);
    const nativeBefore = physical(entries[0]).load().resumes[handoff.state.claim];
    expect(nativeBefore).toMatch(/^[0-9a-f-]{36}$/);
    pressure = true;
    const second = await port.run(request('copy-second', 'What private test word did I ask you to remember in the preceding turn? Reply with that word only. No tools.'));
    writeFileSync(join(root, 'second.json'), JSON.stringify(second, null, 2) + '\n');
    expect(second.state).toBe('complete'); expect(second.text).toContain(marker);
    expect(handoff.current().index).toBe(1);
    expect(pool.state.handoffs).toHaveLength(1); expect(pool.state.handoffs[0].continuity).toBe('transcript');
    expect(physical(entries[1]).load().resumes[handoff.state.claim]).toBe(nativeBefore);
    writeFileSync(join(root, 'result.json'), JSON.stringify({ conversationVerified: true, model: input.model, nativeBefore,
      accounts: entries.map(e => e.profile.expectedAccount), handoff: pool.state.handoffs[0], area }, null, 2) + '\n');
  } finally { try { await port.close(); } finally { stopped = true; await gate.stop(); } }
  expect(physical(handoff.current()).load().sessions.every(session => session.closedAt !== null)).toBe(true);
  const resultPath = join(root, 'result.json');
  const result = JSON.parse(readFileSync(resultPath, 'utf8'));
  writeFileSync(resultPath, JSON.stringify({ ...result, passed: true, closed: true }, null, 2) + '\n');
}, 360000);
