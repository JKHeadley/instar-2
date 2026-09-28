// Checks the register against the shipped inventory, not only against src/**.ts
// (Rules 5, 7, 32, 36, 66, 69, 78, 84). Every finding is a build failure.
// Residual, stated rather than hidden: a second store added to an already
// declared writer file, and a blocking decision that is an ordinary conditional
// rather than a named function, are not detected here.
import ts from 'typescript';
import { resolve } from 'node:path';
import { consumeResult, deriveProfile } from '../dist/index.js';
import { moduleOf, sidecarSource } from './register-inventory.mjs';

// Named node:fs members that durably change bytes on disk.
const WRITES = new Set(['writeFileSync', 'appendFileSync', 'writeSync', 'renameSync', 'createWriteStream', 'ftruncateSync', 'truncateSync',
  'copyFileSync', 'unlinkSync', 'rmSync', 'writeFile', 'appendFile', 'rename', 'truncate', 'copyFile', 'unlink', 'rm']);
// Declarations beside a non-src file name their function as the last dotted segment of their id.
const BOUNDARIES = new Set(['stores', 'blocking sites', 'parsers', 'judgment points']);
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
const sourceOf = (d, shipped) => isSidecar(d.declaredBy.path) ? sidecarSource(d.declaredBy.path, shipped) : d.declaredBy.path;

// Per launcher: which declared features its installation carries. A launcher's own
// module enables its declarations; another module's feature is available only when
// its code is loaded and it is live. Nothing here is hand-listed.
export function capabilityBriefing(register, inventory, show) {
  const text = new Map();
  for (const [dir, m] of Object.entries(inventory.modules)) if (m.readme)
    for (const line of capabilityLines(show(m.readme))) text.set(`${dir}\u0000${line.id}`, line.text);
  const launchers = {};
  for (const [launcher, closure] of Object.entries(inventory.launchers)) {
    const own = moduleOf(launcher);
    launchers[launcher] = features(register).map(d => {
      const module = moduleOf(d.declaredBy.path); const source = sourceOf(d, inventory.files);
      const loaded = source ? closure.includes(source) : closure.some(p => moduleOf(p) === module);
      const availability = module === own ? 'available' : !loaded ? 'not-loaded' : d.status === 'live' ? 'available' : 'switched-off';
      const userFacing = consumeResult(deriveProfile(d.profile, { owner: 'part-three', derivedFrom: register.shape.derivedFrom }, 'capability-briefing'),
        { Success: derived => derived.userFacing, Refused: refusal => { throw new Error(refusal.detail); } });
      return { id: d.id, status: d.status, module, availability, userFacing, text: text.get(`${module}\u0000${d.id}`) ?? null };
    }).sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
  }
  return { launchers };
}

// show(path) returns committed bytes; testsNaming(basename) lists committed test files naming a capture.
export function checkShipped(register, inventory, program, owner, show, testsNaming) {
  const issues = []; const shipped = inventory.files; const checker = program.getTypeChecker();
  for (const [dir, m] of Object.entries(inventory.modules)) if (!m.readme || !/^# \S/m.test(show(m.readme)))
    issues.push(`R5: shipped module ${dir} has no documentation entry (${dir === '.' ? '' : dir + '/'}README.md with a heading)`);
  const declarations = register.entries.map(e => e.declaration);
  const beside = new Map(); // shipped non-src source -> its sidecar declarations
  for (const d of declarations) if (isSidecar(d.declaredBy.path) && !d.declaredBy.path.startsWith('src/')) {
    const source = sidecarSource(d.declaredBy.path, shipped);
    if (!source) { issues.push(`R66: ${d.id} is declared beside ${d.declaredBy.path}, which describes no shipped source`); continue; }
    beside.set(source, [...beside.get(source) ?? [], d]);
    if (!BOUNDARIES.has(d.kind)) continue;
    // The inspected caller must actually use the declared boundary: bind the named
    // function or port, then find a shipped use of that exact binding (not a same-named one).
    const name = d.id.slice(d.id.lastIndexOf('.') + 1); const file = program.getSourceFile(resolve(source));
    const found = [];
    const visit = n => {
      if ((ts.isFunctionDeclaration(n) || ts.isVariableDeclaration(n)) && n.name && ts.isIdentifier(n.name) && n.name.text === name) found.push(n);
      ts.forEachChild(n, visit);
    };
    if (file) visit(file);
    if (found.length !== 1) { issues.push(`R66: ${d.id} names ${name}, which is not exactly one binding in ${source}`); continue; }
    const target = checker.getSymbolAtLocation(found[0].name);
    let used = false;
    for (const path of shipped) {
      const sf = program.getSourceFile(resolve(path)); if (!sf || used) continue;
      const scan = n => {
        if (used) return;
        if (ts.isIdentifier(n) && n !== found[0].name && !ts.isImportSpecifier(n.parent) && !ts.isExportSpecifier(n.parent)
          && !ts.isImportClause(n.parent)) {
          if (target && origin(checker, checker.getSymbolAtLocation(n)) === target) used = true;
        }
        ts.forEachChild(n, scan);
      };
      scan(sf);
    }
    if (!used) issues.push(`R66: no shipped code uses ${d.id} (${source}#${name})`);
    if (d.kind === 'stores' && !durableWriter(source, show(source))) issues.push(`R7/R32: store ${d.id} is declared beside ${source}, which writes nothing durable`);
  }
  // Every shipped file outside src that writes durably declares its stores beside it.
  for (const path of shipped) if (!path.startsWith('src/') && durableWriter(path, show(path))
    && !(beside.get(path) ?? []).some(d => d.kind === 'stores'))
    issues.push(`R7/R32: ${path} writes durable state but declares no store (growth, agent memory, machine scope) beside it`);
  // Parsers of real-world text are exercised on captured bytes, or carry an honest open loop.
  for (const d of declarations.filter(d => d.kind === 'parsers')) {
    const capture = owner.captures.find(c => c.id === d.requiredFacts.fixture);
    const exercised = capture?.origin === 'captured' && testsNaming(capture.artifact.path.split('/').pop()).length > 0;
    if (!exercised && !d.holds.some(h => h.rule === 36 && h.class === 'deferred'))
      issues.push(`R36: parser ${d.id} has no executed test on captured bytes (${capture ? capture.origin + ' ' + capture.artifact.path : 'no capture ' + d.requiredFacts.fixture}) and no deferred Rule 36 loop`);
  }
  // The capability briefing is generated from feature declarations plus their module's own text.
  const lines = new Map();
  for (const [dir, m] of Object.entries(inventory.modules)) if (m.readme) lines.set(dir, capabilityLines(show(m.readme)));
  for (const d of features(register)) {
    const module = moduleOf(d.declaredBy.path); const own = (lines.get(module) ?? []).filter(l => l.id === d.id);
    if (own.length !== 1) issues.push(`R78/R84: feature ${d.id} needs exactly one "- \`${d.id}\`: ..." line under "## Capabilities" in ${module}/README.md`);
  }
  for (const [dir, list] of lines) for (const line of list)
    if (!features(register).some(d => d.id === line.id && moduleOf(d.declaredBy.path) === dir))
      issues.push(`R78/R84: ${dir}/README.md describes ${line.id}, which is not a declared feature of that module`);
  return issues;
}
