import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';

const url = path => pathToFileURL(resolve(path)).href;
const compile = source => 'data:text/javascript;base64,' + Buffer.from(ts.transpileModule(source,
  { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText).toString('base64');
const foundation = source => source.replaceAll("'../src/index.js'", JSON.stringify(url('dist/index.js')))
  .replaceAll("'../../src/index.js'", JSON.stringify(url('dist/index.js')))
  .replaceAll("'../../src/facts/index.js'", JSON.stringify(url('dist/facts/index.js')))
  .replaceAll("'../../src/register/index.js'", JSON.stringify(url('dist/register/index.js')))
  .replaceAll("'../../src/rungraph/index.js'", JSON.stringify(url('dist/rungraph/index.js')));
const base = compile(foundation(readFileSync('tests/fixtures.ts', 'utf8')));
const facts = compile(foundation(readFileSync('tests/facts/fixtures.ts', 'utf8'))
  .replaceAll("'../fixtures.js'", JSON.stringify(base))
  .replaceAll("'../../src/facts/boundary.js'", JSON.stringify(url('dist/facts/boundary.js'))));
const register = compile(foundation(readFileSync('tests/register/fixtures.ts', 'utf8'))
  .replaceAll("'../fixtures.js'", JSON.stringify(base)));
const governance = compile(foundation(readFileSync('tests/rungraph/closure-governance-fixture.ts', 'utf8'))
  .replaceAll("'../register/fixtures.js'", JSON.stringify(register)));
const fixture = compile(foundation(readFileSync('tests/rungraph/fixtures.ts', 'utf8'))
  .replaceAll("'../fixtures.js'", JSON.stringify(base))
  .replaceAll("'../facts/fixtures.js'", JSON.stringify(facts))
  .replace("import { governanceFixture } from './governance-fixture.js';",
    `import { closureGovernanceFixture as governanceFixture } from ${JSON.stringify(governance)};`));

export const { setup, value } = await import(fixture);
export const { closureGovernanceFixture: governanceFixture } = await import(governance);
export const adapterTypes = (await import(facts)).factsFixture().ctx.decode;
