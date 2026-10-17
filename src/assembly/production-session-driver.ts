import { createCodexConversationWorker } from '../harness-adapters/index.js';
import { createSessionConversationAdapter } from './conversation-harness-adapter.js';
import { SUBSCRIPTION_TOOL_NAMES } from './production-provider.js';
import type { SessionProtocolIO } from '../harness-adapters/index.js';
import { createHash, randomUUID } from 'node:crypto';
import { boundary, ensure, take } from './boundary.js';
import type { AssemblyDecodeContext, HarnessObservation } from './contracts.js';
import type { NativeHarnessDriverPort } from './harness.js';
import type { Result } from '../index.js';
import type { SubscriptionToolTurn } from './production-provider.js';

/** Operator-own-use sessions with the harness's full tool set. `unconfined` makes no confinement claim;
 * `admitted` launches every session with the tool admission hook, so each tool call passes it before dispatch. */
export type SessionFramework = 'claude-code' | 'codex-cli';
export interface SessionRecord {
  readonly operation: string; readonly claim: string; readonly name: string; readonly identity: string;
  readonly incarnation: string; readonly startedAt: number; readonly resumeId: string | null;
  readonly recovery: 0 | 1; readonly turnDeadline: number | null; readonly turnStartedAt: number | null;
  readonly closedAt: number | null; readonly turnBaseline?: string; readonly turnReceiptIds?: readonly string[];
  readonly continuation?: SessionContinuation;
  readonly turnCloseEvidence?: string | null;
  /** One neutral continuation per admitted turn; intent survives host loss before input.
   * The original deadline remains the brake and open-turn/reaper exclusion. */
  readonly rateRecovery?: Readonly<{ dueAt: number; state: 'waiting' | 'sending' | 'accepted'; submittedAt?: number }> | null;
  /** Observed native retry pressure, tied to this turn; call liability stays with the owner. */
  readonly connectionRetry?: Readonly<{ turnStartedAt: number; attempt: number }> | null;
  readonly deadlineHalt?: Readonly<{ deadline: number; at: number }>;
}
export interface SessionContinuation {
  readonly pending?: Readonly<{ operation: string; digest: string; deadline: number }>;
  readonly text: string; readonly source: string; readonly state: 'prepared' | 'sending' | 'accepted' | 'completed';
}
export interface DeliveryRecord {
  readonly operation: string; readonly identity: string; readonly intake: string;
  readonly digest: string; readonly text: string; readonly state: 'prepared' | 'sending' | 'accepted' | 'uncertain';
  readonly baseline: string; readonly redeliveries: 0 | 1; readonly evidence: string;
}
export interface SessionReservation {
  readonly name: string; readonly operation: string; readonly claim: string; readonly incarnation: string;
  readonly resumeId: string | null; readonly recovery: 0 | 1; readonly startedAt: number;
  readonly continuation?: SessionContinuation;
}
export interface SessionJournal { readonly sessions: readonly SessionRecord[]; readonly deliveries: readonly DeliveryRecord[];
  readonly resumes: Readonly<Record<string, string>>; readonly reservations?: readonly SessionReservation[];
  readonly continuationRefusals?: readonly Readonly<{ operation: string; claim: string; reason: string; at: number }>[]; }
export interface SessionIO {
  exclusive<T>(run: () => T): T;
  tmux(args: readonly string[]): Readonly<{ code: number; stdout: string }>;
  sleep(ms: number): void;
  load(): SessionJournal;
  save(journal: SessionJournal): void;
  readInbox(name: string): readonly Readonly<{ kind: 'turn-closed' | 'compact'; sessionId: string; at: number; receiptId?: string }>[];
  transcriptExists(framework: SessionFramework, id: string, cwd: string, configHome: string): boolean;
  armDeadline(name: string, identity: string, deadline: number): void;
}
export interface ProductionSessionConfig {
  readonly operatorOwnUse: true; readonly confinement: 'unconfined' | 'admitted'; readonly framework: SessionFramework;
  readonly executable: string; readonly cwd: string; readonly home: string; readonly configHome: string;
  readonly context: AssemblyDecodeContext; readonly io: SessionIO; readonly now: () => number;
  readonly stopped: () => boolean; readonly resolveIntake: (id: string, digest: string) => string;
  readonly maxSessions: number; readonly turnDeadlineMs: number; readonly readyTimeoutMs: number;
  readonly protectedSessions: readonly string[]; readonly hookScript?: string;
  /** Advisory activity for registered work; a changed pane is activity, never proof of completion.
   * The owner records it in its existing work observation cycle. No terminal bytes leave this port. */
  readonly observeActivity?: (observation: Readonly<{ subject: string; at: number; progress: string | null; wait: string | null }>) => void;
  /** Conversation replies require the authenticated lifecycle receipt, never pane heuristics. */
  readonly requireTurnHook?: boolean;
  /** Required exactly in `admitted` mode: the admission/completion command for a session's claim (its own
   * admission state), and the hook timeout. The harness runs it before every tool call, its subagents' too. */
  readonly toolAdmission?: Readonly<{ command: (claim: string, phase: 'pre' | 'post') => string; timeoutSeconds: number }>;
  /** The host's model-dispatch checkpoint for a claim: the base URL every model call of that claim's session is sent
   * to (`modelGateLaunch`), where it takes the step's reserved allowance before it is forwarded. Required in `admitted`
   * mode, so no admitted session can reach its model any other way. */
  readonly modelGate?: (claim: string) => string;
  /** The exact model the session runs, when a reviewed grant names one; absent, the CLI's own default. */
  readonly model?: string;
  /** Host-prepared, credential-free connector launch records for this admitted claim. */
  readonly connectors?: (claim: string) => SubscriptionToolTurn['mcp'];
  /** The command the pane runs the harness through, when it runs as its own identity (the harness-user bridge): its
   * words go before `executable` in the pane's clean environment. The first is an absolute path. Absent: the harness
   * itself. */
  readonly launchVia?: readonly string[];
  readonly inboxDirectory?: string; readonly compactGroundingFile?: string;
  /** Must reconstruct complete permitted context from agent-owned records, including both sides of prior turns. */
  /** The topic host may carry history across a new admission claim. */
  readonly continuationRequired?: () => boolean;
  readonly continuation?: ((input: Readonly<{ operation: string; claim: string; incarnation: string;
    reason: 'cache-miss' | 'context-wall'; pendingDigest?: string }>) => Readonly<{ text: string; source: string }>) | undefined;
}

/** The flags of an operator-own-use session for each harness: every tool and no permission prompt. The
 * harness's own sandbox is not used; an `admitted` session's tool calls each pass the admission hook instead,
 * which confines every shell command itself. Codex runs a hook only after its source is trusted; the hook
 * here is this runner's own reviewed script, so an admitted Codex session trusts it for the invocation.
 * Exported so a reviewed grant can bind exactly what it admits. */
export function sessionLaunchFlags(framework: SessionFramework, admitted = false): readonly string[] {
  return framework === 'claude-code' ? ['--dangerously-skip-permissions',
    ...(admitted ? ['--tools', SUBSCRIPTION_TOOL_NAMES.join(',')] : [])]
    : ['--dangerously-bypass-approvals-and-sandbox', '-c', 'check_for_update_on_startup=false',
      ...(admitted ? ['--dangerously-bypass-hook-trust'] : [])];
}
/** Claude Code variables an admitted session sets: no model call outside the ones its tool calls admit
 * (titles, suggestions) and no other background traffic. */
