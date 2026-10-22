// Machine-local installation inventory. Records contain paths and account observations only;
// sign-in and sealed authority remain with their existing owners (Rules 15, 18, 28, 44, 45, 77, 100, 113).
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname, isAbsolute, join } from 'node:path';
import { durablePreviewWrite } from './durable-write.js';
import { encoded } from './stage2-provider.js';
import { loadHarnessLogins } from './harness-login-pool.mjs';
import { readHarnessLogin } from './harness-user.mjs';

const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const read = path => JSON.parse(readFileSync(path, 'utf8'));
// The caller holds the root's writer lease, the same owner that serializes pool state.
const keepRecord = (path, value) => {
  if (existsSync(path)) {
    if (JSON.stringify(read(path)) !== JSON.stringify(value)) throw Error('preview: immutable login build record differs');
  } else durablePreviewWrite(path, value);
};
const inventoryPath = root => join(root, 'harness-logins.json');
const rowOf = options => ({ profile: options['login-profile'], activation: options['activation-record'],
  authority: options['authority-record'] ?? join(dirname(options['activation-record']), 'activation-authority.json'),
  ...(options['tools-activation'] ? { toolsActivation: options['tools-activation'] } : {}),
  ...(options['session-work-activation'] ? { sessionActivation: options['session-work-activation'] } : {}),
  ...(options['quota-login'] ? { quotaLogin: options['quota-login'] } : {}),
  ...(options['usage-account'] ? { usageAccount: options['usage-account'] } : {}) });
const optionsOf = (options, row) => ({ ...options, 'login-profile': row.profile, 'activation-record': row.activation,
  'authority-record': row.authority, 'tools-activation': row.toolsActivation, 'session-work-activation': row.sessionActivation });
const inventory = root => {
  const value = read(inventoryPath(root));
  if (value.version !== 1 || !Array.isArray(value.logins) || !value.logins.length || value.logins.length > 8)
    throw Error('preview: installed harness logins malformed');
  return value;
};

/** Installation owner records one already authenticated, independently granted login. Repeating
 * it updates that member in place; it never reorders members or changes the primary anchor. */
export function installHarnessLogin({ root, options, verify }) {
  const row = rowOf(options);
  for (const key of ['profile', 'activation', 'authority', 'toolsActivation', 'sessionActivation', 'quotaLogin'])
    if (row[key] !== undefined && !isAbsolute(row[key])) throw Error('preview: installed login paths must be absolute');
  const profile = read(row.profile);
  verify(row, profile); // Existing custody/activation/authority checks, before recording admission.
  const prior = existsSync(inventoryPath(root)) ? inventory(root) : { version: 1, logins: [] };
  const imported = options['login-pool'] ? loadHarnessLogins(options) : null;
  const logins = imported ? imported.entries.map(({ profile, profilePath, options: _options, index: _index, ...entry }) =>
    ({ ...entry, profile: profilePath, admittedProfile: profile })) : [...prior.logins];
  if (imported) for (const entry of imported.entries) verify({ ...entry, profile: entry.profilePath }, entry.profile);
  const index = logins.findIndex(item => (item.admittedProfile ?? read(item.profile)).reference === profile.reference);
  const quotaLogin = row.quotaLogin ?? logins[index]?.quotaLogin;
  const admitted = { ...row, ...(quotaLogin ? { quotaLogin } : {}), admittedProfile: profile };
  if (index < 0) logins.push(admitted); else logins[index] = admitted;
  if (logins.length > 8) throw Error('preview: at most eight installed harness logins');
  // A fresh authenticated admission must supersede a cached preparation exclusion, even
  // when custody recovered without changing any non-secret source record.
  const next = { ...prior, admissionRevision: (prior.admissionRevision ?? 0) + 1, logins,
    ...(imported ? { thresholdPercent: imported.threshold, usageFile: imported.usageFile } : {}),
    ...(options['usage-file'] !== undefined ? { usageFile: options['usage-file'] } : {}) };
  // Reuse the manifest validator for distinct accounts/directories and all path constraints.
  const configuration = loadHarnessLogins({ ...optionsOf(options, logins[0]), 'login-pool': inventoryPath(root) },
    path => path === inventoryPath(root) ? JSON.stringify(next) : readFileSync(path, 'utf8'));
  if (prior.identity && prior.identity !== configuration.identity) {
    if (existsSync(join(root, 'harness-login-pool.json'))) throw Error('preview: installed pool members changed; explicit membership migration required');
    delete next.preparedManifest; // No pool state exists yet; installation is still admitting its initial members.
  }
  if (imported) next.preparedManifest = options['login-pool'];
  next.identity = configuration.identity;
  durablePreviewWrite(inventoryPath(root), next);
  return next;
}

/** Same preparation for the primary and every installed member. Port of the desk's proven
 * policy-successor operation: retain account observation, expiry and profile; change only the
 * build policy pin with a predecessor. The member's OWN sealed authority must resolve each
 * resulting route. No successor grant is manufactured or copied from a different account. */
