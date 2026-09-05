import ts from 'typescript';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// Scope of proof: statically imported core ports with literal kind/id arguments.
// Computed ids and dynamic construction remain an explicit residual, not complete coverage.
export function inspectSource(path, source) {
  const file = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const imported = new Map(); const namespaces = new Set(); const constructs = []; const reads = []; const invokes = []; const residual = []; const scopes = {};
  for (const node of file.statements) if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
    const resolved = ts.resolveModuleName(node.moduleSpecifier.text, resolve(path), { moduleResolution: ts.ModuleResolutionKind.NodeNext }, ts.sys).resolvedModule?.resolvedFileName;
    if (![resolve('src/index.ts'), resolve('src/register/index.ts'), resolve('src/register/governance.ts')].includes(resolved)) continue;
    const bindings = node.importClause?.namedBindings;
    if (bindings && ts.isNamedImports(bindings)) for (const e of bindings.elements) imported.set(e.name.text, e.propertyName?.text ?? e.name.text);
    if (bindings && ts.isNamespaceImport(bindings)) namespaces.add(bindings.name.text);
  }
  function visit(node) {
    if (ts.isCallExpression(node)) {
      const name = ts.isIdentifier(node.expression) ? imported.get(node.expression.text)
        : ts.isPropertyAccessExpression(node.expression) && ts.isIdentifier(node.expression.expression) && namespaces.has(node.expression.expression.text) ? node.expression.name.text : undefined;
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
        else constructs.push({ kind, id, path });
      }
      if (name === 'decode') { const type = literal(node.arguments[0]); if (type) { invokes.push(`decode:${type}`); scopes[scope].invokes.push(`decode:${type}`); } }
      if (name === 'readRegisterEntry') { const id = literal(node.arguments[0]); if (id) { reads.push(id); scopes[scope].reads.push(id); } }
    }
    ts.forEachChild(node, visit);
  }
  visit(file); return { constructs, reads, invokes, residual, scopes };
}
export function checkWiring(register, sourceFiles) {
  const reports = Object.entries(sourceFiles).map(([path, source]) => inspectSource(path, source)); const issues = [];
  const constructs = reports.flatMap(r => r.constructs); const residual = reports.flatMap(r => r.residual);
  for (const c of constructs) if (!register.entries.some(e => e.declaration.id === c.id && e.declaration.kind === c.kind)) issues.push(`P3-NF-04: ${c.path} constructs undeclared ${c.id}`);
  for (const { declaration: d } of register.entries) if (d.kind === 'blocking sites') {
    const rungs = d.requiredFacts.rungs ?? [d.requiredFacts];
    for (const rung of rungs) if (rung.decidesAlone === 'governed-state') {
      const source = sourceFiles[d.declaredBy.path]; const report = source === undefined ? undefined : inspectSource(d.declaredBy.path, source);
      const e = rung.enforces;
      const scope = report?.scopes[d.declaredBy.symbol];
      if (!e || !scope?.reads.includes(e.record) || !scope.invokes.includes(e.decoder)) issues.push(`P3-NF-26: ${d.id} does not read enforced record and invoke named decoder`);
    }
  }
  return { issues, residual, constructs };
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const walk = dir => readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(`${dir}/${e.name}`) : e.name.endsWith('.ts') ? [`${dir}/${e.name}`] : []);
  const register = JSON.parse(readFileSync('generated/register.json', 'utf8'));
  const result = checkWiring(register, Object.fromEntries(walk('src').map(p => [p, readFileSync(p, 'utf8')])));
  if (result.issues.length) { console.error(result.issues.join('\n')); process.exitCode = 1; }
  else console.log(JSON.stringify({ ...result, completeEnumeration: false, boundary: 'static port calls; reflection, computed ids and plugin construction remain residual' }));
}