export const ADMITTED_CLAUDE_ENV = Object.freeze(['DISABLE_NON_ESSENTIAL_MODEL_CALLS=1', 'CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=1']);
const hookCommandPattern = /^[A-Za-z0-9_./@ -]{1,1024}$/u;
/** The provider name a gated Codex invocation uses: its base URL is the host checkpoint, and it keeps the ChatGPT sign-in. */
export const CODEX_GATE_PROVIDER = 'instar-gate';
const gatePattern = /^http:\/\/127\.0\.0\.1:[0-9]{1,5}\/[0-9a-f]{32}\/[A-Za-z0-9._-]{1,121}$/u;
/** How a harness is pointed at the host's model-dispatch checkpoint at `base`: Claude Code reads its model endpoint from
 * ANTHROPIC_BASE_URL; Codex is given a provider whose base URL is the checkpoint. A configured provider speaks plain HTTP
 * (never a websocket the checkpoint could not count), and Codex 0.156.1 keeps its hosted web search only for a provider
 * named `OpenAI` (recorded 2026-10-03: the same provider under another name has no web search), so that is its name. */
export function modelGateLaunch(framework: SessionFramework, base: string): Readonly<{ env: readonly string[]; args: readonly string[] }> {
  ensure(gatePattern.test(base), 'model gate address must be the loopback checkpoint');
  return framework === 'claude-code' ? { env: [`ANTHROPIC_BASE_URL=${base}`], args: [] }
    : { env: [], args: ['-c', `model_provider=${CODEX_GATE_PROVIDER}`, '-c', `model_providers.${CODEX_GATE_PROVIDER}={name="OpenAI",`
      + `base_url="${base}/backend-api/codex",wire_api="responses",requires_openai_auth=true}`] };
}
/** The harness arguments that install the admission hook for one claim. */
export function admissionArgs(framework: SessionFramework, admission: NonNullable<ProductionSessionConfig['toolAdmission']>,
  claim: string, extraClaudeHooks: Readonly<Record<string, unknown>> = {}): readonly string[] {
  const pre = admission.command(claim, 'pre'), post = admission.command(claim, 'post');
  ensure([pre, post].every(command => hookCommandPattern.test(command)), 'admission hook command must be plain');
  if (framework === 'claude-code') {
    const hook = (command: string) => [{ matcher: '*', hooks: [{ type: 'command', command, timeout: admission.timeoutSeconds }] }];
    // Failed calls have a separate completion event; the post command records that outcome distinctly.
    return ['--settings', JSON.stringify({ disableAllHooks: false,
      hooks: { ...extraClaudeHooks, PreToolUse: hook(pre), PostToolUse: hook(post), PostToolUseFailure: hook(post) } })];
  }
  const hook = (command: string) => `[{matcher='*',hooks=[{type='command',command='${command}',timeout=${admission.timeoutSeconds}}]}]`;
  return ['-c', `hooks.PreToolUse=${hook(pre)}`, '-c', `hooks.PostToolUse=${hook(post)}`];
}
/** Both session workers consume the same prepared connector set as the per-call provider. */
export function sessionConnectorArgs(framework: SessionFramework, mcp: SubscriptionToolTurn['mcp']): readonly string[] {
  if (!mcp) return framework === 'claude-code' ? ['--strict-mcp-config', '--mcp-config', '{"mcpServers":{}}'] : [];
  const { servers, launch } = mcp;
  ensure(launch !== undefined && servers.length > 0 && Object.keys(launch).length === servers.length
    && servers.every(name => /^[A-Za-z0-9_-]{1,64}$/u.test(name) && Object.hasOwn(launch, name)),
  'session requires exact prepared connector launch records');
  if (framework === 'claude-code') return ['--strict-mcp-config', '--mcp-config', mcp.config];
  return servers.flatMap(name => {
    const server = launch![name]!;
    const fields = [`command=${JSON.stringify(server.command)}`, `args=${JSON.stringify(server.args ?? [])}`];
    if (server.cwd !== undefined) fields.push(`cwd=${JSON.stringify(server.cwd)}`);
    fields.push(`env={${Object.entries(server.env ?? {}).map(([key, value]) => `${JSON.stringify(key)}=${JSON.stringify(value)}`).join(',')}}`);
    return ['-c', `mcp_servers.${name}={${fields.join(',')}}`];
  });
}
const modelPattern = /^[A-Za-z0-9][A-Za-z0-9._-]{0,80}$/u;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const namePattern = /^instar20-[a-f0-9]{24}$/;
const digestOf = (text: string) => `sha256:${createHash('sha256').update(text).digest('hex')}`;
const tail = (capture: string, lines = 12) => capture.split('\n').map(x => x.trim()).filter(Boolean).slice(-lines).join('\n');
const literalTarget = (name: string) => `=${name}:`;

/** A focused numbered menu wins over its prompt glyph, including a startup menu whose
 * trailing theme preview fills the footer. A later real prompt supersedes old menu output. */
