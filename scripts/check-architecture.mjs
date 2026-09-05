// Rules 1, 26, 31, 40, 42, 69, 96. This uses TypeScript's resolved types, not identifier spelling.
import ts from 'typescript';
import { readdirSync } from 'node:fs';
import { resolve, relative, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

export function createProgram(extra = {}) {
  const configPath = ts.findConfigFile(process.cwd(), ts.sys.fileExists, 'tsconfig.json');
  const loaded = ts.readConfigFile(configPath, ts.sys.readFile);
  const config = ts.parseJsonConfigFileContent(loaded.config, ts.sys, dirname(configPath));
  const virtual = new Map(Object.entries(extra).map(([path, text]) => [resolve(path), text]));
  const host = ts.createCompilerHost(config.options);
  const originalRead = host.readFile.bind(host); const originalExists = host.fileExists.bind(host);
  host.readFile = p => virtual.get(resolve(p)) ?? originalRead(p);
  host.fileExists = p => virtual.has(resolve(p)) || originalExists(p);
  host.getSourceFile = (path, languageVersion) => {
    const contents = host.readFile(path);
    return contents === undefined ? undefined : ts.createSourceFile(path, contents, languageVersion, true);
  };
  return ts.createProgram([...config.fileNames, ...virtual.keys()], config.options, host);
}

export function lintProgram(program, files) {
  const checker = program.getTypeChecker(); const issues = [];
  const targets = new Set(files.map(p => resolve(p)));
  const owner = (file, name, node) => {
    if (relative(process.cwd(), file).replaceAll('\\', '/') !== `src/${name.file}`) return false;
    for (let n = node; n; n = n.parent) if (ts.isFunctionDeclaration(n) && n.name?.text === name.function) return true;
    return false;
  };
  const tagOf = node => {
    const t = checker.getTypeAtLocation(node); const p = t.getProperty('type');
    return p ? checker.typeToString(checker.getTypeOfSymbolAtLocation(p, node)).replaceAll('"', '') : '';
  };
  const add = (file, node, rule, detail) => issues.push({ file: relative(process.cwd(), file), line: ts.getLineAndCharacterOfPosition(node.getSourceFile(), node.getStart()).line + 1, rule, detail });
  for (const source of program.getSourceFiles()) {
    if (!targets.has(resolve(source.fileName))) continue;
    const file = source.fileName;
    const isCore = relative(process.cwd(), file).replaceAll('\\', '/').startsWith('src/');
    const visit = node => {
      if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) {
        const spec = node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier) ? node.moduleSpecifier.text : '';
        if (isCore && spec && !spec.startsWith('.') && spec !== 'node:crypto') add(file, node, 'NF-52', `core external import ${spec}`);
        if (!isCore && /(?:types\/internal|decode\/(?:decode|canonical|schema))/.test(spec)) add(file, node, 'NF-51', 'private package import');
      }
      if (isCore && (node.kind === ts.SyntaxKind.AnyKeyword || (ts.isIdentifier(node) && ['Date', 'performance', 'fetch', 'process', 'XMLHttpRequest', 'setTimeout', 'setInterval', 'require', 'eval', 'Function'].includes(node.text))))
        add(file, node, 'NF-52', 'ambient I/O, time, process, dynamic code, or any');
      if (isCore && ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) add(file, node, 'NF-52', 'dynamic import');
      if (ts.isPropertyAccessExpression(node) || ts.isElementAccessExpression(node)) {
        const field = ts.isPropertyAccessExpression(node) ? node.name.text : node.argumentExpression && ts.isStringLiteral(node.argumentExpression) ? node.argumentExpression.text : '*';
        const tag = tagOf(node.expression);
        if (tag === 'Result' && ['kind', 'value', '*'].includes(field) && !owner(file, { file: 'types/internal.ts', function: 'consumeResult' }, node))
          add(file, node, 'NF-14', 'Result may only be inspected by consumeResult');
        const typename = checker.typeToString(checker.getTypeAtLocation(node.expression));
        if ((tag === 'Result' && field === 'capacity') || (typename.includes('Capacity') && ['kind', '*'].includes(field))) {
          if (!owner(file, { file: 'types/internal.ts', function: 'consumeResult' }, node)) add(file, node, 'NF-15', 'capacity is success data; consume through Result');
        }
        if (tag === 'Evidence' && ['claim', '*'].includes(field) && !owner(file, { file: 'types/operations.ts', function: 'readEvidence' }, node)) add(file, node, 'NF-66', 'claim requires freshness doorway');
        if (tag === 'Outcome' && ['kind', '*'].includes(field) && !['consumeOutcome', 'retryPermission'].some(fn => owner(file, { file: 'types/operations.ts', function: fn }, node))) add(file, node, 'NF-46', 'Outcome requires consumption/retry doorway');
        if (tag === 'Conflict' && ['left', 'right', '*'].includes(field) && !owner(file, { file: 'types/operations.ts', function: 'resolveConflict' }, node)) add(file, node, 'NF-69', 'Conflict side requires resolution doorway');
      }
      if (ts.isVariableDeclaration(node) && ts.isObjectBindingPattern(node.name) && node.initializer) {
        const tag = tagOf(node.initializer);
        if (['Result', 'Evidence', 'Outcome', 'Conflict'].includes(tag)) add(file, node, ({ Result: 'NF-14', Evidence: 'NF-66', Outcome: 'NF-46', Conflict: 'NF-69' })[tag], 'destructuring bypasses consumption doorway');
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
  }
  return issues;
}
function walk(path) { return readdirSync(path, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(`${path}/${e.name}`) : e.name.endsWith('.ts') ? [`${path}/${e.name}`] : []); }
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const program = createProgram(); const issues = lintProgram(program, walk('src'));
  if (issues.length) { console.error(JSON.stringify(issues, null, 2)); process.exitCode = 1; }
  else console.log('architecture checks passed');
}
