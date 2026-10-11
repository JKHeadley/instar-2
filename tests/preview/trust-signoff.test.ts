import { afterEach, expect, it } from 'vitest';
import { rmSync } from 'node:fs';
import { effectFixture, value } from '../effects/fixture.js';
// @ts-expect-error Shared hook JavaScript.
import { admitEffect, decodeEffectPolicy, SIGN_OFF_TESTS } from './effect-doorway.mjs';
const roots: string[] = [];
afterEach(() => roots.splice(0).forEach(path => rmSync(path, { recursive: true, force: true })));
const proposal = { effect: 'tool:mcp', target: 'mcp__mail__send' };
const registration = { ...proposal, consequence: 'external', reversibility: 'irreversible', reach: 'world', costUsd: 0, source: 'operator:conversation:1' };
const grant = { ...proposal, id: 'role:mail', approves: ['scope'], source: 'operator:conversation:1', custodian: 'person', recovery: 'withdraw role' };
const policy = (entry = {}, extra = {}) => decodeEffectPolicy({ type: 'PreviewEffectPolicy', resourceLevelUsd: 2,
  policySensitive: [], registered: [{ ...registration, ...entry }], grants: [grant], ...extra });

it('the sign-off list is exactly five conditions, with both sides of each decision', () => {
  expect(SIGN_OFF_TESTS).toEqual(['resources', 'irreversibleOutsideRole', 'publicInPersonName', 'widensAuthority', 'policySensitive']);
  const cases = [
    ['resources', { costUsd: 3 }, {}],
    ['irreversibleOutsideRole', {}, { grants: [] }],
    ['publicInPersonName', { publicInPersonName: true }, {}],
    ['widensAuthority', { widensAuthority: true }, {}],
    ['policySensitive', { matters: ['personal'] }, { policySensitive: ['personal'] }],
  ] as const;
  for (const [condition, entry, extra] of cases) {
    const p = policy(entry, extra);
    expect(p.registered[0].classification.signOff[condition]).toBe(true);
    expect(admitEffect(proposal, p, ['tool:mcp'])).toMatchObject({ admitted: false, signOffRequired: true,
      refusedFor: expect.arrayContaining(['sign-off']) });
    expect(policy().registered[0].classification.signOff[condition]).toBe(false);
  }
  expect(admitEffect(proposal, policy(), ['tool:mcp'])).toMatchObject({ admitted: true, signOffRequired: false });
  expect(admitEffect(proposal, policy({ reversibility: 'reversible' }))).toMatchObject({ admitted: true, signOffRequired: false });
  expect(admitEffect(proposal, policy({ reversibility: 'reversible' }, { grants: [] }))).toMatchObject({ admitted: false,
    signOffRequired: false, refusedFor: ['role'] });
});

it('recomputes registration classification when role, resource level or sensitive matters change', () => {
  const original = policy();
  const narrowed = decodeEffectPolicy({ ...original, grants: [] });
  expect(narrowed.registered[0].classification.signOff.irreversibleOutsideRole).toBe(true);
  expect(original.registered[0].classification.signOff.irreversibleOutsideRole).toBe(false);
  expect(() => policy({ publicInPersonName: 'yes' })).toThrow('registration');
  expect(() => policy({ widensAuthority: 1 })).toThrow('registration');
});

it('a granted private-email operation on a replicated fixture dispatches once without a per-send prompt', () => {
  // The existing P8 fixture uses two on-disk stores as logical machines, not a physical failure-independence proof.
  // Operation authority is installed once. The role classifier cannot replace the P8 durable-prefix consumer.
  const f = effectFixture(undefined, 'executor:mail', { account: 'mail:team', conversation: 'private:recipient' });
  roots.push(f.directory);
  expect(f.d).toMatchObject({ durability: 'replicated', replicas: 1 });
  const decision = admitEffect(proposal, policy(), [proposal.effect]);
  expect(decision).toMatchObject({ admitted: true, signOffRequired: false, durability: { irreversible: true } });
  const request = f.prepare();
  expect(value(f.api.dispatch(request, f.fence))).toHaveProperty('operation');
  expect(f.calls()).toBe(1);
  // A repeated dispatch returns its recorded observation without invoking the adapter again.
  expect(f.api.dispatch(request, f.fence).kind).toBe('Success');
  expect(f.calls()).toBe(1);
});

it('an enrolled peer without the exact durable prefix still refuses the otherwise ordinary role effect', () => {
  const f = effectFixture(undefined, 'executor:mail-unavailable', { account: 'mail:team', conversation: 'private:recipient' });
  roots.push(f.directory);
  expect(admitEffect(proposal, policy(), [proposal.effect])).toMatchObject({ admitted: true, signOffRequired: false });
  const request = f.prepare();
  f.replicas.enable(false);
  expect(f.api.dispatch(request, f.fence).kind).toBe('Refused');
  expect(f.calls()).toBe(0);
});
