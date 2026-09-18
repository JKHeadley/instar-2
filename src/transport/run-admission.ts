import type { RunAdmissionPort } from '../rungraph/index.js';

const productionAdmissions = new WeakSet<object>();

/** Construction is completed by the row-83 production slice. */
export function createProductionRunAdmission(): RunAdmissionPort {
  throw new Error('production run admission construction is incomplete');
}

/** Ten uses owner-minted construction provenance rather than a structural label. */
export function isProductionRunAdmission(admission: RunAdmissionPort): boolean {
  return productionAdmissions.has(admission);
}
