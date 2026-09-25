import { createHash, randomUUID } from 'node:crypto';
import {
  closeSync, cpSync, existsSync, fsyncSync, lstatSync, mkdirSync, openSync, readFileSync, readdirSync,
  realpathSync, renameSync, writeFileSync,
} from 'node:fs';
import { encoded, stage2Activation, stage2InvocationBinding, subscriptionInvocationPolicy } from './stage2-provider.js';
import type { SubscriptionActivationRecord } from '../../src/assembly/production-provider.js';
import type { ProviderSubscriptionProfile } from '../../src/assembly/provider-credential-custodian.js';
import { dirname, join, resolve } from 'node:path';

export const PREVIEW_STATE_VERSION = 3 as const;
export const MAX_PREVIEW_ERROR_LIMIT = 10_000 as const;
export const MAX_PREVIEW_TOTAL_ERROR_LIMIT = 1_000_000 as const;

export type PreviewIntakeDisposition =
  | 'admitted-bound' | 'admitted-unbound' | 'held' | 'stopped' | 'refused' | 'preserved-unresolved';
export type PreviewTurnPhase =
  | 'intake-preserved' | 'grounded' | 'dispatch-outcome-unknown' | 'api-accepted'
  | 'ignored-out-of-scope' | 'held-or-refused';

export interface PreviewTurn {
  readonly id: string;
  readonly updateId: number;
  readonly route: Readonly<{ channel: string; sender: string; identityEpoch: string; eventId: string | null }>;
  readonly receipt: string;
  readonly preserved: string;
  readonly disposition: PreviewIntakeDisposition;
  readonly phase: PreviewTurnPhase;
  readonly contextReferences: readonly string[];
  readonly contextDigest: string;
  readonly runEvidence: string;
  readonly replyOperation: string;
  readonly replyObservation: string;
  readonly failureClass?: 'limit' | 'policy' | 'timeout' | 'transport' | 'unknown';
  readonly resetHint?: string | null;
  readonly recordedAt: number;
}

export interface PreviewStateDocument {
  readonly version: typeof PREVIEW_STATE_VERSION;
  readonly trial: Readonly<{ id: string; configurationDigest: string; createdAt: number; expiresAt: number;
    maxPendingTurns: number; maxTrialTurns: number; errorLimit: number; totalErrorLimit: number }>;
  readonly cursor: Readonly<{ nextOffset: number }>;
  readonly stop: null | Readonly<{ latchedAt: number; reason: 'operator' | 'signal' | 'expiry' | 'breaker' | 'capacity' }>;
  readonly consecutiveErrors: number;
  readonly totalErrors: number;
  readonly limitHoldUntil: number | null;
  readonly cycle: null | Readonly<{ at: number; pid: number }>;
  readonly replyWindow: Readonly<{ startedAt: number; count: number }>;
  readonly turns: Readonly<Record<string, PreviewTurn>>;
}

export interface PreviewStateOptions {
  readonly root: string;
  readonly configuration: unknown;
  readonly expiresAt: number;
  readonly now?: () => number;
  readonly replyLimit: number;
  readonly replyWindowMs: number;
  readonly errorLimit: number;
  readonly totalErrorLimit: number;
  readonly maxPendingTurns: number;
  readonly maxTrialTurns: number;
  readonly create?: boolean;
}

const digest = (input: unknown): string =>
  `sha256:${createHash('sha256').update(JSON.stringify(input)).digest('hex')}`;

function assertInteger(input: number, label: string, minimum = 0, maximum = Number.MAX_SAFE_INTEGER): void {
  if (!Number.isSafeInteger(input) || input < minimum || input > maximum) throw new Error(`preview state: invalid ${label}`);
}

function validate(document: PreviewStateDocument): PreviewStateDocument {
  if (document.version !== PREVIEW_STATE_VERSION || typeof document.trial?.id !== 'string'
    || !/^sha256:[a-f0-9]{64}$/u.test(document.trial?.configurationDigest ?? '')
    || typeof document.turns !== 'object' || document.turns === null) {
    throw new Error('preview state: corrupt or unsupported state');
  }
  assertInteger(document.trial.createdAt, 'createdAt');
  assertInteger(document.trial.expiresAt, 'expiresAt', 1);
  assertInteger(document.trial.maxPendingTurns, 'max pending turns', 1);
  assertInteger(document.trial.maxTrialTurns, 'max trial turns', 1);
  assertInteger(document.trial.errorLimit, 'error limit', 1, MAX_PREVIEW_ERROR_LIMIT);
  assertInteger(document.trial.totalErrorLimit, 'total error limit', 1, MAX_PREVIEW_TOTAL_ERROR_LIMIT);
  assertInteger(document.cursor.nextOffset, 'cursor offset');
  assertInteger(document.consecutiveErrors, 'consecutiveErrors', 0, MAX_PREVIEW_ERROR_LIMIT);
  assertInteger(document.totalErrors, 'totalErrors', 0, MAX_PREVIEW_TOTAL_ERROR_LIMIT);
  if (document.limitHoldUntil !== null && document.limitHoldUntil !== undefined) assertInteger(document.limitHoldUntil, 'limit hold');
  if (document.cycle !== null && document.cycle !== undefined) {
    assertInteger(document.cycle.at, 'cycle stamp'); assertInteger(document.cycle.pid, 'cycle pid', 1);
  }
  assertInteger(document.replyWindow.startedAt, 'reply window start');
  assertInteger(document.replyWindow.count, 'reply window count');
  for (const turn of Object.values(document.turns)) {
    if (turn.failureClass !== undefined && !['limit', 'policy', 'timeout', 'transport', 'unknown'].includes(turn.failureClass))
      throw new Error('preview state: invalid failure class');
    if (turn.resetHint !== undefined && turn.resetHint !== null && !/^\d{1,2}:\d{2}(?:am|pm)$/.test(turn.resetHint))
      throw new Error('preview state: invalid reset hint');
  }
  return document;
}

