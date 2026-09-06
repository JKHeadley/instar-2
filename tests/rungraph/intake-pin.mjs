// Echo authorized this exact pushed P4 integration base. Load its real owner
// exports AND fixtures from git, not a hand-copied substitute record. Full-history
// CI checkouts include the reachable impl-intake commit; missing input fails.
import { execFileSync } from 'node:child_process';
import { resolve, posix } from 'node:path';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';
export const intakeCommit = '28c84e0cf041b442436c3047fe50b25b74c6337a';
const source = path => execFileSync('git', ['show', `${intakeCommit}:${path}`], { encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 });
const data = code => 'data:text/javascript;base64,' + Buffer.from(code).toString('base64');
const files = Object.fromEntries(['src/intake/port.declarations.json', 'register-source/bootstrap-shape.json'].map(path => [path, source(path)]));
const fsAdapter = data(`const files=${JSON.stringify(files)}; export function readFileSync(path){if(!(path in files))throw Error('unpinned fixture artifact: '+path);return files[path];}`);
const shared = new Map(['src/index.ts', 'src/facts/index.ts', 'src/register/index.ts', 'src/projections/index.ts',
  // Test-only fixture reply construction, not an implementation import.
  'src/facts/boundary.ts'].map(path => [path, pathToFileURL(resolve(path.replace(/^src\//, 'dist/').replace(/\.ts$/, '.js'))).href]));
const modules = new Map(shared);
function moduleUrl(path) {
  if (modules.has(path)) return modules.get(path);
  let code = ts.transpileModule(source(path), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
  code = code.replace(/from\s*(['"])([^'"]+)\1/g, (_match, _quote, specifier) => {
    if (specifier === 'node:fs') return 'from ' + JSON.stringify(fsAdapter);
    if (!specifier.startsWith('.')) return 'from ' + JSON.stringify(specifier);
    return 'from ' + JSON.stringify(moduleUrl(posix.normalize(posix.join(posix.dirname(path), specifier)).replace(/\.js$/, '.ts')));
  });
  const url = data(code); modules.set(path, url); return url;
}
export const intake = await import(moduleUrl('src/intake/index.ts'));
export const fixtures = await import(moduleUrl('tests/intake/fixtures.ts'));
