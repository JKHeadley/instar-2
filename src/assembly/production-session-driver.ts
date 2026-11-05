import { createCodexConversationWorker } from '../harness-adapters/index.js';
import { createSessionConversationAdapter } from './conversation-harness-adapter.js';
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
  readonly rateRecovery?: Readonly<{ dueAt: number; state: 'waiting' | 'sending' | 'accepted'; submittedAt?: number; fingerprint?: string | null }> | null;
  /** Observed native retry pressure, tied to this turn; call liability stays with the owner. */
  readonly connectionRetry?: Readonly<{ turnStartedAt: number; attempt: number }> | null;
  /** Bounded 1.x persisting-menu observation. A signal only: never authorization or a turn close. */
  readonly promptWait?: Readonly<{ digest: string; firstAt: number; lastAt: number; samples: number }> | null;
  readonly deadlineHalt?: Readonly<{ deadline: number; at: number }>;
  readonly staleObservation?: SessionStaleRecord;
  /** 1.x ActiveWorkSilenceSentinel neutral nudge: one bare Enter per open turn, recorded
   * durably before the keystroke so a host restart can never send it twice. */
  readonly nudge?: Readonly<{ at: number; turnStartedAt: number; fingerprint: string; reason: string }> | null;
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
export interface SessionProgressSnapshot {
  readonly transcriptSize: number | null; readonly transcriptTail: string | null;
  readonly descendantCpuSeconds: number | null; readonly mainProcessActive: boolean | null;
}
export interface SessionStaleSignal {
  readonly state: 'progress' | 'stalled' | 'unknown' | 'protected'; readonly episode: number;
  readonly lastProgressAt: number; readonly indeterminateStreak: number; readonly longIndeterminate: boolean; readonly windowMs: number;
}
export interface SessionStaleRecord extends SessionStaleSignal {
  readonly sampledAt: number; readonly snapshot: SessionProgressSnapshot; readonly prompt: string | null;
}
/** Adapted from 1.x StaleSessionBackstop. A signal for the existing supervisor, never disposal authority. */
export function advanceSessionStaleObservation(previous: SessionStaleRecord | undefined,
  input: Readonly<{ at: number; kind: 'job' | 'conversation'; protected: boolean; liveness: 'alive' | 'indeterminate';
    snapshot: SessionProgressSnapshot; prompt: string | null }>): SessionStaleRecord {
  const windowMs = (input.kind === 'job' ? 30 : 180) * 60_000;
  const base = { sampledAt: input.at, snapshot: input.snapshot, prompt: input.prompt, windowMs,
    lastProgressAt: previous?.lastProgressAt ?? input.at, episode: previous?.episode ?? 0,
    indeterminateStreak: 0, longIndeterminate: false };
  if (input.liveness === 'indeterminate') {
    // Observe at the inherited 120-second cadence: repeated reads cannot create fifteen probes.
    const streak = (previous?.indeterminateStreak ?? 0) + (!previous || input.at - previous.sampledAt >= 120_000 ? 1 : 0);
    return { ...base, sampledAt: !previous || input.at - previous.sampledAt >= 120_000 ? input.at : previous.sampledAt,
      indeterminateStreak: streak, longIndeterminate: streak >= 15, state: input.protected ? 'protected' : 'unknown' };
  }
  const current = input.snapshot, prior = previous?.snapshot;
  const transcriptProgress = prior && prior.transcriptSize !== null && current.transcriptSize !== null
    && current.transcriptSize - prior.transcriptSize >= 512 && current.transcriptTail !== null
    && current.transcriptTail !== prior.transcriptTail;
  const cpuProgress = input.kind === 'job'
    ? prior && prior.descendantCpuSeconds !== null && current.descendantCpuSeconds !== null
      && current.descendantCpuSeconds - prior.descendantCpuSeconds > 1
    : current.mainProcessActive === true;
  const promptProgress = previous && input.prompt !== null && previous.prompt !== null && input.prompt !== previous.prompt;
  const progress = !previous || previous.state === 'unknown' || transcriptProgress || cpuProgress || promptProgress;
  if (input.protected) return { ...base, state: 'protected', lastProgressAt: input.at };
  if (input.prompt === null && current.transcriptSize === null && current.descendantCpuSeconds === null)
    return { ...base, state: 'unknown' };
  if (progress) return { ...base, state: 'progress', lastProgressAt: input.at };
  // The inherited floors apply across the 120-second sampling interval, not
  // each fast owner poll. Retain the comparison baseline until it is due or a
  // meaningful advance crosses its floor, so subfloor real work accumulates.
  const sampled = previous && input.at - previous.sampledAt < 120_000
    ? { ...base, sampledAt: previous.sampledAt, snapshot: previous.snapshot } : base;
  const stale = input.at - sampled.lastProgressAt >= windowMs;
  return { ...sampled, state: stale ? 'stalled' : 'progress',
    episode: base.episode + (stale && previous?.state !== 'stalled' ? 1 : 0) };
}
const staleSignal = (record: SessionStaleRecord): SessionStaleSignal => ({ state: record.state, episode: record.episode,
  lastProgressAt: record.lastProgressAt, indeterminateStreak: record.indeterminateStreak,
  longIndeterminate: record.longIndeterminate, windowMs: record.windowMs });
