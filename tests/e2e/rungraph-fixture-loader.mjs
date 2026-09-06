import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';
const url = p => pathToFileURL(resolve(p)).href;
const compile = source => 'data:text/javascript;base64,' + Buffer.from(ts.transpileModule(source,
  { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText).toString('base64');
const foundation = source => source.replaceAll("'../src/index.js'", JSON.stringify(url('dist/index.js')))
  .replaceAll("'../../src/index.js'", JSON.stringify(url('dist/index.js')))
  .replaceAll("'../../src/facts/index.js'", JSON.stringify(url('dist/facts/index.js')))
  .replaceAll("'../../src/register/index.js'", JSON.stringify(url('dist/register/index.js')))
  .replaceAll("'../../src/rungraph/index.js'", JSON.stringify(url('dist/rungraph/index.js')));
const f1 = compile(foundation(readFileSync('tests/fixtures.ts', 'utf8')));
const f2 = compile(foundation(readFileSync('tests/facts/fixtures.ts', 'utf8')).replaceAll("'../fixtures.js'", JSON.stringify(f1))
  .replaceAll("'../../src/facts/boundary.js'", JSON.stringify(url('dist/facts/boundary.js'))));
const f3 = compile(foundation(readFileSync('tests/register/fixtures.ts', 'utf8')).replaceAll("'../fixtures.js'", JSON.stringify(f1)));
const governance = compile(foundation(readFileSync('tests/rungraph/governance-fixture.ts', 'utf8')).replaceAll("'../register/fixtures.js'", JSON.stringify(f3)));
const f5 = compile(foundation(readFileSync('tests/rungraph/fixtures.ts', 'utf8')).replaceAll("'../fixtures.js'", JSON.stringify(f1))
  .replaceAll("'../facts/fixtures.js'", JSON.stringify(f2)).replaceAll("'./governance-fixture.js'", JSON.stringify(governance)));
export const { setup, value } = await import(f5);
export const { governanceFixture } = await import(governance);
export const adapterTypes = (await import(f2)).factsFixture().ctx.decode;
