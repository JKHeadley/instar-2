// Rules 45 and 115: the static import closure of a shipped entry point. It follows every
// relative static import, re-export and literal dynamic import; a computed dynamic import cannot
// be followed and is reported, so a caller must declare what it loads explicitly.
import ts from 'typescript';
import { dirname, join, normalize } from 'node:path';

const resolveSpec = (from, spec, exists) => {
  const base = normalize(join(dirname(from), spec));
  for (const candidate of [base, base.replace(/\.js$/u, '.ts'), `${base}.ts`, join(base, 'index.ts')])
    if (exists(candidate)) return candidate;
  return null;
};
/** `read(path)` returns text or null and `exists(path)` a boolean, both for repository-relative paths.
 * Built core output (`dist/`) is the core itself, reached through its public index, and is not walked. */
export function importClosure(entries, read, exists, core = path => path.startsWith('dist/')) {
  const files = new Set(), unresolved = [], computed = [], stack = [...entries];
  while (stack.length) {
    const file = stack.pop();
    if (files.has(file)) continue;
    const text = read(file);
    if (text === null) { unresolved.push({ from: null, specifier: file }); continue; }
    files.add(file);
    const info = ts.preProcessFile(text, true, true);
    for (const { fileName } of info.importedFiles) {
      if (!fileName.startsWith('.')) continue;
      if (core(normalize(join(dirname(file), fileName)))) continue;
      const target = resolveSpec(file, fileName, exists);
      if (target) stack.push(target); else unresolved.push({ from: file, specifier: fileName });
    }
    const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
    const visit = node => {
      if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword
        && !(node.arguments[0] && ts.isStringLiteralLike(node.arguments[0])))
        computed.push({ from: file, line: source.getLineAndCharacterOfPosition(node.getStart()).line + 1 });
      ts.forEachChild(node, visit);
    };
    visit(source);
  }
  return { files: [...files].sort(), unresolved, computed };
}
