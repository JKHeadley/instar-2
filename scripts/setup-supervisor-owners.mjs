// OS-neutral composition over the existing custody-platform request boundary.
// This is not a custody implementation: the installed broker owns all key work,
// recovery and signatures; One/Two own approved append and its reconciliation.
import { custodyPlatform } from './custody-platform/interface.mjs';
import { CHECKS, SCHEMA } from './setup-supervisor-protocol.mjs';
export function setupPreparationOwners({ broker, facts }) {
  const custody = custodyPlatform(broker);
  if (typeof facts?.request !== 'function') throw Error('setup requires One/Two owner requests');
  const request = async (operation, checkpoint, record) => {
    if (!Object.hasOwn(CHECKS, checkpoint?.step) || checkpoint.schema !== SCHEMA
      || !['pre', 'post'].includes(checkpoint.phase)) throw Error('invalid setup checkpoint');
    // Verify actual custody before every handoff, not a stale installed marker.
    await custody.verify();
    if ((await custody.status()).state !== 'running') throw Error('custodian unavailable');
    const scope = { kind: 'setup-owner-request', operation, checkpoint, ...(record ? { record } : {}) };
    // No secret-return method, file path, credentials or generic shell is exposed.
    // Both owners recheck GP versus GE/A0 themselves; a model answer never enters.
    return checkpoint.step === 'append' ? facts.request(scope) : custody.request(scope);
  };
  return Object.freeze({
    inspect: checkpoint => request('inspect', checkpoint),
    authenticate: (record, checkpoint) => request('authenticate', checkpoint, record),
    reconcile: checkpoint => request('reconcile', checkpoint),
    execute: checkpoint => request('execute', checkpoint),
  });
}