export function durablePreviewWrite(path: string, document: unknown): void {
  const directory = dirname(path);
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  const temporary = join(directory, `.preview-state-${randomUUID()}.pending`);
  const descriptor = openSync(temporary, 'wx', 0o600);
  try { writeFileSync(descriptor, JSON.stringify(document), 'utf8'); fsyncSync(descriptor); }
  finally { closeSync(descriptor); }
  renameSync(temporary, path);
  const directoryDescriptor = openSync(directory, 'r');
  try { fsyncSync(directoryDescriptor); } finally { closeSync(directoryDescriptor); }
}

export function previewTurnId(botId: string, updateId: number): string {
  assertInteger(updateId, 'update id');
  return `telegram:${botId}:update:${String(updateId)}`;
}

const pendingPhase = (phase: PreviewTurnPhase) => phase === 'intake-preserved' || phase === 'grounded';

export function openPreviewState(options: PreviewStateOptions) {
  const root = resolve(options.root);
  if (root !== options.root) throw new Error('preview state: canonical absolute root required');
  assertInteger(options.expiresAt, 'expiry', 1);
  assertInteger(options.replyLimit, 'reply limit', 1);
  assertInteger(options.replyWindowMs, 'reply window', 1);
  assertInteger(options.errorLimit, 'error limit', 1, MAX_PREVIEW_ERROR_LIMIT);
  assertInteger(options.totalErrorLimit, 'total error limit', 1, MAX_PREVIEW_TOTAL_ERROR_LIMIT);
  if (options.totalErrorLimit < options.errorLimit) throw new Error('preview state: total error limit is below consecutive limit');
  assertInteger(options.maxPendingTurns, 'max pending turns', 1);
  assertInteger(options.maxTrialTurns, 'max trial turns', 1);
  if (options.maxPendingTurns > options.maxTrialTurns) throw new Error('preview state: pending bound exceeds trial bound');
  mkdirSync(root, { recursive: true, mode: 0o700 });
  if (realpathSync(root) !== root || lstatSync(root).isSymbolicLink()) throw new Error('preview state: substituted root refused');
  const path = join(root, 'preview-state.json');
  const stopPath = join(root, 'preview-stop.json');
  const now = options.now ?? Date.now;
  const configurationDigest = digest(options.configuration);
  if (existsSync(path)) {
    const legacy = JSON.parse(readFileSync(path, 'utf8')) as any;
    if (legacy.version === 2) {
      if (typeof legacy.trial?.id !== 'string' || !/^sha256:[a-f0-9]{64}$/u.test(legacy.trial?.configurationDigest ?? '')
        || typeof legacy.turns !== 'object' || legacy.turns === null) throw new Error('preview state: corrupt legacy state');
      assertInteger(legacy.consecutiveErrors, 'legacy error count', 0, MAX_PREVIEW_TOTAL_ERROR_LIMIT);
      if (legacy.trial.configurationDigest !== configurationDigest || legacy.trial.expiresAt !== options.expiresAt
        || legacy.trial.maxPendingTurns !== options.maxPendingTurns
        || legacy.trial.maxTrialTurns !== options.maxTrialTurns) {
        throw new Error('preview state: immutable legacy trial configuration differs');
      }
      const migrated = { ...legacy, version: PREVIEW_STATE_VERSION,
        trial: { ...legacy.trial, errorLimit: options.errorLimit, totalErrorLimit: options.totalErrorLimit },
        consecutiveErrors: 0, totalErrors: legacy.consecutiveErrors };
      durablePreviewWrite(path, validate(migrated));
      if (migrated.totalErrors >= options.totalErrorLimit && !existsSync(stopPath)) {
        durablePreviewWrite(stopPath, { latchedAt: now(), reason: 'breaker' as const });
      }
    }
  }
  const read = (): PreviewStateDocument => {
    const document = validate(JSON.parse(readFileSync(path, 'utf8')) as PreviewStateDocument);
    if (!existsSync(stopPath)) return { ...document, limitHoldUntil: document.limitHoldUntil ?? null, cycle: document.cycle ?? null };
    const stop = JSON.parse(readFileSync(stopPath, 'utf8')) as NonNullable<PreviewStateDocument['stop']>;
    assertInteger(stop.latchedAt, 'stop latch');
    if (!['operator', 'signal', 'expiry', 'breaker', 'capacity'].includes(stop.reason)) throw new Error('preview state: corrupt stop latch');
    return { ...document, stop, limitHoldUntil: document.limitHoldUntil ?? null, cycle: document.cycle ?? null };
  };
  if (!existsSync(path)) {
    if (options.create === false) throw new Error('preview state: trial identity is absent');
    if (readdirSync(root).length > 0) throw new Error('preview state: established root is missing its trial identity');
    const instant = now();
    assertInteger(instant, 'clock');
    if (options.expiresAt <= instant) throw new Error('preview state: trial already expired');
    durablePreviewWrite(path, { version: PREVIEW_STATE_VERSION,
      trial: { id: `preview-trial:${randomUUID()}`, configurationDigest, createdAt: instant,
        expiresAt: options.expiresAt, maxPendingTurns: options.maxPendingTurns, maxTrialTurns: options.maxTrialTurns,
        errorLimit: options.errorLimit, totalErrorLimit: options.totalErrorLimit },
      cursor: { nextOffset: 0 }, stop: null, consecutiveErrors: 0, totalErrors: 0, limitHoldUntil: null, cycle: null,
      replyWindow: { startedAt: instant, count: 0 }, turns: {} });
  }
  const initial = read();
  if (initial.trial.configurationDigest !== configurationDigest || initial.trial.expiresAt !== options.expiresAt
    || initial.trial.maxPendingTurns !== options.maxPendingTurns || initial.trial.maxTrialTurns !== options.maxTrialTurns
    || initial.trial.errorLimit !== options.errorLimit || initial.trial.totalErrorLimit !== options.totalErrorLimit) {
    throw new Error('preview state: immutable trial configuration differs');
  }

  const mutate = (change: (current: PreviewStateDocument) => PreviewStateDocument): PreviewStateDocument => {
    const current = read();
    if (current.trial.configurationDigest !== configurationDigest) throw new Error('preview state: trial identity changed');
    const next = validate(change(current));
    const latest = read();
    const merged = latest.stop !== null && next.stop === null ? { ...next, stop: latest.stop } : next;
    durablePreviewWrite(path, merged);
    return read();
  };
  const latchStop = (reason: NonNullable<PreviewStateDocument['stop']>['reason']) => {
    if (!existsSync(stopPath)) durablePreviewWrite(stopPath, { latchedAt: now(), reason });
    return mutate(current => ({ ...current, stop: read().stop }));
  };
  const gate = (point: 'poll' | 'admit' | 'dispatch'): PreviewStateDocument => {
    let current = read();
    const instant = now(); assertInteger(instant, 'clock');
    if (instant >= current.trial.expiresAt && current.stop === null) current = latchStop('expiry');
    if (current.stop !== null) throw new Error(`preview stopped before ${point}`);
    return current;
  };
  const gatePollCapacity = (maximumBatch: number): PreviewStateDocument => {
    assertInteger(maximumBatch, 'maximum batch', 1);
    const current = gate('poll');
    const pending = Object.values(current.turns).filter(turn => pendingPhase(turn.phase)).length;
    if (Object.keys(current.turns).length + maximumBatch > current.trial.maxTrialTurns
      || pending + maximumBatch > current.trial.maxPendingTurns) {
      latchStop('capacity');
      throw new Error('preview stopped before poll: durable trial capacity reached');
    }
    return current;
  };
  const recordIntake = (turn: Omit<PreviewTurn, 'phase' | 'contextReferences' | 'contextDigest' | 'runEvidence'
    | 'replyOperation' | 'replyObservation' | 'recordedAt'>): PreviewStateDocument => mutate(current => {
      const existing = current.turns[turn.id];
      if (existing) {
        if (existing.updateId !== turn.updateId || JSON.stringify(existing.route) !== JSON.stringify(turn.route)
          || existing.disposition !== turn.disposition) throw new Error('preview state: semantic turn identity collision');
        return current;
      }
      if (Object.keys(current.turns).length >= current.trial.maxTrialTurns) throw new Error('preview state: durable trial bound exceeded');
      const active = Object.values(current.turns).filter(row => pendingPhase(row.phase)).length;
      const eligible = turn.disposition === 'admitted-bound';
      if (eligible && active >= current.trial.maxPendingTurns) throw new Error('preview state: durable pending bound exceeded');
      const phase: PreviewTurnPhase = eligible ? 'intake-preserved'
        : turn.disposition === 'admitted-unbound' ? 'ignored-out-of-scope' : 'held-or-refused';
      const recorded: PreviewTurn = { ...turn, phase, contextReferences: [], contextDigest: '', runEvidence: '',
        replyOperation: '', replyObservation: '', recordedAt: now() };
      return { ...current, turns: { ...current.turns, [turn.id]: recorded } };
    });
  const advance = (id: string, expected: PreviewTurnPhase, phase: PreviewTurnPhase,
    fields: Partial<Pick<PreviewTurn, 'contextReferences' | 'contextDigest' | 'runEvidence'
      | 'replyOperation' | 'replyObservation'>> = {}) => mutate(current => {
      const existing = current.turns[id];
      if (!existing) throw new Error('preview state: unknown turn');
      if (existing.phase !== expected) {
        if (existing.phase === phase) return current;
        throw new Error(`preview state: turn phase is ${existing.phase}, expected ${expected}`);
      }
      return { ...current, turns: { ...current.turns, [id]: { ...existing, ...fields, phase } } };
    });
  const advanceCursor = (nextOffset: number) => mutate(current => {
    assertInteger(nextOffset, 'cursor offset');
    if (nextOffset < current.cursor.nextOffset) throw new Error('preview state: cursor regression');
    return nextOffset === current.cursor.nextOffset ? current : { ...current, cursor: { nextOffset } };
  });
  const markFailure = (id: string, failureClass: NonNullable<PreviewTurn['failureClass']>, resetHint: string | null) => mutate(current => {
    const turn = current.turns[id];
    if (!turn || !['intake-preserved', 'grounded'].includes(turn.phase)
      || !['limit', 'policy', 'timeout', 'transport', 'unknown'].includes(failureClass)
      || (resetHint !== null && !/^\d{1,2}:\d{2}(?:am|pm)$/.test(resetHint))) throw Error('preview: invalid turn failure');
    return { ...current, turns: { ...current.turns, [id]: { ...turn, failureClass, resetHint } } };
  });
  const completePoll = (nextOffset: number) => mutate(current => {
    assertInteger(nextOffset, 'cursor offset');
    if (nextOffset < current.cursor.nextOffset) throw new Error('preview state: cursor regression');
    return { ...current, cursor: { nextOffset }, consecutiveErrors: 0 };
  });
  const reserveReply = (): PreviewStateDocument => mutate(current => {
    const instant = now();
    const window = instant - current.replyWindow.startedAt >= options.replyWindowMs
      ? { startedAt: instant, count: 0 } : current.replyWindow;
    if (window.count >= options.replyLimit) throw new Error('preview reply fixed-window brake reached');
    return { ...current, replyWindow: { ...window, count: window.count + 1 } };
  });
  const noteSuccess = () => mutate(current => ({ ...current, consecutiveErrors: 0 }));
  const heartbeat = (pid: number) => mutate(current => {
    assertInteger(pid, 'cycle pid', 1);
    return { ...current, cycle: { at: now(), pid } };
  });
  const noteLimit = (resetAt: number | null): PreviewStateDocument => mutate(current => {
    const instant = now(); assertInteger(instant, 'clock');
    if (current.limitHoldUntil !== null && current.limitHoldUntil > instant) return current;
    const until = resetAt !== null && Number.isSafeInteger(resetAt) && resetAt > instant
      ? Math.min(resetAt, instant + 18000000) : instant + 1800000;
    return { ...current, limitHoldUntil: until };
  });
  const gateSpend = (): PreviewStateDocument => {
    const current = gate('dispatch');
    if (current.limitHoldUntil !== null && now() < current.limitHoldUntil) throw new Error('preview: usage limit hold');
    return current;
  };
  const noteError = () => mutate(current => {
    const consecutiveErrors = current.consecutiveErrors + 1;
    const totalErrors = current.totalErrors + 1;
    if ((consecutiveErrors >= options.errorLimit || totalErrors >= options.totalErrorLimit)
      && current.stop === null && !existsSync(stopPath)) {
      durablePreviewWrite(stopPath, { latchedAt: now(), reason: 'breaker' as const });
    }
    return { ...current, consecutiveErrors, totalErrors, ...(existsSync(stopPath) ? { stop: read().stop } : {}) };
  });
  return Object.freeze({ path, read, gate, gatePollCapacity, latchStop, recordIntake, advance, advanceCursor, completePoll,
    reserveReply, noteSuccess, noteError, noteLimit, gateSpend, markFailure, heartbeat,
    pending: () => Object.values(read().turns).filter(turn => pendingPhase(turn.phase)) });
}

