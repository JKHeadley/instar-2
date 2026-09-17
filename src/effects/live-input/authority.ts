import type { FactStorePort, OwnedBodyRegistration } from '../../facts/index.js';

// Eight's additive arm keeps provenance separately from the legacy doorway's
// public surface. Only the owning constructors import these registration hooks.
const registrations = new WeakSet<object>();
const executions = new WeakMap<object, FactStorePort>();
export function registerLiveInputOwner(registration: OwnedBodyRegistration): void {
  registrations.add(registration);
}
export function registerLiveInputExecution(execution: object, store: FactStorePort): void {
  executions.set(execution, store);
}
export function isHarnessLiveInputOwnerRegistration(registration: OwnedBodyRegistration): boolean {
  return registrations.has(registration);
}
export function isHarnessLiveInputExecution(execution: object, store: FactStorePort): boolean {
  return executions.get(execution) === store;
}
