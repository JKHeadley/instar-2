/** The composition of declared entry points: their static import closure, less the certifying declaration. */
export function compositionClosure(entries: readonly string[], read: (path: string) => string | null, declaration?: string,
  exists?: (path: string) => boolean): { files: string[]; complete: boolean };
export function compositionDigest(runtime: string, files: readonly string[], read: (path: string) => string | null): string | null;
export function fileDigest(path: string): string;
export function currentRuntime(): string;
