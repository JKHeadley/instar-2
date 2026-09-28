import ts from 'typescript';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readCommit } from './register-source.mjs';
import { loadOwnerReferences, ownerManifestPaths } from './register-owner-references.mjs';
import { shippedInventory } from './register-inventory.mjs';
import { checkShipped } from './register-shipped.mjs';

// Public consumer symbols, not P3-owned decoders/schemas. Optional source-only
// discovery lets a scanner report actual P2/P4 calls without inventing catalog
// references: the build still requires the owner's committed manifest bindings.
const consumers = [
  ['createFactStore', 'facts/index', 'facts/store'], ['authorAndAppend', 'facts/index', 'facts/store'],
  ['prepareSnapshot', 'facts/index', 'facts/snapshot'],
  ['foldProjection', 'projections/index', 'projections/fold'], ['readProjection', 'projections/index', 'projections/fold'],
  ...['intakeDedupDefinition', 'intakeWorkRegistration', 'intakeStopRegistration', 'intakeVerifiedActRegistration'].map(id => [id, 'intake/index', 'intake/records']),
].map(([id, module, artifact]) => ({ id, module: { path: `src/${module}.ts` }, artifact: { path: `src/${artifact}.ts` }, optional: true }));

// Scope of proof: statically imported core ports with literal kind/id arguments.
// Computed ids and dynamic construction remain an explicit residual, not complete coverage.
function sourceProgram(sources) {
  // This is a closed source proof, not the worktree's build configuration. Every
  // import/re-export link must come from the supplied graph, including .d.ts.
  // Neither ambient tsconfig/package metadata nor dist/helpers may finish it.
  const options = { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.NodeNext,
    moduleResolution: ts.ModuleResolutionKind.NodeNext, noLib: true, types: [], allowJs: true,
    paths: Object.fromEntries(['', '/register', '/rungraph', '/intake', '/facts', '/projections'].map(part =>
      ['@instar/constitutional-types' + part, [resolve('src' + part + '/index.ts')]])) };
  const host = ts.createCompilerHost(options);
  const files = new Map(Object.entries(sources).map(([p, s]) => [resolve(p), s]));
  host.fileExists = p => files.has(resolve(p));
  host.directoryExists = p => [...files.keys()].some(f => f.startsWith(resolve(p) + '/'));
  host.readFile = p => files.get(resolve(p));
  host.realpath = p => resolve(p);
  host.getSourceFile = (p, language) => files.has(resolve(p))
    ? ts.createSourceFile(p, files.get(resolve(p)), language, true) : undefined;
  const program = ts.createProgram([...files.keys()], options, host);
  program.resolveSourceModule = (specifier, from) => ts.resolveModuleName(specifier, from, options, host).resolvedModule?.resolvedFileName;
  return program;
}
function ownerSymbols(program, sources, bindings) {
  const checker = program.getTypeChecker(); const symbols = new Map();
  for (const binding of bindings) {
    const file = program.getSourceFile(resolve(binding.module.path));
    const module = file && checker.getSymbolAtLocation(file);
    const name = binding.symbol ?? binding.id;
    let symbol = module && checker.getExportsOfModule(module).find(s => s.name === name);
    if (symbol?.flags & ts.SymbolFlags.Alias) symbol = checker.getAliasedSymbol(symbol);
    const declaration = symbol?.declarations?.find(d => resolve(d.getSourceFile().fileName) === resolve(binding.artifact.path)
      && d.getSourceFile().text === sources[binding.artifact.path] && d.name?.getText() === name
      && (ts.isFunctionDeclaration(d) || ts.isVariableDeclaration(d) && d.parent.flags & ts.NodeFlags.Const
        && d.initializer && (ts.isArrowFunction(d.initializer) || ts.isFunctionExpression(d.initializer))));
    if (binding.optional && !declaration) continue;
    if (!declaration || !checker.getTypeOfSymbolAtLocation(symbol, declaration).getCallSignatures().length)
      throw new Error('unresolved public owner decoder export ' + binding.id);
    // P1's schema-dispatched decode still uses its literal schema argument;
    // binding it as a generic owner call would lose that distinction.
    if (!binding.id.startsWith('decode:')) symbols.set(symbol, name);
  }
  return symbols;
}
export function inspectSource(path, source, sources = {}, program = sourceProgram({ ...sources, [path]: source }), owners = new Map()) {
  const file = program.getSourceFile(resolve(path));
  const checker = program.getTypeChecker();
  const core = new Set(['src/register/governance.ts', 'dist/register/governance.d.ts', 'src/decode/decode.ts', 'dist/decode/decode.d.ts'].map(p => resolve(p)));
  function immutableNamespace(node, depth = 0) {
    if (depth > 12 || !ts.isIdentifier(node)) return false;
    // Inspect the binding before following TypeScript's alias symbol. A member
    // signature alone survives parameter substitution and receiver reassignment.
    const declarations = checker.getSymbolAtLocation(node)?.declarations ?? [];
    if (declarations.some(ts.isNamespaceImport)) return true;
    const variable = declarations.find(ts.isVariableDeclaration);
    return !!(variable?.initializer && variable.parent.flags & ts.NodeFlags.Const
      && immutableNamespace(variable.initializer, depth + 1));
  }
  function identity(node, depth = 0) {
    if (depth > 12) return undefined;
    let symbol = checker.getSymbolAtLocation(ts.isPropertyAccessExpression(node) ? node.name : node);
    if (symbol?.flags & ts.SymbolFlags.Alias) symbol = checker.getAliasedSymbol(symbol);
    if (owners.has(symbol)) return !ts.isPropertyAccessExpression(node) || immutableNamespace(node.expression)
      ? 'owner:' + owners.get(symbol) : undefined;
    if (symbol?.name === 'take' && symbol.declarations?.some(d =>
      ['src/intake/boundary.ts', 'src/facts/boundary.ts', 'src/register/boundary.ts'].some(p => resolve(p) === resolve(d.getSourceFile().fileName)))) return 'unwrap:take';
    if (symbol?.declarations?.some(d => core.has(resolve(d.getSourceFile().fileName))))
      return ts.isPropertyAccessExpression(node) && !immutableNamespace(node.expression) ? undefined : symbol.name;
    const variable = symbol?.declarations?.find(ts.isVariableDeclaration);
    if (variable?.initializer && (ts.isIdentifier(variable.initializer) || ts.isPropertyAccessExpression(variable.initializer))) {
      const target = identity(variable.initializer, depth + 1);
      return target && (!(variable.parent.flags & ts.NodeFlags.Const)
        || ts.isPropertyAccessExpression(node) && !immutableNamespace(node.expression)) ? undefined : target;
    }
    return undefined;
  }
  const target = node => node && identity(node)?.replace(/^owner:/, '');
  const symbolOf = node => { let s = checker.getSymbolAtLocation(node); if (s?.flags & ts.SymbolFlags.Alias) s = checker.getAliasedSymbol(s); return s; };
  const mutated = new Set();
  function mutationRoot(node, depth = 0) {
    if (!node || depth > 16) return undefined;
    if (ts.isParenthesizedExpression(node) || ts.isAsExpression(node) || ts.isNonNullExpression(node)) return mutationRoot(node.expression, depth + 1);
    if (ts.isPropertyAccessExpression(node) || ts.isElementAccessExpression(node)) return mutationRoot(node.expression, depth + 1);
    if (!ts.isIdentifier(node)) return undefined;
    const symbol = symbolOf(node), d = symbol?.declarations?.find(ts.isVariableDeclaration);
    return d?.initializer && ts.isIdentifier(d.initializer) ? mutationRoot(d.initializer, depth + 1) : symbol;
  }
  function markAssigned(node) {
    if (ts.isParenthesizedExpression(node)) return markAssigned(node.expression);
    if (ts.isArrayLiteralExpression(node)) { for (const e of node.elements) markAssigned(ts.isSpreadElement(e) ? e.expression : e); return; }
    if (ts.isObjectLiteralExpression(node)) {
      for (const p of node.properties) {
        if (ts.isShorthandPropertyAssignment(p)) mutated.add(checker.getShorthandAssignmentValueSymbol(p));
        else if (ts.isPropertyAssignment(p)) markAssigned(p.initializer);
        else if (ts.isSpreadAssignment(p)) markAssigned(p.expression);
      }
      return;
    }
    if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.EqualsToken) return markAssigned(node.left);
    mutated.add(mutationRoot(node));
  }
  function collectMutations(node) {
    if (ts.isBinaryExpression(node) && node.operatorToken.kind >= ts.SyntaxKind.FirstAssignment && node.operatorToken.kind <= ts.SyntaxKind.LastAssignment)
      markAssigned(node.left);
    if ((ts.isForOfStatement(node) || ts.isForInStatement(node)) && !ts.isVariableDeclarationList(node.initializer)) markAssigned(node.initializer);
    if (ts.isDeleteExpression(node) || ts.isPostfixUnaryExpression(node) || ts.isPrefixUnaryExpression(node)) mutated.add(mutationRoot(node.operand ?? node.expression));
    if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)
      && ['push', 'pop', 'shift', 'unshift', 'splice', 'fill', 'copyWithin', 'sort', 'reverse'].includes(node.expression.name.text)) mutated.add(mutationRoot(node.expression.expression));
    ts.forEachChild(node, collectMutations);
  }
  collectMutations(file);
  function origin(node, depth = 0) {
    if (!node || depth > 16) return undefined;
    if (ts.isParenthesizedExpression(node) || ts.isAsExpression(node) || ts.isNonNullExpression(node) || ts.isSatisfiesExpression(node)) return origin(node.expression, depth + 1);
    if (ts.isIdentifier(node)) {
      const d = symbolOf(node)?.declarations?.find(ts.isVariableDeclaration);
      if (d) return d.parent.flags & ts.NodeFlags.Const && !mutated.has(mutationRoot(node)) ? origin(d.initializer, depth + 1) : undefined;
    }
    if (ts.isCallExpression(node) && target(node.expression) === 'unwrap:take' && node.arguments.length === 1) return origin(node.arguments[0], depth + 1);
    return node;
  }
  function returned(call) {
    // Expand only a uniquely resolved, unmodified LOCAL helper binding. A
    // retained function declaration/member type is not proof of the called body.
    // External/member/dynamic helpers remain outside this bounded source form.
    if (!ts.isCallExpression(call) || !ts.isIdentifier(call.expression)) return [];
    const symbol = symbolOf(call.expression);
    if (!symbol || mutated.has(symbol)) return [];
    const declarations = symbol.declarations?.filter(ts.isFunctionDeclaration) ?? [];
    const d = declarations.length === 1 && declarations[0].getSourceFile() === file ? declarations[0] : undefined;
    const values = [];
    if (d?.body) {
      const visit = n => { if (ts.isReturnStatement(n)) { if (n.expression) values.push(n.expression); return; }
        if (n !== d.body && ts.isFunctionLike(n)) return; ts.forEachChild(n, visit); };
      visit(d.body);
    }
    return values;
  }
  function factory(node) { const n = origin(node); return n && ts.isCallExpression(n) && target(n.expression) === 'createFactStore' ? n : undefined; }
  function hasStoreRead(node, depth = 0) {
    const n = origin(node); if (!n || depth > 16) return false;
    if (ts.isConditionalExpression(n)) return hasStoreRead(n.whenTrue, depth + 1) && hasStoreRead(n.whenFalse, depth + 1);
    if (ts.isArrayLiteralExpression(n)) return n.elements.some(e => ts.isSpreadElement(e) && hasStoreRead(e.expression, depth + 1));
    if (ts.isCallExpression(n)) {
      if (ts.isPropertyAccessExpression(n.expression) && n.expression.name.text === 'read' && factory(n.expression.expression)) return true;
      const values = returned(n); if (values.length) return values.every(v => hasStoreRead(v, depth + 1));
      // Four's merge/dedup helper preserves each input fact as the Map value.
      // Merely mentioning read() in a discarded argument/comma expression is
      // not evidence that prepareSnapshot consumes those facts.
      if (ts.isPropertyAccessExpression(n.expression)) {
        const receiver = origin(n.expression.expression);
        if (n.expression.name.text === 'values' && !n.arguments.length && receiver && ts.isNewExpression(receiver)
          && ts.isIdentifier(receiver.expression) && receiver.expression.text === 'Map' && !symbolOf(receiver.expression)?.declarations?.length)
          return hasStoreRead(receiver.arguments?.[0], depth + 1);
        if (n.expression.name.text === 'map' && n.arguments.length === 1) {
          const mapper = n.arguments[0];
          if (ts.isArrowFunction(mapper) && mapper.parameters.length === 1 && ts.isArrayLiteralExpression(mapper.body)
            && mapper.body.elements.length === 2 && ts.isIdentifier(mapper.body.elements[1])
            && symbolOf(mapper.body.elements[1]) === symbolOf(mapper.parameters[0].name)) return hasStoreRead(receiver, depth + 1);
        }
      }
    }
    return false;
  }
  function dedupRead(call) {
    const definition = origin(call.arguments[1]), view = origin(call.arguments[0]);
    if (!definition || !ts.isCallExpression(definition) || target(definition.expression) !== 'intakeDedupDefinition'
      || !view || !ts.isCallExpression(view) || target(view.expression) !== 'foldProjection' || origin(view.arguments[0]) !== definition) return false;
    const snapshot = origin(view.arguments[1]);
    return !!(snapshot && ts.isCallExpression(snapshot) && target(snapshot.expression) === 'prepareSnapshot' && hasStoreRead(snapshot.arguments[0]));
  }
  function properties(node, key, depth = 0) {
    const n = origin(node); if (!n || depth > 16) return [];
    if (ts.isConditionalExpression(n)) {
      const a = properties(n.whenTrue, key, depth + 1), b = properties(n.whenFalse, key, depth + 1); return a.length && b.length ? [...a, ...b] : [];
    }
    if (ts.isCallExpression(n)) {
      const values = returned(n).map(v => properties(v, key, depth + 1)); return values.length && values.every(v => v.length) ? values.flat() : [];
    }
    if (ts.isObjectLiteralExpression(n)) for (const p of [...n.properties].reverse()) {
      if ((ts.isPropertyAssignment(p) || ts.isShorthandPropertyAssignment(p)) && (ts.isIdentifier(p.name) || ts.isStringLiteral(p.name)) && p.name.text === key)
        return [ts.isPropertyAssignment(p) ? p.initializer : p.name];
      // An unknown later spread may replace the registry; do not look past it.
      if (ts.isSpreadAssignment(p)) return properties(p.expression, key, depth + 1);
    }
    return [];
  }
  function registrations(node, depth = 0) {
    const n = origin(node); if (!n || depth > 16) return [];
    if (ts.isArrayLiteralExpression(n)) return n.elements.flatMap(e => registrations(ts.isSpreadElement(e) ? e.expression : e, depth + 1));
    if (ts.isCallExpression(n) && ['intakeWorkRegistration', 'intakeStopRegistration', 'intakeVerifiedActRegistration'].includes(target(n.expression))) return [target(n.expression)];
    return [];
  }
  function admittedRegistrations(call, receiver = false) {
    const store = factory(receiver ? call.expression.expression : call.arguments[2]); if (!store) return [];
    const context = store.arguments[0];
    if (!receiver && origin(call.arguments[1]) !== origin(context)) return [];
    const alternatives = properties(context, 'ownedBodies').map(v => registrations(v));
    return alternatives.length ? alternatives[0].filter(id => alternatives.every(a => a.includes(id))) : [];
  }
  const constructs = []; const reads = []; const invokes = []; const residual = []; const scopes = {};
  for (const node of file.statements) if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
    const resolved = program.resolveSourceModule(node.moduleSpecifier.text, resolve(path));
    if (![resolve('src/index.ts'), resolve('src/register/index.ts'), resolve('src/register/governance.ts'), resolve('dist/index.d.ts'), resolve('dist/register/index.d.ts')].includes(resolved)
      && !['@instar/constitutional-types', '@instar/constitutional-types/register'].includes(node.moduleSpecifier.text)) {
      if (!resolved && node.importClause?.getText(file).match(/constructGoverned|readRegisterEntry|decode/))
        residual.push({ path, reason: 'unresolved static import of a possible core port: ' + node.moduleSpecifier.text });
      continue;
    }
  }
  function visit(node) {
    if (ts.isCallExpression(node)) {
      if (node.expression.kind === ts.SyntaxKind.ImportKeyword) residual.push({ path, reason: 'dynamic import is outside static port proof' });
      if (ts.isElementAccessExpression(node.expression)) residual.push({ path, reason: 'computed invocation is outside static port proof' });
      const name = identity(node.expression);
      const literal = n => n && ts.isStringLiteralLike(n) ? n.text : undefined;
      let scope = 'module';
      for (let n = node.parent; n; n = n.parent) {
        if (ts.isFunctionDeclaration(n) && n.name) { scope = n.name.text; break; }
        if (ts.isVariableDeclaration(n) && (ts.isArrowFunction(n.initializer) || ts.isFunctionExpression(n.initializer))) { scope = n.name.getText(file); break; }
      }
      scopes[scope] ??= { reads: [], invokes: [], enforcedReads: [] };
      if (name === 'constructGoverned') {
        const kind = literal(node.arguments[0]); const id = literal(node.arguments[1]);
        if (!kind || !id) residual.push({ path, line: file.getLineAndCharacterOfPosition(node.getStart()).line + 1, reason: 'computed or missing governed-port kind/id' });
        else constructs.push({ kind, id, path, symbol: scope });
      }
      if (name === 'decode') { const type = literal(node.arguments[0]); if (type) { invokes.push(`decode:${type}`); scopes[scope].invokes.push(`decode:${type}`); } }
      const credit = id => { invokes.push(id); scopes[scope].invokes.push(id); };
      const receiverAppend = ts.isPropertyAccessExpression(node.expression) && node.expression.name.text === 'append' && factory(node.expression.expression);
      if (name === 'owner:readProjection') {
        if (dedupRead(node)) { credit('readProjection'); credit('intakeDedupDefinition'); }
        else residual.push({ path, reason: 'projection read lacks the immutable intake definition / snapshot / store-read chain' });
      } else if (name === 'owner:authorAndAppend' || receiverAppend) {
        const owned = admittedRegistrations(node, !!receiverAppend);
        if (owned.includes('intakeWorkRegistration')) { credit(receiverAppend ? 'createFactStore.append' : 'authorAndAppend'); for (const id of owned) credit(id); }
        else residual.push({ path, reason: 'admission lacks a real fact store with the intake owner registration in its context' });
      } else if (name?.startsWith('owner:') && !consumers.some(c => c.id === name.slice(6))) credit(name.slice(6));
      if (name === 'readRegisterEntry') { const id = literal(node.arguments[0]); if (id) { reads.push(id); scopes[scope].reads.push(id); } }
      if (identity(node.expression) === 'readEnforcedRecord') {
        const [site, record, decoder] = node.arguments.slice(0, 3).map(literal);
        if (site && record && decoder) scopes[scope].enforcedReads.push({ site, record, decoder });
        else residual.push({ path, reason: 'enforced-record read requires literal site/record/decoder' });
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(file); return { constructs, reads, invokes, residual, scopes };
}
export function scanSources(sourceFiles, decoderBindings = []) {
  const program = sourceProgram(sourceFiles);
  const owners = ownerSymbols(program, sourceFiles, [...consumers, ...decoderBindings]);
  const reports = Object.entries(sourceFiles).map(([path, source]) => inspectSource(path, source, sourceFiles, program, owners));
  // A pair-aware read supplies record-read evidence only for its own colocated
  // constructed gate; a different site's guard cannot discharge this site's read.
  for (const report of reports) for (const [scope, observed] of Object.entries(report.scopes))
    for (const read of observed.enforcedReads) if (report.constructs.some(c => c.symbol === scope && c.id === read.site && c.kind === 'blocking sites')) {
      observed.reads.push(read.record); report.reads.push(read.record);
    }
  const constructs = reports.flatMap(r => r.constructs); const residual = reports.flatMap(r => r.residual);
  return { reports, constructs, residual, program };
}
export function checkWiring(register, sourceFiles, scanned = scanSources(sourceFiles)) {
  const { reports, constructs, residual } = scanned; const issues = [];
  for (const c of constructs) if (!register.entries.some(e => e.declaration.id === c.id && e.declaration.kind === c.kind)) issues.push(`P3-NF-04: ${c.path} constructs undeclared ${c.id}`);
  for (const { declaration: d } of register.entries) if (d.kind === 'blocking sites') {
    const multi = d.requiredFacts.rungs !== undefined;
    const rungs = multi ? d.requiredFacts.rungs : [d.requiredFacts];
    if (!Array.isArray(rungs) || !rungs.length || multi && ['decidesAlone', 'criticality', 'failDirection', 'preservesInput', 'enforces', 'model'].some(k => k in d.requiredFacts)) {
      issues.push(`P3-NF-26: ${d.id} malformed/ambiguous rung list`); continue;
    }
    if (rungs.some(r => !r || !['no', 'ruled-three', 'governed-state'].includes(r.decidesAlone) || !['open', 'closed'].includes(r.failDirection) || !r.preservesInput || !r.criticality)) issues.push(`P3-NF-26: ${d.id} malformed rung`);
    for (const rung of rungs) if (rung.decidesAlone === 'governed-state') {
      const report = reports[Object.keys(sourceFiles).indexOf(d.declaredBy.path)];
      const e = rung.enforces;
      const scope = report?.scopes[d.declaredBy.symbol];
      if (!e || !scope?.reads.includes(e.record) || !scope.invokes.includes(e.decoder)) issues.push(`P3-NF-26: ${d.id} does not read enforced record and invoke named decoder`);
      if (scope?.enforcedReads?.some(r => r.site === d.id && !rungs.some(rung => rung.decidesAlone === 'governed-state'
        && rung.enforces?.record === r.record && rung.enforces?.decoder === r.decoder)))
        issues.push(`P3-NF-26: ${d.id} enforced-record read names a different declared pair`);
    }
  }
  return { issues, residual, constructs, reports };
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const register = JSON.parse(readFileSync('generated/register.json', 'utf8'));
  const input = readCommit(process.cwd(), register.commit);
  const owner = loadOwnerReferences(process.cwd(), input);
  for (const [path, content] of Object.entries({ ...owner.artifacts,
    ...Object.fromEntries(Object.entries(input.sources).filter(([p]) => ownerManifestPaths.includes(p))) }))
    if (readFileSync(path, 'utf8') !== content) throw new Error('owner reference source pin trails ' + path);
  // The roster is the shipped inventory of the working tree, not a src/ glob.
  const tracked = execFileSync('git', ['ls-files'], { encoding: 'utf8' }).trim().split('\n');
  const livePaths = shippedInventory(tracked, path => readFileSync(path, 'utf8')).files;
  if (JSON.stringify(livePaths) !== JSON.stringify(Object.keys(input.code).sort()))
    throw new Error('source wiring roster differs from committed graph; commit source changes and regenerate');
  for (const path of livePaths) if (readFileSync(path, 'utf8') !== input.code[path])
    throw new Error('source wiring pin trails ' + path);
  const sourceFiles = input.code; const scanned = scanSources(sourceFiles, owner.decoders);
  const result = checkWiring(register, sourceFiles, scanned);
  const testsNaming = name => { try { return execFileSync('git', ['grep', '-l', '-F', name, '--', 'tests'], { encoding: 'utf8' }).split('\n').filter(p => p.endsWith('.test.ts')); } catch { return []; } };
  result.issues.push(...checkShipped(register, input.inventory, scanned.program, owner, input.show, testsNaming));
  if (result.issues.length) { console.error(result.issues.join('\n')); process.exitCode = 1; }
  else console.log(JSON.stringify({ ...result, completeEnumeration: false, boundary: 'static port calls; reflection, computed ids and plugin construction remain residual' }));
}
