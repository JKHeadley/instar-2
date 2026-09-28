// Checks the register against the shipped inventory, not only against src/**.ts
// (Rules 5, 7, 32, 36, 66, 69, 78, 84). Every finding is a build failure.
// Residual, stated rather than hidden: a second store added to an already
// declared writer file, and a blocking decision that is an ordinary conditional
// rather than a named function, are not detected here.
import ts from 'typescript';
import { posix, resolve } from 'node:path';
import { consumeResult, deriveProfile } from '../dist/index.js';
import { moduleOf, sidecarSource } from './register-inventory.mjs';

// Named node:fs members that durably change bytes on disk.
const WRITES = new Set(['writeFileSync', 'appendFileSync', 'writeSync', 'renameSync', 'createWriteStream', 'ftruncateSync', 'truncateSync',
  'copyFileSync', 'unlinkSync', 'rmSync', 'writeFile', 'appendFile', 'rename', 'truncate', 'copyFile', 'unlink', 'rm']);
// Declarations beside a non-src file name their function as the last dotted segment of their id.
const BOUNDARIES = new Set(['stores', 'blocking sites', 'parsers', 'judgment points', 'operator actions']);
const isSidecar = path => /\.(?:declarations|parser)\.json$/.test(path);

// Follow an import alias or an object-literal property (`{ gate }`, `{ gate: gate }`)
// back to the binding it carries, so `worker.gate()` counts as a use of `gate`.
function origin(checker, symbol, depth = 0) {
  if (!symbol || depth > 8) return symbol;
  if (symbol.flags & ts.SymbolFlags.Alias) return origin(checker, checker.getAliasedSymbol(symbol), depth + 1);
  const d = symbol.valueDeclaration;
  if (d && ts.isShorthandPropertyAssignment(d)) return origin(checker, checker.getShorthandAssignmentValueSymbol(d), depth + 1);
  if (d && ts.isPropertyAssignment(d) && ts.isIdentifier(d.initializer)) return origin(checker, checker.getSymbolAtLocation(d.initializer), depth + 1);
  return symbol;
}
// The reference is the callee of a call, or an argument to a call or construction,
// directly or as a property of an object literal written in the argument list
// (`open({ io: port })`). Stored in a variable's object literal, it is not passed.
function invokedOrPassed(n) {
  let e = ts.isPropertyAccessExpression(n.parent) && n.parent.name === n ? n.parent : n;
  if ((ts.isPropertyAssignment(e.parent) && e.parent.initializer === e || ts.isShorthandPropertyAssignment(e.parent))
    && ts.isObjectLiteralExpression(e.parent.parent)) e = e.parent.parent;
  const call = e.parent;
  return !!call && (ts.isCallExpression(call) || ts.isNewExpression(call))
    && (call.expression === e || (call.arguments ?? []).includes(e));
}
export function durableWriter(path, text) {
  const file = ts.createSourceFile(path, text, ts.ScriptTarget.ES2022, true);
  return file.statements.some(s => ts.isImportDeclaration(s) && ts.isStringLiteral(s.moduleSpecifier)
    && ['node:fs', 'fs', 'node:fs/promises', 'fs/promises'].includes(s.moduleSpecifier.text) && s.importClause && !s.importClause.isTypeOnly
    && (s.importClause.name || s.importClause.namedBindings && (ts.isNamespaceImport(s.importClause.namedBindings)
      || s.importClause.namedBindings.elements.some(e => WRITES.has((e.propertyName ?? e.name).text)))));
}
// "## Capabilities" lines in a module README: "- `feature-id`: what it does".
export function capabilityLines(text) {
  const section = text.split(/^## Capabilities\s*$/m)[1]?.split(/^## /m)[0] ?? '';
  return [...section.matchAll(/^- `([^`]+)`: (.+)$/gm)].map(m => ({ id: m[1], text: m[2].trim() }));
}
const features = register => register.entries.map(e => e.declaration).filter(d => d.kind === 'features' && d.status !== 'retired');
// A module's capability lines, read from its own README whether or not a launcher loads it.
const readmeLines = (dir, show) => { try { return capabilityLines(show(`${dir === '.' ? '' : dir + '/'}README.md`)); } catch { return []; } };
const sourceOf = (d, shipped) => isSidecar(d.declaredBy.path) ? sidecarSource(d.declaredBy.path, shipped) : d.declaredBy.path;

// Per launcher: which declared features its installation carries, from that launcher's
// own runtime closure. A feature is available when its declaring source is loaded AND
// enabled there: the register says it is live, or the launcher itself imports and wires
// that source. Sharing a directory with the launcher enables nothing. Availability in
// this installation is separate from the register status (graduation and live proof),
// which is reported beside it. Nothing here is hand-listed.
export function capabilityBriefing(register, inventory, show) {
  const text = new Map();
  for (const dir of new Set(features(register).map(d => moduleOf(d.declaredBy.path))))
    for (const line of readmeLines(dir, show)) text.set(`${dir}\u0000${line.id}`, line.text);
  const launchers = {};
  for (const [launcher, closure] of Object.entries(inventory.launchers)) {
    const wired = inventory.wires?.[launcher] ?? [launcher];
    launchers[launcher] = features(register).map(d => {
      const module = moduleOf(d.declaredBy.path); const source = sourceOf(d, inventory.files);
      const loaded = source ? closure.includes(source) : closure.some(p => moduleOf(p) === module);
      const enabled = d.status === 'live' || !!source && wired.includes(source);
      const availability = !loaded ? 'not-loaded' : enabled ? 'available' : 'switched-off';
      const userFacing = consumeResult(deriveProfile(d.profile, { owner: 'part-three', derivedFrom: register.shape.derivedFrom }, 'capability-briefing'),
        { Success: derived => derived.userFacing, Refused: refusal => { throw new Error(refusal.detail); } });
      return { id: d.id, status: d.status, module, availability, userFacing, text: text.get(`${module}\u0000${d.id}`) ?? null };
    }).sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
  }
  return { launchers };
}

// show(path) returns committed bytes; owner carries the committed captures and fixture catalog.
export function checkShipped(register, inventory, program, owner, show) {
  const issues = []; const shipped = inventory.files; const checker = program.getTypeChecker();
  for (const [dir, m] of Object.entries(inventory.modules)) if (!m.readme || !/^# \S/m.test(show(m.readme)))
    issues.push(`R5: shipped module ${dir} has no documentation entry (${dir === '.' ? '' : dir + '/'}README.md with a heading)`);
  const declarations = register.entries.map(e => e.declaration);
  const beside = new Map(); // shipped non-src source -> its sidecar declarations
  const bound = []; // [declaration, source, name, binding symbol]
  for (const d of declarations) if (isSidecar(d.declaredBy.path) && !d.declaredBy.path.startsWith('src/')) {
    const source = sidecarSource(d.declaredBy.path, shipped);
    if (!source) { issues.push(`R66: ${d.id} is declared beside ${d.declaredBy.path}, which describes no shipped source`); continue; }
    beside.set(source, [...beside.get(source) ?? [], d]);
    if (!BOUNDARIES.has(d.kind)) continue;
    // Bind the named function or port in the declaring file.
    const name = d.id.slice(d.id.lastIndexOf('.') + 1); const file = program.getSourceFile(resolve(source));
    const found = [];
    const visit = n => {
      if ((ts.isFunctionDeclaration(n) || ts.isVariableDeclaration(n)) && n.name && ts.isIdentifier(n.name) && n.name.text === name) found.push(n);
      ts.forEachChild(n, visit);
    };
    if (file) visit(file);
    if (found.length !== 1) { issues.push(`R66: ${d.id} names ${name}, which is not exactly one binding in ${source}`); continue; }
    bound.push({ d, source, name, node: found[0].name, symbol: checker.getSymbolAtLocation(found[0].name) });
    if (d.kind === 'stores' && !durableWriter(source, show(source))) issues.push(`R7/R32: store ${d.id} is declared beside ${source}, which writes nothing durable`);
  }
  // The inspected caller must actually use each bound boundary: one pass over shipped code,
  // resolving only identifiers that carry a bound name back to the exact binding.
  const names = new Set(bound.map(b => b.name)); const used = new Set();
  for (const path of shipped) {
    const sf = program.getSourceFile(resolve(path)); if (!sf) continue;
    const scan = n => {
      // Only calling it (`gate()`, `worker.gate()`) or passing it as an argument is a use.
      // Importing, re-exporting, or storing it in an object or variable is not.
      if (ts.isIdentifier(n) && names.has(n.text) && invokedOrPassed(n)) {
        const s = origin(checker, checker.getSymbolAtLocation(n));
        for (const b of bound) if (n !== b.node && b.symbol && s === b.symbol) used.add(b);
      }
      ts.forEachChild(n, scan);
    };
    scan(sf);
  }
  for (const b of bound) if (!used.has(b)) issues.push(`R66: no shipped code uses ${b.d.id} (${b.source}#${b.name})`);
  // Every shipped file outside src that writes durably declares its stores beside it.
  for (const path of shipped) if (!path.startsWith('src/') && durableWriter(path, show(path))
    && !(beside.get(path) ?? []).some(d => d.kind === 'stores'))
    issues.push(`R7/R32: ${path} writes durable state but declares no store (growth, agent memory, machine scope) beside it`);
  // Rule 36: a parser of real-world text either carries an owned deferred loop, or holds the
  // rule through the existing fixture/check-run evidence path: its hold names a committed
  // fixture whose test imports this parser's source and reads its genuinely captured bytes.
  // Whether that test actually ran and passed is the rule graph's check-run question, not this one.
  const fixtures = owner.catalog?.fixtures ?? [];
  for (const d of declarations.filter(d => d.kind === 'parsers')) {
    const capture = owner.captures.find(c => c.id === d.requiredFacts.fixture);
    const hold = d.holds.find(h => h.rule === 36);
    if (hold?.class === 'deferred') continue;
    const where = capture ? `${capture.origin} ${capture.artifact.path}` : `no capture ${d.requiredFacts.fixture}`;
    if (!hold || hold.evidence?.kind !== 'fixture') { issues.push(`R36: parser ${d.id} has no Rule 36 fixture evidence on captured bytes (${where}) and no deferred Rule 36 loop`); continue; }
    const fixture = fixtures.find(f => f.id === hold.evidence.id && f.stage === hold.evidence.stage);
    const source = sourceOf(d, shipped); const test = fixture?.artifact?.path;
    const testText = test ? (() => { try { return show(test); } catch { return ''; } })() : '';
    const imported = [...testText.matchAll(/\bfrom\s+['"](\.[^'"]+)['"]/g)].map(m => posix.normalize(posix.join(posix.dirname(test), m[1])))
      .some(p => [p, p.replace(/\.js$/, '.ts'), p.replace(/\.mjs$/, '.mts')].includes(source));
    if (capture?.origin !== 'captured' || !fixture || !imported || !testText.includes(capture.artifact.path.split('/').pop()))
      issues.push(`R36: parser ${d.id} Rule 36 evidence ${hold.evidence.id} is not a committed test of ${source ?? d.declaredBy.path} on its captured bytes (${where})`);
  }
  // The capability briefing is generated from feature declarations plus their module's own text.
  const lines = new Map();
  for (const dir of new Set([...Object.keys(inventory.modules), ...features(register).map(d => moduleOf(d.declaredBy.path))])) lines.set(dir, readmeLines(dir, show));
  for (const d of features(register)) {
    const module = moduleOf(d.declaredBy.path); const own = (lines.get(module) ?? []).filter(l => l.id === d.id);
    if (own.length !== 1) issues.push(`R78/R84: feature ${d.id} needs exactly one "- \`${d.id}\`: ..." line under "## Capabilities" in ${module}/README.md`);
  }
  for (const [dir, list] of lines) for (const line of list)
    if (!features(register).some(d => d.id === line.id && moduleOf(d.declaredBy.path) === dir))
      issues.push(`R78/R84: ${dir}/README.md describes ${line.id}, which is not a declared feature of that module`);
  return issues;
}
