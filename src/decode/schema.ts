import type { Inventory } from '../types/values.js';
export const schemaRegistry = {
  VerifiedPrincipal: ['id', 'kind', 'provenance'], StandingGrant: ['*'], Revocation: ['*'],
  Intent: ['raw', 'principal', 'receivedAt'], Directive: ['principal', 'scope', 'statement', 'issuedAt'],
  Result: [], Measurement: [], Profile: [], Evidence: ['claim', 'source', 'observedAt', 'capture'],
  Decision: ['*'], Authorization: ['*'], Scope: [], ActionFloor: [], Outcome: [], SecretRef: [],
  Provenance: [], Conflict: [], UnresolvedInput: [],
} as const satisfies Record<keyof Inventory, readonly string[]>;
export const schemas = Object.freeze(Object.fromEntries(Object.keys(schemaRegistry).map(type => [type,
  Object.freeze({ type, schemaVersion: 1, hashAlgorithm: 'sha256', posture: 'shared', priorVersions: [] }),
])));
