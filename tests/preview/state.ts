import { createHash, randomUUID } from 'node:crypto';
import {
  closeSync, existsSync, fsyncSync, lstatSync, mkdirSync, openSync, readFileSync, readdirSync,
  realpathSync, renameSync, writeFileSync,
} from 'node:fs';
import { dirname, join, resolve } from 'node:path';

export const PREVIEW_STATE_VERSION = 1 as const;

export type PreviewTurnPhase =
  | 'intake-preserved'
  | 'grounded'
  | 'dispatch-outcome-unknown'
  | 'sent'
  | 'ignored-out-of-scope';

export interface PreviewTurn {
  readonly id: string;
  readonly updateId: number;
  readonly route: Readonly<{ channel: string; sender: string; identityEpoch: string; eventId: string | null }>;
  readonly receipt: string;
  readonly preserved: string;
  readonly phase: PreviewTurnPhase;
  readonly contextReferences: readonly string[];
  readonly contextDigest: string;
  readonly replyOperation: string;
  readonly replyObservation: string;
  readonly recordedAt: number;
}

export interface PreviewStateDocument {
  readonly version: typeof PREVIEW_STATE_VERSION;
  readonly trial: Readonly<{
    id: string;
    configurationDigest: string;
    createdAt: number;
    expiresAt: number;
  }>;
  readonly stop: null | Readonly<{ latchedAt: number; reason: 'operator' | 'signal' | 'expiry' | 'breaker' }>;
  readonly consecutiveErrors: number;
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
  readonly create?: boolean;
}

function digest(value: unknown): string {
  return `sha256:${createHash('sha256').update(JSON.stringify(value)).digest('hex')}`;
}

function assertInteger(value: number, label: string, minimum = 0): void {
  if (!Number.isSafeInteger(value) || value < minimum) throw new Error(`preview state: invalid ${label}`);
}

function validate(document: PreviewStateDocument): PreviewStateDocument {
  if (document.version !== PREVIEW_STATE_VERSION
    || typeof document.trial?.id !== 'string'
    || !/^sha256:[a-f0-9]{64}$/u.test(document.trial?.configurationDigest ?? '')
    || typeof document.turns !== 'object' || document.turns === null) {
    throw new Error('preview state: corrupt or unsupported state');
  }
  assertInteger(document.trial.createdAt, 'createdAt');
  assertInteger(document.trial.expiresAt, 'expiresAt', 1);
  assertInteger(document.consecutiveErrors, 'consecutiveErrors');
  assertInteger(document.replyWindow.startedAt, 'reply window start');
  assertInteger(document.replyWindow.count, 'reply window count');
  return document;
}

function durableWrite(path: string, document: unknown): void {
  const directory = dirname(path);
  const temporary = join(directory, `.preview-state-${randomUUID()}.pending`);
  const descriptor = openSync(temporary, 'wx', 0o600);
  try {
    writeFileSync(descriptor, JSON.stringify(document), 'utf8');
    fsyncSync(descriptor);
  } finally {
    closeSync(descriptor);
  }
  renameSync(temporary, path);
  const directoryDescriptor = openSync(directory, 'r');
  try { fsyncSync(directoryDescriptor); } finally { closeSync(directoryDescriptor); }
}

export function previewTurnId(botId: string, updateId: number): string {
  assertInteger(updateId, 'update id');
  return `telegram:${botId}:update:${String(updateId)}`;
}

