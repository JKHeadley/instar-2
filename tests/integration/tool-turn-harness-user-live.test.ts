// Desk unit harness-user (plan row #464), live: the preview's Claude Code harness as its own macOS user. Gated:
// INSTAR_TOOL_TURN_HARNESS_USER_LIVE_TEST=1 runs it; INSTAR_TOOL_TURN_CASE=<name> selects one case. It needs the root
// step (lanes/harness-user/root-steps.sh: the `_instarharness` user and its one sudoers rule) and the unprivileged
// setup (`node tests/preview/harness-user.mjs setup ...`, which writes /Users/Shared/instar-harness/profile.json), and
// for the turn case a login in that profile. Every root is a throwaway under /private/tmp; nothing is sent to any chat.
//
// `race` is the swap race of docs/defects/2026-10-03-file-tool-swap-race.md, scheduled deterministically: the real
// admission hook allows a workspace path, the path is then swapped for a link to a canary in the operator's home, and
// the open happens. Opened as the operator's account it reads the canary (the race is real); opened as the harness
// user it is refused by the kernel. `turn` drives one real tool turn through the real launcher, hook, resource owner
// and shipped route on a throwaway root: the harness runs as the harness user with its full tool set, and leaves no
// process of that user behind.
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, symlinkSync, unlinkSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { afterAll, expect, it } from 'vitest';
import { canonical, decode } from '../../src/index.js';
import { createClaudeCodeSubscriptionRoute, subscriptionToolsPolicy, SUBSCRIPTION_PREVIEW_EXPIRY,
  SUBSCRIPTION_TOOLS_FRAMING } from '../../src/assembly/production-provider.js';
import type { SubscriptionActivationRecord, SubscriptionToolTurn } from '../../src/assembly/production-provider.js';
import type { ProviderSubscriptionProfile } from '../../src/assembly/provider-credential-custodian.js';
import { factsFixture, value } from '../facts/fixtures.js';
import { openPreviewJournal } from '../preview/journal.js';
import { prepareJournalEnvelope } from '../preview/journal-envelope.js';
import { SINGLE_MACHINE_PROFILE } from '../preview/activation-authority.js';
import { redact } from '../../src/recall/redact.js';
// @ts-expect-error Physical host JavaScript stays outside pure core.
import { createSubscriptionProviderIO } from '../../scripts/production-boot-io.mjs';
// @ts-expect-error Physical host JavaScript stays outside pure core.
import { hostResources } from '../../scripts/resource-owner.mjs';
// @ts-expect-error The runner side stays plain JavaScript.
import { runToolTurn, attachScratch, detachScratch } from '../preview/tool-turn.mjs';
// @ts-expect-error The runner side stays plain JavaScript.
import { grantVolume, harnessReadiness, HARNESS_LAUNCHER, HARNESS_USER, installHook, probeAccess, runnerUser } from '../preview/harness-user.mjs';

const LIVE = process.env.INSTAR_TOOL_TURN_HARNESS_USER_LIVE_TEST === '1';
const ONLY = process.env.INSTAR_TOOL_TURN_CASE;
const run = (name: string) => LIVE && (ONLY === undefined || ONLY === name);
const PROFILE = '/Users/Shared/instar-harness/profile.json';
const RECORD = join(__dirname, '../preview/fixtures/tool-turn/harness-user-2026-10-03');
const MODEL = 'claude-sonnet-5';
const scratch = LIVE ? realpathSync(mkdtempSync('/private/tmp/tool-harness-user-')) : '';
// A canary in the operator's home (never a real secret), removed afterwards.
const CANARY_DIR = LIVE ? realpathSync(mkdtempSync(join(homedir(), '.harness-user-canary-'))) : '';
const CANARY_TEXT = 'HARNESS-USER-SYNTHETIC-CANARY';
afterAll(() => { if (scratch) rmSync(scratch, { recursive: true, force: true }); if (CANARY_DIR) rmSync(CANARY_DIR, { recursive: true, force: true }); });
const hash = (v: unknown) => (canonical(v) as { kind: 'Success'; value: { hash: string } }).value.hash;
const harnessUid = () => Number(execFileSync('/usr/bin/id', ['-u', HARNESS_USER], { encoding: 'utf8' }).trim());
// ps exits 1 when the user has no process: that is the empty list.
const harnessProcesses = () => { const r = spawnSync('/bin/ps', ['-U', String(harnessUid()), '-o', 'pid='], { encoding: 'utf8' });
  expect([0, 1]).toContain(r.status); return r.stdout.trim(); };

