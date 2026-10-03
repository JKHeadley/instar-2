// Part Thirteen §9 (docs/17-harness-adapters), the persistent workspace and kept session (plan row #400, MF5), live: real
// tool turns through the pinned harness (claude-cli 2.1.280), the real admission hook, the real fixed-size volume and the
// shipped tools route, on a scratch root, with the preview's own login profile (its projects directory receives the kept
// session's transcript, which the runner removes). Gated: INSTAR_TOOL_TURN_PERSIST_LIVE_TEST=1 runs it, and
// INSTAR_TOOL_TURN_CASE=<name> selects one case per run. Each case's outputs are stored verbatim under
// fixtures/tool-turn/persist-2026-10-03 (Rule 36). Nothing is sent to any chat.
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, expect, it } from 'vitest';
import { canonical, decode } from '../../src/index.js';
import { createClaudeCodeSubscriptionRoute, subscriptionToolsPolicy, SUBSCRIPTION_PREVIEW_EXPIRY,
  SUBSCRIPTION_TOOLS_FRAMING } from '../../src/assembly/production-provider.js';
import type { SubscriptionActivationRecord, SubscriptionToolTurn } from '../../src/assembly/production-provider.js';
import type { ProviderSubscriptionProfile } from '../../src/assembly/provider-credential-custodian.js';
import { factsFixture, value } from '../facts/fixtures.js';
import { createJournalWorker, openPreviewJournal } from '../preview/journal-test-worker.js';
import { prepareJournalEnvelope } from '../preview/journal-envelope.js';
import { decisionWithinFloor } from '../preview/model-call-boundary.js';
import { parseModelJson, conclusionText } from '../preview/model-json.js';
import { SINGLE_MACHINE_PROFILE } from '../preview/activation-authority.js';
import { redact } from '../../src/recall/redact.js';
// @ts-expect-error Physical host JavaScript stays outside pure core.
import { createSubscriptionProviderIO } from '../../scripts/production-boot-io.mjs';
// @ts-expect-error The runner side stays plain JavaScript.
import { conversationWorkspace, detachScratch, readSession, removeSessionFiles, runToolTurn, sessionTranscript } from '../preview/tool-turn.mjs';

const LIVE = process.env.INSTAR_TOOL_TURN_PERSIST_LIVE_TEST === '1';
const ONLY = process.env.INSTAR_TOOL_TURN_CASE;
const run = (name: string) => LIVE && (ONLY === undefined || ONLY === name);
const PROFILE = '/Users/Shared/instar-preview-s2/profile-v2.json';
const MODEL = 'claude-sonnet-5';
const RECORD = join(__dirname, '../preview/fixtures/tool-turn/persist-2026-10-03');
const scratch = LIVE ? realpathSync(mkdtempSync('/private/tmp/tool-persist-live-')) : '';
const hash = (v: unknown) => (canonical(v) as { kind: 'Success'; value: { hash: string } }).value.hash;
type Row = Record<string, unknown> & { phase: string };
const rowsOf = (state: string): Row[] => { try { return readFileSync(join(state, 'admission.jsonl'), 'utf8').trim().split('\n')
  .filter(Boolean).map(line => JSON.parse(line) as Row); } catch { return []; } };
const genesis = { kind: 'genesis' as const, bot: '12345678', chat: '7654321', operator: '7654321', grant: 'grant:scratch',
  configurationDigest: 'sha256:scratch', expires: SUBSCRIPTION_PREVIEW_EXPIRY, maxCalls: 200, maxReplies: 20, maxTurns: 20, maxBytes: 32768, cursor: 0 };
const conversation = `telegram/bot-${genesis.bot}/chat-${genesis.chat}`;

