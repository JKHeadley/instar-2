export interface SyncChildOptions {
  timeout?: number;
  killSignal?: number | string;
  [field: string]: unknown;
}

export type SyncChildCall = (...args: readonly unknown[]) => unknown;

export interface BoundSyncChildren {
  spawnSync: SyncChildCall;
  execFileSync: SyncChildCall;
  execSync: SyncChildCall;
}

export const FALLBACK_MS: number;
export const SYNC_CALLS: readonly string[];
export const BOUNDED: symbol;
export function fallbackBound(env?: Readonly<Record<string, string | undefined>>): number;
export function childBound(declared: number | undefined, fallback: number): number;
export function boundOptions(options: SyncChildOptions, bound: number, kill?: number): number | null;
export function optionsSlot(args: readonly unknown[]): number;
export function timedOut(error: unknown): boolean;
export function boundMessage(file: unknown, bound: number): string;
export function bindSyncCall(name: string, original: SyncChildCall, currentTimeout: () => number | undefined,
  fallback?: () => number, note?: (text: string) => void): SyncChildCall;
export function patchChildProcess<T extends BoundSyncChildren>(childExports: T,
  currentTimeout: () => number | undefined, fallback?: () => number, note?: (text: string) => void,
  publish?: () => void): T;
export function install(currentTimeout?: () => number | undefined): void;
