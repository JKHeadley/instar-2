import type { Result } from './runner.mjs';
export function createDriver(host: object): { execute(request: object, options?: { signal: AbortSignal }): Promise<Result> };
