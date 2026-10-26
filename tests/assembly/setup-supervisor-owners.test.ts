import { expect, it } from 'vitest';
// @ts-expect-error OS-neutral installer owner composition.
import { setupPreparationOwners } from '../../scripts/setup-supervisor-owners.mjs';
const checkpoint = { installation: 'installation', session: 'session', subject: 'a'.repeat(64), authority: 'preparation',
  step: 'key', phase: 'pre', operation: 'key-op', schema: 'setup-owner-results-v1' };
it('routes custody and append to their distinct existing owners, verifying the broker before each handoff', async () => {
  const calls: string[] = [];
  const broker = { install() {}, start() {}, stop() {}, verify() { calls.push('verify'); },
    status() { return { state: 'running' }; }, request(request: any) { calls.push(`custody:${request.operation}`); return 'executed'; } };
  const facts = { request(request: any) { calls.push(`facts:${request.operation}`); return 'executed'; } };
  const owners = setupPreparationOwners({ broker, facts });
  expect(await owners.execute(checkpoint)).toBe('executed');
  expect(await owners.execute({ ...checkpoint, step: 'append' })).toBe('executed');
  expect(calls).toEqual(['verify', 'custody:execute', 'verify', 'facts:execute']);
  expect(Object.keys(owners).sort()).toEqual(['authenticate', 'execute', 'inspect', 'reconcile']);
});
it('preserves broker refusals and blocks incomplete or unavailable owner wiring', async () => {
  let state = 'stopped';
  const broker = { install() {}, start() {}, stop() {}, verify() {}, status() { return { state }; },
    request() { throw Error('must not run'); } };
  expect(() => setupPreparationOwners({ broker, facts: {} })).toThrow();
  const owners = setupPreparationOwners({ broker, facts: { request() { throw Error('must not run'); } } });
  await expect(owners.execute(checkpoint)).rejects.toThrow('custodian unavailable');
  await expect(owners.execute({ ...checkpoint, step: 'export-secret' })).rejects.toThrow('invalid setup checkpoint');
  state = 'running';
  await expect(owners.execute(checkpoint)).rejects.toThrow('must not run');
});
