#!/usr/bin/env node
// Desk-only status-quo activation renewal (see README "Activation renewal").
// Usage: node --loader ./scripts/slice-ts-loader.mjs tests/preview/renew-activation.mjs \
//   --current /ABS/activation-talk.json --profile /ABS/profile-v2.json \
//   --observation /ABS/observation.json --out /ABS/activation-talk-v3.json [--profile-out /ABS/profile-v3.json]
// Writes NEW files only (exclusive create); the current record and profile are only read.
// It reads no credential or token bytes and runs no Claude command.
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { SUBSCRIPTION_CONVERSATION_FRAMING, SUBSCRIPTION_PREVIEW_EXPIRY,
  validateSubscriptionActivation } from '../../src/assembly/production-provider.js';
import { encoded } from './stage2-provider.js';

const REQUIRED = ['reference', 'reviewedHead', 'assertedAt', 'observedAt', 'method', 'observer',
  'safeCaptureReference', 'observedAccount', 'subscriptionLimit', 'subscriptionLimitReason'];
const OPTIONAL = ['operatorAssertion', 'waiver', 'extraUsageReason'];

/** Pure renewal: copy every current field, apply the fresh desk observation, set the
 * reviewed expiry, and validate against this build before anything is written. */
export function renewActivation({ current, currentBytes, profile, observation, now,
  framing = SUBSCRIPTION_CONVERSATION_FRAMING }) {
  if (!observation || typeof observation !== 'object' || Array.isArray(observation)) throw Error('renewal: observation malformed');
  for (const key of Object.keys(observation))
    if (!REQUIRED.includes(key) && !OPTIONAL.includes(key)) throw Error(`renewal: observation field ${key} not renewable`);
  for (const key of REQUIRED) if (observation[key] === undefined) throw Error(`renewal: observation missing ${key}`);
  if (!(current.expiresAt < SUBSCRIPTION_PREVIEW_EXPIRY)) throw Error('renewal: current record is not older than this build');
  if (observation.observedAccount !== current.observedAccount || observation.observedAccount !== profile.expectedAccount)
    throw Error('renewal: observed account differs; a different account is not a status-quo renewal');
  if (!['available', 'unobservable'].includes(observation.subscriptionLimit)) throw Error('renewal: subscription limit not available');
  let successor = null;
  if (observation.reference !== profile.activationReference)
    successor = Object.freeze({ ...profile, activationReference: observation.reference });
  const bound = successor ?? profile;
  const record = { ...current, ...observation, profileDigest: encoded(bound).hash, expiresAt: SUBSCRIPTION_PREVIEW_EXPIRY,
    predecessor: { reference: current.reference,
      digest: `sha256:${createHash('sha256').update(currentBytes, 'utf8').digest('hex')}` } };
  validateSubscriptionActivation(record, Object.freeze({ ...bound }), record.model, now, framing);
  return { record, profile: successor };
}

function main(argv) {
  const options = {};
  for (let i = 0; i < argv.length; i += 2) {
    if (!argv[i]?.startsWith('--') || argv[i + 1] === undefined) throw Error('renewal: arguments malformed');
    options[argv[i].slice(2)] = argv[i + 1];
  }
  const need = name => { if (!options[name]) throw Error(`renewal: missing --${name}`); return resolve(options[name]); };
  const currentPath = need('current'), profilePath = need('profile'), out = need('out');
  if ([currentPath, profilePath].includes(out) || options['profile-out'] && [currentPath, profilePath, out].includes(resolve(options['profile-out'])))
    throw Error('renewal: outputs must be new paths');
  const currentBytes = readFileSync(currentPath, 'utf8');
  const result = renewActivation({ current: JSON.parse(currentBytes), currentBytes,
    profile: JSON.parse(readFileSync(profilePath, 'utf8')),
    observation: JSON.parse(readFileSync(need('observation'), 'utf8')), now: Date.now() });
  if (result.profile && !options['profile-out']) throw Error('renewal: new reference needs --profile-out for the profile successor');
  if (!result.profile && options['profile-out']) throw Error('renewal: reference unchanged; no profile successor is needed');
  // Exclusive create: never replaces an existing file, including the live record.
  if (result.profile) writeFileSync(resolve(options['profile-out']), `${JSON.stringify(result.profile, null, 2)}\n`, { flag: 'wx', mode: 0o600 });
  writeFileSync(out, `${JSON.stringify(result.record, null, 2)}\n`, { flag: 'wx', mode: 0o600 });
  process.stdout.write(`${JSON.stringify({ out, profileOut: result.profile ? resolve(options['profile-out']) : null,
    expiresAt: result.record.expiresAt, reference: result.record.reference, profileDigest: result.record.profileDigest })}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) main(process.argv.slice(2));
