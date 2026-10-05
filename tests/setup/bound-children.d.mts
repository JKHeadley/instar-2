export interface SpawnBindingOptions {
  file?: unknown;
  timeout?: number;
  killSignal?: number;
  [field: string]: unknown;
}

export interface SpawnBindingResult {
  error?: number | undefined;
  [field: string]: unknown;
}

export interface SpawnBinding {
  spawn(options: SpawnBindingOptions): SpawnBindingResult;
}

export const FALLBACK_MS: number;
export const TIMED_OUT_ERRNO: number;
export function fallbackBound(env?: Readonly<Record<string, string | undefined>>): number;
export function childBound(declared: number | undefined, fallback: number): number;
export function boundOptions(options: SpawnBindingOptions, bound: number, kill?: number): number | null;
export function boundMessage(file: unknown, bound: number): string;
export function patchSpawnBinding<T extends SpawnBinding>(binding: T, currentTimeout: () => number | undefined,
  fallback?: () => number, note?: (text: string) => void): T;
export function install(currentTimeout?: () => number | undefined): void;
