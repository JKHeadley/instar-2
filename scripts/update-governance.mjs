import { bindBlockingSite } from '../src/register/governance.js';

// Bind the complete updater refusal boundary: candidate, saved state and postconditions.
// Use the same constitutional binding as the other shipped host boundaries.
// Loading this module requires the package's existing TypeScript loader.
export function bindUpdateCheckpoints(declarations) {
  bindBlockingSite(declarations, 'update.writeUpdateRuntime', [
    { decidesAlone: 'ruled-three', decidesAloneBasis: 'recorded-governed-state', failDirection: 'closed' },
  ]);
  return bindBlockingSite(declarations, 'update.updateRoot', [
    { decidesAlone: 'ruled-three', decidesAloneBasis: 'recorded-governed-state', failDirection: 'closed' },
  ]);
}
