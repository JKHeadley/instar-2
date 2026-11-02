import { expect, it } from 'vitest';
import { admitSessionOrQueue } from '../../scripts/session-auth-admission.mjs';

it('queues an unavailable pre-dispatch auth status and admits the same retry', async () => {
  let calls = 0;
  const admit = async () => { if (++calls === 1) throw Error('subscription authentication status unavailable'); };
  expect(await admitSessionOrQueue(admit)).toBe(false);
  expect(await admitSessionOrQueue(admit)).toBe(true);
  expect(calls).toBe(2);
});

it('does not queue an observed rejected login or another admission error', async () => {
  for (const reason of ['subscription authentication status refused', 'subscription profile or managed configuration changed'])
    await expect(admitSessionOrQueue(async () => { throw Error(reason); })).rejects.toThrow(reason);
});
