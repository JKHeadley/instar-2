import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { createPartTwoRegisterAuthority } from '../../src/register/index.js';
import type { PartTwoRegisterAuthorityOptions } from '../../src/register/index.js';
import { factsFixture } from '../facts/fixtures.js';
import { setup } from './fixtures.js';

describe('round-five documented provider contract', () => {
  it('P3-NF-09 type-checks and executes the exact shipped authority input', () => {
    const f = factsFixture(), s = setup();
    const options: PartTwoRegisterAuthorityOptions = { facts: f.ctx, scope: f.scope,
      landing: { owner: 'part-ten', merges: [] }, context: s.context };
    const { facts, scope, landing, context } = options;
    expect(createPartTwoRegisterAuthority({ facts, scope, landing, context }).owner).toBe('part-two');
    const guide = readFileSync('docs/build-part-three.md', 'utf8');
    expect(guide).toContain('createPartTwoRegisterAuthority({facts, scope, landing, context})');
    expect(guide).not.toMatch(/createPartTwoRegisterAuthority\(\{vector,|versions, shapeChanges/);
  });
});