it.runIf(run('race'))('the swap race: admitted by the real hook, swapped, then opened: the operator account reads the canary, the harness user is refused', { timeout: 120000 }, () => {
  const canary = join(CANARY_DIR, 'credentials.json');
  writeFileSync(canary, CANARY_TEXT, { mode: 0o600 });
  const dir = join(scratch, 'race'); mkdirSync(dir, { mode: 0o700 });
  const runner = runnerUser();
  const mounted = attachScratch(dir);
  try {
    grantVolume(mounted, HARNESS_USER, runner);
    const ws = join(mounted, 'ws'), state = join(dir, 'state');
    mkdirSync(ws, { mode: 0o700 }); mkdirSync(state, { mode: 0o700 });
    writeFileSync(join(state, 'config.json'), JSON.stringify({ workspace: ws, tmp: join(mounted, 'tmp'), maxCalls: 8, maxWriteBytes: 1024, operations: [] }));
    const hook = (tool: string, input: object) => {
      const result = spawnSync(process.execPath, [installHook(), 'pre', state], { input: JSON.stringify({ tool_name: tool, tool_input: input, tool_use_id: 'harness-user-race' }), encoding: 'utf8' });
      expect(result.status).toBe(0);
      return result.stdout ? JSON.parse(result.stdout).hookSpecificOutput : { permissionDecision: 'allow' };
    };
    for (const mode of ['r', 'w'] as const) {
      const safe = join(ws, `safe-${mode}.txt`);
      writeFileSync(safe, 'ordinary');
      const admitted = hook(mode === 'r' ? 'Read' : 'Write', mode === 'r' ? { file_path: safe } : { file_path: safe, content: 'x' });
      expect(admitted.permissionDecision).toBe('allow');
      const target = admitted.updatedInput?.file_path ?? safe;
      // The permitted workspace mutation, scheduled between the hook's allow and the open.
      unlinkSync(safe); symlinkSync(canary, safe);
      // As the operator's account the open follows the link to the canary: the race is real.
      if (mode === 'r') expect(readFileSync(target, 'utf8')).toBe(CANARY_TEXT);
      // As the harness user the kernel refuses the same open.
      const rows = probeAccess([`${mode}:${target}`]);
      expect(rows).not.toBeNull();
      expect(rows![0]).toMatchObject({ ok: false, code: 'EACCES' });
      // An ordinary workspace file stays readable and writable as the harness user.
      const plain = join(ws, `plain-${mode}.txt`); writeFileSync(plain, 'ordinary');
      expect(probeAccess([`r:${plain}`, `w:${plain}`])!.every((row: { ok: boolean }) => row.ok)).toBe(true);
    }
    expect(readFileSync(canary, 'utf8')).toBe(CANARY_TEXT);
  } finally { detachScratch(dir); }
});

