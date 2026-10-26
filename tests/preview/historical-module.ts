import { writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';

// Keep historical test modules in the caller's temporary directory. Writing them
// beside current sources races the gate's per-worker source-digest sampling.
// Resolve only import/export specifiers, preserving the historical implementation
// and the same current dependency identities that the former sibling copy used.
export function historicalModule(source: string, original: string, destination: string): string {
  const parsed = ts.createSourceFile(original, source, ts.ScriptTarget.Latest, true);
  const edits: { start: number; end: number; text: string }[] = [];
  for (const statement of parsed.statements) {
    if (!ts.isImportDeclaration(statement) && !ts.isExportDeclaration(statement)) continue;
    const specifier = statement.moduleSpecifier;
    if (!specifier || !ts.isStringLiteral(specifier) || !specifier.text.startsWith('.')) continue;
    edits.push({ start: specifier.getStart(parsed), end: specifier.end,
      text: JSON.stringify(resolve(dirname(original), specifier.text)) });
  }
  for (const edit of edits.reverse()) source = source.slice(0, edit.start) + edit.text + source.slice(edit.end);
  writeFileSync(destination, source, { flag: 'wx' });
  return pathToFileURL(destination).href;
}
