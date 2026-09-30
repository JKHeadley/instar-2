// @ts-nocheck -- desk-only adapter over the waived preview fixture and physical IO module.
// Desk-only recovery of one admitted preview turn whose provider never dispatched.
// The installed Six result and fenced retirement ports own every state change.
import { createDecipheriv, createHash } from 'node:crypto';
import { closeSync, existsSync, fsyncSync, lstatSync, openSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { openProductionStorageReader } from '../../src/assembly/production-storage.js';
import { servingView } from '../../src/transport/sequential-serving-admission.js';
import { factsFixture, value } from '../facts/fixtures.js';
import { productionProviderIO } from '../../scripts/production-boot-io.mjs';
import { HOST_OUTAGE_TEXT, openPreviewState, validateSuccessiveRoot } from './state.js';
import { createSuccessiveComposition } from './successive.js';

const hash = (value: string) => createHash('sha256').update(value).digest('hex');
const aliveProcess = (pid: number) => {
  try { process.kill(pid, 0); return true; }
  catch (error) { return (error as NodeJS.ErrnoException).code !== 'ESRCH'; }
};
const record = (row: any) => row.body?.record;

export interface SlotRecoveryInput {
  readonly root: string; readonly profilePath: string; readonly activationPath: string;
  readonly model: string; readonly configuration: any; readonly expectedUpdateId: number;
  readonly reason: string; readonly recordedBy: string;
  readonly storageKey: Uint8Array; readonly telegramToken: string;
  readonly now?: () => number; readonly alive?: (pid: number) => boolean;
}

/** No Telegram or provider IO is supplied to this invocation, even by mistake. */
export function recoverPreDispatchSlot(input: SlotRecoveryInput) {
  const clock = input.now ?? Date.now, now = clock(), alive = input.alive ?? aliveProcess;
  for (const path of [input.root, input.profilePath, input.activationPath])
    if (resolve(path) !== path || realpathSync(path) !== path) throw Error('preview recovery: canonical absolute paths required');
  if (!input.reason?.trim() || !input.recordedBy?.trim()) throw Error('preview recovery: reason and recorder required');
  const root = input.root, outer = JSON.parse(readFileSync(join(root, 'preview-state.json'), 'utf8'));
  const sidecar = JSON.parse(readFileSync(join(root, 'successive-state.json'), 'utf8'));
  if (outer.stop !== null || existsSync(join(root, 'preview-stop.json')) || sidecar.hold !== null
    || now >= outer.trial.expiresAt) throw Error('preview recovery: trial stopped, held or expired');
  if (outer.cycle?.pid && alive(outer.cycle.pid)) throw Error('preview recovery: live preview process');
  const store = join(root, '.successive'), owner = join(store, '.boot-lease', 'owner.json');
  if (existsSync(join(store, '.boot-lease-guard'))) throw Error('preview recovery: store acquisition in progress');
  if (existsSync(join(store, '.boot-lease'))) {
    if (!existsSync(owner)) throw Error('preview recovery: unreadable store holder');
    const lease = JSON.parse(readFileSync(owner, 'utf8'));
    if (!Number.isSafeInteger(lease.pid) || lease.pid < 1 || alive(lease.pid))
      throw Error('preview recovery: live or unverifiable store holder');
  }
  if (!existsSync(join(root, 'successive-checkpoint.json'))) throw Error('preview recovery: completed boot checkpoint absent');
  validateSuccessiveRoot(root, outer);
  const audit = join(dirname(root), `.preview-slot-recovery-${hash(outer.trial.id)}.json`);
  if (existsSync(audit)) throw Error('preview recovery: already used');

  const fixture = factsFixture(), context = { ...fixture.ctx.decode, site: fixture.c.site, preserved: fixture.c.preserved };
  const opened = openProductionStorageReader({ root: store, machine: 'machine-a', key: input.storageKey,
    store: 'store:fact', context, io: { existsSync, lstatSync, readFileSync, realpathSync, join, resolve } as never });
  if (opened.kind !== 'Success') throw Error('preview recovery: encrypted store unreadable');
  let rows: any[], identityCapture: string, identityReference: string;
  try {
    rows = [...opened.value.segment.read()];
    // The sealed getMe bytes are in Ten's encrypted capture table. This is the
    // same read-only unseal used by carryPredecessorCursor for archived custody.
    const sealed = JSON.parse(readFileSync(join(store, 'captures.encrypted'), 'utf8'));
    const decipher = createDecipheriv('aes-256-gcm', Buffer.from(input.storageKey), Buffer.from(sealed.nonce, 'hex'));
    decipher.setAAD(Buffer.from('machine-a:store:fact:captures'));
    decipher.setAuthTag(Buffer.from(sealed.tag, 'hex'));
    const captures = JSON.parse(Buffer.concat([decipher.update(Buffer.from(sealed.ciphertext, 'base64')),
      decipher.final()]).toString('utf8'));
    const references = Object.keys(captures).filter(ref => ref.startsWith('capture:telegram:sealed-getMe:'));
    if (references.length !== 1 || !/^capture:telegram:sealed-getMe:[a-f0-9]{64}$/u.test(references[0]))
      throw Error('preview recovery: one retained bot identity capture required');
    identityReference = references[0];
    identityCapture = captures[identityReference];
    if (typeof identityCapture !== 'string' || hash(identityCapture) !== identityReference.split(':').at(-1))
      throw Error('preview recovery: retained bot identity capture changed');
    if (opened.value.captures.read(identityReference) !== identityCapture)
      throw Error('preview recovery: bot identity differs from coherent store view');
    const bot = JSON.parse(identityCapture).result;
    if (String(bot?.id) !== input.configuration.botId || `@${bot?.username}` !== input.configuration.botUsername)
      throw Error('preview recovery: retained bot identity differs');
  } finally { opened.value.close(); }
  const history = rows.filter(row => row.kind === 'transport-ServingRecord').map(record);
  const before = servingView(history);
  const providerRequests = new Set(rows.filter(row => row.kind === 'effect-provider-ProviderEffectRequest')
    .map(row => record(row)?.id));
  if (rows.some(row => row.kind === 'transport-AdmissionReservation'
      && providerRequests.has(record(row)?.request) && ['dispatch-claimed', 'consumed'].includes(record(row)?.state))
    || rows.some(row => row.kind === 'effect-provider-ProviderOperationObservation'))
    throw Error('preview recovery: provider dispatch evidence exists');
  // Context delivery is a separate, already-settled internal effect on this
  // same Run. Only an ordinary-reply message could lead to a Telegram send.
  if (rows.some(row => row.kind === 'effect-OutboundMessage' && record(row)?.purpose === 'ordinary-reply'))
    throw Error('preview recovery: reply or send evidence exists');
  const admits = history.filter(row => row.action === 'admit');
  if (admits.length !== 1 || !before.slot || admits[0].provider !== before.slot || before.stopped)
    throw Error('preview recovery: expected one unlatched admitted slot');
  if (!Number.isSafeInteger(input.expectedUpdateId)
    || sidecar.turns?.[admits[0].input]?.update !== input.expectedUpdateId)
    throw Error('preview recovery: admitted update differs');
  const starts = history.filter(row => row.action === 'start' && row.provider === before.slot);
  const results = history.filter(row => row.action === 'result' && row.provider === before.slot);
  if (!starts.length || !results.some(row => row.outcome === 'error')
    || starts.some(start => !results.some(result => result.attempt === start.attempt && result.outcome === 'error')
      && start.attempt !== before.pendingAttempt)
    || results.some(row => row.outcome !== 'error'))
    throw Error('preview recovery: failed pre-dispatch attempts not established');
  const provider = before.slot;
  const state = openPreviewState({ root, configuration: input.configuration, expiresAt: outer.trial.expiresAt,
    replyLimit: input.configuration.replyLimit, replyWindowMs: input.configuration.replyWindowMs,
    errorLimit: outer.trial.errorLimit, totalErrorLimit: outer.trial.totalErrorLimit,
    maxPendingTurns: outer.trial.maxPendingTurns, maxTrialTurns: outer.trial.maxTrialTurns,
    hostNotice: { botId: input.configuration.botId, chatId: input.configuration.chatId, message: HOST_OUTAGE_TEXT },
    now: () => now, create: false });
  if (state.read().trial.id !== outer.trial.id) throw Error('preview recovery: trial changed');
  const activation = JSON.parse(readFileSync(input.activationPath, 'utf8'));
  const profile = JSON.parse(readFileSync(input.profilePath, 'utf8'));
  let composition: ReturnType<typeof createSuccessiveComposition> | undefined;
  try {
    composition = createSuccessiveComposition({ configuration: input.configuration, state, root,
      storageKey: input.storageKey, resolveSecret: reference => {
        if (reference.name === 'telegram-bot-token') return input.telegramToken;
        throw Error('preview recovery: unexpected secret reference');
      },
      telegramIO: () => ({ invoke: request => {
        if (request.method === 'getMe') return { kind: 'response', status: 200, bytes: identityCapture };
        throw Error('preview recovery: Telegram poll or send prohibited');
      } }),
      provider: { activation, profile, model: input.model, active: () => false,
        io: { ...productionProviderIO, execute: async () => { throw Error('preview recovery: provider IO prohibited'); } } },
      now: () => now, stopped: () => true, readSource: path => readFileSync(resolve(process.cwd(), path), 'utf8') });
    const port = composition.application.owners.serving;
    const current = value(port.inspect());
    if (current.slot !== provider || current.pendingAttempt !== before.pendingAttempt || current.stopped)
      throw Error('preview recovery: serving state changed during boot');
    value(port.registerQuiescence(() => true));
    const fence = composition.built.f.effects.fence;
    const currentTrial = () => {
      const stateNow = state.read();
      if (stateNow.stop !== null || JSON.parse(readFileSync(join(root, 'successive-state.json'), 'utf8')).hold !== null
        || clock() >= stateNow.trial.expiresAt)
        throw Error('preview recovery: trial stopped, held or expired');
    };
    currentTrial();
    let resultRecord = null;
    if (current.pendingAttempt !== null)
      resultRecord = value(port.result(`recovery-result:${current.pendingAttempt}`, fence, current.pendingAttempt, 'error', ''));
    const settled = value(port.inspect());
    if (settled.stopped) throw Error('preview recovery: serving breaker latched after attempt result');
    currentTrial();
    const retirement = value(port.retire(`recovery-retire:${provider}`, fence, provider, ''));
    const after = value(port.inspect());
    if (after.slot !== null || after.pendingAttempt !== null || !after.retired.includes(provider)
      || after.turns !== before.turns || after.replies !== before.replies)
      throw Error('preview recovery: Six retirement did not settle the slot');
    const report = { version: 1, kind: 'pre-dispatch-slot-recovery', trial: outer.trial.id, root,
      reason: input.reason, recordedBy: input.recordedBy, recordedAt: now,
      admittedInput: admits[0].input, updateId: input.expectedUpdateId, provider,
      failedDisposition: 'error', failedAttempts: results.length,
      orphanAttempt: before.pendingAttempt, noDispatchClaim: true, noSend: true,
      retainedIdentityCapture: identityReference,
      beforeFactHead: rows.at(-1)?.contentHash, afterFactHead: composition.rows().at(-1)?.contentHash,
      resultRecord: resultRecord?.id ?? null, retirementRecord: retirement.id,
      before: { turns: before.turns, replies: before.replies, totalErrors: before.totalErrors,
        consecutiveErrors: before.consecutiveErrors },
      after: { turns: after.turns, replies: after.replies, totalErrors: after.totalErrors,
        consecutiveErrors: after.consecutiveErrors, retired: after.retired.includes(provider) } };
    const fd = openSync(audit, 'wx', 0o600);
    try { writeFileSync(fd, `${JSON.stringify(report, null, 2)}\n`, 'utf8'); fsyncSync(fd); } finally { closeSync(fd); }
    return Object.freeze({ audit, ...report });
  } finally { composition?.close(); }
}
