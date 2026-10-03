import { createHash, randomUUID } from 'node:crypto';
import { boundary, ensure, take } from './boundary.js';
import type { AssemblyDecodeContext, HarnessObservation } from './contracts.js';
import type { NativeHarnessDriverPort } from './harness.js';
import type { Result } from '../index.js';

/** Operator-own-use sessions with the harness's full tool set. `unconfined` makes no confinement claim;
 * `admitted` launches every session with the tool admission hook, so each tool call passes it before dispatch. */
export type SessionFramework = 'claude-code' | 'codex-cli';
export interface SessionRecord {
  readonly operation: string; readonly claim: string; readonly name: string; readonly identity: string;
  readonly incarnation: string; readonly startedAt: number; readonly resumeId: string | null;
  readonly recovery: 0 | 1; readonly turnDeadline: number | null; readonly turnStartedAt: number | null;
  readonly closedAt: number | null; readonly turnBaseline?: string; readonly turnReceiptIds?: readonly string[];
  readonly continuation?: SessionContinuation;
}
export interface SessionContinuation {
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
  /** Required exactly in `admitted` mode: the PreToolUse/PostToolUse command for a session's claim (its own
   * admission state), and the hook timeout. The harness runs it before every tool call, its subagents' too. */
  readonly toolAdmission?: Readonly<{ command: (claim: string, phase: 'pre' | 'post') => string; timeoutSeconds: number }>;
  /** The host's model-dispatch checkpoint for a claim: the base URL every model call of that claim's session is sent
   * to (`modelGateLaunch`), where it takes the step's reserved allowance before it is forwarded. Required in `admitted`
   * mode, so no admitted session can reach its model any other way. */
  readonly modelGate?: (claim: string) => string;
  /** The exact model the session runs, when a reviewed grant names one; absent, the CLI's own default. */
  readonly model?: string;
  readonly inboxDirectory?: string; readonly compactGroundingFile?: string;
  /** Must reconstruct complete permitted context from agent-owned records, including both sides of prior turns. */
  readonly continuation?: ((input: Readonly<{ operation: string; claim: string; incarnation: string;
    reason: 'cache-miss' | 'context-wall' }>) => Readonly<{ text: string; source: string }>) | undefined;
}

/** The flags of an operator-own-use session for each harness: every tool and no permission prompt. The
 * harness's own sandbox is not used; an `admitted` session's tool calls each pass the admission hook instead,
 * which confines every shell command itself. Codex runs a hook only after its source is trusted; the hook
 * here is this runner's own reviewed script, so an admitted Codex session trusts it for the invocation.
 * Exported so a reviewed grant can bind exactly what it admits. */
export function sessionLaunchFlags(framework: SessionFramework, admitted = false): readonly string[] {
  return framework === 'claude-code' ? ['--dangerously-skip-permissions']
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
    return ['--settings', JSON.stringify({ disableAllHooks: false,
      hooks: { ...extraClaudeHooks, PreToolUse: hook(pre), PostToolUse: hook(post) } })];
  }
  const hook = (command: string) => `[{matcher='*',hooks=[{type='command',command='${command}',timeout=${admission.timeoutSeconds}}]}]`;
  return ['-c', `hooks.PreToolUse=${hook(pre)}`, '-c', `hooks.PostToolUse=${hook(post)}`];
}
const modelPattern = /^[A-Za-z0-9][A-Za-z0-9._-]{0,80}$/u;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const namePattern = /^instar20-[a-f0-9]{24}$/;
const digestOf = (text: string) => `sha256:${createHash('sha256').update(text).digest('hex')}`;
const tail = (capture: string, lines = 12) => capture.split('\n').map(x => x.trim()).filter(Boolean).slice(-lines).join('\n');
const literalTarget = (name: string) => `=${name}:`;

