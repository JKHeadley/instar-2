import { beforeEach, afterEach, expect, chai } from 'vitest';
import { appendFileSync, readFileSync, realpathSync, mkdirSync } from 'node:fs';
import { resolve, relative } from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { productionGroundingSourceDigest } from '../../scripts/check-assembly-contracts.mjs';
const root = realpathSync(fileURLToPath(new URL('../..', import.meta.url)));
const hash = value => createHash('sha256').update(value).digest('hex');
const revision = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
const sourceDigest = productionGroundingSourceDigest(root);
let current;
const methods = ['toBe', 'toEqual', 'toStrictEqual', 'toMatchObject', 'toHaveLength', 'toContain', 'toBeDefined', 'toBeUndefined',
  'toBeLessThan', 'toBeLessThanOrEqual', 'toContainEqual', 'toBeGreaterThan', 'toBeGreaterThanOrEqual', 'toThrow', 'toThrowError', 'toMatch', 'toBeTruthy', 'toBeFalsy', 'toBeNull', 'toHaveProperty', 'toBeInstanceOf', 'toBeTypeOf'];
for (const method of methods) {
  const prior = chai.Assertion.prototype[method];
  if (typeof prior !== 'function') continue;
  chai.Assertion.prototype[method] = function (...args) {
    const stack = new Error().stack?.split('\n') ?? [];
    const frame = stack.find(line => line.includes('/tests/') && !line.includes('production-grounding-evidence'));
    const match = frame?.match(/(?:\(|at )(\/.*?):(\d+):(\d+)\)?$/);
    if (current && match) {
      const file = realpathSync(match[1]), line = Number(match[2]), text = readFileSync(file, 'utf8').split('\n')[line - 1];
      current.assertions.push({ file: relative(root, file), line, method, source: hash(text ?? ''),
        negated: !!chai.util.flag(this, 'negate') });
    }
    const actual = chai.util.flag(this, 'object');
    if (current && ['toThrow', 'toThrowError'].includes(method) && typeof actual === 'function') {
      chai.util.flag(this, 'object', function (...args) {
        try { return actual.apply(this, args); }
        catch (error) { (current.refusals ??= []).push(String(error?.message ?? error)); throw error; }
      });
    }
    if (current && actual && typeof actual === 'object' && actual.accepted === false && typeof actual.detail === 'string')
      (current.refusals ??= []).push(actual.detail);
    return prior.apply(this, args);
  };
}
beforeEach(async context => {
  // A sequence of synchronous owner tests otherwise starves the worker's RPC
  // response queue across case boundaries. Service it before the next case;
  // never change a case's assertions, result or deadline.
  await new Promise(resolve => setImmediate(resolve));
  current = { file: realpathSync(context.task.file.filepath), fullName: expect.getState().currentTestName,
    start: Date.now(), revision, sourceDigest, assertions: [] };
});
afterEach(async context => {
  if (!current) return;
  current.end = Date.now(); current.assertionCalls = expect.getState().assertionCalls;
  current.state = context.task.result?.state;
  mkdirSync(resolve(root, '.instar/lanes/round4b-artifacts'), { recursive: true });
  appendFileSync(resolve(root, '.instar/lanes/round4b-artifacts/assertions.jsonl'), JSON.stringify(current) + '\n');
  current = undefined;
  await new Promise(resolve => setImmediate(resolve));
});
export function groundingCheckpoint(name, evidence) {
  if (!current) return;
  (current.checkpoints ??= []).push({ name, evidence });
}
