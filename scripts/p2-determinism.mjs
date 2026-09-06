// Identical, pinned canonical/reconciliation output on x64 and arm64, not machine-key aliases.
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';
import { canonical, consumeResult } from '../dist/index.js';
import { prepareSnapshot, preimage } from '../dist/facts/index.js';
import { foldProjection } from '../dist/projections/index.js';
export async function fixtureModule(path) {
  let js = ts.transpileModule(readFileSync(path, 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText;
  if (path.endsWith('tests/facts/fixtures.ts')) js = js.replace("'../fixtures.js'", JSON.stringify(await fixtureModule(resolve('tests/fixtures.ts'))));
  js = js.replace(/(['"])(?:\.\.\/)+src\/([^'"]+)\1/g, (_all, _q, suffix) => JSON.stringify(pathToFileURL(resolve('dist', suffix)).href));
  return 'data:text/javascript;base64,' + Buffer.from(js).toString('base64');
}
const { factsFixture } = await import(await fixtureModule(resolve('tests/facts/fixtures.ts')));
const take = r => consumeResult(r, { Success: v => v, Refused: r => { throw new Error(r.detail); } });
const f = factsFixture(), a = f.fact({ body: { identity: 'π', amount: '9007199254740993' } }), b = f.fact({ machine: 'machine-b', segment: { machine: 'machine-b', epoch: 0, position: 0 }, body: { identity: 'π', amount: '-7' } });
const generation = { reference: f.ctx.decode.register.generation, kinds: ['note'], lineages: Object.fromEntries([a, b].map(f => [f.machine, { head: { epoch: 0, position: 0 }, observedAt: 100, closed: false }])) };
const snapshot = take(prepareSnapshot([a, b], f.ctx));
const reconciliations = {};
for (const merge of ['additive', 'set-union', 'max', 'min', 'exclusive-singleton', 'cap-checked aggregate']) {
  const definition = { id: 'pinned', class: 'authority-answering', stalenessBound: 100, retention: 'all-identities', decisions: { note: { kind: 'folds', merge, identity: 'identity', value: 'amount', ...(merge === 'cap-checked aggregate' ? { cap: '10' } : {}) } } };
  reconciliations[merge] = take(canonical(take(foldProjection(definition, snapshot, generation, f.c)))).bytes;
}
const output = JSON.stringify({ preimage: preimage(a).bytes, hash: a.contentHash, signature: a.signature, envelope: take(canonical(a)).bytes, reconciliations }, null, 2) + '\n';
if (process.argv.includes('--print')) process.stdout.write(output);
else {
  if (output !== readFileSync('tests/p2-canonical.json', 'utf8')) throw new Error('P2 pinned canonical/reconciliation output differs');
  const dest = process.argv[2]; if (dest) writeFileSync(dest, output);
  console.log(`P2 pinned outputs match on ${process.arch}`);
}