export function classifyPaneReadiness(capture: string): 'ready' | 'menu' | 'not-ready' {
  const text = tail(capture, 6);
  const visible = tail(capture, 80).split('\n');
  const prompt = visible.map(line => /^[❯›>]\s*$/.test(line)).lastIndexOf(true);
  const active = visible.slice(prompt + 1);
  // Native 2.1.280 startup confirmations use unnumbered choices; their cursor is not input.
  if (active.includes('Enter to confirm · Esc to cancel')
    && active.some(line => /^[❯›]\s+(?:No, exit|Yes, I trust this folder|Yes, I accept)$/.test(line))
    && (active.includes('Accessing workspace:') || active.includes('WARNING: Claude Code running in Bypass Permissions mode')))
    return 'menu';
  const options = active.filter(line => /^\s*(?:[❯›>●○◉]\s*)?\d+[.)]\s/.test(line));
  if (options.length >= 2 && options.some(line => /^\s*[❯›>●○◉]\s*\d+[.)]\s/.test(line))) return 'menu';
  if (/[❯›]/.test(text) || /(?:bypass permissions|shift\+tab to cycle|ctrl\+c to exit)/i.test(text)) return 'ready';
  return 'not-ready';
}
/** A prompt can remain visible throughout work; only a changed, quiet idle frame closes a turn. */
export function classifyPaneIdle(capture: string, framework: SessionFramework): boolean {
  const lines = tail(capture, 8).split('\n').filter(line => !/^[─━]+$/u.test(line))
    .map(line => line.replace(/^⏵⏵\s*/u, ''));
  if (classifyPaneReadiness(capture) !== 'ready') return false;
  if (/(?:esc|ctrl\+c) to interrupt|\bworking(?:…|\.\.\.|\s*\()|\bgenerating\b|[⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏]/i.test(lines.join('\n'))) return false;
  const prompt = framework === 'codex-cli' ? /^[❯›>]\s*$/ : /^[❯›]\s*$/;
  const promptIndex = lines.map(line => prompt.test(line)).lastIndexOf(true);
  return promptIndex >= 0 && lines.slice(promptIndex + 1)
    .every(line => /^(?:[─━]+$|⏵⏵ bypass permissions on \(shift\+tab to cycle\)|bypass permissions|shift\+tab to cycle|\? for shortcuts|gpt-|tokens?\b)/i.test(line));
}
export function classifyWedgeTail(capture: string): 'thinking-block-400' | 'aup-rejection' | null {
  const live = tail(capture, 10);
  if (/blocks in the latest assistant message cannot be modified|(?:thinking|redacted_thinking)\s+blocks.{0,80}cannot be modified/i.test(live)) return 'thinking-block-400';
  const aup = /appears to violate our Usage Policy/i;
  if (aup.test(live) && capture.split('\n').filter(line => aup.test(line)).length > 1) return 'aup-rejection';
  return null;
}
export function classifyStuckSignature(capture: string): 'policy-wedge' | 'context-wedge' | 'rate-limited' | 'context-too-long' | null {
  const wedge = classifyWedgeTail(capture);
  if (wedge) return wedge === 'aup-rejection' ? 'policy-wedge' : 'context-wedge';
  const live = tail(capture);
  // A usage-percentage warning also names the reset time; only an actual limit hit pauses work.
  if (/you['’]?ve (?:hit|reached) your (?:(?:session|usage|5-hour|weekly) )?limit\b|usage limit reached/i.test(live)) return 'rate-limited';
  if (/conversation (?:is )?too long|prompt is too long|error during compaction[^.\n]{0,40}too long|press esc twice to go up a few messages/i.test(live)
    && !/conversation compacted|paused for context compaction|compaction[^.\n]{0,20}resumed/i.test(live)) return 'context-too-long';
  return null;
}
/** Native retries own backoff and never receive a second prompt. The captured 2.1.280
 * exhausted 529 has no Stop receipt: recognize only its final error at a quiet prompt,
 * not countdowns, echoed/quoted errors, or an older error followed by more output. */
export function classifyConnectionExhausted(capture: string): boolean {
  const lines = capture.split('\n').map(line => line.trimEnd()).filter(line => line.trim());
  const prompt = lines.lastIndexOf('❯');
  if (prompt < 0 || !lines.slice(prompt + 1).every(line => /^─+$/.test(line)
    || /^  ⏵⏵ bypass permissions on \(shift\+tab to cycle\)(?: · ← for agents)?(?: +● high · \/effort)?$/.test(line))) return false;
  const output = lines.slice(0, prompt).filter(line => !/^─+$/.test(line));
  if (/^[✻✽✳✢·] .+ · done \d{1,2}:\d{2} [AP]M$/.test(output.at(-1) ?? '')) output.pop();
  const error = output.map(line => line.startsWith('⏺ ')).lastIndexOf(true);
  return error >= 0 && /^⏺ API Error: 529 Overloaded\./.test(output[error]!)
    && output.slice(error + 1).every(line => /^  \S/.test(line));
}
export function chunkLiteralForTmux(value: string, maximum = 8000): string[] {
  ensure(maximum >= 4, 'tmux chunk bound too small');
  const result: string[] = []; let chunk = '', bytes = 0;
  for (const point of value) {
    const length = Buffer.byteLength(point);
    if (bytes + length > maximum) { result.push(chunk); chunk = ''; bytes = 0; }
    chunk += point; bytes += length;
  }
  if (chunk) result.push(chunk);
  return result;
}
export function buildLiteralSendArgs(name: string, chunk: string): readonly string[] {
  ensure(namePattern.test(name), 'invalid exact tmux name');
  return ['send-keys', '-t', literalTarget(name), '-l', '--', chunk];
}

export type SessionStopTarget = Readonly<{ claim: string; incarnation: string; processIdentity?: string; idleEvidence?: string }>;
/** Only a known refusal before actuation may clear the holder's cleanup inhibition. */
export type SessionStopRefusal = Readonly<{ state: 'refused'; evidence: string }>;
export interface SessionStopPort {
  stop(input?: SessionStopTarget & { idleEvidence?: undefined }): Result<readonly string[]>;
  stop(input: SessionStopTarget): Result<readonly string[] | SessionStopRefusal>;
}

export function createProductionSessionDriver(config: ProductionSessionConfig): NativeHarnessDriverPort & SessionStopPort & Readonly<{
  observeIdle(identity: string): Result<string | null>;
  bootSweep(): Result<readonly string[]>;
  recoverDelivery(input: Readonly<{ operation: string; processIdentity: string; intake: string; digest: string; incarnation: string }>): Result<string>;
  saveResume(identity: string, sessionId: string): Result<string>;
  recoverContext(identity: string, pending?: { operation: string; digest: string; deadline: number }): Result<string>;
}> {
  ensure(config.operatorOwnUse === true && (config.confinement === 'unconfined' || config.confinement === 'admitted'),
    'explicit operator-own-use mode required');
  const admitted = config.confinement === 'admitted';
  ensure(config.connectors === undefined || admitted, 'connectors require admitted session');
  ensure(admitted === (config.toolAdmission !== undefined), 'an admitted session requires its admission hook, and only it');
  ensure(admitted === (config.modelGate !== undefined), 'an admitted session requires its model-dispatch checkpoint, and only it');
  if (config.toolAdmission) ensure(typeof config.toolAdmission.command === 'function'
    && Number.isSafeInteger(config.toolAdmission.timeoutSeconds) && config.toolAdmission.timeoutSeconds > 0
    && config.toolAdmission.timeoutSeconds <= 3600, 'bounded admission hook required');
  ensure(Number.isSafeInteger(config.maxSessions) && config.maxSessions > 0 && config.maxSessions <= 16,
    'fixed concurrent session cap required');
  ensure(Number.isSafeInteger(config.turnDeadlineMs) && config.turnDeadlineMs > 0 && config.turnDeadlineMs <= 14_400_000,
    'bounded per-turn deadline required');
  ensure(config.framework === 'claude-code' || config.framework === 'codex-cli', 'supported session framework required');
  ensure(config.model === undefined || modelPattern.test(config.model), 'exact session model required');
  ensure(config.executable.startsWith('/') && config.cwd.startsWith('/') && config.home.startsWith('/')
    && config.configHome.startsWith('/'), 'exact executable and absolute paths required');
  ensure(config.launchVia === undefined || (config.launchVia[0]?.startsWith('/') === true
    && config.launchVia.every(word => typeof word === 'string' && word.length > 0)), 'exact launch command required');
  if (config.hookScript) ensure(config.hookScript.startsWith('/') && config.inboxDirectory?.startsWith('/')
    && (config.compactGroundingFile === undefined || config.compactGroundingFile.startsWith('/')), 'hook requires exact script and inbox; compaction grounding must be absolute');
  const run = (args: readonly string[]) => {
    const result = config.io.tmux(args);
    ensure(result.code === 0, `tmux ${args[0]} failed`);
    return result.stdout.trim();
  };
  const lockedBoundary = <T>(name: string, input: unknown, perform: () => T): Result<T> =>
    boundary(name, input, config.context, () => config.io.exclusive(perform));
  const capture = (name: string) => run(['capture-pane', '-p', '-t', literalTarget(name), '-S', '-80']);
  const alive = (name: string) => config.io.tmux(['has-session', '-t', literalTarget(name)]).code === 0;
  const checkStop = () => {
    if (!config.stopped()) return;
    reconcileReservations();
    for (const row of config.io.load().sessions) {
      if (config.protectedSessions.includes(row.name) || !namePattern.test(row.name)) continue;
      if (config.io.tmux(['has-session', '-t', literalTarget(row.name)]).code !== 0) continue;
      const current = config.io.tmux(['display-message', '-p', '-t', literalTarget(row.name), '#{pane_pid}:#{session_created}']);
      if (current.code === 0 && row.identity === `${row.name}:${current.stdout.trim()}`)
        config.io.tmux(['kill-session', '-t', literalTarget(row.name)]);
    }
    throw Error('session stop authority is active');
  };
  const replaceSession = (journal: SessionJournal, session: SessionRecord): SessionJournal => ({ ...journal,
    sessions: [...journal.sessions.filter(row => row.identity !== session.identity), session] });
  const replaceDelivery = (journal: SessionJournal, delivery: DeliveryRecord): SessionJournal => ({ ...journal,
    deliveries: [...journal.deliveries.filter(row => row.operation !== delivery.operation), delivery] });
  const loadSession = (identity: string) => {
    const session = config.io.load().sessions.find(row => row.identity === identity);
    ensure(session && namePattern.test(session.name), 'unknown exact process identity');
    return session;
  };
  const verifyLive = (session: SessionRecord) => {
    ensure(alive(session.name), 'session exited');
    const current = run(['display-message', '-p', '-t', literalTarget(session.name), '#{pane_pid}:#{session_created}']);
    ensure(session.identity === `${session.name}:${current}`, 'tmux process identity changed');
  };
  const reconcileReservations = () => {
    const journal = config.io.load();
    for (const reservation of journal.reservations ?? []) {
      ensure(namePattern.test(reservation.name), 'invalid reserved tmux name');
      if (!alive(reservation.name)) {
        const current = config.io.load();
        config.io.save({ ...current, reservations: (current.reservations ?? []).filter(row => row.name !== reservation.name) });
        continue;
      }
      const stamp = run(['display-message', '-p', '-t', literalTarget(reservation.name), '#{pane_pid}:#{session_created}']);
      const session: SessionRecord = { ...reservation, identity: `${reservation.name}:${stamp}`,
        turnDeadline: null, turnStartedAt: null, closedAt: null };
      const current = config.io.load();
      config.io.save({ ...replaceSession(current, session),
        resumes: reservation.resumeId ? { ...current.resumes, [reservation.claim]: reservation.resumeId } : current.resumes,
        reservations: (current.reservations ?? []).filter(row => row.name !== reservation.name) });
    }
  };
  const armTurn = (session: SessionRecord, recovery = session.recovery): SessionRecord => {
    ensure(!session.deadlineHalt, 'session safety halt requires reconciliation');
    const started = config.now();
    const deadline = Math.min(started + config.turnDeadlineMs, session.continuation?.pending?.deadline ?? Infinity);
    ensure(deadline > started, 'context continuation deadline exhausted');
    const armed = { ...session, recovery, turnStartedAt: started, turnDeadline: deadline, closedAt: null, turnCloseEvidence: null,
      rateRecovery: null,
      connectionRetry: null,
      turnBaseline: digestOf(capture(session.name)),
      turnReceiptIds: config.io.readInbox(session.name).filter(row => row.kind === 'turn-closed')
        .flatMap(row => row.receiptId ? [row.receiptId] : []) };
    config.io.save(replaceSession(config.io.load(), armed));
    config.io.armDeadline(session.name, session.identity, deadline);
    return armed;
  };
  const closeTurn = (session: SessionRecord, at: number): SessionRecord => ({ ...session,
    closedAt: at, turnDeadline: null,
    ...(session.continuation?.state === 'accepted'
      ? { continuation: { ...session.continuation, state: 'completed' as const } } : {}) });
  const sendText = (session: SessionRecord, text: string) => {
    verifyLive(session); checkStop();
    const target = literalTarget(session.name);
    const safe = text.replace(/(?:\x1b\[|\x9b)20[01]~/g, '');
    if (safe.includes('\n')) run(['send-keys', '-t', target, '\x1b[200~']);
    for (const chunk of chunkLiteralForTmux(safe)) run(buildLiteralSendArgs(session.name, chunk));
    if (safe.includes('\n')) run(['send-keys', '-t', target, '\x1b[201~']);
    config.io.sleep(config.framework === 'codex-cli' ? 1500 : safe.includes('\n') ? 500 : 100);
    checkStop(); verifyLive(session);
    run(['send-keys', '-t', target, 'Enter']);
    if (config.framework === 'codex-cli') { config.io.sleep(300); checkStop(); run(['send-keys', '-t', target, 'Enter']); }
  };
  const spawn = (operation: string, claim: string, incarnation: string, workingScope: string,
    resumeId: string | null, recovery: 0 | 1, continuation?: SessionContinuation): string => {
    checkStop(); ensure(workingScope === config.cwd, 'working scope differs from fixed session directory');
    reconcileReservations();
    const existing = config.io.load().sessions.find(row => row.operation === operation && row.incarnation === incarnation && alive(row.name));
    if (existing) { verifyLive(existing); return existing.identity; }
    const currentJournal = config.io.load();
    const active = currentJournal.sessions.filter(row => alive(row.name));
    ensure(active.length + (currentJournal.reservations ?? []).length < config.maxSessions, 'concurrent session cap reached');
    const name = `instar20-${createHash('sha256').update(`${operation}:${incarnation}:${randomUUID()}`).digest('hex').slice(0, 24)}`;
    const transcriptId = config.framework === 'claude-code' ? resumeId ?? randomUUID() : resumeId;
    const reservation: SessionReservation = { name, operation, claim, incarnation, resumeId: transcriptId, recovery,
      startedAt: config.now(), ...(continuation ? { continuation } : {}) };
    config.io.save({ ...currentJournal, reservations: [...(currentJournal.reservations ?? []), reservation] });
    const model = config.model === undefined ? [] : ['--model', config.model];
    const args = config.framework === 'claude-code'
      ? [resumeId ? '--resume' : '--session-id', transcriptId!, ...sessionLaunchFlags('claude-code', admitted), ...model]
      : [ ...(resumeId ? ['resume', resumeId] : []), ...sessionLaunchFlags('codex-cli', admitted), ...model];
    const lifecycleHooks = config.hookScript && config.framework === 'claude-code'
      ? { Stop: [{ hooks: [{ type: 'command', command: `node ${JSON.stringify(config.hookScript)}` }] }],
        ...(config.compactGroundingFile ? { SessionStart: [{ matcher: 'compact', hooks: [{ type: 'command', command: `node ${JSON.stringify(config.hookScript)} compact` }] }] } : {}) }
      : null;
    // One settings object carries every Claude hook: the admission hook and, when configured, the lifecycle hooks.
    if (config.toolAdmission) args.push(...admissionArgs(config.framework, config.toolAdmission, claim, lifecycleHooks ?? {}));
    else if (lifecycleHooks) args.push('--settings', JSON.stringify({ hooks: lifecycleHooks }));
    if (admitted && config.connectors) args.push(...sessionConnectorArgs(config.framework, config.connectors(claim)));
    const gate = config.modelGate ? modelGateLaunch(config.framework, config.modelGate(claim)) : null;
    if (gate) args.push(...gate.args);
    const harnessEnv = [...(admitted && config.framework === 'claude-code' ? ADMITTED_CLAUDE_ENV : []), ...(gate?.env ?? [])];
    try { run(['new-session', '-d', '-s', name, '-c', config.cwd, '-x', '100', '-y', '30',
      '-e', `HOME=${config.home}`, '-e', `CLAUDE_CONFIG_DIR=${config.configHome}`,
      '-e', `CODEX_HOME=${config.configHome}`, '-e', `INSTAR_SESSION_NAME=${name}`,
      '-e', `INSTAR_SESSION_INBOX=${config.inboxDirectory ?? ''}`,
      '-e', `INSTAR_SESSION_GROUNDING_FILE=${config.compactGroundingFile ?? ''}`,
      '--', '/usr/bin/env', '-i', 'PATH=/usr/bin:/bin:/usr/local/bin:/opt/homebrew/bin', `HOME=${config.home}`,
      `CLAUDE_CONFIG_DIR=${config.configHome}`, `CODEX_HOME=${config.configHome}`,
      `INSTAR_SESSION_NAME=${name}`, `INSTAR_SESSION_INBOX=${config.inboxDirectory ?? ''}`,
      `INSTAR_SESSION_GROUNDING_FILE=${config.compactGroundingFile ?? ''}`, ...harnessEnv,
      ...(config.launchVia ?? []), config.executable, ...args]); } catch (error) { reconcileReservations(); throw error; }
    reconcileReservations();
    const session = config.io.load().sessions.find(row => row.name === name);
    ensure(session, 'spawned session identity missing');
    const identity = session.identity;
    const until = config.now() + config.readyTimeoutMs;
    while (config.now() < until) {
      checkStop(); verifyLive(session);
      const state = classifyPaneReadiness(capture(name));
      if (state === 'ready') return identity;
      if (state === 'menu') throw Error('session startup menu requires operator');
      config.io.sleep(100);
    }
    throw Error('session readiness deadline exceeded');
  };
  const requireContinuation = (operation: string, claim: string, incarnation: string,
    reason: 'cache-miss' | 'context-wall', pending?: { operation: string; digest: string; deadline: number }): SessionContinuation => {
    const refuse = (detail: string): never => {
      const journal = config.io.load();
      config.io.save({ ...journal, continuationRefusals: [
        ...(journal.continuationRefusals ?? []).filter(row => row.operation !== operation),
        { operation, claim, reason: `${reason}: ${detail}`, at: config.now() },
      ] });
      throw Error(`continuation refused: ${detail}`);
    };
    if (!config.continuation) return refuse('continuation provider unavailable');
    let provided: Readonly<{ text: string; source: string }>;
    try { provided = config.continuation({ operation, claim, incarnation, reason, ...(pending ? { pendingDigest: pending.digest } : {}) }); }
    catch { return refuse('continuation provider failed'); }
    if (typeof provided?.text !== 'string' || !provided.text.trim()
      || typeof provided.source !== 'string' || !provided.source.trim())
      return refuse('complete agent-owned continuation unavailable');
    if (Buffer.byteLength(provided.text) > 128_000 || provided.source.length > 512)
      return refuse('continuation exceeds bounded context');
    return { text: provided.text, source: provided.source, state: 'prepared', ...(pending ? { pending } : {}) };
  };
  const submitContinuation = (identity: string) => {
    let session = loadSession(identity);
    const continuation = session.continuation;
    ensure(continuation, 'continuation missing from session reservation');
    ensure(continuation.state === 'prepared', 'continuation delivery uncertain or already submitted');
    ensure(classifyPaneIdle(capture(session.name), config.framework), 'pane is not at an idle prompt');
    armTurn(session);
    session = loadSession(identity);
    config.io.save(replaceSession(config.io.load(), { ...session,
      continuation: { ...continuation, state: 'sending' } }));
    // The owner already fenced tool/send replay and supplied the exact accepted packet,
    // including its inbound identity and history. A recovery wrapper changes that task and
    // can be mistaken for an injected identity/protocol. Disclosure belongs to the host reply.
    sendText(session, continuation.pending
      ? continuation.text
      : `Restore the following agent-owned context as prior history. Do not repeat any action or send on its behalf. `
        + `Acknowledge that it was read, then wait for the next input.\n\n${continuation.text}`);
    session = loadSession(identity);
    config.io.save(replaceSession(config.io.load(), { ...session,
      continuation: { ...continuation, state: 'accepted' } }));
  };
  const waitContinuation = (identity: string) => {
    for (let elapsed = 0; elapsed < config.turnDeadlineMs; elapsed += 100) {
      const pending = loadSession(identity).continuation;
      if (!pending || pending.state === 'completed') return;
      ensure(pending.state === 'accepted', 'continuation delivery uncertain or incomplete');
      const outcome = take(api.observe({ operation: `${loadSession(identity).operation}:continuation`, processIdentity: identity }));
      if (outcome.phase === 'output-observed') {
        ensure(loadSession(identity).continuation?.state === 'completed', 'continuation completion not recorded');
        return;
      }
      ensure(outcome.phase === 'launched', `continuation did not complete: ${outcome.detail}`);
      config.io.sleep(100);
    }
    throw Error('continuation completion deadline exceeded');
  };
  const idleFingerprint = (identity: string): string | null => {
    const session = loadSession(identity); verifyLive(session);
    if (config.stopped() || config.protectedSessions.includes(session.name) || session.turnDeadline !== null
      || !session.turnCloseEvidence || session.closedAt === null
      || session.continuation && session.continuation.state !== 'completed'
      || config.io.load().deliveries.some(row => row.identity === identity && row.state !== 'accepted')) return null;
    const pane = capture(session.name);
    if (!classifyPaneIdle(pane, config.framework) || classifyStuckSignature(pane)) return null;
    return digestOf(JSON.stringify([identity, session.turnCloseEvidence, pane]));
  };
  function stop(target?: SessionStopTarget & { idleEvidence?: undefined }): Result<readonly string[]>;
  function stop(target: SessionStopTarget): Result<readonly string[] | SessionStopRefusal>;
  function stop(target?: SessionStopTarget): Result<readonly string[] | SessionStopRefusal> {
    return lockedBoundary<readonly string[] | SessionStopRefusal>('ProductionSessionStop', target ?? null, () => {
      reconcileReservations();
      if (target?.idleEvidence !== undefined) {
        const session = config.io.load().sessions.find(row => row.identity === target.processIdentity
          && row.claim === target.claim && row.incarnation === target.incarnation);
        if (!session || config.protectedSessions.includes(session.name)
          || idleFingerprint(session.identity) !== target.idleEvidence)
          return { state: 'refused', evidence: 'idle evidence changed; worker kept' };
      }
      const killed: string[] = [];
      for (const session of config.io.load().sessions) {
        if (target && (session.claim !== target.claim || session.incarnation !== target.incarnation
          || target.processIdentity !== undefined && session.identity !== target.processIdentity)) continue;
        if (config.protectedSessions.includes(session.name)) continue;
        if (alive(session.name)) { verifyLive(session); run(['kill-session', '-t', literalTarget(session.name)]);
          ensure(!alive(session.name), 'session stop unconfirmed'); killed.push(session.name); }
      }
      return killed;
    });
  }
  const api = {
    owner: 'part-eight' as const,
    observeIdle: (identity: string) => lockedBoundary('ProductionSessionIdle', identity, () => idleFingerprint(identity)),
    launch(input: { operation: string; claim: string; artifact: string; incarnation: string; workingScope: string; handles: readonly string[]; restore?: { operation: string; digest: string; deadline: number } }) {
      return boundary('ProductionSessionLaunch', input, config.context, () => {
        const identity = config.io.exclusive(() => {
          ensure(input.operation && input.claim && input.artifact && input.incarnation, 'launch identity required');
          ensure(input.handles.length === 0, 'session launch accepts no ambient handles');
          checkStop();
          reconcileReservations();
          const journal = config.io.load();
          const existing = journal.sessions.find(row => row.operation === input.operation
            && row.incarnation === input.incarnation && alive(row.name));
          if (existing) {
            verifyLive(existing);
            if (existing.continuation?.state === 'prepared') submitContinuation(existing.identity);
            const current = loadSession(existing.identity);
            ensure(!current.continuation || current.continuation.state === 'completed'
              || current.continuation.state === 'accepted',
              'continuation delivery uncertain or incomplete');
            return existing.identity;
          }
          const previous = journal.sessions.filter(row => row.operation === input.operation
            && row.incarnation === input.incarnation).at(-1);
          ensure(!previous?.continuation || previous.continuation.state === 'prepared'
            || previous.continuation.state === 'completed',
            'continuation delivery uncertain; no automatic respawn');
          if (input.restore) {
            ensure(!journal.sessions.some(row => row.continuation?.pending?.operation === input.restore!.operation
              && row.continuation.state !== 'prepared'), 'pending continuation already submitted; no replay');
            const original = journal.deliveries.find(row => row.operation === input.restore!.operation);
            const former = original && journal.sessions.find(row => row.identity === original.identity);
            ensure(original?.state === 'accepted' && original.digest === input.restore.digest && former && !alive(former.name),
              'context restore requires exact accepted intake and a retired original worker');
          }
          const resumeId = journal.resumes[input.claim] ?? null;
          ensure(!resumeId || uuid.test(resumeId), 'invalid recorded resume id');
          const hit = resumeId !== null && config.io.transcriptExists(config.framework, resumeId, config.cwd, config.configHome);
          const needsContinuation = !hit && (resumeId !== null || config.continuationRequired?.() === true || journal.sessions.some(row => row.claim === input.claim));
          const continuation = input.restore
            ? requireContinuation(input.restore.operation, input.claim, input.incarnation, 'context-wall', input.restore) : needsContinuation
            ? requireContinuation(input.operation, input.claim, input.incarnation, 'cache-miss') : undefined;
          const identity = spawn(input.operation, input.claim, input.incarnation, input.workingScope,
            hit && !input.restore ? resumeId : null, input.restore ? 1 : 0, continuation);
          if (continuation) submitContinuation(identity);
          return identity;
        });
        if (!input.restore) waitContinuation(identity);
        return identity;
      });
    },
    deliver(input: { operation: string; processIdentity: string; intake: string; digest: string; incarnation: string }): Result<string> {
      return lockedBoundary('ProductionSessionDeliver', input, () => {
        if (config.stopped()) { stop(); throw Error('session stop authority is active'); }
        const session = loadSession(input.processIdentity); verifyLive(session);
        ensure(!session.continuation || session.continuation.state === 'completed',
          'continuation delivery uncertain or incomplete');
        ensure(input.incarnation === session.incarnation && input.operation && input.intake, 'stale or empty delivery');
        const prior = config.io.load().deliveries.find(row => row.operation === input.operation);
        if (prior) {
          ensure(prior.identity === input.processIdentity && prior.intake === input.intake && prior.digest === input.digest,
            'delivery operation reused for different input');
          ensure(prior.state === 'accepted', 'delivery outcome uncertain; boot sweep required');
          return prior.evidence;
        }
        ensure(session.turnDeadline === null || session.closedAt !== null, 'prior turn still open');
        ensure(classifyPaneReadiness(capture(session.name)) === 'ready', 'pane is not at an idle prompt');
        const text = config.resolveIntake(input.intake, input.digest);
        ensure(digestOf(text) === input.digest, 'intake bytes differ from admitted digest');
        const baseline = digestOf(capture(session.name));
        let delivery: DeliveryRecord = { ...input, identity: input.processIdentity, text,
          state: 'prepared', baseline, redeliveries: 0, evidence: '' };
        config.io.save(replaceDelivery(config.io.load(), delivery));
        armTurn(session, 0);
        delivery = { ...delivery, state: 'sending' };
        config.io.save(replaceDelivery(config.io.load(), delivery));
        sendText(session, text);
        delivery = { ...delivery, state: 'accepted', evidence: `tmux-input:${input.operation}` };
        config.io.save(replaceDelivery(config.io.load(), delivery));
        return delivery.evidence;
      });
    },
    observe(input: { operation: string; processIdentity: string; resultAvailable?: boolean }): Result<Readonly<{ phase: HarnessObservation['phase']; evidence: string; detail: string; safetyDeadline?: number }>> {
      return lockedBoundary('ProductionSessionObserve', input, () => {
        const session = loadSession(input.processIdentity);
        if (config.stopped()) { stop(); return { phase: 'exit-observed' as const, evidence: session.identity, detail: 'stop authority active' }; }
        if (session.deadlineHalt) return { phase: 'exit-observed' as const, evidence: `safety-ceiling:deadline:${session.identity}`, detail: 'per-turn deadline exceeded; closure must be reconciled', safetyDeadline: session.deadlineHalt.deadline };
        if (!alive(session.name)) return { phase: 'exit-observed' as const, evidence: session.identity, detail: 'tmux session exited' };
        verifyLive(session);
        const pane = capture(session.name);
        try {
          config.observeActivity?.({ subject: session.claim, at: config.now(), progress: pane.trim() ? digestOf(pane) : null,
            wait: classifyStuckSignature(pane) });
        } catch { /* An advisory observer cannot fail the worker; its last sample becomes stale/unknown. */ }
        const rate = session.rateRecovery;
        if (rate && session.turnDeadline !== null && config.now() >= session.turnDeadline) {
          config.io.save(replaceSession(config.io.load(), { ...session, deadlineHalt: { deadline: session.turnDeadline, at: config.now() } }));
          run(['kill-session', '-t', literalTarget(session.name)]);
          return { phase: 'exit-observed' as const, evidence: `safety-ceiling:deadline:${session.identity}`, detail: 'per-turn deadline exceeded', safetyDeadline: session.turnDeadline };
        }
        if (rate?.state === 'sending')
          return { phase: 'uncertain' as const, evidence: session.identity, detail: 'rate-limit continuation delivery uncertain; no resend' };
        if (config.requireTurnHook && session.turnCloseEvidence)
          return { phase: 'output-observed' as const, evidence: session.turnCloseEvidence, detail: 'recorded Stop hook closed turn' };
        const throttled = classifyStuckSignature(pane) === 'rate-limited';
        const hook = config.io.readInbox(session.name).filter(row => row.kind === 'turn-closed'
          && (row.receiptId ? !session.turnReceiptIds?.includes(row.receiptId) : row.at > (session.turnStartedAt ?? Infinity))).at(-1);
        // A throttle can emit Stop without completing work. A bounded result plus Stop
        // still wins over stale quota scrollback; the marker alone must retain recovery.
        if (hook && (!throttled || input.resultAvailable === true)
          && session.turnStartedAt !== null && hook.at >= session.turnStartedAt
          && session.turnDeadline !== null && hook.at <= config.now() && hook.at <= session.turnDeadline) {
          config.io.save(replaceSession(config.io.load(), { ...closeTurn(session, hook.at),
            turnCloseEvidence: `turn-closed:${session.name}:${hook.at}` }));
          if (uuid.test(hook.sessionId)) {
            const journal = config.io.load();
            config.io.save({ ...journal, resumes: { ...journal.resumes, [session.claim]: hook.sessionId } });
          }
          return { phase: 'output-observed' as const, evidence: `turn-closed:${session.name}:${hook.at}`,
            detail: 'Stop hook closed turn' };
        }
        const contextWall = classifyStuckSignature(pane);
        if ((contextWall === 'context-too-long' || contextWall === 'context-wedge') && classifyPaneIdle(pane, config.framework)
          && (!session.turnBaseline || digestOf(pane) !== session.turnBaseline)) {
          config.io.save(replaceSession(config.io.load(), { ...session, closedAt: config.now(), turnDeadline: null }));
          return { phase: 'pause-observed' as const, evidence: session.identity, detail: contextWall };
        }
        // Keep the same admitted turn, claim, effect identities and original deadline.
        if (session.turnDeadline !== null && config.now() < session.turnDeadline
          && admitted && session.recovery === 0 && (!session.continuation || session.continuation.state === 'completed')
          && (rate || throttled && classifyPaneIdle(pane, config.framework)
            && digestOf(pane) !== session.turnBaseline
            && config.io.load().deliveries.filter(row => row.identity === session.identity).at(-1)?.state === 'accepted')) {
          if (!rate && config.now() + 30_000 < session.turnDeadline) {
            config.io.save(replaceSession(config.io.load(), { ...session,
              rateRecovery: { dueAt: config.now() + 30_000, state: 'waiting' },
              turnReceiptIds: config.io.readInbox(session.name).filter(row => row.kind === 'turn-closed')
                .flatMap(row => row.receiptId ? [row.receiptId] : []), turnStartedAt: config.now() }));
            return { phase: 'launched' as const, evidence: session.identity, detail: 'rate-limit recovery waiting' };
          }
          if (rate?.state === 'waiting' && classifyStuckSignature(pane) !== null) {
            if (config.now() < rate.dueAt || !classifyPaneIdle(pane, config.framework)
              || classifyStuckSignature(pane) !== 'rate-limited')
              return { phase: 'launched' as const, evidence: session.identity, detail: 'rate-limit recovery waiting' };
            // Durable before touching the terminal. Capture old Stop receipts so none can
            // close the continued turn; the driver still requires its normal completion evidence.
            const sending = { ...session, rateRecovery: { ...rate, state: 'sending' as const, submittedAt: config.now() },
              turnReceiptIds: config.io.readInbox(session.name).filter(row => row.kind === 'turn-closed')
                .flatMap(row => row.receiptId ? [row.receiptId] : []), turnStartedAt: config.now(),
              turnBaseline: digestOf(pane) };
            config.io.save(replaceSession(config.io.load(), sending));
            sendText(sending, 'Continue the same interrupted turn from its recorded state. Do not repeat completed actions or sends; leave uncertain actions unresolved.');
            config.io.save(replaceSession(config.io.load(), { ...sending,
              rateRecovery: { ...sending.rateRecovery, state: 'accepted' } }));
            return { phase: 'launched' as const, evidence: session.identity, detail: 'rate-limit continuation submitted' };
          }
          if (rate?.state === 'accepted' && throttled) {
            if (!classifyPaneIdle(pane, config.framework) || config.now() < rate.submittedAt! + 5_000)
              return { phase: 'launched' as const, evidence: session.identity, detail: 'rate-limit continuation pending' };
            return { phase: 'pause-observed' as const, evidence: session.identity, detail: 'rate-limited' };
          }
        }
        if (session.turnDeadline !== null && config.now() >= session.turnDeadline) {
          config.io.save(replaceSession(config.io.load(), { ...session, deadlineHalt: { deadline: session.turnDeadline, at: config.now() } }));
          run(['kill-session', '-t', literalTarget(session.name)]);
          return { phase: 'exit-observed' as const, evidence: `safety-ceiling:deadline:${session.identity}`, detail: 'per-turn deadline exceeded', safetyDeadline: session.turnDeadline };
        }
        const baseline = session.turnBaseline ?? config.io.load().deliveries.filter(row => row.identity === session.identity).at(-1)?.baseline;
        // Record native retry progress, not a second retry engine. The current-turn record
        // prevents quoted error output without a real countdown from retiring the worker.
        const retry = config.framework === 'claude-code' && /\besc to interrupt\b/.test(tail(pane, 4))
          ? /^✻ 529 Overloaded · Retrying in \d+s · attempt ([1-9]|10)\/10$/m.exec(pane) : null;
        if (retry && session.turnStartedAt !== null && session.turnDeadline !== null && baseline && digestOf(pane) !== baseline) {
          const previous = session.connectionRetry?.turnStartedAt === session.turnStartedAt ? session.connectionRetry.attempt : 0;
          if (Number(retry[1]) > previous) config.io.save(replaceSession(config.io.load(), { ...session,
            connectionRetry: { turnStartedAt: session.turnStartedAt, attempt: Number(retry[1]) } }));
        }
        // Keep the original deadline and delivery. This is an uncertain terminal failure,
        // never a successful close or permission to replay a tool, send or owner input.
        if (config.framework === 'claude-code' && session.turnDeadline !== null
          && session.connectionRetry?.turnStartedAt === session.turnStartedAt
          && baseline && digestOf(pane) !== baseline && classifyConnectionExhausted(pane))
          return { phase: 'pause-observed' as const, evidence: session.identity, detail: 'connection-exhausted' };
        const idle = classifyPaneIdle(pane, config.framework) && (!baseline || digestOf(pane) !== baseline);
        const stuck = classifyStuckSignature(pane);
        if (stuck && idle && session.turnDeadline !== null) {
          config.io.save(replaceSession(config.io.load(), { ...session, closedAt: config.now(), turnDeadline: null }));
        }
        if (stuck && (stuck !== 'context-too-long' && stuck !== 'context-wedge' || idle))
          return { phase: 'pause-observed' as const, evidence: session.identity, detail: stuck };
        if (session.turnDeadline !== null && idle && !config.requireTurnHook) {
          config.io.save(replaceSession(config.io.load(), closeTurn(session, config.now())));
          return { phase: 'output-observed' as const, evidence: `pane-idle:${session.name}:${config.now()}`,
            detail: 'idle prompt fallback; turn close not independently verified' };
        }
        return { phase: 'launched' as const, evidence: session.identity, detail: 'session live; turn still open' };
      });
    },
    bootSweep(): Result<readonly string[]> {
      return lockedBoundary('ProductionSessionBootSweep', null, () => {
        checkStop(); reconcileReservations(); const outcomes: string[] = [];
        for (const row of config.io.load().deliveries.filter(value => value.state === 'prepared' || value.state === 'sending')) {
          const session = loadSession(row.identity);
          if (!alive(session.name)) { config.io.save(replaceDelivery(config.io.load(), { ...row, state: 'uncertain' })); outcomes.push(`${row.operation}:uncertain`); continue; }
          verifyLive(session);
          const pane = capture(session.name);
          // A send already started can have completed and returned to the same
          // prompt. An unchanged pane cannot prove non-arrival in that window.
          if (row.state !== 'prepared' || digestOf(pane) !== row.baseline
            || classifyPaneReadiness(pane) !== 'ready' || row.redeliveries !== 0) {
            config.io.save(replaceDelivery(config.io.load(), { ...row, state: 'uncertain' }));
            outcomes.push(`${row.operation}:uncertain`); continue;
          }
          try { armTurn(session, 0); } catch {
            outcomes.push(`${row.operation}:deadline-unavailable`); continue;
          }
          const sending: DeliveryRecord = { ...row, state: 'sending', redeliveries: 1 };
          config.io.save(replaceDelivery(config.io.load(), sending));
          try {
            sendText(session, row.text);
            config.io.save(replaceDelivery(config.io.load(), { ...sending, state: 'accepted', evidence: `tmux-input:${row.operation}` }));
            outcomes.push(`${row.operation}:redelivered`);
          } catch {
            config.io.save(replaceDelivery(config.io.load(), { ...sending, state: 'uncertain' }));
            outcomes.push(`${row.operation}:uncertain`);
          }
        }
        return outcomes;
      });
    },
    recoverDelivery(input: { operation: string; processIdentity: string; intake: string; digest: string; incarnation: string }): Result<string> {
      return lockedBoundary('ProductionSessionRecoverDelivery', input, () => {
        checkStop();
        const prior = config.io.load().deliveries.find(row => row.operation === input.operation);
        if (!prior) return take(api.deliver(input));
        ensure(prior.identity === input.processIdentity && prior.intake === input.intake && prior.digest === input.digest,
          'recovery operation differs from durable intake');
        if (prior.state === 'accepted') return prior.evidence;
        if (prior.state === 'prepared') {
          take(api.bootSweep());
          const after = config.io.load().deliveries.find(row => row.operation === input.operation);
          ensure(after?.state === 'accepted', 'delivery recovery remains uncertain');
          return after.evidence;
        }
        throw Error('delivery outcome uncertain; no automatic resend');
      });
    },
    stop,
    saveResume(identity: string, sessionId: string): Result<string> {
      return lockedBoundary('ProductionSessionResume', { identity, sessionId }, () => {
        const session = loadSession(identity);
        ensure(uuid.test(sessionId), 'invalid resume id');
        const journal = config.io.load();
        config.io.save({ ...journal, resumes: { ...journal.resumes, [session.claim]: sessionId } });
        return sessionId;
      });
    },
    recoverContext(identity: string, pending?: { operation: string; digest: string; deadline: number }): Result<string> {
      return boundary('ProductionSessionContextRecovery', identity, config.context, () => {
        const recovered = config.io.exclusive(() => {
          checkStop(); const session = loadSession(identity); verifyLive(session);
          const pane = capture(session.name);
          if (pending) {
            ensure(Number.isSafeInteger(pending.deadline) && pending.deadline > config.now(), 'context recovery deadline exhausted');
            const delivery = config.io.load().deliveries.find(row => row.operation === pending.operation);
            ensure(delivery?.state === 'accepted' && delivery.identity === identity && delivery.digest === pending.digest,
              'context recovery requires exact accepted intake; uncertain input is never replayed');
            if (session.recovery === 1) {
              ensure(session.continuation?.state === 'prepared' && session.continuation.pending?.operation === pending.operation,
                'context recovery already submitted or belongs to another input');
              if (!classifyPaneIdle(pane, config.framework)) return { identity: 'compacting', needsWait: false };
              const failed = /not enough messages to compact|error during compaction/i.test(tail(pane));
              const compacted = config.io.readInbox(session.name).some(row => row.kind === 'compact'
                && row.at >= (session.turnStartedAt ?? Infinity) && row.at <= config.now());
              if (!compacted) return { identity: failed ? 'replace-required' : 'compacting', needsWait: false };
              config.io.save(replaceSession(config.io.load(), { ...session, turnDeadline: null, closedAt: config.now() }));
              submitContinuation(identity);
              return { identity, needsWait: false };
            }
            ensure(session.turnDeadline === null && classifyPaneIdle(pane, config.framework), 'context recovery requires an idle prompt');
            ensure(['context-too-long', 'context-wedge'].includes(classifyStuckSignature(pane) ?? ''), 'no context wall evidence');
            const continuation = requireContinuation(pending.operation, session.claim, session.incarnation, 'context-wall', pending);
            const prepared = { ...session, continuation };
            config.io.save(replaceSession(config.io.load(), prepared));
            armTurn(prepared, 1);
            sendText(prepared, '/compact');
            return { identity: 'compact-requested', needsWait: false };
          }
          ensure(session.turnDeadline === null && classifyPaneIdle(pane, config.framework),
            'context recovery requires an idle prompt');
          const stuck = classifyStuckSignature(pane);
          ensure(stuck === 'context-too-long' || stuck === 'context-wedge', 'no context wall evidence');
          if (session.recovery === 0) {
            armTurn(session, 1);
            sendText(session, '/compact');
            return { identity: 'compact-requested', needsWait: false };
          }
          const continuation = requireContinuation(session.operation, session.claim, session.incarnation, 'context-wall');
          ensure(!config.protectedSessions.includes(session.name), 'protected session cannot be killed');
          const journal = config.io.load(); const resumes = { ...journal.resumes }; delete resumes[session.claim];
          config.io.save({ ...journal, resumes });
          run(['kill-session', '-t', literalTarget(session.name)]);
          const nextIdentity = spawn(session.operation, session.claim, session.incarnation, config.cwd, null, 0, continuation);
          submitContinuation(nextIdentity);
          return { identity: nextIdentity, needsWait: true };
        });
        if (recovered.needsWait) waitContinuation(recovered.identity);
        return recovered.identity;
      });
    },
  };
  return Object.freeze(api);
}

/** Registered conversation selection at the existing session-driver boundary. The default
 * terminal mapping and its flags remain unchanged. */
export function createProductionConversationAdapter(input: Parameters<typeof createSessionConversationAdapter>[0] & Readonly<{
  configuration(): ProductionSessionConfig; transport(): SessionProtocolIO; resumeKey?: string;
  beforeLaunch?(claim: string): void; afterLaunch?(): void;
}>): import('./contracts.js').HarnessAdapterPort<2> {
  return input.configuration().framework === 'codex-cli'
    ? createCodexConversationWorker({ ...input, transport: input.transport() }) : createSessionConversationAdapter(input);
}