export type PreviewState = ReturnType<typeof openPreviewState>;

export const STAGE2_PHASES = ['armed', 'provider-prepared', 'provider-dispatch-unknown', 'response-preserved',
  'answer-accepted', 'reply-opened', 'reply-admitted', 'reply-prepared', 'reply-dispatch-unknown', 'api-accepted', 'held'] as const;
export type Stage2Phase = typeof STAGE2_PHASES[number];
export interface Stage2StateDocument {
  readonly version: 1; readonly root: string; readonly trial: string; readonly baseConfigurationDigest: string;
  readonly activationDigest: string; readonly policyDigest: string; readonly cutoff: number;
  readonly excludedTurns: readonly string[]; readonly selectedTurn: string | null;
  readonly contextReferences: readonly string[]; readonly contextDigest: string;
  readonly ownerStart: number | null; readonly ownerDeadline: number | null; readonly absoluteStart: number | null;
  readonly modelAttemptUsed: 0 | 1; readonly phase: Stage2Phase; readonly terminalLatch: boolean;
  readonly references: Readonly<Record<string, string>>;
  readonly hold: null | Readonly<{ code: 'BOUND' | 'UNKNOWN' | 'STOPPED' | 'EXPIRED' | 'REFUSED';
    lengths: Readonly<Record<string, number>>; references: readonly string[] }>;
}
export function stage2SidecarExists(root: string): boolean { return existsSync(join(root, 'preview-stage2-state.json')); }
export function validateStage2State(d: Stage2StateDocument, outer: PreviewStateDocument, root: string) {
  if (d.version !== 1 || d.root !== root || d.trial !== outer.trial.id
    || d.baseConfigurationDigest !== outer.trial.configurationDigest
    || !/^sha256:[a-f0-9]{64}$/u.test(d.activationDigest) || !/^sha256:[a-f0-9]{64}$/u.test(d.policyDigest)
    || !STAGE2_PHASES.includes(d.phase)
    || ![0, 1].includes(d.modelAttemptUsed) || typeof d.terminalLatch !== 'boolean'
    || !Array.isArray(d.excludedTurns) || !Array.isArray(d.contextReferences)
    || typeof d.references !== 'object' || d.references === null
    || !Object.values(d.references).every(v => typeof v === 'string' && v.length > 0)
    || d.terminalLatch !== ['held', 'api-accepted'].includes(d.phase)) throw new Error('preview: corrupt stage2 sidecar');
  if (!d.excludedTurns.every(v => typeof v === 'string') || !d.contextReferences.every(v => typeof v === 'string')
    || typeof d.contextDigest !== 'string' || ((d.phase === 'held') !== (d.hold !== null)))
    throw new Error('preview: corrupt stage2 hold');
  if (d.hold && (!['BOUND', 'UNKNOWN', 'STOPPED', 'EXPIRED', 'REFUSED'].includes(d.hold.code)
    || !d.hold.lengths || !Object.values(d.hold.lengths).every(v => Number.isSafeInteger(v) && v >= 0)
    || !Array.isArray(d.hold.references) || !d.hold.references.every(v => typeof v === 'string')))
    throw new Error('preview: corrupt stage2 hold');
  assertInteger(d.cutoff, 'stage2 cutoff');
  if (d.selectedTurn !== null) {
    if (typeof d.selectedTurn !== 'string' || !/^sha256:[a-f0-9]{64}$/u.test(d.contextDigest) || !d.contextReferences.length)
      throw new Error('preview: corrupt stage2 selection');
    if (!outer.turns[d.selectedTurn] || d.excludedTurns.includes(d.selectedTurn)) throw new Error('preview: stage2 turn differs');
    assertInteger(d.ownerStart!, 'owner start'); assertInteger(d.absoluteStart!, 'absolute start');
    if (d.absoluteStart !== d.ownerStart || d.ownerDeadline !== d.ownerStart! + 300000
      || d.absoluteStart! + 300000 > outer.trial.expiresAt) throw new Error('preview: stage2 window differs');
  } else if (d.modelAttemptUsed !== 0 || d.ownerStart !== null || d.ownerDeadline !== null || d.absoluteStart !== null)
    throw new Error('preview: stage2 attempt without turn');
  const phase = STAGE2_PHASES.indexOf(d.phase);
  if (d.phase !== 'held') {
    if (phase > 0 && (d.selectedTurn === null || !d.contextDigest || !d.contextReferences.length))
      throw new Error('preview: corrupt stage2 selection');
    if (phase < 2 && d.modelAttemptUsed !== 0) throw new Error('preview: corrupt stage2 attempt');
    if (phase >= 2 && d.modelAttemptUsed !== 1) throw new Error('preview: corrupt stage2 attempt');
    const roles = [[], ['requestFact', 'preparedFact', 'providerRequest', 'submittedCapture', 'providerRun'], [],
      ['responseFact', 'receipt'], ['assessmentFact', 'acceptanceFact', 'settlementFact', 'accountingFact'],
      ['replyRun', 'replyOpeningFact'], ['pairFact', 'replyGroundingFact'], ['replyRequestFact', 'replyMessageFact'], [],
      ['replyObservationFact']];
    for (const name of roles.slice(0, phase + 1).flat()) if (!d.references[name])
      throw new Error('preview: corrupt stage2 reference role');
  }
  return d;
}