/** One live world: a scratch root, the real route per turn, the kept session in the profile's projects directory. */
function world(name: string) {
  const f = factsFixture(), root = join(scratch, name); mkdirSync(root, { mode: 0o700 });
  const profile: ProviderSubscriptionProfile = Object.freeze(JSON.parse(readFileSync(PROFILE, 'utf8')));
  const store = join(profile.configDirectory, 'projects');
  const stop = { value: false, at: null as number | null };
  const io = createSubscriptionProviderIO({ repository: process.cwd(), stopped: () => stop.value });
  const policy = subscriptionToolsPolicy(MODEL);
  const now = Date.now();
  // A scratch activation bound to the tools policy digest, for this test's own route only (no live file changes).
  const activation: SubscriptionActivationRecord = { type: 'SubscriptionActivationRecord', schemaVersion: 1,
    reference: profile.activationReference, waiver: 'w4-persist integration test', p11: 'scratch', reviewedHead: 'w4-persist',
    trial: 'scratch', baseConfigurationDigest: hash('scratch'), profileDigest: hash(profile), executable: profile.executable,
    artifact: profile.artifact, version: profile.version, model: MODEL, invocationPolicyDigest: hash(policy),
    expectedAccount: profile.expectedAccount, observedAccount: profile.expectedAccount, authSource: 'claude.ai',
    operatorAssertion: 'scratch test', assertedAt: now - 2000, observer: 'w4-persist', observedAt: now - 1000, method: 'scratch',
    safeCaptureReference: 'scratch', extraUsage: 'operator-asserted/unobservable', extraUsageReason: 'scratch integration test',
    subscriptionLimit: 'unobservable', subscriptionLimitReason: 'scratch integration test', acceptedResiduals: ['scratch test'],
    expiresAt: SUBSCRIPTION_PREVIEW_EXPIRY };
  const ctx = { ...f.ctx.decode, register: { ...f.ctx.decode.register, entries: [...f.ctx.decode.register.entries, 'preview'] } };
  const journal = openPreviewJournal(join(root, 'journal.encrypted'), new Uint8Array(32).fill(3), genesis);
  const appended: Record<string, unknown>[] = [];
  const recorder = { get view() { return journal.view; }, append: (row: never) => { appended.push(row); return journal.append(row); } };
  const states: string[] = [];
  const invokeRoute = async (turn: SubscriptionToolTurn, prepared: string, id: string, stopWhen?: (rows: Row[]) => boolean) => {
    states.push(turn.stateDirectory);
    const route = value(createClaudeCodeSubscriptionRoute({ provider: 'anthropic', model: MODEL, route: 'preview-subscription',
      disclosure: 'scratch integration test', credential: value(decode('SecretRef', { type: 'SecretRef', schemaVersion: 1,
        vault: 'preview', name: profile.reference }, ctx)), context: { ...ctx, site: f.c.site, preserved: f.c.preserved },
      profile, resolveProfile: () => profile, activation, io, now: () => Date.now(), active: () => !stop.value,
      framing: SUBSCRIPTION_TOOLS_FRAMING, toolTurn: turn, adapterEvidenceContract: { reference: activation.reference,
        version: activation.profileDigest, parserReference: 'claude-code-json-result', parserVersion: '1',
        endpoint: profile.loginProfileIdentity, account: profile.expectedAccount, credentialReference: profile.reference,
        controller: 'w4-persist-live', sourceEvidence: ['scratch'], terminalEvidence: 'scratch', terminalReasonField: 'subtype',
        successfulFinalReplyReasons: ['success'], strength: 'observation', maxMetadataBytes: policy.maxMetadataBytes,
        maxRawTerminalBytes: policy.maxRawTerminalBytes, maxCaptureBytes: policy.maxCaptureBytes } }));
    const watcher = stopWhen ? setInterval(() => { if (!stop.value && stopWhen(rowsOf(turn.stateDirectory))) {
      stop.value = true; stop.at = performance.now(); } }, 20) : undefined;
    try {
      const result = await route.invoke(prepared, { operation: id, deadline: Date.now() + policy.timeout + 30000, timeout: policy.timeout,
        maxOutputBytes: policy.maxOutputBytes, maxTokens: policy.maxTokens, maxCharge: 0, automaticRetries: 0 });
      const extracted = typeof result.bytes === 'string' ? parseModelJson(result.bytes, { wrapped: 'accept' }) : null;
      const decision = extracted?.ok ? extracted.value as { type?: unknown; floor?: unknown; conclusion?: { subject?: unknown; value?: unknown } } : null;
      const text = decision?.type === 'Decision' && decision.conclusion?.subject === 'preview-stage2-answer' && decisionWithinFloor(decision)
        ? conclusionText(decision.conclusion.value as never) : null;
      return { state: result.state, raw: result.bytes ?? null, text };
    } finally { clearInterval(watcher); }
  };
  const options = (id: string, prepared: string, invoke: (turn: SubscriptionToolTurn) => Promise<unknown>) => ({ journal: recorder, root, id, prepared,
    promptLimit: 32768, deniedRoots: [root, profile.home, profile.configDirectory, profile.workingDirectory], operations: SINGLE_MACHINE_PROFILE.operations,
    now: () => Date.now(), redactText: (t: string) => redact(t).text, authority: `${activation.reference} ${activation.invocationPolicyDigest}`,
    conversation, session: { store, harness: `${profile.version} ${MODEL}` }, stopped: () => stop.value,
    completed: (r: { state?: string; text?: string | null }) => r?.state === 'complete' && typeof r.text === 'string',
    fallback: async () => ({ result: { state: 'fallback' } }), invoke });
  const ask = async (id: string, question: string, stopWhen?: (rows: Row[]) => boolean) => {
    const prepared = prepareJournalEnvelope({ question, context: JSON.stringify({ now: new Date().toISOString(), audience: 'operator', sources: [], history: [] }), id },
      MODEL, genesis.grant, Date.now(), 32768);
    const started = performance.now();
    const outcome = await runToolTurn(options(id, prepared, turn => invokeRoute(turn, prepared, id, stopWhen))).catch((error: Error) => ({ error: error.message }));
    return { outcome, elapsedMs: Math.round(performance.now() - started), stopToSettledMs: stop.at === null ? null : Math.round(performance.now() - stop.at) };
  };
  const space = () => conversationWorkspace(root, conversation);
  const save = (record: object) => { mkdirSync(RECORD, { recursive: true }); writeFileSync(join(RECORD, `${name}.json`), `${JSON.stringify(record, null, 2)}\n`); };
  // Test cleanup only (the runner never deletes a workspace): unmount, then remove the scratch root's workspaces and the
  // kept session's files in the profile, by the exact names the runner derived.
  const cleanup = () => {
    let names: string[] = [];
    try { names = readdirSync(join(root, 'workspaces')); } catch { names = []; }
    for (const name of names) {
      const directory = join(root, 'workspaces', name), record = readSession(directory);
      detachScratch(directory);
      if (record.state === 'present') {
        removeSessionFiles(store, record.value.workspace, record.value.id);
        if (record.value.workspace === `/private/tmp/itw-${name}/ws`) rmSync(join(store, `-private-tmp-itw-${name}-ws`), { recursive: true, force: true });
      }
    }
  };
  return { root, store, journal, appended, states, stop, ask, options, invokeRoute, space, save, cleanup, profile };
}
afterAll(() => { if (scratch) rmSync(scratch, { recursive: true, force: true }); });
const sessionRows = (rows: Record<string, unknown>[]) => rows.filter(row => row.phase === 'trace').map(row => row.session);

