// The 201 remaining synchronous child callsites that name no timeout are bounded only if the
// setup file actually reached this worker AND its replacement reached the ESM named imports a
// test writes. This file imports nothing from the setup module on purpose: it reads the three
// calls exactly the way a test reads them — as named imports from `node:child_process` — and
// asserts those bindings are the wrappers, so the coverage claim rests on the wiring rather
// than on an import this test performed itself.
import { it, expect } from 'vitest';
import { execFileSync, execSync, spawnSync } from 'node:child_process';

it('tests/setup/bound-children.mjs has bounded this worker\'s synchronous child calls', () => {
  const marker = Symbol.for('instar.tests.boundChildren');
  for (const [name, call] of [['spawnSync', spawnSync], ['execFileSync', execFileSync], ['execSync', execSync]] as const) {
    expect(typeof call, name).toBe('function');
    expect(Reflect.get(call, marker), name).toBe(true);
    expect(call.name, name).toBe(`bound_${name}`);
  }
});
