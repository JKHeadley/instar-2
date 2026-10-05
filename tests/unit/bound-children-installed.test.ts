// The 201 remaining synchronous child callsites that name no timeout are bounded only if the
// setup file actually reached this worker. This file imports nothing from it on purpose: it
// asserts the doorway is already patched by tests/setup, so the coverage claim rests on the
// wiring rather than on an import this test performed itself.
import { it, expect } from 'vitest';

it('tests/setup/bound-children.mjs has bounded this worker\'s spawn doorway', () => {
  const binding: Record<string, unknown> =
    (process as unknown as { binding: (name: string) => Record<string, unknown> }).binding('spawn_sync');
  expect(Reflect.get(binding, Symbol.for('instar.tests.boundChildren'))).toBe(true);
  expect(typeof binding.spawn).toBe('function');
  expect((binding.spawn as { name: string }).name).toBe('boundSpawn');
});
