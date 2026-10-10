import { expect, it } from 'vitest';
import { SINGLE_MACHINE_PROFILE } from './activation-authority.js';
// @ts-expect-error The executable hook's shared .mjs module has no declaration file.
import { admitEffect, decodeEffectPolicy } from './effect-doorway.mjs';

it('keeps a paired Threadline send outside the single-machine irreversible set even under an exact scope grant', () => {
  const effect = 'threadline:paired-send';
  const target = 'paired-peer:test';
  const registration = { effect, target, consequence: 'external', reversibility: 'irreversible',
    reach: 'world', costUsd: 0, source: 'test:paired-peer-registration' };
  const grant = { id: 'test:peer-grant', effect, target, approves: ['scope'],
    source: 'test:operator-approval', custodian: 'test:operator', recovery: 'retain unknown sends without retry', expiresAt: 200 };
  const policy = (grants: unknown[]) => decodeEffectPolicy({ type: 'PreviewEffectPolicy', resourceLevelUsd: 0,
    policySensitive: [], registered: [registration], grants });
  const decide = (grants: unknown[]) => admitEffect({ effect, target }, policy(grants), SINGLE_MACHINE_PROFILE.operations, { now: 100 });

  expect(decide([])).toMatchObject({ admitted: false, tests: { irreversible: true, scope: true } });
  expect(decide([grant])).toMatchObject({ admitted: false, disposition: 'refused',
    tests: { irreversible: true, scope: false, resources: false, policySensitive: false } });
  expect(decide([grant]).admits).toContain('replicated durability');
  expect(decide([{ ...grant, target: 'another-peer:test' }])).toMatchObject({ admitted: false, tests: { scope: true } });
  expect(decide([{ ...grant, expiresAt: 100 }])).toMatchObject({ admitted: false, tests: { scope: true } });

  // The existing permitted operation remains usable: no blanket outbound refusal.
  const reply = 'telegram:ordinary-reply';
  const replyPolicy = decodeEffectPolicy({ type: 'PreviewEffectPolicy', resourceLevelUsd: 0, policySensitive: [],
    registered: [{ ...registration, effect: reply }], grants: [{ ...grant, effect: reply }] });
  expect(admitEffect({ effect: reply, target }, replyPolicy, SINGLE_MACHINE_PROFILE.operations, { now: 100 }))
    .toMatchObject({ admitted: true, disposition: 'closed-set' });
});