export function openStage2State(options: { root: string; state: PreviewState; activationDigest: string;
  policyDigest: string; cutoff: number; create?: boolean; ownerFactsExist: () => boolean }) {
  const root = resolve(options.root), path = join(root, 'preview-stage2-state.json');
  const outer = options.state.read();
  const check = (d: Stage2StateDocument) => {
    validateStage2State(d, options.state.read(), root);
    if (d.activationDigest !== options.activationDigest || d.policyDigest !== options.policyDigest || d.cutoff !== options.cutoff)
      throw new Error('preview: corrupt stage2 binding');
    return d;
  };
  if (!existsSync(path)) {
    if (options.create !== true || options.ownerFactsExist()) throw new Error('preview: stage2 sidecar missing');
    options.state.gate('admit'); assertInteger(options.cutoff, 'stage2 cutoff');
    durablePreviewWrite(path, { version: 1, root, trial: outer.trial.id,
      baseConfigurationDigest: outer.trial.configurationDigest, activationDigest: options.activationDigest,
      policyDigest: options.policyDigest, cutoff: options.cutoff, excludedTurns: Object.keys(outer.turns).sort(),
      selectedTurn: null, contextReferences: [], contextDigest: '', ownerStart: null, ownerDeadline: null,
      absoluteStart: null, modelAttemptUsed: 0, phase: 'armed', terminalLatch: false, references: {}, hold: null });
  }
  const read = () => check(JSON.parse(readFileSync(path, 'utf8')));
  read();
  const update = (fields: Partial<Stage2StateDocument>) => {
    const previous = read(), next = check({ ...previous, ...fields });
    for (const field of ['version', 'root', 'trial', 'baseConfigurationDigest', 'activationDigest', 'policyDigest', 'cutoff', 'excludedTurns'] as const)
      if (JSON.stringify(previous[field]) !== JSON.stringify(next[field])) throw new Error('preview: immutable stage2 binding');
    if (previous.selectedTurn !== null) for (const field of ['selectedTurn', 'contextReferences', 'contextDigest', 'ownerStart', 'ownerDeadline', 'absoluteStart'] as const)
      if (JSON.stringify(previous[field]) !== JSON.stringify(next[field])) throw new Error('preview: immutable stage2 selection');
    if (next.modelAttemptUsed < previous.modelAttemptUsed || (previous.terminalLatch && JSON.stringify(next) !== JSON.stringify(previous))
      || STAGE2_PHASES.indexOf(next.phase) < STAGE2_PHASES.indexOf(previous.phase)) throw new Error('preview: stage2 regression');
    for (const [name, reference] of Object.entries(previous.references))
      if (next.references[name] !== reference) throw new Error('preview: stage2 reference changed');
    durablePreviewWrite(path, next); return read();
  };
  const hold = (code: NonNullable<Stage2StateDocument['hold']>['code'], lengths: Record<string, number> = {}, references: readonly string[] = []) => {
    if (read().terminalLatch) return read();
    return update({ phase: 'held', terminalLatch: true, hold: { code, lengths, references } });
  };
  return Object.freeze({ path, read, update, hold });
}
export type Stage2State = ReturnType<typeof openStage2State>;

