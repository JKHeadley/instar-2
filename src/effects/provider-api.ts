/** Additive public provider entry point. Kept separate from the legacy barrel so
 * consumers can also typecheck with the independently pinned Eight v1 API.
 * No private issuance helper is exported here. */
export { consumeProviderReceipt } from './provider-authority.js';
export type { ProviderReceipt } from './provider-authority.js';
export { createProviderEffectDoorway, providerEffectSchemas, providerEffectMigrations, registerProviderEffectBodies } from './provider-path.js';
export type { ProviderCallPayload, ProviderEffectRequest, ProviderOperationObservation, ProviderEffectDependencies, ProviderEffectDoorway } from './provider-path.js';
