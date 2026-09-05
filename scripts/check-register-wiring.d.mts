export function inspectSource(path: string, source: string): { constructs: { kind: string; id: string; path: string }[]; reads: string[]; invokes: string[]; residual: unknown[] };
export function checkWiring(register: unknown, files: Record<string, string>): { issues: string[]; residual: unknown[]; constructs: unknown[] };
