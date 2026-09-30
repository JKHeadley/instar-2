export function importClosure(entries: readonly string[], read: (path: string) => string | null, exists: (path: string) => boolean, core?: (path: string) => boolean):
  { files: string[]; unresolved: { from: string | null; specifier: string }[]; computed: { from: string; line: number }[] };