let attached: { uid: number } | null = null;
async function liveTurn(name: string, question: string, stopWhen?: (rows: Record<string, unknown>[]) => boolean) {
  const profile: ProviderSubscriptionProfile = Object.freeze(JSON.parse(readFileSync(PROFILE, 'utf8')));
  const root = join(scratch, name); mkdirSync(root, { mode: 0o700 });
  const readiness = harnessReadiness({ profile, denied: [realpathSync(root), homedir(), process.cwd()] });
  expect(readiness).toMatchObject({ ready: true, user: HARNESS_USER });
  const harness = { ...readiness, runner: runnerUser(), launcher: HARNESS_LAUNCHER };
  if (!attached) { await hostResources.attach({ harnessUid: harness.uid }); attached = { uid: harness.uid }; }
  const f = factsFixture();
  let stop = false;
  const io = createSubscriptionProviderIO({ repository: process.cwd(), stopped: () => stop, runAs: { user: harness.user, launcher: harness.launcher } });
  const now = Date.now();
  const policy = subscriptionToolsPolicy(MODEL);
  const activation: SubscriptionActivationRecord = { type: 'SubscriptionActivationRecord', schemaVersion: 1,
    reference: profile.activationReference, waiver: 'harness-user integration test', p11: 'scratch', reviewedHead: 'w4-harnessuser',
    trial: 'scratch', baseConfigurationDigest: hash('scratch'), profileDigest: hash(profile), executable: profile.executable,
    artifact: profile.artifact, version: profile.version, model: MODEL, invocationPolicyDigest: hash(policy),
    expectedAccount: profile.expectedAccount, observedAccount: profile.expectedAccount, authSource: 'claude.ai',
    operatorAssertion: 'scratch test', assertedAt: now - 2000, observer: 'harness-user', observedAt: now - 1000, method: 'scratch',
    safeCaptureReference: 'scratch', extraUsage: 'operator-asserted/unobservable', extraUsageReason: 'scratch integration test',
    subscriptionLimit: 'unobservable', subscriptionLimitReason: 'scratch integration test', acceptedResiduals: ['scratch test'],
    expiresAt: SUBSCRIPTION_PREVIEW_EXPIRY };
  const ctx = { ...f.ctx.decode, register: { ...f.ctx.decode.register, entries: [...f.ctx.decode.register.entries, 'preview'] } };
  const journal = openPreviewJournal(join(root, 'journal.encrypted'), new Uint8Array(32).fill(3), { kind: 'genesis', bot: '12345678',
    chat: '7654321', operator: '7654321', grant: 'grant:scratch', configurationDigest: 'sha256:scratch', expires: SUBSCRIPTION_PREVIEW_EXPIRY,
    maxCalls: 40, maxReplies: 10, maxTurns: 10, maxBytes: 32768, cursor: 0 });
  const id = 'telegram:12345678:update:1';
  const prepared = prepareJournalEnvelope({ question, context: JSON.stringify({ now: new Date(now).toISOString(), audience: 'operator', sources: [], history: [] }), id },
    MODEL, 'grant:scratch', now, 32768);
  const appended: unknown[] = [];
  const recorder = { get view() { return journal.view; }, append: (row: never) => { appended.push(row); return journal.append(row); } };
  let stateDirectory = '', stoppedAt: number | null = null;
  const rowsOf = (state: string) => { try { return readFileSync(join(state, 'admission.jsonl'), 'utf8').trim().split('\n').filter(Boolean)
    .map(line => JSON.parse(line) as Record<string, unknown>); } catch { return []; } };
  const outcome = await runToolTurn({ journal: recorder, root, id, prepared, promptLimit: 32768, deniedRoots: [root, profile.home, profile.configDirectory,
    profile.workingDirectory], operations: SINGLE_MACHINE_PROFILE.operations, now: () => Date.now(), redactText: (t: string) => redact(t).text,
    authority: `${activation.reference} ${activation.invocationPolicyDigest}`, mcp: null, stopped: () => stop, harness,
    fallback: async () => ({ result: 'fallback' }),
    invoke: async (turn: SubscriptionToolTurn) => {
      stateDirectory = turn.stateDirectory;
      const route = value(createClaudeCodeSubscriptionRoute({ provider: 'anthropic', model: MODEL, route: 'preview-subscription',
        disclosure: 'scratch integration test', credential: value(decode('SecretRef', { type: 'SecretRef', schemaVersion: 1,
          vault: 'preview', name: profile.reference }, ctx)), context: { ...ctx, site: f.c.site, preserved: f.c.preserved },
        profile, resolveProfile: () => profile, activation, io, now: () => Date.now(), active: () => !stop,
        framing: SUBSCRIPTION_TOOLS_FRAMING, toolTurn: turn, adapterEvidenceContract: { reference: activation.reference,
          version: activation.profileDigest, parserReference: 'claude-code-json-result', parserVersion: '1',
          endpoint: profile.loginProfileIdentity, account: profile.expectedAccount, credentialReference: profile.reference,
          controller: 'harness-user-live', sourceEvidence: ['scratch'], terminalEvidence: 'scratch', terminalReasonField: 'subtype',
          successfulFinalReplyReasons: ['success'], strength: 'observation', maxMetadataBytes: policy.maxMetadataBytes,
          maxRawTerminalBytes: policy.maxRawTerminalBytes, maxCaptureBytes: policy.maxCaptureBytes } }));
      const watcher = stopWhen ? setInterval(() => { if (!stop && stopWhen(rowsOf(turn.stateDirectory))) { stop = true; stoppedAt = performance.now(); } }, 20) : undefined;
      try {
        return await route.invoke(prepared, { operation: id, deadline: Date.now() + policy.timeout + 30000, timeout: policy.timeout,
          maxOutputBytes: policy.maxOutputBytes, maxTokens: policy.maxTokens, maxCharge: 0, automaticRetries: 0 });
      } finally { clearInterval(watcher); }
    } }).catch((error: Error) => ({ error: error.message }));
  const settled = performance.now();
  const rows = rowsOf(stateDirectory);
  const trace = appended.find(row => (row as { phase?: string }).phase === 'trace') as { harness?: unknown } | undefined;
  const record = { name, question, error: 'error' in outcome ? outcome.error : null, uid: harness.uid, stateDirectory, rows, trace,
    stopToSettledMs: stoppedAt === null ? null : Math.round(settled - stoppedAt), toolTurns: journal.view.toolTurns,
    lastLaunch: hostResources.snapshot().lastLaunch, harnessProcessesAfter: harnessProcesses() };
  mkdirSync(RECORD, { recursive: true });
  writeFileSync(join(RECORD, `${name}.json`), `${JSON.stringify(record, null, 2)}\n`);
  return record;
}