export function prepareInstalledHarnessLogins({ root, options, doorway, build, now, verify }) {
  const installed = inventory(root);
  const source = { ...installed, logins: [...installed.logins] };
  // A launch-supplied session grant belongs to the installation's primary anchor.
  // Retain it in preparation and its fingerprint; never lend it to another member.
  if (options['session-work-activation'] !== undefined)
    source.logins[0] = { ...source.logins[0], sessionActivation: options['session-work-activation'] };
  const fingerprints = source.logins.map(row => [row.profile, row.activation, row.authority, row.toolsActivation, row.sessionActivation]
    .filter(Boolean).map(path => { try { return hash(readFileSync(path, 'utf8')); } catch { return null; } }));
  const key = hash({ build, admissionRevision: source.admissionRevision, logins: source.logins, fingerprints, model: options.model, tools: options.tools ?? 'default',
    thresholdPercent: source.thresholdPercent ?? 95, usageFile: source.usageFile });
  const directory = join(root, 'harness-login-builds', key), manifestPath = join(directory, 'pool.json');
  if (!existsSync(manifestPath)) {
    if (source.preparedManifest === manifestPath) throw Error('preview: prepared login manifest lost; retained records require recovery');
    mkdirSync(directory, { recursive: true, mode: 0o700 });
    const logins = source.logins.map((row, index) => {
      try {
        const profile = Object.freeze(read(row.profile));
        const successor = (path, framing) => {
          const bytes = readFileSync(path, 'utf8'), current = JSON.parse(bytes);
          const digest = encoded(doorway.policyFor(options.model, framing)).hash;
          const next = current.invocationPolicyDigest === digest ? current : { ...current,
            invocationPolicyDigest: digest, previousInvocationPolicyDigest: current.invocationPolicyDigest,
            reviewedHead: String(build).slice(0, 1024),
            predecessor: { reference: current.reference, digest: `sha256:${createHash('sha256').update(bytes).digest('hex')}` } };
          doorway.validateActivation(next, profile, options.model, now, framing, current.expiresAt);
          return next;
        };
        const activation = successor(row.activation, doorway.conversationFraming);
        const tools = options.tools === 'off' ? null : row.toolsActivation ? successor(row.toolsActivation, doorway.toolsFraming)
          : { ...activation, invocationPolicyDigest: encoded(doorway.policyFor(options.model, doorway.toolsFraming)).hash };
        const authority = read(row.authority);
        verify(row, profile, activation, tools); // Includes independent sealed authority resolution.
        const records = { activation, authority, ...(tools ? { toolsActivation: tools } : {}) };
        const prepared = { ...row, admittedProfile: profile, sources: [row.profile, row.activation, row.authority, row.toolsActivation, row.sessionActivation]
          .filter(Boolean).map(path => ({ path, digest: hash(read(path)) })) };
        for (const [name, value] of Object.entries(records)) {
          const target = join(directory, `${index}-${name}.json`);
          keepRecord(target, value);
          prepared[name] = target;
        }
        return prepared;
      } catch (error) {
        if (index === 0) throw error;
        // Keep its index/profile identity; launch records the exclusion once. Never erase holds
        // or reinterpret history by renumbering the remaining members.
        return { ...row, unavailable: 'build records or authentication unavailable' };
      }
    });
    const manifest = { version: 1, thresholdPercent: source.thresholdPercent ?? 95, logins,
      ...(source.usageFile ? { usageFile: source.usageFile } : {}),
      ...(source.preparedManifest ? { previousManifest: source.preparedManifest } : {}) };
    keepRecord(manifestPath, manifest);
  }
  if (source.preparedManifest !== manifestPath)
    durablePreviewWrite(inventoryPath(root), { ...installed, preparedManifest: manifestPath });
  return manifestPath;
}

/** No pool flag: use the installation's recorded order. An explicit profile without a pool
 * is the recorded single-login override. A singleton preserves the former launch options. */
export function installedHarnessLaunch({ root, options, prepare }) {
  if (options['login-profile'] !== undefined || options['login-pool'] !== undefined)
    return { options, mode: options['login-pool'] ? 'explicit-pool' : 'explicit-profile' };
  if (!existsSync(inventoryPath(root))) return { options, mode: 'legacy-single' };
  const source = inventory(root), primary = source.logins[0];
  const selected = optionsOf(options, { ...primary,
    sessionActivation: options['session-work-activation'] ?? primary.sessionActivation });
  if (source.logins.length === 1) return { options: selected, mode: 'single-installed' };
  const manifestPath = prepare(selected);
  const manifest = read(manifestPath);
  return { options: { ...optionsOf(options, manifest.logins[0]), 'login-pool': manifestPath }, mode: 'installed-pool' };
}

export function verifyPreparedHarnessLogin(entry) {
  if (entry.unavailable) throw Error('preview: login build preparation unavailable');
  for (const source of entry.sources ?? [])
    if (hash(read(source.path)) !== source.digest) throw Error('preview: installed login source withdrawn; prepare the installation again');
}

/** Called only from the driver's verified-live activity observation. Custody absence
 * is exact ENOENT, not an identity mismatch, a stale profile or an unreadable login.
 * No token, account, path or caught error enters the observation (Rules 26/100).
 * The key binds the admitted profile lifetime, so a host restart cannot repeat it. */
export function observeInstalledSessionLogin(profile, activity, login = readHarnessLogin, machine = 'local') {
  if (!activity || !Number.isSafeInteger(activity.at) || !activity.subject) return null;
  let state = 'present';
  try { login(profile); } catch (error) { state = error?.code === 'ENOENT' ? 'missing' : 'unknown'; }
  return { key: `credential:session-login:${hash([machine, profile.reference, profile.activationReference])}`,
    state, slot: activity.slot ?? 1, at: activity.at };
}