/** Desk-supervised stopped-root handoff. No source latch is removed, no trial
 * budget is reset, and every prior turn remains excluded when S2 arms. */
export function cutoverPreviewRoot(options: { predecessorRoot: string; root: string;
  predecessorConfiguration: Record<string, unknown>; configuration: Record<string, unknown>;
  quiescenceReference: string; cutoff: number; now?: () => number }) {
  const source = resolve(options.predecessorRoot), target = resolve(options.root), now = options.now?.() ?? Date.now();
  if (source !== options.predecessorRoot || target !== options.root || source === target
    || target.startsWith(source + '/') || source.startsWith(target + '/') || realpathSync(source) !== source
    || !options.quiescenceReference || existsSync(join(source, '.boot-lease')) || existsSync(join(source, '.boot-lease-guard'))
    || stage2SidecarExists(source) || existsSync(join(source, '.preview-stage2'))) throw new Error('preview: predecessor cutover refused');
  const old = validate(JSON.parse(readFileSync(join(source, 'preview-state.json'), 'utf8')));
  const stopPath = join(source, 'preview-stop.json');
  const stop = existsSync(stopPath) ? JSON.parse(readFileSync(stopPath, 'utf8')) : old.stop;
  if (!stop || !['operator', 'signal'].includes(stop.reason) || now + 300000 > old.trial.expiresAt
    || old.trial.configurationDigest !== digest(options.predecessorConfiguration)
    || options.predecessorConfiguration.root !== source || options.configuration.root !== target
    || JSON.stringify({ ...options.predecessorConfiguration, root: target }) !== JSON.stringify(options.configuration)
    || options.cutoff > now || options.cutoff < old.trial.createdAt) throw new Error('preview: cutover must inherit trial bounds');
  mkdirSync(target, { mode: 0o700, recursive: true });
  if (realpathSync(target) !== target || readdirSync(target).length !== 0) throw new Error('preview: fresh empty cutover root required');
  return archivePreviewRoot(options, source, target, old, stop, now).inherited;
}

