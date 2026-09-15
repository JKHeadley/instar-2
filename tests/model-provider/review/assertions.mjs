// Count executed native assertions per reviewer case, including subprocess parent
// assertions. Contract maps bind this receipt to the same full-gate report and
// source bytes; a matching test title alone cannot establish an arm.
import assert from 'node:assert/strict';
import { AsyncLocalStorage } from 'node:async_hooks';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
const active = new AsyncLocalStorage();
export default new Proxy(assert, {
  get(target, key) {
    const value = target[key];
    if (typeof value !== 'function') return value;
    return (...args) => { const context = active.getStore(); if (context) context.assertions++; return value(...args); };
  },
  apply(target, receiver, args) { const context = active.getStore(); if (context) context.assertions++; return Reflect.apply(target, receiver, args); },
});
const sources = ['conformance', 'supplement', 'partial', 'plan-copy', 'cuts', 'cut-worker', 'cut-loader', 'assertions']
  .map(name => `tests/model-provider/review/${name}.mjs`)
  .concat(['tests/integration/model-provider-review.test.ts', 'tests/e2e/model-provider-review.test.ts', 'tests/integration/model-provider-reply.test.ts',
    'src/effects/provider-path.ts', 'src/judgment/provider-path.ts', 'src/verification/effect-consumption.ts',
    'src/assembly/provider-invocation.ts', 'scripts/model-provider-contracts.mjs']);
export async function runAssertions(id, run) {
  const context = { id, assertions: 0, startedAt: Date.now(), passed: false,
    sources: Object.fromEntries(sources.map(path => [path, createHash('sha256').update(readFileSync(path)).digest('hex')])) };
  mkdirSync('.model-provider-review-proofs', { recursive: true });
  const path = `.model-provider-review-proofs/${id}.json`;
  writeFileSync(path, JSON.stringify(context));
  return active.run(context, async () => {
    const result = await run();
    assert.ok(context.assertions > 0, 'case must execute native assertions');
    context.passed = true;
    writeFileSync(path, JSON.stringify({ ...context, finishedAt: Date.now() }));
    return result;
  });
}
