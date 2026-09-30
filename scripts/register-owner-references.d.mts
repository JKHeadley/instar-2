import type { DecoderBinding } from './check-register-wiring.mjs';
export interface OwnerReferences {
  references: { provider: string; id: string; kind?: string }[];
  catalog: { fixtures: { id: string; stage: string }[]; probes: { id: string; cadence: number }[] };
  decoders: DecoderBinding[]; documents: { id: string; artifact: { path: string; hash: string }; declarationPath: string }[];
  captures: { id: string; origin: 'captured' | 'synthetic'; source: string; artifact: { path: string; hash: string } }[];
  artifacts: Record<string, string>;
}
export const ownerManifestPath: string;
export const ownerManifestPaths: string[];
export function loadOwnerReferences(root: string, input: { commit: string; sources: Record<string, string>; files: string[]; show?: (path: string) => string }): OwnerReferences;
export function mergeOwnerReferences(workflow: Record<string, unknown>, owner: OwnerReferences): Record<string, unknown>;
