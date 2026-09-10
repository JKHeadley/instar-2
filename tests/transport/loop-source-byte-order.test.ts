import { expect, it } from 'vitest';
import { sourceVectorCheck } from '../../src/transport/records.js';

it('SLB-SOURCE-BYTES-74 accepts UTF-8-byte order and refuses the conflicting UTF-16 order', () => {
  const machines = ['machine:\ue000', 'machine:\u{10000}'];
  const vector = (values: readonly string[]) => values.map(machine => ({ machine, epoch: 0, position: 1 }));
  expect(() => sourceVectorCheck(vector(machines))).not.toThrow();
  expect(() => sourceVectorCheck(vector([...machines].reverse()))).toThrow();
  expect(() => sourceVectorCheck(vector(['machine-a', 'machine-b']))).not.toThrow();
  expect(() => sourceVectorCheck(vector(['machine-b', 'machine-a']))).toThrow();
});
