import { mkdtempSync } from 'node:fs';
import { rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
// @ts-expect-error the reference assembly is JavaScript, outside pure core compilation.
import { PEER_STANDIN_ID as peerId, bootSliceAssembly, sliceConfig } from '../../scripts/slice-assembly.mjs';

export interface SliceAssembly {
  readonly home: string; readonly bootIndex: number; readonly incarnation: string;
  readonly config: Readonly<Record<string, unknown>>;
  readonly registerChecks: readonly string[];
  readonly intake: { receive(raw: string, route: unknown): unknown; recover(id: string): unknown };
  readonly transport: Readonly<Record<string, (...args: never[]) => unknown>>;
  readonly effects: { readonly owner: string; settle(operation: string): unknown; inspect(): unknown;
    prepare(input: Record<string, unknown>): unknown };
  readonly effectHost: unknown;
  readonly decodeOutboundMessage: (input: unknown, host: unknown) => unknown;
  readonly judgment: { inspect(): unknown };
  readonly assessor: { readonly owner: string };
  readonly service: { readonly adapter: string; readonly decisive: boolean; journal(): { applications: readonly unknown[]; inbound: readonly unknown[] } };
  readonly custody: { readonly custody: { readonly owner: string } };
  readonly install: () => Record<string, { id: string; kind: string }>;
  readonly drive: () => Promise<Record<string, unknown>>;
  readonly facts: () => readonly { id: string; kind: string; body: Record<string, never> }[];
  readonly factsOfKind: (kind: string) => readonly { id: string; kind: string; body: Record<string, never> }[];
  readonly factOfKind: (kind: string) => { id: string; kind: string; body: Record<string, never> } | undefined;
  readonly kinds: () => readonly string[];
  readonly adapterContract: () => { capabilities: Record<string, { status: string; stage?: string }> };
  readonly declaredStage: () => string;
  readonly boundary: (name: string, extra?: Record<string, unknown>) => void;
  readonly liveFence: () => unknown;
  readonly rebuildAll: () => readonly { projection: string; equal: string; hash: string }[];
  readonly transportFacts: () => readonly { fact: { id: string }; record: Record<string, never> }[];
  readonly operationDefinition: Record<string, unknown>;
}

export { DECLARED_BOUNDARIES, PROFILE_BOUNDARIES, RECOVERY_BOUNDARIES, SLICE_BOUNDARIES, UNREACHED_BOUNDARIES } from './boundaries.js';
export const PEER_STANDIN_ID = peerId as string;
export const homes: string[] = [];

export function sliceAssembly(overrides: Record<string, unknown> = {}, home = mkdtempSync(join(tmpdir(), 'p11-unit-'))): SliceAssembly {
  homes.push(home);
  return bootSliceAssembly(home, sliceConfig(overrides)) as SliceAssembly;
}
// ASYNC teardown on the threadpool so the worker's event loop stays free during cleanup
// (REPAIR6: a synchronous rmSync of many home trees at afterAll blocked the loop long
// enough to miss the file's final onTaskUpdate RPC on a slow runner). `force: true`
// ignores a missing path, but a REAL removal failure is PROPAGATED after every deletion
// settles rather than swallowed (astra D2); homes are de-duplicated.
export async function cleanup(): Promise<void> {
  const results = await Promise.allSettled([...new Set(homes.splice(0))].map(home => rm(home, { recursive: true, force: true })));
  const failures = results.filter((r): r is PromiseRejectedResult => r.status === 'rejected');
  if (failures.length) throw new Error(`cleanup failed to remove ${failures.length} home(s): ${failures.map(f => String(f.reason)).join('; ')}`);
}
