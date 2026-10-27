// Receiving half of setupPreparationOwners. Runs INSIDE the independently installed
// owner, after authenticated IPC; it is neither a key store nor a grant decoder.
// Rules 26/28/38/42/60: only current owner evidence can justify an operation.
import { isDeepStrictEqual } from 'node:util';
import { CHECKS, SCHEMA, boundedId, projectSetupChecks } from './setup-supervisor-protocol.mjs';

const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const keys = (value, names) => object(value)
  && Object.keys(value).sort().join(',') === [...names].sort().join(',');
const bindings = ['installation', 'session', 'subject', 'authority', 'step', 'phase', 'operation', 'schema'];
const refused = reason => ({ state: 'refused', reason,
  message: 'Resume setup after the installer repairs the named owner check.' });
const freeze = value => {
  if (object(value) || Array.isArray(value)) {
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  }
  return value;
};
function snapshot(value) {
  const bytes = JSON.stringify(value);
  if (typeof bytes !== 'string' || Buffer.byteLength(bytes) > 16384) throw Error('request-bound');
  return freeze(JSON.parse(bytes));
}
function checkpointValid(checkpoint, owner) {
  return keys(checkpoint, bindings) && bindings.every(name => boundedId(checkpoint[name]))
    && /^[a-f0-9]{64}$/.test(checkpoint.subject) && checkpoint.schema === SCHEMA
    && ['pre', 'post'].includes(checkpoint.phase) && Object.hasOwn(CHECKS, checkpoint.step)
    && (owner === 'one-two' ? checkpoint.step === 'append' : checkpoint.step !== 'append');
}

/** The installed owner's trusted implementation supplies:
 * read(checkpoint): fresh full check record, from retained receipts and actual state;
 * reconcile(checkpoint): absent | executed | uncertain, from its durable operation;
 * execute(checkpoint, frontier): revalidate authority, stop, supervision and the
 * frontier AT the effect, durably record intent, then perform/reconcile that exact
 * operation. It must return executed only after durable completion. It must not
 * repeat an uncertain operation. A preparation grant never permits GE/A0 work.
 *
 * These methods are code installed under the owner identity, never request fields.
 * This receiver creates no standing, key, signature, model acceptance or history.
 * Owner calls must be bounded by the installed service's resource/lifetime limits.
 */
export function setupOwnerReceiver({ owner, implementation }) {
  if (!['custodian', 'one-two'].includes(owner)
    || ['read', 'reconcile', 'execute'].some(name => typeof implementation?.[name] !== 'function'))
    throw Error('setup receiver requires an installed owner');
  // Bind once: replacing a property on the composition object cannot change owners.
  const read = implementation.read.bind(implementation);
  const reconcile = implementation.reconcile.bind(implementation);
  const execute = implementation.execute.bind(implementation);
  let busy = false;
  const current = async checkpoint => {
    const record = snapshot(await read(checkpoint));
    projectSetupChecks(record, checkpoint);
    return record;
  };
  return Object.freeze({
    async request(input) {
      let request;
      try { request = snapshot(input); } catch { return refused('request-bound'); }
      const { operation, checkpoint } = request ?? {};
      if (!keys(request, ['kind', 'operation', 'checkpoint', ...(operation === 'authenticate' ? ['record'] : [])])
        || request.kind !== 'setup-owner-request'
        || !['inspect', 'authenticate', 'reconcile', 'execute'].includes(operation)
        || !checkpointValid(checkpoint, owner)
        || (['execute', 'reconcile'].includes(operation) && checkpoint.phase !== 'pre'))
        return refused('request-shape');
      // No queued unbounded requests and no overlap with an owner's mutation.
      if (busy) return refused('owner-busy');
      busy = true;
      try {
        if (operation === 'inspect') return await current(checkpoint);
        if (operation === 'authenticate') {
          // Short handles have meaning only in this complete current owner record.
          // Failed/unobserved checks can be authentic; authenticity is not approval.
          try {
            projectSetupChecks(request.record, checkpoint);
            return isDeepStrictEqual(request.record, await current(checkpoint));
          } catch { return false; }
        }
        const state = await reconcile(checkpoint);
        if (!['absent', 'executed'].includes(state)) return 'uncertain';
        if (operation === 'reconcile') return state;
        // Idempotent retry observes completion; it never repeats the effect.
        if (state === 'executed') return state;
        const before = await current(checkpoint);
        if (before.checks.some(row => !row.observed || !row.passed)) return refused('owner-check-failed');
        // The owner's atomic boundary, not this earlier read, enforces currency.
        const outcome = await execute(checkpoint, before.checkpoint.frontier);
        if (outcome !== 'executed') return 'uncertain';
        return await reconcile(checkpoint) === 'executed' ? 'executed' : 'uncertain';
      } catch {
        // Do not leak owner diagnostics, credentials or provider responses.
        return operation === 'execute' ? 'uncertain' : refused('owner-unavailable');
      } finally { busy = false; }
    },
  });
}
