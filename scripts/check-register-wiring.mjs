import ts from 'typescript';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// Scope of proof: statically imported core ports with literal kind/id arguments.
// Computed ids and dynamic construction remain an explicit residual, not complete coverage.
function sourceProgram(sources) {
  const config = ts.readConfigFile('tsconfig.json', ts.sys.readFile).config;
  const options = ts.parseJsonConfigFileContent(config, ts.sys, process.cwd()).options;
  const host = ts.createCompilerHost(options);
  const originals = host.getSourceFile.bind(host);
  const files = new Map(Object.entries(sources).map(([p, s]) => [resolve(p), s]));
  host.fileExists = p => files.has(resolve(p)) || ts.sys.fileExists(p);
  host.readFile = p => files.get(resolve(p)) ?? ts.sys.readFile(p);
  host.getSourceFile = (p, language, ...rest) => files.has(resolve(p))
    ? ts.createSourceFile(p, files.get(resolve(p)), language, true) : originals(p, language, ...rest);
  return ts.createProgram([...files.keys()], options, host);
}
export function inspectSource(path, source, sources = {}, program = sourceProgram({ ...sources, [path]: source })) {
  const file = program.getSourceFile(resolve(path));
  const checker = program.getTypeChecker();
  const core = new Set(['src/register/governance.ts', 'dist/register/governance.d.ts', 'src/decode/decode.ts', 'dist/decode/decode.d.ts'].map(p => resolve(p)));
  function identity(node, depth = 0) {
    if (depth > 12) return undefined;
    let symbol = checker.getSymbolAtLocation(node);
    if (symbol?.flags & ts.SymbolFlags.Alias) symbol = checker.getAliasedSymbol(symbol);
    if (symbol?.declarations?.some(d => core.has(resolve(d.getSourceFile().fileName)))) return symbol.name;
    const variable = symbol?.declarations?.find(ts.isVariableDeclaration);
    if (variable?.initializer && (ts.isIdentifier(variable.initializer) || ts.isPropertyAccessExpression(variable.initializer)))
      return identity(ts.isPropertyAccessExpression(variable.initializer) ? variable.initializer.name : variable.initializer, depth + 1);
    return undefined;
  }
  const imported = new Map(); const namespaces = new Set(); const constructs = []; const reads = []; const invokes = []; const residual = []; const scopes = {};
  for (const node of file.statements) if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
    const resolved = ts.resolveModuleName(node.moduleSpecifier.text, resolve(path), { moduleResolution: ts.ModuleResolutionKind.NodeNext }, ts.sys).resolvedModule?.resolvedFileName;
    if (![resolve('src/index.ts'), resolve('src/register/index.ts'), resolve('src/register/governance.ts'), resolve('dist/index.d.ts'), resolve('dist/register/index.d.ts')].includes(resolved)
      && !['@instar/constitutional-types', '@instar/constitutional-types/register'].includes(node.moduleSpecifier.text)) {
      if (!resolved && node.importClause?.getText(file).match(/constructGoverned|readRegisterEntry|decode/))
        residual.push({ path, reason: 'unresolved static import of a possible core port: ' + node.moduleSpecifier.text });
      continue;
    }
    const bindings = node.importClause?.namedBindings;
    if (bindings && ts.isNamedImports(bindings)) for (const e of bindings.elements) imported.set(e.name.text, e.propertyName?.text ?? e.name.text);
    if (bindings && ts.isNamespaceImport(bindings)) namespaces.add(bindings.name.text);
  }
  function visit(node) {
    if (ts.isCallExpression(node)) {
      if (node.expression.kind === ts.SyntaxKind.ImportKeyword) residual.push({ path, reason: 'dynamic import is outside static port proof' });
      const name = identity(ts.isPropertyAccessExpression(node.expression) ? node.expression.name : node.expression)
        ?? (ts.isIdentifier(node.expression) ? imported.get(node.expression.text)
        : ts.isPropertyAccessExpression(node.expression) && ts.isIdentifier(node.expression.expression) && namespaces.has(node.expression.expression.text) ? node.expression.name.text : undefined);
      const literal = n => n && ts.isStringLiteralLike(n) ? n.text : undefined;
      let scope = 'module';
      for (let n = node.parent; n; n = n.parent) {
        if (ts.isFunctionDeclaration(n) && n.name) { scope = n.name.text; break; }
        if (ts.isVariableDeclaration(n) && (ts.isArrowFunction(n.initializer) || ts.isFunctionExpression(n.initializer))) { scope = n.name.getText(file); break; }
      }
      scopes[scope] ??= { reads: [], invokes: [] };
      if (name === 'constructGoverned') {
        const kind = literal(node.arguments[0]); const id = literal(node.arguments[1]);
        if (!kind || !id) residual.push({ path, line: file.getLineAndCharacterOfPosition(node.getStart()).line + 1, reason: 'computed or missing governed-port kind/id' });
        else constructs.push({ kind, id, path, symbol: scope });
      }
      if (name === 'decode') { const type = literal(node.arguments[0]); if (type) { invokes.push(`decode:${type}`); scopes[scope].invokes.push(`decode:${type}`); } }
      if (name === 'readRegisterEntry') { const id = literal(node.arguments[0]); if (id) { reads.push(id); scopes[scope].reads.push(id); } }
    }
    ts.forEachChild(node, visit);
  }
  visit(file); return { constructs, reads, invokes, residual, scopes };
}
export function checkWiring(register, sourceFiles) {
  const program = sourceProgram(sourceFiles);
  const reports = Object.entries(sourceFiles).map(([path, source]) => inspectSource(path, source, sourceFiles, program)); const issues = [];
  const constructs = reports.flatMap(r => r.constructs); const residual = reports.flatMap(r => r.residual);
  for (const c of constructs) if (!register.entries.some(e => e.declaration.id === c.id && e.declaration.kind === c.kind)) issues.push(`P3-NF-04: ${c.path} constructs undeclared ${c.id}`);
  for (const { declaration: d } of register.entries) if (d.kind === 'blocking sites') {
    const multi = d.requiredFacts.rungs !== undefined;
    const rungs = multi ? d.requiredFacts.rungs : [d.requiredFacts];
    if (!Array.isArray(rungs) || !rungs.length || multi && ['decidesAlone', 'criticality', 'failDirection', 'preservesInput', 'enforces', 'model'].some(k => k in d.requiredFacts)) {
      issues.push(`P3-NF-26: ${d.id} malformed/ambiguous rung list`); continue;
    }
    if (rungs.some(r => !r || !['no', 'ruled-three', 'governed-state'].includes(r.decidesAlone) || !['open', 'closed'].includes(r.failDirection) || !r.preservesInput || !r.criticality)) issues.push(`P3-NF-26: ${d.id} malformed rung`);
    for (const rung of rungs) if (rung.decidesAlone === 'governed-state') {
      const source = sourceFiles[d.declaredBy.path]; const report = source === undefined ? undefined : inspectSource(d.declaredBy.path, source, sourceFiles, program);
      const e = rung.enforces;
      const scope = report?.scopes[d.declaredBy.symbol];
      if (!e || !scope?.reads.includes(e.record) || !scope.invokes.includes(e.decoder)) issues.push(`P3-NF-26: ${d.id} does not read enforced record and invoke named decoder`);
    }
  }
  return { issues, residual, constructs, reports };
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const walk = dir => readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(`${dir}/${e.name}`) : e.name.endsWith('.ts') ? [`${dir}/${e.name}`] : []);
  const register = JSON.parse(readFileSync('generated/register.json', 'utf8'));
  const result = checkWiring(register, Object.fromEntries(walk('src').map(p => [p, readFileSync(p, 'utf8')])));
  if (result.issues.length) { console.error(result.issues.join('\n')); process.exitCode = 1; }
  else console.log(JSON.stringify({ ...result, completeEnumeration: false, boundary: 'static port calls; reflection, computed ids and plugin construction remain residual' }));
}