function archivePreviewRoot(options: CutoverOptions, source: string, target: string, old: PreviewStateDocument,
  stop: NonNullable<PreviewStateDocument['stop']>, now: number, continuation: Record<string, unknown> = {}) {
  const inventory: Record<string, string> = {};
  const visit = (directory: string, relative = '') => {
    for (const name of readdirSync(directory).sort()) {
      const path = join(directory, name), key = relative ? `${relative}/${name}` : name, info = lstatSync(path);
      if (info.isSymbolicLink() || (!info.isDirectory() && !info.isFile()) || name.endsWith('.lock'))
        throw new Error('preview: ambiguous predecessor custody');
      if (info.isDirectory()) visit(path, key);
      else inventory[key] = `sha256:${createHash('sha256').update(readFileSync(path)).digest('hex')}`;
    }
  };
  visit(source);
  const archive = join(target, '.preview-predecessor');
  cpSync(source, archive, { recursive: true, errorOnExist: true, force: false });
  for (const name of ['facts.encrypted', 'captures.encrypted', 'exact.encrypted', '.preview-runs', '.preview-effects']) {
    if (existsSync(join(source, name))) cpSync(join(source, name), join(target, name), { recursive: true, errorOnExist: true, force: false });
  }
  const syncTree = (path: string) => {
    if (lstatSync(path).isDirectory()) for (const name of readdirSync(path)) syncTree(join(path, name));
    const fd = openSync(path, 'r'); try { fsyncSync(fd); } finally { closeSync(fd); }
  };
  syncTree(target);
  // Detect accidental concurrent source change rather than blessing its mixed snapshot.
  const before = JSON.stringify(inventory); for (const key of Object.keys(inventory)) delete inventory[key]; visit(source);
  if (before !== JSON.stringify(inventory)) throw new Error('preview: predecessor changed during cutover');
  for (const [relative, expected] of Object.entries(inventory)) {
    if (`sha256:${createHash('sha256').update(readFileSync(join(archive, relative))).digest('hex')}` !== expected)
      throw new Error('preview: predecessor archive differs');
  }
  durablePreviewWrite(join(target, 'preview-predecessor.json'), { version: 1, root: source,
    trial: old.trial.id, configurationDigest: old.trial.configurationDigest, snapshot: inventory,
    stateDigest: digest(old), stop, cursor: old.cursor, excludedTurns: Object.keys(old.turns).sort(),
    quiescenceReference: options.quiescenceReference, cutoff: options.cutoff, recordedAt: now, ...continuation });
  const inherited = { ...old, trial: { ...old.trial, configurationDigest: digest(options.configuration) }, stop: null };
  durablePreviewWrite(join(target, 'preview-state.json'), inherited);
  return { inherited, inventory, predecessor: JSON.parse(readFileSync(join(target, 'preview-predecessor.json'), 'utf8')) };
}

type CutoverOptions = { predecessorRoot: string; root: string;
  predecessorConfiguration: Record<string, unknown>; configuration: Record<string, unknown>;
  quiescenceReference: string; cutoff: number; now?: () => number };
type SuccessorOptions = CutoverOptions & { activation: SubscriptionActivationRecord;
  profile: ProviderSubscriptionProfile; model: string };