it.runIf(run('turn'))('one tool turn on a throwaway root runs as the harness user with its full tool set and leaves nothing running', { timeout: 400000 }, async () => {
  const record = await liveTurn('turn', 'Do these five steps in order, each with the tool named, then answer with what each returned. 1) Write: create '
    + 'note.txt containing exactly: hello harness. 2) Bash: run id -u; wc -c note.txt 3) Read: read note.txt. 4) WebFetch: fetch https://example.com '
    + 'and note the page title. 5) Bash: run curl -sS -m 30 https://example.com | grep -o "<title>.*</title>"; echo "curl-exit: $?"');
  const { rows, trace, stateDirectory } = record;
  const harness = { uid: record.uid };
  expect(record.error).toBeNull();
  const decided = rows.filter(row => row.phase === 'pre').map(row => [row.tool, row.decision]);
  for (const step of [['Write', 'allow'], ['Bash', 'allow'], ['Read', 'allow'], ['WebFetch', 'allow']]) expect(decided).toContainEqual(step);
  const bash = rows.filter(row => row.phase === 'post' && row.tool === 'Bash').map(row => String(row.result)).join('\n');
  // The shell, the file tools and the hook ran as the harness user (the hook wrote this record as it).
  expect(bash).toMatch(new RegExp(`\\b${String(harness.uid)}\\b`, 'u'));
  expect(bash).toMatch(/\b13 note\.txt\b/u);
  // The shell's network still goes through the turn's checkpoint (a loopback port the runner's account serves).
  expect(bash).toMatch(/<title>Example Domain<\/title>/u);
  expect(bash).toMatch(/curl-exit: 0/u);
  expect(trace?.harness).toEqual({ user: HARNESS_USER });
  expect(record.toolTurns).toMatchObject({ invocations: 1, open: [], inconsistent: 0 });
  // The turn's harness-side state is the harness area's, and the launcher left no process of that user running.
  expect(stateDirectory.startsWith('/Users/Shared/instar-harness/turns/')).toBe(true);
  expect(record.harnessProcessesAfter).toBe('');
  expect(record.lastLaunch).toMatchObject({ cleanup: 'verified' });
});

it.runIf(run('stop'))('the stop ends a harness-user turn within the bound: the runner kills sudo, the launcher ends the harness tree', { timeout: 400000 }, async () => {
  const record = await liveTurn('stop', 'Use Bash to run: sleep 60; echo done. Then answer with what it printed.',
    rows => rows.some(row => row.phase === 'pre' && row.tool === 'Bash'));
  expect(record.stopToSettledMs).not.toBeNull();
  expect(record.stopToSettledMs!).toBeLessThan(3000);
  expect(record.toolTurns).toMatchObject({ invocations: 1, open: [] });
  expect(record.harnessProcessesAfter).toBe('');
});
