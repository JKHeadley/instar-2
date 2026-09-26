import { createHash } from 'node:crypto';
import { chmodSync, closeSync, existsSync, fsyncSync, lstatSync, openSync, readFileSync, realpathSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { openProductionStorageReader } from '../../src/assembly/production-storage.js';
import { servingView } from '../../src/transport/sequential-serving-admission.js';
import type { ServingRecord } from '../../src/transport/contracts.js';
import { SUBSCRIPTION_CONVERSATION_FRAMING } from '../../src/assembly/production-provider.js';
import type { SubscriptionActivationRecord } from '../../src/assembly/production-provider.js';
import type { ProviderSubscriptionProfile } from '../../src/assembly/provider-credential-custodian.js';
import { factsFixture } from '../facts/fixtures.js';
import { durablePreviewWrite } from './state.js';
import { encoded, stage2Activation, stage2InvocationBinding } from './stage2-provider.js';

/** Suffix given to every file this re-record supersedes; nothing is deleted. */
export const RERECORD_SUFFIX = '.superseded-dev-identity';
const rawHash = (text: string) => `sha256:${createHash('sha256').update(text).digest('hex')}`;
const rerecordMarker = (root: string, trial: string) =>
  join(dirname(root), `.preview-profile-rerecord-${rawHash(trial).slice(7)}.json`);

export interface ProfileRerecordInput {
  readonly root: string; readonly profilePath: string; readonly activationPath: string; readonly model: string;
  readonly reason: string; readonly recordedBy: string;
  /** The physical host's current inspection (scripts/production-boot-io.mjs). */
  readonly inspect: (profile: ProviderSubscriptionProfile) => Readonly<{ loginProfileIdentity: string; managedConfigurationDigest: string }>;
  /** Storage key of the root's `.successive` store, used read-only for the serving view. */
  readonly storageKey: Uint8Array;
  readonly now?: () => number;
  readonly alive?: (pid: number) => boolean;
}

function processAlive(pid: number): boolean {
  try { process.kill(pid, 0); return true; }
  catch (error) { return (error as NodeJS.ErrnoException).code !== 'ESRCH'; }
}
function differsOnly(before: Record<string, unknown>, after: Record<string, unknown>, allowed: readonly string[]): boolean {
  const keys = [...new Set([...Object.keys(before), ...Object.keys(after)])];
  return keys.every(key => allowed.includes(key) || encoded(before[key]).hash === encoded(after[key]).hash);
}
function readServing(root: string, key: Uint8Array) {
  const storageRoot = join(root, '.successive');
  if (!existsSync(join(storageRoot, 'facts.encrypted'))) return servingView([]);
  const f = factsFixture(), context = { ...f.ctx.decode, site: f.c.site, preserved: f.c.preserved };
  const opened = openProductionStorageReader({ root: storageRoot, machine: 'machine-a', key, store: 'store:fact', context,
    io: { existsSync, lstatSync, readFileSync, realpathSync, join, resolve } as never });
  if (opened.kind !== 'Success') throw Error('preview: serving view unreadable');
  try {
    const rows = opened.value.segment.read() as { kind?: string; body?: { record?: ServingRecord } }[];
    return servingView(rows.filter(row => row.kind === 'transport-ServingRecord' && row.body?.record).map(row => row.body!.record!));
  } finally { opened.value.close(); }
}
/** Crash-safe replacement that keeps the old bytes beside the new under a suffix. */
function supersede(path: string, document: unknown) {
  const kept = `${path}${RERECORD_SUFFIX}`;
  if (existsSync(kept)) throw Error('preview: superseded copy already exists');
  const mode = lstatSync(path).mode & 0o777;
  const temporary = `${path}.rerecord-pending`;
  const fd = openSync(temporary, 'wx', 0o600);
  try { writeFileSync(fd, `${JSON.stringify(document, null, 2)}\n`, 'utf8'); fsyncSync(fd); } finally { closeSync(fd); }
  chmodSync(temporary, mode);
  renameSync(path, kept);
  renameSync(temporary, path);
  const parent = openSync(dirname(path), 'r'); try { fsyncSync(parent); } finally { closeSync(parent); }
}

/**
 * Desk-supervised one-use re-record of a successive root's login-profile
 * identity after the identity form dropped the device number (a macOS reboot
 * renumbers st_dev). It re-derives loginProfileIdentity from the unchanged
 * directories and rewrites exactly the fields that digest that identity: the
 * profile's loginProfileIdentity, the activation's profileDigest and the
 * successive sidecar's activationDigest (policyDigest is re-derived and must be
 * unchanged). Every other field must be identical. It refuses while any
 * process is live, a provider attempt is pending, or the trial is stopped,
 * held, latched or expired. Old files are kept under RERECORD_SUFFIX and an
 * exclusive audit marker beside the root makes a second use refuse.
 */
export function rerecordLoginProfileIdentity(input: ProfileRerecordInput) {
  const now = input.now?.() ?? Date.now(), alive = input.alive ?? processAlive;
  const root = input.root;
  for (const path of [root, input.profilePath, input.activationPath])
    if (resolve(path) !== path || realpathSync(path) !== path) throw Error('preview: canonical absolute paths required');
  if (typeof input.reason !== 'string' || !input.reason.trim() || typeof input.recordedBy !== 'string' || !input.recordedBy.trim())
    throw Error('preview: re-record reason and recorder required');
  if (existsSync(join(root, 'preview-stage2-state.json'))) throw Error('preview: only a successive root is supported');
  const outer = JSON.parse(readFileSync(join(root, 'preview-state.json'), 'utf8'));
  const sidecarPath = join(root, 'successive-state.json');
  const sidecar = JSON.parse(readFileSync(sidecarPath, 'utf8'));
  // Physical quiescence: no live preview process and no live storage writer.
  const leaseOwner = join(root, '.successive', '.boot-lease', 'owner.json');
  const leasePid = existsSync(leaseOwner) ? JSON.parse(readFileSync(leaseOwner, 'utf8')).pid : null;
  if ((outer.cycle && alive(outer.cycle.pid)) || (leasePid !== null && alive(leasePid)))
    throw Error('preview: a preview process is live');
  if (outer.stop !== null || existsSync(join(root, 'preview-stop.json')) || sidecar.hold !== null
    || now >= outer.trial.expiresAt) throw Error('preview: trial is stopped, held or expired');
  if (sidecar.trial !== outer.trial.id || sidecar.configurationDigest !== outer.trial.configurationDigest
    || sidecar.framing !== SUBSCRIPTION_CONVERSATION_FRAMING || typeof sidecar.activationDigest !== 'string')
    throw Error('preview: successive sidecar differs from the trial');
  const serving = readServing(root, input.storageKey);
  if (serving.slot !== null || serving.pendingAttempt !== null || serving.stopped)
    throw Error('preview: serving slot occupied, provider attempt in flight or serving latched');

  const profile = JSON.parse(readFileSync(input.profilePath, 'utf8')) as ProviderSubscriptionProfile;
  const activation = JSON.parse(readFileSync(input.activationPath, 'utf8')) as SubscriptionActivationRecord;
  const framing = SUBSCRIPTION_CONVERSATION_FRAMING;
  // The recorded chain must be self-consistent before anything is re-derived.
  if (activation.profileDigest !== encoded(profile).hash || sidecar.activationDigest !== encoded(activation).hash)
    throw Error('preview: recorded activation chain is inconsistent');
  const observed = input.inspect(profile);
  if (observed.managedConfigurationDigest !== profile.managedConfigurationDigest)
    throw Error('preview: managed configuration changed');
  if (observed.loginProfileIdentity === profile.loginProfileIdentity) throw Error('preview: identity already current');
  const nextProfile = { ...profile, loginProfileIdentity: observed.loginProfileIdentity };
  const nextActivation = { ...activation, profileDigest: encoded(nextProfile).hash };
  const activationDigest = stage2Activation({ activation: nextActivation, profile: nextProfile, model: input.model,
    trial: outer.trial.id, configurationDigest: outer.trial.configurationDigest, now, framing });
  const policyDigest = stage2InvocationBinding({ activation: nextActivation, profile: nextProfile, model: input.model, framing }).invocationPolicyDigest;
  if (policyDigest !== sidecar.policyDigest) throw Error('preview: invocation policy differs');
  const nextSidecar = { ...sidecar, activationDigest, policyDigest };
  if (!differsOnly(profile as never, nextProfile, ['loginProfileIdentity'])
    || !differsOnly(activation as never, nextActivation, ['profileDigest'])
    || !differsOnly(sidecar, nextSidecar, ['activationDigest', 'policyDigest']))
    throw Error('preview: re-record would change more than the identity digests');

  const marker = rerecordMarker(root, outer.trial.id);
  const reservation = { version: 1, kind: 'login-profile-identity-rerecord', trial: outer.trial.id, root,
    profilePath: input.profilePath, activationPath: input.activationPath, sidecarPath, suffix: RERECORD_SUFFIX,
    reason: input.reason, recordedBy: input.recordedBy, recordedAt: now,
    serving: { slot: serving.slot, pendingAttempt: serving.pendingAttempt, consecutiveErrors: serving.consecutiveErrors,
      totalErrors: serving.totalErrors, turns: serving.turns, replies: serving.replies },
    changes: [
      { file: input.profilePath, field: 'loginProfileIdentity', from: profile.loginProfileIdentity, to: nextProfile.loginProfileIdentity },
      { file: input.activationPath, field: 'profileDigest', from: activation.profileDigest, to: nextActivation.profileDigest },
      { file: sidecarPath, field: 'activationDigest', from: sidecar.activationDigest, to: activationDigest },
      { file: sidecarPath, field: 'policyDigest', from: sidecar.policyDigest, to: policyDigest }] };
  const fd = openSync(marker, 'wx', 0o600);
  try { writeFileSync(fd, JSON.stringify(reservation), 'utf8'); fsyncSync(fd); } finally { closeSync(fd); }
  supersede(input.profilePath, nextProfile);
  supersede(input.activationPath, nextActivation);
  const keptSidecar = `${sidecarPath}${RERECORD_SUFFIX}`;
  if (existsSync(keptSidecar)) throw Error('preview: superseded copy already exists');
  renameSync(sidecarPath, keptSidecar);
  durablePreviewWrite(sidecarPath, nextSidecar);
  durablePreviewWrite(marker, { ...reservation, completion: { profileDigest: encoded(nextProfile).hash,
    activationDigest, sidecarDigest: encoded(nextSidecar).hash } });
  return Object.freeze({ marker, ...reservation });
}
