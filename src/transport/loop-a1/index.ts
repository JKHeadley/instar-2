/**
 * The sole additive A1 entry point. Legacy callers continue through
 * `src/transport/index.ts`; this module calls those main-owned constructors and
 * decoders first, and routes only inputs carrying A1's new field/kind marker.
 */
export type * from './contracts.js';
export { createLoopA1Authority, createLoopA1Spine } from './authority.js';
export {
  decodeLoopPolicyA1,
  loopA1Schemas,
  registerLoopA1Bodies,
  rowsA1,
} from './records.js';
export {
  hasA1PolicyMarker,
  loopA1Shapes,
  rejectTransitionExtensions,
  rejectUnsupportedSliceA1Fields,
  requireOpaqueSourceReference,
  sharedLoopRecordFactKind,
  sharedPolicyCheck,
  storeSharedLoopPolicy,
  storeSharedLoopRecord,
} from './shapes.js';