const FRAMING_AMENDMENT = 'astra-preview-s2-framing.md';
const rawHash = (bytes: Uint8Array | string) => `sha256:${createHash('sha256').update(bytes).digest('hex')}`;
const markerPath = (root: string, trial: string) => join(dirname(root), `.preview-s2-framing-v2-${rawHash(trial).slice(7)}.json`);
function treeInventory(root: string): Record<string, string> {
  const inventory: Record<string, string> = {};
  const visit = (directory: string, relative = '') => {
    for (const name of readdirSync(directory).sort()) {
      const path = join(directory, name), key = relative ? `${relative}/${name}` : name, info = lstatSync(path);
      if (info.isSymbolicLink() || (!info.isDirectory() && !info.isFile()) || name.endsWith('.lock')
        || name === '.boot-lease' || name === '.boot-lease-guard') throw Error('preview: ambiguous predecessor custody');
      if (info.isDirectory()) visit(path, key); else inventory[key] = rawHash(readFileSync(path));
    }
  };
  visit(root); return inventory;
}
function noPreviousSuccessor(source: string): void {
  for (let root = source; existsSync(root); root = join(root, '.preview-predecessor')) {
    const recordPath = join(root, 'preview-predecessor.json');
    if (existsSync(recordPath)) {
      const record = JSON.parse(readFileSync(recordPath, 'utf8'));
      if (record.continuation || record.activationOrdinal !== undefined) throw Error('preview: previous successor lineage');
    }
    if (root !== source && (stage2SidecarExists(root) || existsSync(join(root, '.preview-stage2'))))
      throw Error('preview: archived stage2 predecessor');
  }
}
/** One exclusive desk reservation, never a rearm or a process launcher. A failed
 * copy leaves its marker occupied for manual disposition, with no cleanup. */
export async function cutoverRefusedStage2Root(options: SuccessorOptions) {
  const source = options.predecessorRoot, target = options.root, now = options.now?.() ?? Date.now();
  if (resolve(source) !== source || resolve(target) !== target || source === target
    || dirname(source) !== dirname(target) || realpathSync(dirname(source)) !== dirname(source)
    || realpathSync(source) !== source || !existsSync(target) || realpathSync(target) !== target
    || !lstatSync(target).isDirectory() || readdirSync(target).length
    || typeof options.quiescenceReference !== 'string' || !options.quiescenceReference.trim())
    throw Error('preview: canonical empty sibling cutover required');
  const old = validate(JSON.parse(readFileSync(join(source, 'preview-state.json'), 'utf8')));
  const stop = existsSync(join(source, 'preview-stop.json')) ? JSON.parse(readFileSync(join(source, 'preview-stop.json'), 'utf8')) : old.stop;
  assertInteger(now, 'cutover clock'); assertInteger(options.cutoff, 'cutover cutoff');
  if (!stop || !['operator', 'signal'].includes(stop.reason) || !Number.isSafeInteger(stop.latchedAt)
    || now + 300000 > old.trial.expiresAt || options.cutoff > now || options.cutoff < old.trial.createdAt
    || old.trial.configurationDigest !== digest(options.predecessorConfiguration)
    || options.predecessorConfiguration.root !== source || options.configuration.root !== target
    || JSON.stringify({ ...options.predecessorConfiguration, root: target }) !== JSON.stringify(options.configuration))
    throw Error('preview: successor must inherit stopped trial bounds');
  const before = treeInventory(source);
  const { validateRefusedStage2Predecessor } = await import('./stage2-owners.js');
  const proof = validateRefusedStage2Predecessor(source, old, options.predecessorConfiguration);
  noPreviousSuccessor(source);
  const activationDigest = stage2Activation({ ...options, trial: old.trial.id,
    configurationDigest: digest(options.configuration), now });
  if (activationDigest === proof.oldActivationDigest || options.activation.reference === proof.oldActivationReference
    || options.activation.invocationPolicyDigest === proof.oldPolicyDigest)
    throw Error('preview: successor requires new activation and policy');
  if (encoded(treeInventory(source)).hash !== encoded(before).hash) throw Error('preview: predecessor changed before reservation');
  const binding = stage2InvocationBinding(options);
  const reservation = { version: 1, amendment: FRAMING_AMENDMENT, trial: old.trial.id,
    source, target, oldSidecarRawDigest: before['preview-stage2-state.json'],
    oldStoreRawDigest: before['.preview-stage2/facts.json'], ...proof,
    activationDigest, activationReference: options.activation.reference, profileDigest: encoded(options.profile).hash,
    policyDigest: binding.invocationPolicyDigest, systemPromptDigest: binding.systemPromptDigest, framing: binding.framing, configurationDigest: digest(options.configuration),
    cutoff: options.cutoff, localStopEvidence: options.quiescenceReference, originalExpiry: old.trial.expiresAt,
    activationOrdinal: 2, maximumActivations: 2 };
  const reservationDigest = encoded(reservation).hash;
  const marker = markerPath(source, old.trial.id), initial = { reservation, reservationDigest, completion: null };
  const fd = openSync(marker, 'wx', 0o600);
  try { writeFileSync(fd, JSON.stringify(initial), 'utf8'); fsyncSync(fd); } finally { closeSync(fd); }
  const parent = openSync(dirname(marker), 'r'); try { fsyncSync(parent); } finally { closeSync(parent); }
  // Check again after reservation, including locks and unchanged source bytes.
  if (encoded(treeInventory(source)).hash !== encoded(before).hash) throw Error('preview: predecessor changed after reservation');
  const result = archivePreviewRoot(options, source, target, old, stop, now, {
    continuation: { marker, reservationDigest }, activationOrdinal: 2, maximumActivations: 2,
    activationDigest, activationReference: options.activation.reference, profileDigest: reservation.profileDigest,
    policyDigest: reservation.policyDigest, systemPromptDigest: reservation.systemPromptDigest, framing: reservation.framing, unresolvedObligation: proof.unresolvedObligation });
  if (encoded(result.inventory).hash !== encoded(before).hash
    || encoded(JSON.parse(readFileSync(marker, 'utf8'))).hash !== encoded(initial).hash)
    throw Error('preview: successor reservation changed');
  durablePreviewWrite(marker, { ...initial, completion: { archiveInventoryDigest: encoded(result.inventory).hash,
    predecessorRecordDigest: encoded(result.predecessor).hash } });
  return result.inherited;
}