/** 1.x classifier: a focused numbered menu wins over the prompt glyph. */
export function classifyPaneReadiness(capture: string): 'ready' | 'menu' | 'not-ready' {
  const text = tail(capture, 6);
  const options = text.split('\n').filter(line => /^\s*(?:[❯›>●○◉]\s*)?\d+[.)]\s/.test(line));
  if (options.length >= 2 && options.some(line => /^\s*[❯›>●○◉]\s*\d+[.)]\s/.test(line))) return 'menu';
  if (/[❯›]/.test(text) || /(?:bypass permissions|shift\+tab to cycle|ctrl\+c to exit)/i.test(text)) return 'ready';
  return 'not-ready';
}
/** A prompt can remain visible throughout work; only a changed, quiet idle frame closes a turn. */
export function classifyPaneIdle(capture: string, framework: SessionFramework): boolean {
  const lines = tail(capture, 8).split('\n');
  if (classifyPaneReadiness(capture) !== 'ready') return false;
  if (/(?:esc|ctrl\+c) to interrupt|\bworking(?:…|\.\.\.|\s*\()|\bgenerating\b|[⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏]/i.test(lines.join('\n'))) return false;
  const prompt = framework === 'codex-cli' ? /^[❯›>]\s*$/ : /^[❯›]\s*$/;
  const promptIndex = lines.map(line => prompt.test(line)).lastIndexOf(true);
  return promptIndex >= 0 && lines.slice(promptIndex + 1)
    .every(line => /^(?:bypass permissions|shift\+tab to cycle|\? for shortcuts|gpt-|tokens?\b)/i.test(line));
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
  if (/you'?ve (?:hit|reached) your (?:session|usage|5-hour) limit|usage limit reached|\blimit\b[^.\n]{0,30}\bresets?\b/i.test(live)) return 'rate-limited';
  if (/conversation (?:is )?too long|error during compaction[^.\n]{0,40}too long|press esc twice to go up a few messages/i.test(live)
    && !/conversation compacted|paused for context compaction|compaction[^.\n]{0,20}resumed/i.test(live)) return 'context-too-long';
  return null;
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

export function createProductionSessionDriver(config: ProductionSessionConfig): NativeHarnessDriverPort & Readonly<{
  bootSweep(): Result<readonly string[]>; stop(): Result<readonly string[]>;
  recoverDelivery(input: Readonly<{ operation: string; processIdentity: string; intake: string; digest: string; incarnation: string }>): Result<string>;
  saveResume(identity: string, sessionId: string): Result<string>;
  recoverContext(identity: string): Result<string>;
}> {
  ensure(config.operatorOwnUse === true && (config.confinement === 'unconfined' || config.confinement === 'admitted'),
    'explicit operator-own-use mode required');
  const admitted = config.confinement === 'admitted';
  ensure(admitted === (config.toolAdmission !== undefined), 'an admitted session requires its admission hook, and only it');
  ensure(admitted === (config.modelGate !== undefined), 'an admitted session requires its model-dispatch checkpoint, and only it');
  if (config.toolAdmission) ensure(typeof config.toolAdmission.command === 'function'
    && Number.isSafeInteger(config.toolAdmission.timeoutSeconds) && config.toolAdmission.timeoutSeconds > 0
    && config.toolAdmission.timeoutSeconds <= 3600, 'bounded admission hook required');
  ensure(Number.isSafeInteger(config.maxSessions) && config.maxSessions > 0 && config.maxSessions <= 16,
    'fixed concurrent session cap required');
  ensure(Number.isSafeInteger(config.turnDeadlineMs) && config.turnDeadlineMs > 0 && config.turnDeadlineMs <= 3_600_000,
    'bounded per-turn deadline required');
  ensure(config.framework === 'claude-code' || config.framework === 'codex-cli', 'supported session framework required');
  ensure(config.model === undefined || modelPattern.test(config.model), 'exact session model required');
  ensure(config.executable.startsWith('/') && config.cwd.startsWith('/') && config.home.startsWith('/')
    && config.configHome.startsWith('/'), 'exact executable and absolute paths required');
  if (config.hookScript) ensure(config.hookScript.startsWith('/') && config.inboxDirectory?.startsWith('/')
    && config.compactGroundingFile?.startsWith('/'), 'hook requires exact script, inbox, and compact grounding file');
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
        reservations: (current.reservations ?? []).filter(row => row.name !== reservation.name) });
    }
  };
  const armTurn = (session: SessionRecord, recovery = session.recovery): SessionRecord => {
    const started = config.now();
    const deadline = started + config.turnDeadlineMs;
    const armed = { ...session, recovery, turnStartedAt: started, turnDeadline: deadline, closedAt: null,
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
    const reservation: SessionReservation = { name, operation, claim, incarnation, resumeId, recovery,
      startedAt: config.now(), ...(continuation ? { continuation } : {}) };
    config.io.save({ ...currentJournal, reservations: [...(currentJournal.reservations ?? []), reservation] });
    const model = config.model === undefined ? [] : ['--model', config.model];
    const args = config.framework === 'claude-code'
      ? [resumeId ? '--resume' : '--session-id', resumeId ?? randomUUID(), ...sessionLaunchFlags('claude-code', admitted), ...model]
      : [ ...(resumeId ? ['resume', resumeId] : []), ...sessionLaunchFlags('codex-cli', admitted), ...model];
    const lifecycleHooks = config.hookScript && config.framework === 'claude-code'
      ? { Stop: [{ hooks: [{ type: 'command', command: `node ${JSON.stringify(config.hookScript)}` }] }],
        SessionStart: [{ matcher: 'compact', hooks: [{ type: 'command', command: `node ${JSON.stringify(config.hookScript)} compact` }] }] }
      : null;
    // One settings object carries every Claude hook: the admission hook and, when configured, the lifecycle hooks.
    if (config.toolAdmission) args.push(...admissionArgs(config.framework, config.toolAdmission, claim, lifecycleHooks ?? {}));
    else if (lifecycleHooks) args.push('--settings', JSON.stringify({ hooks: lifecycleHooks }));
    const gate = config.modelGate ? modelGateLaunch(config.framework, config.modelGate(claim)) : null;
    if (gate) args.push(...gate.args);
    const harnessEnv = [...(admitted && config.framework === 'claude-code' ? ADMITTED_CLAUDE_ENV : []), ...(gate?.env ?? [])];
    try { run(['new-session', '-d', '-s', name, '-c', config.cwd, '-x', '100', '-y', '30',
      '-e', `HOME=${config.home}`, '-e', `CLAUDE_CONFIG_DIR=${config.configHome}`,
      '-e', `CODEX_HOME=${config.configHome}`, '-e', `INSTAR_SESSION_NAME=${name}`,
      '-e', `INSTAR_SESSION_INBOX=${config.inboxDirectory ?? ''}`,
      '-e', `INSTAR_SESSION_GROUNDING_FILE=${config.compactGroundingFile ?? ''}`,
      '--', '/usr/bin/env', '-i', 'PATH=/usr/bin:/bin:/opt/homebrew/bin', `HOME=${config.home}`,
      `CLAUDE_CONFIG_DIR=${config.configHome}`, `CODEX_HOME=${config.configHome}`,
      `INSTAR_SESSION_NAME=${name}`, `INSTAR_SESSION_INBOX=${config.inboxDirectory ?? ''}`,
      `INSTAR_SESSION_GROUNDING_FILE=${config.compactGroundingFile ?? ''}`, ...harnessEnv,
      config.executable, ...args]); } catch (error) { reconcileReservations(); throw error; }
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
    reason: 'cache-miss' | 'context-wall'): SessionContinuation => {
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
    try { provided = config.continuation({ operation, claim, incarnation, reason }); }
    catch { return refuse('continuation provider failed'); }
    if (typeof provided?.text !== 'string' || !provided.text.trim()
      || typeof provided.source !== 'string' || !provided.source.trim())
      return refuse('complete agent-owned continuation unavailable');
    if (Buffer.byteLength(provided.text) > 128_000 || provided.source.length > 512)
      return refuse('continuation exceeds bounded context');
    return { text: provided.text, source: provided.source, state: 'prepared' };
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
    sendText(session, `Restore the following agent-owned context as prior history. Do not repeat any action or send on its behalf. `
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
  const stop = () => lockedBoundary('ProductionSessionStop', null, () => {
    reconcileReservations();
    const killed: string[] = [];
    for (const session of config.io.load().sessions) {
      if (config.protectedSessions.includes(session.name)) continue;
      if (alive(session.name)) { verifyLive(session); run(['kill-session', '-t', literalTarget(session.name)]); killed.push(session.name); }
    }
    return killed;
  });
  const api = {
    owner: 'part-eight' as const,
    launch(input: { operation: string; claim: string; artifact: string; incarnation: string; workingScope: string; handles: readonly string[] }) {
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
          const resumeId = journal.resumes[input.claim] ?? null;
          ensure(!resumeId || uuid.test(resumeId), 'invalid recorded resume id');
          const hit = resumeId !== null && config.io.transcriptExists(config.framework, resumeId, config.cwd, config.configHome);
          const needsContinuation = !hit && (resumeId !== null || journal.sessions.some(row => row.claim === input.claim));
          const continuation = needsContinuation
            ? requireContinuation(input.operation, input.claim, input.incarnation, 'cache-miss') : undefined;
          const identity = spawn(input.operation, input.claim, input.incarnation, input.workingScope,
            hit ? resumeId : null, 0, continuation);
          if (continuation) submitContinuation(identity);
          return identity;
        });
        waitContinuation(identity);
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
        armTurn(session);
        delivery = { ...delivery, state: 'sending' };
        config.io.save(replaceDelivery(config.io.load(), delivery));
        sendText(session, text);
        delivery = { ...delivery, state: 'accepted', evidence: `tmux-input:${input.operation}` };
        config.io.save(replaceDelivery(config.io.load(), delivery));
        return delivery.evidence;
      });
    },
    observe(input: { operation: string; processIdentity: string }): Result<Readonly<{ phase: HarnessObservation['phase']; evidence: string; detail: string }>> {
      return lockedBoundary('ProductionSessionObserve', input, () => {
        const session = loadSession(input.processIdentity);
        if (config.stopped()) { stop(); return { phase: 'exit-observed' as const, evidence: session.identity, detail: 'stop authority active' }; }
        if (!alive(session.name)) return { phase: 'exit-observed' as const, evidence: session.identity, detail: 'tmux session exited' };
        verifyLive(session);
        const pane = capture(session.name);
        const hook = config.io.readInbox(session.name).filter(row => row.kind === 'turn-closed'
          && (row.receiptId ? !session.turnReceiptIds?.includes(row.receiptId) : row.at > (session.turnStartedAt ?? Infinity))).at(-1);
        if (hook && session.turnStartedAt !== null && hook.at >= session.turnStartedAt
          && session.turnDeadline !== null && hook.at <= config.now()) {
          config.io.save(replaceSession(config.io.load(), closeTurn(session, hook.at)));
          if (uuid.test(hook.sessionId)) {
            const journal = config.io.load();
            config.io.save({ ...journal, resumes: { ...journal.resumes, [session.claim]: hook.sessionId } });
          }
          return { phase: 'output-observed' as const, evidence: `turn-closed:${session.name}:${hook.at}`,
            detail: 'Stop hook closed turn' };
        }
        if (session.turnDeadline !== null && config.now() >= session.turnDeadline) {
          run(['kill-session', '-t', literalTarget(session.name)]);
          return { phase: 'exit-observed' as const, evidence: session.identity, detail: 'per-turn deadline exceeded' };
        }
        const baseline = session.turnBaseline ?? config.io.load().deliveries.filter(row => row.identity === session.identity).at(-1)?.baseline;
        const idle = classifyPaneIdle(pane, config.framework) && (!baseline || digestOf(pane) !== baseline);
        const stuck = classifyStuckSignature(pane);
        if (stuck && idle && session.turnDeadline !== null) {
          config.io.save(replaceSession(config.io.load(), { ...session, closedAt: config.now(), turnDeadline: null }));
        }
        if (stuck) return { phase: 'pause-observed' as const, evidence: session.identity, detail: stuck };
        if (session.turnDeadline !== null && idle) {
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
          try { armTurn(session); } catch {
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
    recoverContext(identity: string): Result<string> {
      return boundary('ProductionSessionContextRecovery', identity, config.context, () => {
        const recovered = config.io.exclusive(() => {
          checkStop(); const session = loadSession(identity); verifyLive(session);
          const pane = capture(session.name);
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
