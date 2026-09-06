// Actual eight producer and fixtures from the routed, pushed checkpoint. No
// copied implementation and no dependency on a sibling's mutable working files.
import { execFileSync } from 'node:child_process';
import { resolve, posix } from 'node:path';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';
export const effectCommit = '4048b2d2799112df4ab8809b7462e8b801f527c5';
const source = path => execFileSync('git', ['show', `${effectCommit}:${path}`], { encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 });
const data = code => 'data:text/javascript;base64,' + Buffer.from(code).toString('base64');
const local = path => pathToFileURL(resolve(path)).href;
const sixUrl = local('dist/transport/index.js');
const shim = data(`export * from ${JSON.stringify(sixUrl)}; import * as six from ${JSON.stringify(sixUrl)};
export const bindings=new WeakMap();
export function createTransportAuthority(...args){const api=six.createTransportAuthority(...args);bindings.set(api,args);return api;}`);
export const { bindings } = await import(shim);
const shared = new Map(['src/index.ts', 'src/facts/index.ts', 'src/register/index.ts', 'src/projections/index.ts',
  'src/facts/boundary.ts'].map(path => [path, local(path.replace(/^src\//, 'dist/').replace(/\.ts$/, '.js'))]));
shared.set('src/transport/index.ts', shim);
shared.set('scripts/transport-file-storage.mjs', local('scripts/transport-file-storage.mjs'));
shared.set('dist/index.js', local('dist/index.js'));
shared.set('dist/facts/index.js', local('dist/facts/index.js'));
const modules = new Map(shared);
function moduleUrl(path) {
  if (modules.has(path)) return modules.get(path);
  let code = path.endsWith('.ts') ? ts.transpileModule(source(path), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText : source(path);
  code = code.replace(/from\s*(['"])([^'"]+)\1/g, (_match, _quote, specifier) => {
    if (!specifier.startsWith('.')) return 'from ' + JSON.stringify(specifier);
    const target = posix.normalize(posix.join(posix.dirname(path), specifier));
    return 'from ' + JSON.stringify(moduleUrl(shared.has(target) ? target : target.replace(/\.js$/, '.ts')));
  });
  const url = data(code); modules.set(path, url); return url;
}
export const effects = await import(moduleUrl('src/effects/index.ts'));
export const fixtures = await import(moduleUrl('tests/effects/fixture.ts'));
export const replicaHost = await import(moduleUrl('scripts/effect-replica-storage.mjs'));
export const factFixtures = await import(moduleUrl('tests/facts/fixtures.ts'));
