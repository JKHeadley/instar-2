#!/usr/bin/env node
// Desk-only activation renewal or policy successor (see README "Activation renewal").
// Usage: node --loader ./scripts/slice-ts-loader.mjs tests/preview/renew-activation.mjs \
//   --current /ABS/activation-talk.json --profile /ABS/profile-v2.json \
//   --observation /ABS/observation.json --out /ABS/activation-talk-v3.json [--profile-out /ABS/profile-v3.json] [--policy-successor]
// Writes NEW files only (exclusive create); the current record and profile are only read.
// It reads no credential or token bytes and runs no Claude command.
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { SUBSCRIPTION_CONVERSATION_FRAMING, SUBSCRIPTION_PREVIEW_EXPIRY,
  subscriptionPolicyFor, validateSubscriptionActivation } from '../../src/assembly/production-provider.js';
import { encoded } from './stage2-provider.js';

const REQUIRED = ['reference', 'reviewedHead', 'assertedAt', 'observedAt', 'method', 'observer',
  'safeCaptureReference', 'observedAccount', 'subscriptionLimit', 'subscriptionLimitReason'];
const OPTIONAL = ['operatorAssertion', 'waiver', 'extraUsageReason'];

/** Copy every current field, apply the fresh desk observation, and validate against
 * this build before anything is written. */
export function renewActivation({ current, currentBytes, profile, observation, now,
  framing = SUBSCRIPTION_CONVERSATION_FRAMING, policySuccessor = false }) {
  if (!observation || typeof observation !== 'object' || Array.isArray(observation)) throw Error('renewal: observation malformed');
  for (const key of Object.keys(observation))
    if (!REQUIRED.includes(key) && !OPTIONAL.includes(key)) throw Error(`renewal: observation field ${key} not renewable`);
  for (const key of REQUIRED) if (observation[key] === undefined) throw Error(`renewal: observation missing ${key}`);
  if (policySuccessor) {
    if (current.expiresAt !== SUBSCRIPTION_PREVIEW_EXPIRY) throw Error('renewal: policy successor would change expiry');
    if (observation.reference !== current.reference) throw Error('renewal: policy successor would change profile');
  } else if (!(current.expiresAt < SUBSCRIPTION_PREVIEW_EXPIRY))
    throw Error('renewal: current record is not older than this build');
  if (observation.observedAccount !== current.observedAccount || observation.observedAccount !== profile.expectedAccount)
    throw Error('renewal: observed account differs; a different account is not a status-quo renewal');
  if (!['available', 'unobservable'].includes(observation.subscriptionLimit)) throw Error('renewal: subscription limit not available');
  let successor = null;
  if (observation.reference !== profile.activationReference)
    successor = Object.freeze({ ...profile, activationReference: observation.reference });
  const bound = successor ?? profile;
  const policyDigest = policySuccessor ? encoded(subscriptionPolicyFor(current.model, framing).policy).hash : current.invocationPolicyDigest;
  if (policySuccessor) {
    if (policyDigest === current.invocationPolicyDigest) throw Error('renewal: invocation policy digest unchanged');
    // The predecessor must be valid for this build in every respect except its old policy digest.
    validateSubscriptionActivation({ ...current, invocationPolicyDigest: policyDigest }, profile, current.model, now, framing);
  }
  const record = { ...current, ...observation, profileDigest: encoded(bound).hash, expiresAt: SUBSCRIPTION_PREVIEW_EXPIRY,
    invocationPolicyDigest: policyDigest,
    predecessor: { reference: current.reference,
      digest: `sha256:${createHash('sha256').update(currentBytes, 'utf8').digest('hex')}` } };
  if (policySuccessor) record.previousInvocationPolicyDigest = current.invocationPolicyDigest;
  validateSubscriptionActivation(record, Object.freeze({ ...bound }), record.model, now, framing);
  return { record, profile: successor };
}

function main(argv) {
  const options = {};
  for (let i = 0; i < argv.length;) {
    if (argv[i] === '--policy-successor') {
      if (options['policy-successor']) throw Error('renewal: duplicate --policy-successor');
      options['policy-successor'] = true;
      i += 1;
      continue;
    }
    if (!argv[i]?.startsWith('--') || argv[i + 1] === undefined) throw Error('renewal: arguments malformed');
    options[argv[i].slice(2)] = argv[i + 1];
    i += 2;
  }
  const need = name => { if (!options[name]) throw Error(`renewal: missing --${name}`); return resolve(options[name]); };
  const currentPath = need('current'), profilePath = need('profile'), out = need('out');
  if ([currentPath, profilePath].includes(out) || options['profile-out'] && [currentPath, profilePath, out].includes(resolve(options['profile-out'])))
    throw Error('renewal: outputs must be new paths');
  const currentBytes = readFileSync(currentPath, 'utf8');
  const result = renewActivation({ current: JSON.parse(currentBytes), currentBytes,
    profile: JSON.parse(readFileSync(profilePath, 'utf8')),
    observation: JSON.parse(readFileSync(need('observation'), 'utf8')), now: Date.now(),
    policySuccessor: options['policy-successor'] === true });
  if (result.profile && !options['profile-out']) throw Error('renewal: new reference needs --profile-out for the profile successor');
  if (!result.profile && options['profile-out']) throw Error('renewal: reference unchanged; no profile successor is needed');
  // Exclusive create: never replaces an existing file, including the live record.
  if (result.profile) writeFileSync(resolve(options['profile-out']), `${JSON.stringify(result.profile, null, 2)}\n`, { flag: 'wx', mode: 0o600 });
  writeFileSync(out, `${JSON.stringify(result.record, null, 2)}\n`, { flag: 'wx', mode: 0o600 });
  process.stdout.write(`${JSON.stringify({ out, profileOut: result.profile ? resolve(options['profile-out']) : null,
    expiresAt: result.record.expiresAt, reference: result.record.reference, profileDigest: result.record.profileDigest })}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) main(process.argv.slice(2));