export function openPreviewState(options: PreviewStateOptions) {
  const root = resolve(options.root);
  if (root !== options.root) throw new Error('preview state: canonical absolute root required');
  assertInteger(options.expiresAt, 'expiry', 1);
  assertInteger(options.replyLimit, 'reply limit', 1);
  assertInteger(options.replyWindowMs, 'reply window', 1);
  assertInteger(options.errorLimit, 'error limit', 1);
  mkdirSync(root, { recursive: true, mode: 0o700 });
  if (realpathSync(root) !== root || lstatSync(root).isSymbolicLink()) {
    throw new Error('preview state: substituted root refused');
  }
  const path = join(root, 'preview-state.json');
  const stopPath = join(root, 'preview-stop.json');
  const now = options.now ?? Date.now;
  const configurationDigest = digest(options.configuration);
  const read = (): PreviewStateDocument => {
    const document = validate(JSON.parse(readFileSync(path, 'utf8')) as PreviewStateDocument);
    if (!existsSync(stopPath)) return document;
    const stop = JSON.parse(readFileSync(stopPath, 'utf8')) as NonNullable<PreviewStateDocument['stop']>;
    assertInteger(stop.latchedAt, 'stop latch');
    if (!['operator', 'signal', 'expiry', 'breaker'].includes(stop.reason)) {
      throw new Error('preview state: corrupt stop latch');
    }
    return { ...document, stop };
  };
  if (!existsSync(path)) {
    if (options.create === false) throw new Error('preview state: trial identity is absent');
    if (readdirSync(root).length > 0) throw new Error('preview state: established root is missing its trial identity');
    const instant = now();
    assertInteger(instant, 'clock');
    if (options.expiresAt <= instant) throw new Error('preview state: trial already expired');
    durableWrite(path, {
      version: PREVIEW_STATE_VERSION,
      trial: { id: `preview-trial:${randomUUID()}`, configurationDigest, createdAt: instant, expiresAt: options.expiresAt },
      stop: null,
      consecutiveErrors: 0,
      replyWindow: { startedAt: instant, count: 0 },
      turns: {},
    });
  }
  const initial = read();
  if (initial.trial.configurationDigest !== configurationDigest || initial.trial.expiresAt !== options.expiresAt) {
    throw new Error('preview state: immutable trial configuration differs');
  }

  const mutate = (change: (current: PreviewStateDocument) => PreviewStateDocument): PreviewStateDocument => {
    const current = read();
    if (current.trial.configurationDigest !== configurationDigest) {
      throw new Error('preview state: trial identity changed');
    }
    const next = validate(change(current));
    // A concurrently written stop is sticky even if a stale worker mutation raced it.
    const latest = read();
    const merged = latest.stop !== null && next.stop === null ? { ...next, stop: latest.stop } : next;
    durableWrite(path, merged);
    return read();
  };

  const latchStop = (reason: NonNullable<PreviewStateDocument['stop']>['reason']) => {
    if (!existsSync(stopPath)) durableWrite(stopPath, { latchedAt: now(), reason });
    return mutate(current => ({ ...current, stop: read().stop }));
  };

  const gate = (point: 'poll' | 'admit' | 'dispatch'): PreviewStateDocument => {
    let current = read();
    const instant = now();
    assertInteger(instant, 'clock');
    if (instant >= current.trial.expiresAt && current.stop === null) current = latchStop('expiry');
    if (current.stop !== null) throw new Error(`preview stopped before ${point}`);
    return current;
  };

  const recordIntake = (turn: Omit<PreviewTurn, 'phase' | 'contextReferences' | 'contextDigest'
    | 'replyOperation' | 'replyObservation' | 'recordedAt'>, inScope: boolean): PreviewStateDocument => mutate(current => {
      const existing = current.turns[turn.id];
      if (existing) {
        if (existing.updateId !== turn.updateId || existing.receipt !== turn.receipt
          || JSON.stringify(existing.route) !== JSON.stringify(turn.route)) {
          throw new Error('preview state: semantic turn identity collision');
        }
        return current;
      }
      const recorded: PreviewTurn = {
        ...turn,
        phase: inScope ? 'intake-preserved' : 'ignored-out-of-scope',
        contextReferences: [], contextDigest: '', replyOperation: '', replyObservation: '', recordedAt: now(),
      };
      return { ...current, turns: { ...current.turns, [turn.id]: recorded } };
    });

  const advance = (id: string, expected: PreviewTurnPhase, phase: PreviewTurnPhase,
    fields: Partial<Pick<PreviewTurn, 'contextReferences' | 'contextDigest' | 'replyOperation' | 'replyObservation'>> = {}) => mutate(current => {
      const existing = current.turns[id];
      if (!existing) throw new Error('preview state: unknown turn');
      if (existing.phase !== expected) {
        if (existing.phase === phase) return current;
        throw new Error(`preview state: turn phase is ${existing.phase}, expected ${expected}`);
      }
      return { ...current, turns: { ...current.turns, [id]: { ...existing, ...fields, phase } } };
    });

  const reserveReply = (): PreviewStateDocument => mutate(current => {
    const instant = now();
    const window = instant - current.replyWindow.startedAt >= options.replyWindowMs
      ? { startedAt: instant, count: 0 }
      : current.replyWindow;
    if (window.count >= options.replyLimit) throw new Error('preview reply rate limit reached');
    return { ...current, replyWindow: { ...window, count: window.count + 1 } };
  });

  const noteSuccess = () => mutate(current => ({ ...current, consecutiveErrors: 0 }));
  const noteError = () => mutate(current => {
    const count = current.consecutiveErrors + 1;
    if (count >= options.errorLimit && current.stop === null && !existsSync(stopPath)) {
      durableWrite(stopPath, { latchedAt: now(), reason: 'breaker' as const });
    }
    return { ...current, consecutiveErrors: count, ...(existsSync(stopPath) ? { stop: read().stop } : {}) };
  });

  return Object.freeze({
    path,
    read,
    gate,
    latchStop,
    recordIntake,
    advance,
    reserveReply,
    noteSuccess,
    noteError,
    pending: () => Object.values(read().turns).filter(turn => turn.phase === 'intake-preserved' || turn.phase === 'grounded'),
  });
}

export type PreviewState = ReturnType<typeof openPreviewState>;
