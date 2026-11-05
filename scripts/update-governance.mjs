import { bindBlockingSite } from '../src/register/governance.js';

// Use the same constitutional binding as the other shipped host boundaries.
// Loading this module requires the package's existing TypeScript loader.
export function bindUpdateCandidate(declarations) {
  return bindBlockingSite(declarations, 'update.validateCandidate', [
    { decidesAlone: 'ruled-three', decidesAloneBasis: 'recorded-governed-state', failDirection: 'closed' },
  ]);
}