it.runIf(run('persist'))('a file the agent writes on one turn is read back on the next, in the same kept session; a lost session recovers from the journal', { timeout: 900000 }, async () => {
  const w = world('persist');
  try {
    const one = await w.ask('telegram:12345678:update:1', 'Use the Write tool to create plan.txt in your workspace containing exactly: kiwi-7731. Then reply: saved.');
    const two = await w.ask('telegram:12345678:update:2', 'Use the Read tool on plan.txt and tell me exactly what it contains. Also: what did I ask you to do in my previous message?');
    const ws = readSession(w.space().directory).value.workspace as string;
    const record = readSession(w.space().directory);
    // The loss: the kept session's transcript disappears between turns; the next turn starts fresh and still has the file.
    rmSync(sessionTranscript(w.store, ws, record.value.id), { force: true });
    const three = await w.ask('telegram:12345678:update:3', 'Use the Read tool on plan.txt and tell me exactly what it contains.');
    const admissions = w.states.map(rowsOf);
    const out = { one, two, three, journalRows: w.appended, admissions, workspace: ws };
    w.save(out);
    const sessions = sessionRows(w.appended) as { id: string; mode: string; reason: string; kept: boolean }[];
    expect(sessions.map(s => [s.mode, s.reason, s.kept])).toEqual([['new', 'new', true], ['resume', 'resumed', true],
      ['new', 'lost: the transcript is missing', true]]);
    expect(sessions[1]!.id).toBe(sessions[0]!.id);
    expect(sessions[2]!.id).not.toBe(sessions[0]!.id);
    // Turn two's Read returned turn one's file, and its answer recalls turn one's request from the kept session.
    expect(admissions[1]!.some(row => row.phase === 'post' && row.tool === 'Read' && String(row.result).includes('kiwi-7731'))).toBe(true);
    const text = (o: unknown) => String((o as { result?: { text?: string } }).result?.text ?? '');
    expect(text(two.outcome)).toMatch(/kiwi-7731/u);
    expect(text(two.outcome)).toMatch(/plan\.txt|write|creat/iu);
    expect(admissions[2]!.some(row => row.phase === 'post' && row.tool === 'Read' && String(row.result).includes('kiwi-7731'))).toBe(true);
    expect(text(three.outcome)).toMatch(/kiwi-7731/u);
    // The harness kept no memory of its own beside the journal.
    expect(existsSync(join(w.store, ws.replace(/[^A-Za-z0-9]/gu, '-'), 'memory'))).toBe(false);
  } finally { w.cleanup(); w.journal.close(); }
});

