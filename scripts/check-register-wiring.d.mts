export function inspectSource(path: string, source: string, sources?: Record<string, string>): { constructs: Construct[]; reads: string[]; invokes: string[]; residual: ResidualRow[] };
export interface DecoderBinding { id: string; symbol?: string; module: { path: string; hash: string }; artifact: { path: string; hash: string } }
export interface ResidualRow { path?: string; reason: string }
export interface Construct { kind: string; id: string; path: string; symbol: string }
export interface Scan { reports: { scopes: Record<string, { reads: string[]; invokes: string[] }> }[]; residual: ResidualRow[]; constructs: Construct[]; program: import('typescript').Program }
export function scanSources(files: Record<string, string>, bindings?: DecoderBinding[]): Scan;
export function checkWiring(register: unknown, files: Record<string, string>, scanned?: Scan): { issues: string[]; residual: ResidualRow[]; constructs: Construct[] };
