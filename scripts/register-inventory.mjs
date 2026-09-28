// Shipped-module inventory, derived from the build and package inputs rather than
// a file glob (Rules 5, 32, 66, 69, 78, 84). The build input is tsconfig.build.json
// (its include list, rootDir and outDir); the package input is package.json
// instar.launchers, the entry points a host actually runs. A launcher's shipped
// code is its static import closure; dist/ imports map back to their source.
import ts from 'typescript';
import { posix } from 'node:path';

// A top-level src directory is one module; any other shipped file belongs to its directory.
export function moduleOf(path) {
  const parts = path.split('/');
  return parts[0] === 'src' ? (parts.length > 2 ? `src/${parts[1]}` : 'src') : posix.dirname(path);
}
// The sibling source a sidecar declaration file describes (same stem), when shipped.
export function sidecarSource(path, shipped) {
  const stem = path.replace(/\.(?:declarations|parser)\.json$/, '');
  return ['.ts', '.mts', '.mjs', '.js'].map(ext => stem + ext).find(p => shipped.includes(p));
}
// Runtime module edges only: a type-only import ships nothing. A computed dynamic
// import is not followed here; the wiring scan reports it as residual.
function runtimeImports(path, text) {
  const file = ts.createSourceFile(path, text, ts.ScriptTarget.ES2022, true);
  const found = [];
  const visit = node => {
    if ((ts.isImportDeclaration(node) && !node.importClause?.isTypeOnly
      || ts.isExportDeclaration(node) && !node.isTypeOnly) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
      const named = ts.isImportDeclaration(node) ? node.importClause?.namedBindings : node.exportClause;
      const onlyTypes = named && ts.isNamedImports?.(named) && !node.importClause?.name && named.elements.length > 0
        && named.elements.every(e => e.isTypeOnly);
      if (!onlyTypes) found.push(node.moduleSpecifier.text);
    }
    if (ts.isCallExpression(node) && node.arguments.length === 1 && ts.isStringLiteral(node.arguments[0])
      && (node.expression.kind === ts.SyntaxKind.ImportKeyword || ts.isIdentifier(node.expression) && node.expression.text === 'require'))
      found.push(node.arguments[0].text);
    ts.forEachChild(node, visit);
  };
  visit(file);
  return found;
}
export function shippedInventory(files, show) {
  const present = new Set(files);
  const pkg = JSON.parse(show('package.json'));
  const build = JSON.parse(show('tsconfig.build.json'));
  const { rootDir, outDir } = build.compilerOptions ?? {};
  if (typeof rootDir !== 'string' || typeof outDir !== 'string' || !Array.isArray(build.include))
    throw new Error('R5: tsconfig.build.json must name include, rootDir and outDir');
  const launchers = pkg.instar?.launchers;
  if (!Array.isArray(launchers) || !launchers.length || launchers.some(l => typeof l !== 'string' || !present.has(l)))
    throw new Error('R5: package.json instar.launchers must list committed launcher files');
  const built = files.filter(p => build.include.some(dir => p.startsWith(`${dir}/`)) && p.endsWith('.ts') && !p.endsWith('.d.ts'));
  const resolveImport = (from, specifier) => {
    if (!specifier.startsWith('.')) return null; // node built-ins and packages are not shipped source
    let path = posix.normalize(posix.join(posix.dirname(from), specifier));
    if (path.startsWith(`${outDir}/`)) path = rootDir + path.slice(outDir.length);
    const found = [path, path.replace(/\.js$/, '.ts'), path.replace(/\.mjs$/, '.mts')].find(p => present.has(p) && !p.endsWith('.d.ts'));
    if (!found) throw new Error(`R5: shipped import ${specifier} from ${from} does not resolve to a committed source`);
    return found;
  };
  const closures = {};
  for (const launcher of launchers) {
    const seen = new Set(); const queue = [launcher];
    while (queue.length) {
      const file = queue.shift();
      if (seen.has(file)) continue; seen.add(file);
      for (const specifier of runtimeImports(file, show(file))) {
        const next = resolveImport(file, specifier); if (next) queue.push(next);
      }
    }
    closures[launcher] = [...seen].sort();
  }
  const shipped = [...new Set([...built, ...Object.values(closures).flat()])].sort();
  const modules = {};
  for (const path of shipped) {
    const dir = moduleOf(path); const readme = `${dir === '.' ? '' : dir + '/'}README.md`;
    modules[dir] ??= { readme: present.has(readme) ? readme : null, files: [] };
    modules[dir].files.push(path);
  }
  return { launchers: closures, files: shipped, modules };
}
