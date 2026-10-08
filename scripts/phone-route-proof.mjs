// Rules 79/82: proof of the root's configured phone routes, not permission to exceed a reviewed trial end.
// Shared by M and Q so missing connection/disclosure evidence fails identically in both rooms.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

/** @param {unknown} value @returns {Record<string, unknown>} */
const object = value =>
  value !== null && typeof value === 'object' && !Array.isArray(value) ? value : {};
const nonempty = value => typeof value === 'string' && value.trim().length > 0;
const phone = value => typeof value === 'string' && value.startsWith('phone:')
  && !/host command line|no phone surface/iu.test(value);

export function phoneRouteProof(raw, reviewedExpiry) {
  const status = object(raw), yes = object(status.explicitYes), review = object(yes.review);
  const acceptance = review.acceptance, accepted = object(acceptance);
  const source = yes.connected === true && (object(yes.chat).admissible === true
    || review.admissible === true && (acceptance === undefined || acceptance === null
      || accepted.current === true && nonempty(accepted.account) && nonempty(accepted.disclosure)));
  const surfaces = object(status.operatorActionSurface);
  // Missing fields and unknown declared surfaces do not disappear through vacuous all().
  if (!source || !phone(surfaces.raiseCaps) || !nonempty(surfaces.renewExpiry)
    || Object.entries(surfaces).some(([name, value]) => name !== 'renewExpiry' && !phone(value)))
    return { source, actions: false, renewal: 'route evidence missing or inadmissible' };
  if (!Number.isSafeInteger(reviewedExpiry) || reviewedExpiry <= 0
    || !Number.isSafeInteger(status.expires) || status.expires <= 0 || status.expires > reviewedExpiry)
    return { source, actions: false, renewal: 'missing or invalid trial end' };
  // Rule 79: "Every action needing the operator can be completed from a phone."
  // At the reviewed ceiling there is no renewal that ANY surface may offer. This is UNTESTED,
  // never PASS: it cannot substitute for a completed phone renewal while one is available.
  if (status.expires === reviewedExpiry)
    return { source, actions: null, renewal: 'untested: already at the reviewed trial end' };
  return { source, actions: phone(surfaces.renewExpiry), renewal: 'a later reviewed end requires an unconditional phone route' };
}

// The CLI reads only recorded status and the DEPLOYED build's reviewed ceiling, never a desk-supplied expiry.
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  let result = { source: false, actions: false, renewal: 'missing or unreadable proof input' };
  try {
    const tree = resolve(process.argv[2]);
    const { SUBSCRIPTION_PREVIEW_EXPIRY } = await import(pathToFileURL(resolve(tree, 'src/assembly/subscription-window.ts')).href);
    const declarations = JSON.parse(readFileSync(resolve(tree, 'tests/preview/journal.declarations.json'), 'utf8'))
      .filter(row => row.kind === 'operator actions').map(row => row.requiredFacts?.request?.action).sort();
    // An added declaration needs proof too, never silent omission from the two-action check.
    if (JSON.stringify(declarations) === JSON.stringify(['raise-caps', 'renew-expiry']))
      result = phoneRouteProof(JSON.parse(readFileSync(process.argv[3], 'utf8')), SUBSCRIPTION_PREVIEW_EXPIRY);
  } catch { /* Missing tree/status/declarations fail closed as missing evidence. */ }
  process.stdout.write(`${JSON.stringify(result)}\n`);
}
