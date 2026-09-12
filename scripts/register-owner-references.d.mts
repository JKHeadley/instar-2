import type { DecoderBinding } from './check-register-wiring.mjs';
export interface OwnerReferences {
  references: { provider: string; id: string }[];
  catalog: { fixtures: { id: string; stage: string }[]; probes: { id: string; cadence: number }[] };
  decoders: DecoderBinding[]; documents: { id: string; artifact: { path: string; hash: string }; declarationPath: string }[];
  artifacts: Record<string, string>;
}
export interface OwnerReferenceEnrollment { part: number; owner: string; manifest: { path: string; hash: string } }
export const ownerManifestPath: string;
export const ownerManifestPaths: string[];
export function retainedOwnerEnrollments(input: { sources: Record<string, string> }): OwnerReferenceEnrollment[];
export function loadOwnerReferences(root: string, input: { commit: string; sources: Record<string, string>; files: string[] }, enrollments?: readonly OwnerReferenceEnrollment[]): OwnerReferences;
export function mergeOwnerReferences(workflow: Record<string, unknown>, owner: OwnerReferences): Record<string, unknown>;
