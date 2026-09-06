// Runs the actual separately-owned P3 public decoders; no rival GenerationRecord type.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';
import assert from 'node:assert/strict';
import { consumeResult } from '../dist/index.js';
import { registerOwnedBody, decodeEnvelope, decodeBody, verifyAndAdmit, decodeHistoricalBody } from '../dist/facts/index.js';
const p3 = resolve(process.argv[2]);
async function fixture(path, root) {
  let js = ts.transpileModule(readFileSync(path, 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText;
  if (js.includes("'../fixtures.js'")) js = js.replace("'../fixtures.js'", JSON.stringify(await fixture(resolve(root, 'tests/fixtures.ts'), root)));
  js = js.replace(/(['"])(?:\.\.\/)+src\/([^'"]+)\1/g, (_a, _q, suffix) => JSON.stringify(pathToFileURL(resolve(root, 'dist', suffix)).href));
  js = js.replace("'register-source/bootstrap-shape.json'", JSON.stringify(resolve(root, 'register-source/bootstrap-shape.json')));
  return 'data:text/javascript;base64,' + Buffer.from(js).toString('base64');
}
const p3api = await import(pathToFileURL(resolve(p3, 'dist/register/index.js')));
const { setup } = await import(await fixture(resolve(p3, 'tests/register/fixtures.ts'), p3));
const { factsFixture } = await import(await fixture(resolve('tests/facts/fixtures.ts'), process.cwd()));
const s = setup(), f = factsFixture();
const take = r => consumeResult(r, { Success: v => v, Refused: r => { throw new Error(r.detail); } });
const refused = r => consumeResult(r, { Success: () => { throw new Error('expected refusal'); }, Refused: r => r.detail });
const generation = take(p3api.generationOf(s.build(), s.context));
const records = [
  { type: 'GenerationRecord', schemaVersion: 1, generation, at: s.f.now },
  { type: 'CheckRunRecord', schemaVersion: 1, id: 'run', commit: 'commit:1', branch: 'main', providerRun: 'ci:1', outcome: 'passed', fixtures: [{ id: 'P2-provider', stage: 'integration', outcome: 'passed' }], at: s.f.now },
];
// Infer only a bounded byte-policy fixture from the concrete owner's output. Semantic
// validity is always decided by its real decoder (including nested hash/verdict rules).
const policy = value => typeof value === 'string' ? { kind: 'text', maxLength: 200 } : typeof value === 'number' ? { kind: 'integer' }
  : Array.isArray(value) ? { kind: 'array', maxLength: 100, items: policy(value[0]) }
  : { kind: 'object', fields: Object.fromEntries(Object.entries(value).map(([k, v]) => [k, policy(v)])) };
for (const [i, record] of records.entries()) {
  const kind = i === 0 ? 'generation-record' : 'check-run-record';
  const owner = input => p3api.decodeRegisteredFact(kind, input, s.context);
  take(owner(record));
  const registration = take(registerOwnedBody({ owner: 'part-three', name: record.type, currentVersion: 1,
    versions: { 1: { validate: input => ({ ok: true, value: input }) } }, migrations: {},
    decodeCurrent: input => consumeResult(owner(input), { Success: value => ({ ok: true, value }), Refused: r => ({ ok: false, detail: r.detail, reason: r.reason }) }) }, policy(record), f.c));
  const ctx = { ...f.ctx, ownedBodies: [registration], schemas: [{ ...f.schema, fields: { record: { kind: 'owned', owner: 'part-three', name: record.type } } }] };
  const fact = take(decodeEnvelope(f.wire({ body: { record } }), ctx));
  assert.equal(take(decodeBody(fact, ctx, ctx.decode)).record.type, record.type);
  assert.equal(take(verifyAndAdmit(fact, 'machine-a', ctx)).id, fact.id);
  assert.equal(take(decodeHistoricalBody(fact, ctx, ctx.decode)).fields.record.type, record.type);
  const bad = i === 0 ? { ...record, generation: { ...record.generation, id: 'not-a-hash' } }
    : { ...record, fixtures: [{ ...record.fixtures[0], outcome: 'failed' }] };
  const badFact = take(decodeEnvelope(f.wire({ body: { record: bad } }), ctx));
  assert.ok(refused(decodeBody(badFact, ctx, ctx.decode))); assert.ok(refused(verifyAndAdmit(badFact, 'machine-a', ctx)));
}
console.log('Actual P3 GenerationRecord and CheckRunRecord enter/replay through P2; malformed nested fields refuse.');