it.runIf(run('forget'))('a forget recorded in the journal ends the kept session that held the fact; the next turn never sees it', { timeout: 900000 }, async () => {
  const w = world('forget');
  const now = Date.now(), sends: string[] = [], seen: { id: string; session: unknown }[] = [];
  let transcriptAfterTwo = '';
  const worker = createJournalWorker(w.journal, { now: () => Date.now(), stopped: () => false,
    prepareModel: input => prepareJournalEnvelope(input, MODEL, genesis.grant, Date.now(), 32768),
    toolRoute: () => true,
    model: async input => {
      if (input.id.startsWith('summary:')) return { state: 'complete' as const, failureClass: 'malformed' as const };
      const prepared = String(input.prepared);
      const ran = await runToolTurn(w.options(input.id, prepared, async turn => {
        seen.push({ id: input.id, session: turn.session });
        return w.invokeRoute(turn, prepared, input.id);
      }));
      const r = ran.result as { state: string; text: string | null };
      return r.state === 'complete' && r.text !== null ? r.text : { state: 'complete' as const, failureClass: 'malformed' as const };
    }, send: async input => { sends.push(input.text); return sends.length; }, checkOutbound: () => {} });
  const update = (id: number, text: string) => ({ update_id: id, message: { chat: { id: Number(genesis.chat), type: 'private' },
    from: { id: Number(genesis.operator) }, text, date: Math.floor(now / 1000) + id } });
  try {
    worker.intake([update(1, 'My locker code is 4417.')]); await worker.drain();
    worker.intake([update(2, 'Please forget this fact: My locker code is 4417.')]); await worker.drain();
    const record = readSession(w.space().directory);
    const ws = readSession(w.space().directory).value.workspace as string;
    try { transcriptAfterTwo = readFileSync(sessionTranscript(w.store, ws, record.value.id), 'utf8'); } catch { transcriptAfterTwo = ''; }
    worker.intake([update(3, 'What is my locker code? If you do not know it, say so.')]); await worker.drain();
    const out = { sends, seen, memory: w.journal.view.memory, journalRows: w.appended, admissions: w.states.map(rowsOf),
      heldFactBeforeForget: transcriptAfterTwo.includes('4417'), oldTranscriptAfter: existsSync(sessionTranscript(w.store, ws, record.value.id)) };
    w.save(out);
    expect(w.journal.view.memory).toMatchObject([{ mode: 'forget' }]);
    const sessions = sessionRows(w.appended) as { id: string; mode: string; reason: string }[];
    expect(sessions[1]).toMatchObject({ mode: 'resume', id: sessions[0]!.id });
    // The kept session held the fact before the forget; the forget rotated it, and its transcript is gone.
    expect(out.heldFactBeforeForget).toBe(true);
    expect(sessions.at(-1)).toMatchObject({ mode: 'new', reason: 'the journal changed a fact' });
    expect(out.oldTranscriptAfter).toBe(false);
    expect(sends.at(-1)).not.toMatch(/4417/u);
  } finally { w.cleanup(); w.journal.close(); }
});

it.runIf(run('stop'))('a stop ends the live turn and its kept session within the bound', { timeout: 900000 }, async () => {
  const w = world('stop');
  try {
    const turn = await w.ask('telegram:12345678:update:1', 'Use the Bash tool to run: sleep 60. Then reply: done.',
      rows => rows.some(row => row.phase === 'pre' && row.tool === 'Bash'));
    const ws = readSession(w.space().directory).value.workspace as string;
    const sessions = sessionRows(w.appended) as { id: string; kept: boolean; ended?: string }[];
    const out = { turn, journalRows: w.appended, admissions: w.states.map(rowsOf),
      transcriptAfter: existsSync(sessionTranscript(w.store, ws, sessions[0]!.id)), record: readSession(w.space().directory) };
    w.save(out);
    expect(turn.stopToSettledMs).not.toBeNull();
    expect(turn.stopToSettledMs!).toBeLessThan(3000);
    expect(sessions[0]).toMatchObject({ kept: false, ended: 'stopped or withdrawn' });
    expect(out.transcriptAfter).toBe(false);
    expect(out.record.value).toMatchObject({ ended: 'stopped or withdrawn', open: false });
  } finally { w.cleanup(); w.journal.close(); }
});