export interface SessionControlPlaneSignal {
  readonly state: 'healthy' | 'degraded' | 'unknown'; readonly episode: number; readonly ewmaMs: number | null;
  readonly consecutiveSlowCycles: number; readonly ageMs: number; readonly escalations: number;
}
export interface SessionPhysicalObservation {
  readonly state: 'alive' | 'dead' | 'indeterminate'; readonly identity: string; readonly pane: string | null;
  readonly at: number; readonly reachable: boolean;
}
export type SessionObserveInput = Readonly<{ operation: string; processIdentity: string; resultAvailable?: boolean }>;
export type SessionObserveResult = Result<Readonly<{ phase: HarnessObservation['phase']; evidence: string; detail: string; safetyDeadline?: number; observationAvailable?: false }>>;
export interface SessionIO {
  exclusive<T>(run: () => T): T;
  tmux(args: readonly string[]): Readonly<{ code: number; stdout: string }>;
  sleep(ms: number): void;
  progressSnapshot?(framework: SessionFramework, id: string | null, cwd: string, configHome: string, identity: string): SessionProgressSnapshot;
  controlPlaneStatus?(): SessionControlPlaneSignal;
  retainedExposure?(identity: string): boolean;
  observeSession?(name: string, identity: string): Promise<SessionPhysicalObservation>;
  load(): SessionJournal;
  save(journal: SessionJournal): void;
  readInbox(name: string): readonly Readonly<{ kind: 'turn-closed' | 'compact'; sessionId: string; at: number; receiptId?: string }>[];
  /** Physical bridge terminal metadata; absent until a worker actually exits. */
  readTerminal?(name: string): Readonly<{ code: number | null; signal: string | null;
    workerExitClaim: Readonly<{ workerPid: number; code: number | null; signal: string | null }> | null }> | null;
  transcriptExists(framework: SessionFramework, id: string, cwd: string, configHome: string): boolean;
  armDeadline(name: string, identity: string, deadline: number): void;
}
/** Adapter-owned observations, never terminal content or authority to interrupt a worker. */
export interface SessionActivityObservation {
  readonly subject: string; readonly incarnation?: string; readonly launch?: string; readonly at: number; readonly progress: string | null; readonly wait: string | null;
  /** Absent on older adapters: cannot corroborate a stall. Idle is not proof of completion. */
  readonly activity?: 'active' | 'idle' | 'indeterminate' | 'unknown';
  readonly stale?: SessionStaleSignal; readonly controlPlane?: SessionControlPlaneSignal;
  /** 1.x StallTriageNurse typed-but-not-submitted frame for the open accepted turn: a signal only. */
  readonly typedUnsubmitted?: boolean;
}
/** Private full-context supervision evidence; never part of the public activity projection. */
export interface SessionRecoveryObservation extends SessionActivityObservation {
  readonly incarnation: string; readonly launch: string; readonly terminal: string;
}
export interface ProductionSessionConfig {
  readonly operatorOwnUse: true; readonly confinement: 'unconfined' | 'admitted'; readonly framework: SessionFramework;
  readonly executable: string; readonly cwd: string; readonly home: string; readonly configHome: string;
  /** Private writable scratch for shell temp files inside the admitted sandbox. */
  readonly scratchDir?: string;
  readonly context: AssemblyDecodeContext; readonly io: SessionIO; readonly now: () => number;
  readonly stopped: () => boolean; readonly resolveIntake: (id: string, digest: string) => string;
  readonly maxSessions: number; readonly turnDeadlineMs: number; readonly readyTimeoutMs: number;
  readonly protectedSessions: readonly string[]; readonly hookScript?: string;
  /** Advisory activity for registered work; a changed pane is activity, never proof of completion.
   * The owner records it in its existing work observation cycle. No terminal bytes leave this port. */
  readonly observeActivity?: (observation: SessionActivityObservation) => void;
  readonly observeRecovery?: (observation: SessionRecoveryObservation) => void;
  readonly workKind?: () => 'job' | 'conversation';
  /** Conversation replies require the authenticated lifecycle receipt, never pane heuristics. */
  readonly requireTurnHook?: boolean;
  /** Required exactly in `admitted` mode: the admission/completion command for a session's claim (its own
   * admission state), and the hook timeout. The harness runs it before every tool call, its subagents' too. */
  readonly toolAdmission?: Readonly<{ command: (claim: string, phase: 'pre' | 'post' | 'permission') => string; timeoutSeconds: number }>;
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
  const permission = framework === 'claude-code' ? admission.command(claim, 'permission') : pre;
  ensure([pre, post, permission].every(command => hookCommandPattern.test(command)), 'admission hook command must be plain');
  if (framework === 'claude-code') {
    const hook = (command: string) => [{ matcher: '*', hooks: [{ type: 'command', command, timeout: admission.timeoutSeconds }] }];
    // Failed calls have a separate completion event; the post command records that outcome distinctly.
    return ['--settings', JSON.stringify({ disableAllHooks: false,
      hooks: { ...extraClaudeHooks, PreToolUse: hook(pre), PermissionRequest: hook(permission), PostToolUse: hook(post), PostToolUseFailure: hook(post) } })];
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
/** PermissionPromptAutoResolver/PromptGate port: focused options at the genuine
 * bottom, with a blocking footer. This observes UI structure, never human intent.
 * Unknown and blanket menus remain visible too; no terminal bytes leave the adapter. */
export function classifyBlockingMenu(capture: string): boolean {
  if (classifyPaneActive(capture)) return false;
  const lines = capture.replace(/\x1b\[[0-9;]*m/g, '').split('\n').map(line => line.trim()).filter(Boolean).slice(-12);
  const option = /^(?:[┃│]\s*)?(?:[❯›>●○◉]\s*)?\d+(?:[.)]\s|\s*\([●○]\)\s)/u;
  const focused = /^(?:[┃│]\s*)?(?:[❯›>●○◉]\s*\d+[.)]\s|\d+\s*\([●○]\)\s)/u;
  const footer = /^(?:Esc to cancel|Enter to confirm · Esc to cancel|Press enter to continue|\d+\/\d+:select\b)/u;
  const last = lines.at(-1) ?? '';
  return lines.filter(line => option.test(line)).length >= 2
    && lines.slice(-6).some(line => focused.test(line)) && (option.test(last) || footer.test(last));
}

/** ActiveWorkSilenceSentinel A1: a visible input box is not an idle worker.
 * This is adapter evidence only (Rules 26/30/86), never a semantic stuck verdict. */
export function classifyPaneActive(capture: string): boolean {
  return /(?:esc|ctrl\+c) to interrupt|\bworking(?:…|\.\.\.|\s*\()|\bgenerating\b|[⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏]/i.test(tail(capture, 8));
}
/** Port of 1.x StallTriageNurse.detectTypedButNotSubmitted: the input box holds at least 20
 * characters after the last prompt glyph and no processing indicator is visible, the exact
 * frame left when a bracketed-paste delivery lost its trailing Enter. A structural signal only. */
export function classifyTypedUnsubmitted(capture: string, framework: SessionFramework): boolean {
  if (!capture || classifyPaneActive(capture) || classifyBlockingMenu(capture)) return false;
  const lines = tail(capture, 12).split('\n');
  const prompt = framework === 'codex-cli' ? /[❯›>]/u : /[❯›]/u;
  const index = lines.map(line => prompt.test(line)).lastIndexOf(true);
  if (index < 0) return false;
  // The inherited processing glyphs disqualify the frame only from the input line down: scrollback
  // above a quiet prompt always holds earlier tool and assistant markers.
  if (/⎿|✶|⏺|Coalescing|thinking|esc to interrupt/i.test(lines.slice(index).join('\n'))) return false;
  const line = lines[index]!, match = prompt.exec(line)!;
  const after = line.slice(match.index + match[0].length).trim();
  return after.length >= 20 && !/^(?:[─━]+|bypass permissions.*|shift\+tab to cycle.*|\? for shortcuts.*)$/iu.test(after);
}
/** A prompt can remain visible throughout work; only a changed, quiet idle frame closes a turn. */
export function classifyPaneIdle(capture: string, framework: SessionFramework): boolean {
  const lines = tail(capture, 8).split('\n').filter(line => !/^[─━]+$/u.test(line))
    .map(line => line.replace(/^⏵⏵\s*/u, ''));
  if (classifyPaneReadiness(capture) !== 'ready') return false;
  if (classifyPaneActive(capture)) return false;
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
export function classifyStuckSignature(capture: string): 'policy-wedge' | 'context-wedge' | 'rate-limited' | 'provider-throttled' | 'context-too-long' | null {
  const wedge = classifyWedgeTail(capture);
  if (wedge) return wedge === 'aup-rejection' ? 'policy-wedge' : 'context-wedge';
  const live = tail(capture);
  // A usage-percentage warning also names the reset time; only an actual limit hit pauses work.
  if (/you['’]?ve (?:hit|reached) your (?:(?:session|usage|5-hour|weekly) )?limit\b|usage limit reached/i.test(live)) return 'rate-limited';
  if (classifyProviderThrottle(capture)) return 'provider-throttled';
  if (/conversation (?:is )?too long|prompt is too long|error during compaction[^.\n]{0,40}too long|press esc twice to go up a few messages/i.test(live)
    && !/conversation compacted|paused for context compaction|compaction[^.\n]{0,20}resumed/i.test(live)) return 'context-too-long';
  return null;
}
/** Port of 1.x rateLimitDetection + IdleErrorClassifier: provider capacity is not
 * account quota. Only a terminal API frame qualifies; native retries still own work.
 * Completion remains the authenticated result/Stop pair, never this text signal. */
function classifyProviderThrottle(capture: string): boolean {
  const live = tail(capture, 20);
  if (/retrying in\s+\d+/i.test(live)) return false;
  const lines = live.split('\n');
  const prompt = lines.lastIndexOf('❯');
  if (prompt < 0 || !classifyPaneIdle(capture, 'claude-code')) return false;
  const output = lines.slice(0, prompt).filter(line => !/^[─━]+$/.test(line));
  // Like exhausted-connection frames below, discard only trailing native status,
  // here the completion decoration documented by the 1.x throttle incident.
  if (/^✻ Churned for \d+m \d+s$/u.test(output.at(-1) ?? '')) output.pop();
  return /^(?:⏺\s+|⎿\s+)?API Error: (?:Server is temporarily limiting requests \(not your usage limit\) · Rate limited|Repeated 529 Overloaded errors\. The API is at capacity\.)$/i.test(output.at(-1) ?? '');
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

/** One neutral Enter to the exact live worker (1.x ActiveWorkSilenceSentinel nudge). */
export type SessionNudgeInput = Readonly<{ processIdentity: string; claim: string; incarnation: string; reason: string }>;
export type SessionNudgeResult = Readonly<{ state: 'nudged' | 'refused'; evidence: string }>;
export type SessionRedeliverResult = Readonly<{ state: 'redelivered' | 'refused'; evidence: string }>;
export function createProductionSessionDriver(config: ProductionSessionConfig): NativeHarnessDriverPort & SessionStopPort & Readonly<{
  continuationReady(identity: string): Result<boolean>;
  observeAsync(input: SessionObserveInput): Promise<SessionObserveResult>;
  observeIdle(identity: string): Result<string | null>;
  bootSweep(): Result<readonly string[]>;
  recoverDelivery(input: Readonly<{ operation: string; processIdentity: string; intake: string; digest: string; incarnation: string }>): Result<string>;
  saveResume(identity: string, sessionId: string): Result<string>;
  recoverContext(identity: string, pending?: { operation: string; digest: string; deadline: number }): Result<string>;
  nudge(input: SessionNudgeInput): Result<SessionNudgeResult>;
  redeliver(input: Readonly<{ operation: string; processIdentity: string; intake: string; digest: string; incarnation: string }>): Result<SessionRedeliverResult>;
  recoverWorker(input: Readonly<{ operation: string; claim: string }>): Result<Readonly<{ identity: string; incarnation: string; deliveryDigest: string | null }> | null>;
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
      rateRecovery: null, promptWait: null, nudge: null,
      connectionRetry: null,
      turnBaseline: digestOf(capture(session.name)),
      turnReceiptIds: config.io.readInbox(session.name).filter(row => row.kind === 'turn-closed')
        .flatMap(row => row.receiptId ? [row.receiptId] : []) };
    config.io.save(replaceSession(config.io.load(), armed));
    config.io.armDeadline(session.name, session.identity, deadline);
    return armed;
  };
  const closeTurn = (session: SessionRecord, at: number): SessionRecord => ({ ...session,
    closedAt: at, turnDeadline: null, promptWait: null,
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
    // The stale backstop excludes long-unverifiable slots only from this UI/session
    // count. Six's original physical debit remains held; no CPU/memory/call allowance
    // is reclaimed, and protected sessions stay counted. Same-work retries above
    // still require affirmative liveness and cannot duplicate uncertain intake.
    const active = currentJournal.sessions.filter(row => !(row.staleObservation?.longIndeterminate
      && !config.protectedSessions.includes(row.name) && config.io.retainedExposure?.(row.identity) === true) && alive(row.name));
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
    const harnessEnv = [...(admitted && config.framework === 'claude-code' ? ADMITTED_CLAUDE_ENV : []),
      ...(admitted && config.scratchDir ? [`TMPDIR=${config.scratchDir}`, `CLAUDE_CODE_TMPDIR=${config.scratchDir}`, `TMUX_TMPDIR=${config.scratchDir}`] : []),
      ...(gate?.env ?? [])];
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
  // Observe once, then return to the host. The model checkpoint and signal handlers
  // run on that host's event loop; a synchronous wait here deadlocks restoration.
  const continuationReady = (identity: string): Result<boolean> =>
    lockedBoundary('ProductionSessionContinuationReady', identity, () => {
      checkStop();
      const session = loadSession(identity);
      const pending = session.continuation;
      if (!pending || pending.state === 'completed') return true;
      ensure(pending.state === 'accepted', 'continuation delivery uncertain or incomplete');
      const outcome = take(api.observe({ operation: `${session.operation}:continuation`, processIdentity: identity }));
      if (outcome.phase === 'output-observed') {
        ensure(loadSession(identity).continuation?.state === 'completed', 'continuation completion not recorded');
        return true;
      }
      ensure(outcome.phase === 'launched', `continuation did not complete: ${outcome.detail}`);
      return false;
    });
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
  const observeFrom = (input: SessionObserveInput, physical: SessionPhysicalObservation | null): SessionObserveResult => {
      return lockedBoundary('ProductionSessionObserve', input, () => {
        let session = loadSession(input.processIdentity);
        if (physical) ensure(physical.identity === session.identity && Number.isFinite(physical.at)
          && physical.at <= config.now() && config.now() - physical.at <= 9000,
          'stale or substituted session observation');
        if (config.stopped()) { stop(); return { phase: 'exit-observed' as const, evidence: session.identity, detail: 'stop authority active' }; }
        if (physical?.state === 'indeterminate') {
          const previous = session.staleObservation;
          const observed = advanceSessionStaleObservation(previous, { at: config.now(), kind: config.workKind?.() ?? 'conversation',
            protected: config.protectedSessions.includes(session.name), liveness: 'indeterminate', prompt: null,
            snapshot: { transcriptSize: null, transcriptTail: null, descendantCpuSeconds: null, mainProcessActive: null } });
          const stale = physical.reachable ? observed : { ...observed, indeterminateStreak: previous?.indeterminateStreak ?? 0,
            longIndeterminate: previous?.longIndeterminate ?? false };
          config.io.save(replaceSession(config.io.load(), { ...session, staleObservation: stale }));
          const controlPlane = config.io.controlPlaneStatus?.();
          try { config.observeActivity?.({ subject: session.claim, incarnation: session.incarnation, launch: session.identity,
            at: physical.at, progress: null, wait: null, activity: 'unknown', stale: staleSignal(stale), ...(controlPlane ? { controlPlane } : {}) }); }
          catch { /* Unknown observation does not acquire action authority. */ }
          return { phase: 'uncertain' as const, observationAvailable: false as const, evidence: session.identity,
            detail: 'session observation unavailable; worker state unknown' };
        }
        if (session.deadlineHalt) return { phase: 'exit-observed' as const, evidence: `safety-ceiling:deadline:${session.identity}`, detail: 'per-turn deadline exceeded; closure must be reconciled', safetyDeadline: session.deadlineHalt.deadline };
        if (physical ? physical.state === 'dead' : !alive(session.name)) {
          // A result may complete between the owner's final observation and exact retirement.
          // Only the current turn's authenticated receipt plus bounded nonempty result can
          // survive physical exit; process absence alone never manufactures completion.
          if (config.requireTurnHook && input.resultAvailable === true) {
            if (session.turnCloseEvidence)
              return { phase: 'output-observed' as const, evidence: session.turnCloseEvidence, detail: 'recorded Stop hook closed turn before exit' };
            const receipt = config.io.readInbox(session.name).filter(row => row.kind === 'turn-closed'
              && (row.receiptId ? !session.turnReceiptIds?.includes(row.receiptId) : row.at > (session.turnStartedAt ?? Infinity))).at(-1);
            if (receipt && session.turnStartedAt !== null && receipt.at >= session.turnStartedAt
              && session.turnDeadline !== null && receipt.at <= config.now() && receipt.at <= session.turnDeadline) {
              const evidence = `turn-closed:${session.name}:${receipt.at}`;
              config.io.save(replaceSession(config.io.load(), { ...closeTurn(session, receipt.at), turnCloseEvidence: evidence }));
              return { phase: 'output-observed' as const, evidence, detail: 'Stop hook and bounded result retained after exit' };
            }
          }
          const terminal = config.io.readTerminal?.(session.name);
          const worker = terminal?.workerExitClaim;
          const detail = terminal
            ? `tmux session exited; wrapper code=${String(terminal.code)} signal=${terminal.signal ?? 'none'}; unverified worker claim code=${String(worker?.code ?? 'unknown')} signal=${worker?.signal ?? 'unknown'}`
            : 'tmux session exited; terminal result unavailable';
          return { phase: 'exit-observed' as const, evidence: session.identity, detail };
        }
        if (physical) ensure(physical.identity === session.identity && physical.state === 'alive' && physical.pane !== null,
          'exact session observation unavailable');
        else verifyLive(session);
        const pane = physical?.pane ?? capture(session.name);
        const progressSnapshot = config.io.progressSnapshot?.(config.framework, session.resumeId, config.cwd, config.configHome, session.identity)
          ?? { transcriptSize: null, transcriptTail: null, descendantCpuSeconds: null, mainProcessActive: null };
        const stale = advanceSessionStaleObservation(session.staleObservation, { at: config.now(),
          kind: config.workKind?.() ?? 'conversation', protected: config.protectedSessions.includes(session.name),
          liveness: 'alive', snapshot: progressSnapshot,
          prompt: !pane.trim() ? null : classifyPaneActive(pane) ? 'active' : classifyPaneIdle(pane, config.framework) ? 'idle' : 'indeterminate' });
        session = { ...session, staleObservation: stale };
        config.io.save(replaceSession(config.io.load(), session));
        const controlPlane = config.io.controlPlaneStatus?.();
        // The typed-but-unsubmitted frame counts only for an open turn whose delivery was accepted.
        const typedUnsubmitted = session.turnDeadline !== null && session.closedAt === null
          && config.io.load().deliveries.filter(row => row.identity === session.identity).at(-1)?.state === 'accepted'
          && classifyTypedUnsubmitted(pane, config.framework);
        try {
          config.observeActivity?.({ stale: staleSignal(stale), ...(controlPlane ? { controlPlane } : {}), ...(typedUnsubmitted ? { typedUnsubmitted: true } : {}), subject: session.claim, incarnation: session.incarnation, launch: session.identity, at: physical?.at ?? config.now(), progress: pane.trim() ? digestOf(pane) : null,
            wait: classifyPaneActive(pane) ? null : classifyStuckSignature(pane),
            activity: !pane.trim() ? 'unknown' : classifyPaneActive(pane) ? 'active'
              : classifyPaneIdle(pane, config.framework) ? 'idle' : 'indeterminate' });
        } catch { /* An advisory observer cannot fail the worker; its last sample becomes stale/unknown. */ }
        try {
          config.observeRecovery?.({ stale: staleSignal(stale), ...(controlPlane ? { controlPlane } : {}), ...(typedUnsubmitted ? { typedUnsubmitted: true } : {}), subject: session.claim, incarnation: session.incarnation, launch: session.identity,
            terminal: pane, at: physical?.at ?? config.now(), progress: pane.trim() ? digestOf(pane) : null,
            wait: classifyPaneActive(pane) ? null : classifyStuckSignature(pane),
            activity: !pane.trim() ? 'unknown' : classifyPaneActive(pane) ? 'active'
              : classifyPaneIdle(pane, config.framework) ? 'idle' : 'indeterminate' });
        } catch { /* Private evidence failure cannot affect the worker. */ }
        const rate = session.rateRecovery;
        if (rate && session.turnDeadline !== null && config.now() >= session.turnDeadline) {
          config.io.save(replaceSession(config.io.load(), { ...session, deadlineHalt: { deadline: session.turnDeadline, at: config.now() } }));
          verifyLive(session);
          run(['kill-session', '-t', literalTarget(session.name)]);
          return { phase: 'exit-observed' as const, evidence: `safety-ceiling:deadline:${session.identity}`, detail: 'per-turn deadline exceeded', safetyDeadline: session.turnDeadline };
        }
        if (rate?.state === 'sending')
          return { phase: 'uncertain' as const, evidence: session.identity, detail: 'rate-limit continuation delivery uncertain; no resend' };
        if (config.requireTurnHook && session.turnCloseEvidence)
          return { phase: 'output-observed' as const, evidence: session.turnCloseEvidence, detail: 'recorded Stop hook closed turn' };
        const throttle = classifyStuckSignature(pane);
        const throttled = throttle === 'rate-limited' || throttle === 'provider-throttled';
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
        // 1.x Layer 3: repeated unsupported menus are observable, never a reason
        // to press Enter, end work, or borrow the underlying task's authority.
        const menu = session.turnDeadline !== null && config.now() < session.turnDeadline && session.closedAt === null && classifyBlockingMenu(pane);
        if (menu) {
          const fingerprint = digestOf(pane), now = config.now(), previous = session.promptWait;
          const wait = previous?.digest === fingerprint && previous.lastAt <= now
            ? { ...previous, lastAt: now, samples: Math.min(4, previous.samples + (now > previous.lastAt ? 1 : 0)) }
            : { digest: fingerprint, firstAt: now, lastAt: now, samples: 1 };
          config.io.save(replaceSession(config.io.load(), { ...session, promptWait: wait }));
          if (wait.samples >= 4 && now - wait.firstAt >= 5_000)
            return { phase: 'launched' as const, evidence: fingerprint, detail: 'harness menu needs exact authorization; no input sent' };
        } else if (session.promptWait) {
          config.io.save(replaceSession(config.io.load(), { ...session, promptWait: null }));
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
              rateRecovery: { dueAt: config.now() + 30_000, state: 'waiting', fingerprint: digestOf(pane) },
              turnReceiptIds: config.io.readInbox(session.name).filter(row => row.kind === 'turn-closed')
                .flatMap(row => row.receiptId ? [row.receiptId] : []), turnStartedAt: config.now() }));
            return { phase: 'launched' as const, evidence: session.identity, detail: 'rate-limit recovery waiting' };
          }
          if (rate?.state === 'waiting' && !throttled && rate.fingerprint !== null)
            config.io.save(replaceSession(config.io.load(), { ...session,
              rateRecovery: { ...rate, fingerprint: null, dueAt: config.now() + 30_000 } }));
          if (rate?.state === 'waiting' && throttled) {
            // Port of SessionWatchdog/evaluateThrottleSettle: intervening output or an
            // active frame restarts corroboration. The original deadline never moves.
            // Legacy waiting records lack a fingerprint and must observe afresh too.
            const fingerprint = throttled && classifyPaneIdle(pane, config.framework) ? digestOf(pane) : null;
            if (fingerprint === null || fingerprint !== rate.fingerprint) {
              if (fingerprint !== rate.fingerprint) config.io.save(replaceSession(config.io.load(), { ...session,
                rateRecovery: { ...rate, fingerprint, dueAt: config.now() + 30_000 } }));
              return { phase: 'launched' as const, evidence: session.identity, detail: 'rate-limit recovery waiting' };
            }
            if (config.now() < rate.dueAt)
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
            return { phase: 'pause-observed' as const, evidence: session.identity, detail: throttle! };
          }
        }
        if (session.turnDeadline !== null && config.now() >= session.turnDeadline) {
          config.io.save(replaceSession(config.io.load(), { ...session, deadlineHalt: { deadline: session.turnDeadline, at: config.now() } }));
          verifyLive(session);
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
          // SocketDisconnectSentinel's bounded-wait signal, behind this harness adapter.
          // Native backoff owns recovery; a second Enter/nudge could repeat effects.
          return { phase: 'launched' as const, evidence: session.identity, detail: 'connection recovery waiting' };
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
  };
  const api = {
    owner: 'part-eight' as const,
    continuationReady,
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
    observe(input: SessionObserveInput): SessionObserveResult { return observeFrom(input, null); },
    async observeAsync(input: SessionObserveInput): Promise<SessionObserveResult> {
      if (!config.io.observeSession) return observeFrom(input, null);
      const session = config.io.load().sessions.find(row => row.identity === input.processIdentity);
      if (!session || config.stopped()) return observeFrom(input, null);
      let physical: SessionPhysicalObservation;
      try { physical = await config.io.observeSession(session.name, session.identity); }
      catch { physical = { state: 'indeterminate', identity: session.identity, pane: null, at: config.now(), reachable: false }; }
      return observeFrom(input, physical);
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
    /** 1.x ActiveWorkSilenceSentinel nudge: one bare Enter to the exact live worker of an open accepted
     * turn. Refused while the frame generates, shows a menu or a wait signature, while a continuation or
     * throttle recovery owns the turn, and after one nudge for the same turn. The record is durable before
     * the keystroke. It is input under the admitted delivery's own principal, never a new authority. */
    nudge(input: SessionNudgeInput): Result<SessionNudgeResult> {
      return lockedBoundary('ProductionSessionNudge', input, () => {
        checkStop();
        const session = loadSession(input.processIdentity);
        ensure(session.claim === input.claim && session.incarnation === input.incarnation && input.reason.trim().length > 0,
          'nudge target differs from the admitted worker');
        const refuse = (evidence: string): SessionNudgeResult => ({ state: 'refused', evidence });
        if (config.protectedSessions.includes(session.name)) return refuse('protected session is never nudged');
        if (session.deadlineHalt || session.turnDeadline === null || session.closedAt !== null || session.turnStartedAt === null
          || config.now() >= session.turnDeadline) return refuse('no open admitted turn; nothing to nudge');
        if (session.continuation && session.continuation.state !== 'completed') return refuse('continuation delivery pending; no nudge');
        if (session.rateRecovery) return refuse('throttle continuation owns this turn; no nudge');
        if (config.io.load().deliveries.filter(row => row.identity === session.identity).at(-1)?.state !== 'accepted')
          return refuse('delivery outcome is not accepted; no nudge');
        if (session.nudge && session.nudge.turnStartedAt === session.turnStartedAt) return refuse('one neutral nudge per turn already sent');
        verifyLive(session);
        const pane = capture(session.name);
        if (classifyPaneActive(pane)) return refuse('worker is generating; a nudge would be noise');
        if (classifyBlockingMenu(pane)) return refuse('harness menu needs exact authorization; no input sent');
        if (classifyStuckSignature(pane)) return refuse('wait signature owns this frame; native recovery, not a nudge');
        const fingerprint = digestOf(pane);
        config.io.save(replaceSession(config.io.load(), { ...session,
          nudge: { at: config.now(), turnStartedAt: session.turnStartedAt, fingerprint, reason: input.reason } }));
        checkStop(); verifyLive(session);
        run(['send-keys', '-t', literalTarget(session.name), 'Enter']);
        return { state: 'nudged', evidence: `nudge:${session.name}:${fingerprint}` };
      });
    },
    /** 1.x TriageOrchestrator reinject_message: the exact accepted delivery, redelivered at most once
     * (the existing `redeliveries` bound), only at a quiet idle prompt with no receipt for its turn.
     * The record turns `sending` before any input; a crash there is a boot-sweep uncertainty, never a resend. */
    redeliver(input: { operation: string; processIdentity: string; intake: string; digest: string; incarnation: string }): Result<SessionRedeliverResult> {
      return lockedBoundary('ProductionSessionRedeliver', input, () => {
        checkStop();
        const session = loadSession(input.processIdentity);
        ensure(input.incarnation === session.incarnation && input.operation && input.intake, 'stale or empty redelivery');
        const refuse = (evidence: string): SessionRedeliverResult => ({ state: 'refused', evidence });
        const prior = config.io.load().deliveries.find(row => row.operation === input.operation);
        if (!prior) return refuse('no recorded delivery to redeliver');
        ensure(prior.identity === input.processIdentity && prior.intake === input.intake && prior.digest === input.digest,
          'redelivery operation differs from durable intake');
        if (prior.state !== 'accepted') return refuse('delivery outcome is not accepted; the boot sweep owns prepared and sending records');
        if (prior.redeliveries !== 0) return refuse('one redelivery per delivery already used');
        if (config.protectedSessions.includes(session.name)) return refuse('protected session is never redelivered to');
        if (session.deadlineHalt || session.turnDeadline === null || session.closedAt !== null || config.now() >= session.turnDeadline)
          return refuse('no open admitted turn; nothing to redeliver');
        if (session.continuation && session.continuation.state !== 'completed') return refuse('continuation delivery pending; no redelivery');
        if (session.rateRecovery) return refuse('throttle continuation owns this turn; no redelivery');
        verifyLive(session);
        const pane = capture(session.name);
        if (classifyTypedUnsubmitted(pane, config.framework)) return refuse('input typed but not submitted; the neutral nudge is the exact repair');
        if (!classifyPaneIdle(pane, config.framework) || classifyStuckSignature(pane)) return refuse('worker is not at a quiet idle prompt; the delivery may still be in flight');
        const receipt = config.io.readInbox(session.name).filter(row => row.kind === 'turn-closed'
          && (row.receiptId ? !session.turnReceiptIds?.includes(row.receiptId) : row.at > (session.turnStartedAt ?? Infinity))).at(-1);
        if (receipt) return refuse('a turn receipt exists for this delivery; observe it instead of redelivering');
        const text = config.resolveIntake(input.intake, input.digest);
        ensure(digestOf(text) === input.digest, 'intake bytes differ from admitted digest');
        const sending: DeliveryRecord = { ...prior, state: 'sending', redeliveries: 1, baseline: digestOf(pane) };
        config.io.save(replaceDelivery(config.io.load(), sending));
        armTurn(loadSession(input.processIdentity), 0);
        sendText(loadSession(input.processIdentity), text);
        const evidence = `tmux-input:${input.operation}:redelivered`;
        config.io.save(replaceDelivery(config.io.load(), { ...sending, state: 'accepted', evidence }));
        return { state: 'redelivered', evidence };
      });
    },
    /** 1.x StaleSessionBackstop/ResumeQueue restoration lookup: the one live, identity-verified worker a
     * registered claim still owns after a host restart, with its accepted delivery digest. Ambiguity,
     * a halted worker or a protected session yields null; this never launches, sends or stops. */
    recoverWorker(input: { operation: string; claim: string }): Result<Readonly<{ identity: string; incarnation: string; deliveryDigest: string | null }> | null> {
      return lockedBoundary('ProductionSessionRecoverWorker', input, () => {
        checkStop(); reconcileReservations();
        const journal = config.io.load();
        const rows = journal.sessions.filter(row => row.operation === input.operation && row.claim === input.claim
          && namePattern.test(row.name) && alive(row.name));
        if (rows.length !== 1) return null;
        const session = rows[0]!;
        if (session.deadlineHalt || config.protectedSessions.includes(session.name)) return null;
        verifyLive(session);
        const delivery = journal.deliveries.find(row => row.operation === input.operation && row.identity === session.identity);
        return { identity: session.identity, incarnation: session.incarnation,
          deliveryDigest: delivery?.state === 'accepted' ? delivery.digest : null };
      });
    },
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
              if (!classifyPaneIdle(pane, config.framework)) return 'compacting';
              const failed = /not enough messages to compact|error during compaction/i.test(tail(pane));
              const compacted = config.io.readInbox(session.name).some(row => row.kind === 'compact'
                && row.at >= (session.turnStartedAt ?? Infinity) && row.at <= config.now());
              if (!compacted) return failed ? 'replace-required' : 'compacting';
              config.io.save(replaceSession(config.io.load(), { ...session, turnDeadline: null, closedAt: config.now() }));
              submitContinuation(identity);
              return identity;
            }
            ensure(session.turnDeadline === null && classifyPaneIdle(pane, config.framework), 'context recovery requires an idle prompt');
            ensure(['context-too-long', 'context-wedge'].includes(classifyStuckSignature(pane) ?? ''), 'no context wall evidence');
            const continuation = requireContinuation(pending.operation, session.claim, session.incarnation, 'context-wall', pending);
            const prepared = { ...session, continuation };
            config.io.save(replaceSession(config.io.load(), prepared));
            armTurn(prepared, 1);
            sendText(prepared, '/compact');
            return 'compact-requested';
          }
          ensure(session.turnDeadline === null && classifyPaneIdle(pane, config.framework),
            'context recovery requires an idle prompt');
          const stuck = classifyStuckSignature(pane);
          ensure(stuck === 'context-too-long' || stuck === 'context-wedge', 'no context wall evidence');
          if (session.recovery === 0) {
            armTurn(session, 1);
            sendText(session, '/compact');
            return 'compact-requested';
          }
          const continuation = requireContinuation(session.operation, session.claim, session.incarnation, 'context-wall');
          ensure(!config.protectedSessions.includes(session.name), 'protected session cannot be killed');
          const journal = config.io.load(); const resumes = { ...journal.resumes }; delete resumes[session.claim];
          config.io.save({ ...journal, resumes });
          run(['kill-session', '-t', literalTarget(session.name)]);
          const nextIdentity = spawn(session.operation, session.claim, session.incarnation, config.cwd, null, 0, continuation);
          submitContinuation(nextIdentity);
          return nextIdentity;
        });
        return recovered;
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
