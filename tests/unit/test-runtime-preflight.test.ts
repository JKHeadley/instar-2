// The suite refuses, in one line, a Node that cannot run the shipped-bin proofs (tests/setup/runtime.ts).
import { expect, it } from 'vitest';
import setup, { REQUIRED_NODE_FLAG, runtimeRefusal } from '../setup/runtime.js';

it('admits a runtime that accepts the transform flag and refuses one that does not, naming its version', () => {
  expect(runtimeRefusal(new Set([REQUIRED_NODE_FLAG, '--import']), 'v24.14.1')).toBeNull();
  const refusal = runtimeRefusal(new Set(['--import']), 'v26.10.0');
  expect(refusal).toContain('REFUSED: node v26.10.0 does not accept --experimental-transform-types');
});

it('the live runtime passes the preflight the run already cleared', () => {
  expect(() => setup()).not.toThrow();
});
