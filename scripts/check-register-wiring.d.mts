export function inspectSource(path: string, source: string, sources?: Record<string, string>): { constructs: { kind: string; id: string; path: string }[]; reads: string[]; invokes: string[]; residual: unknown[] };
export interface DecoderBinding { id: string; module: { path: string; hash: string }; artifact: { path: string; hash: string } }
export interface Scan { reports: { scopes: Record<string, { reads: string[]; invokes: string[] }> }[]; residual: unknown[]; constructs: unknown[] }
export function scanSources(files: Record<string, string>, bindings?: DecoderBinding[]): Scan;
export function checkWiring(register: unknown, files: Record<string, string>, scanned?: Scan): { issues: string[]; residual: unknown[]; constructs: unknown[] };