/** Read-only startup verification; terminal history needs no live activation. */
export function validateStage2Successor(input: { root: string; outer: PreviewStateDocument;
  activation?: SubscriptionActivationRecord; profile?: ProviderSubscriptionProfile; model: string; cutoff: number; binding?: ReturnType<typeof stage2InvocationBinding> }) {
  const path = join(input.root, 'preview-predecessor.json'), marker = markerPath(input.root, input.outer.trial.id);
  if (!existsSync(path)) {
    if (existsSync(marker) || existsSync(join(input.root, '.preview-predecessor'))) throw Error('preview: incomplete successor');
    return;
  }
  const predecessor = JSON.parse(readFileSync(path, 'utf8'));
  if (!predecessor.continuation) {
    if (existsSync(marker)) throw Error('preview: successor binding absent');
    noPreviousSuccessor(input.root); return;
  }
  const binding = input.activation || input.profile
    ? stage2InvocationBinding({ activation: input.activation!, profile: input.profile!, model: input.model }) : input.binding;
  const policy = subscriptionInvocationPolicy(input.model);
  const systemPromptDigest = rawHash(policy.args[policy.args.indexOf('--system-prompt') + 1]!);
  const check = (ok: unknown) => { if (!ok) throw Error('preview: successor evidence differs'); };
  if (!binding) throw Error('preview: successor binding absent');
  if (input.activation) check(input.profile?.activationReference === input.activation.reference
    && input.activation.invocationPolicyDigest === encoded(policy).hash && input.activation.profileDigest === binding.profileDigest);
  check(predecessor.continuation.marker === marker && realpathSync(marker) === marker);
  const retained = JSON.parse(readFileSync(marker, 'utf8')), r = retained.reservation;
  check(retained.completion && retained.reservationDigest === encoded(r).hash
    && predecessor.continuation.reservationDigest === retained.reservationDigest
    && r.version === 1 && r.amendment === FRAMING_AMENDMENT && r.activationOrdinal === 2 && r.maximumActivations === 2
    && r.target === input.root && r.source === predecessor.root && dirname(r.source) === dirname(input.root)
    && r.trial === input.outer.trial.id && r.originalExpiry === input.outer.trial.expiresAt
    && r.configurationDigest === input.outer.trial.configurationDigest && r.cutoff === input.cutoff
    && r.activationDigest === binding.activationDigest && r.activationReference === binding.activationReference
    && r.profileDigest === binding.profileDigest
    && r.policyDigest === binding.invocationPolicyDigest && r.policyDigest === encoded(subscriptionInvocationPolicy(input.model)).hash
    && r.systemPromptDigest === binding.systemPromptDigest && r.systemPromptDigest === systemPromptDigest
    && r.framing === binding.framing && r.framing === policy.framing
    && predecessor.cutoff === r.cutoff && predecessor.quiescenceReference === r.localStopEvidence);
  for (const key of ['activationOrdinal', 'maximumActivations', 'activationDigest', 'activationReference', 'profileDigest', 'policyDigest', 'systemPromptDigest', 'framing', 'unresolvedObligation'])
    check(encoded(predecessor[key]).hash === encoded(r[key]).hash);
  const inventory = treeInventory(join(input.root, '.preview-predecessor'));
  check(encoded(inventory).hash === retained.completion.archiveInventoryDigest
    && encoded(predecessor.snapshot).hash === retained.completion.archiveInventoryDigest
    && encoded(predecessor).hash === retained.completion.predecessorRecordDigest
    && inventory['preview-stage2-state.json'] === r.oldSidecarRawDigest && inventory['.preview-stage2/facts.json'] === r.oldStoreRawDigest);
  const archived = validate(JSON.parse(readFileSync(join(input.root, '.preview-predecessor/preview-state.json'), 'utf8')));
  check(encoded(Object.keys(archived.turns).sort()).hash === encoded(predecessor.excludedTurns).hash
    && archived.trial.id === r.trial && archived.trial.expiresAt === r.originalExpiry);
  for (const [id, turn] of Object.entries(archived.turns)) check(encoded(input.outer.turns[id]).hash === encoded(turn).hash);
  check(input.outer.cursor.nextOffset >= archived.cursor.nextOffset);
  if (stage2SidecarExists(input.root)) {
    const sidecar = validateStage2State(JSON.parse(readFileSync(join(input.root, 'preview-stage2-state.json'), 'utf8')), input.outer, input.root);
    check(predecessor.excludedTurns.every((id: string) => sidecar.excludedTurns.includes(id))
      && sidecar.activationDigest === r.activationDigest && sidecar.policyDigest === r.policyDigest && sidecar.cutoff === r.cutoff);
  }
}
