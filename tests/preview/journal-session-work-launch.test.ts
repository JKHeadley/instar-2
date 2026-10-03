// Part fifteen §5 (docs/19-scheduled-work) at the real launcher: the delegated-session path is
// enabled only by a reviewed session grant — an activation record bound to the doorway's session
// policy, sealed by the operator's authority and accepting the unconfined residual. An answer
// activation offered as a session grant refuses the launch before anything runs; a real grant is
// admitted and the launcher runs normally.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { encoded } from '../../src/assembly/boundary.js';
import { subscriptionSessionPolicy } from '../../src/assembly/production-provider.js';
import { SESSION_WORK_RESIDUAL } from '../../src/assembly/production-session-work.js';
import { cutoverHarness } from './journal-cutover-harness.mjs';
import { offlineActivationAuthority, offlineProfile, successiveWorld } from './successive-fixture.js';

const grantAt = (directory: string, record: Record<string, unknown>) => {
  mkdirSync(directory, { recursive: true });
  writeFileSync(join(directory, 'session-activation.json'), JSON.stringify(record));
  writeFileSync(join(directory, 'activation-authority.json'), JSON.stringify(offlineActivationAuthority(record)));
  return join(directory, 'session-activation.json');
};
const lastRun = (root: string) => readFileSync(join(root, 'runs.jsonl'), 'utf8').split('\n').filter(line => line.trim())
  .map(line => JSON.parse(line) as Record<string, unknown>).filter(row => 'exit' in row).at(-1) ?? {};

it('refuses an answer activation offered as a session grant, and admits a sealed session grant', async () => {
  const world = successiveWorld(), harness = cutoverHarness(world, offlineProfile);
  harness.setUpdates([]);
  const answer = world.activation();
  // The answer activation binds the conversation policy, not the session policy: refused before launch.
  const refused = await harness.runLive(1, ['--session-work-activation', grantAt(join(world.directory, 'wrong-grant'), answer)]);
  expect(refused.status).not.toBe(0);
  expect(lastRun(harness.liveRoot)).toMatchObject({ reason: 'refused before launch' });
  expect(String(lastRun(harness.liveRoot).refused)).toMatch(/policy differs/u);
  // A session grant that does not accept the unconfined residual is refused too.
  const policyDigest = encoded(subscriptionSessionPolicy(world.model)).hash;
  const unaccepted = await harness.runLive(1, ['--session-work-activation',
    grantAt(join(world.directory, 'no-residual'), { ...answer, invocationPolicyDigest: policyDigest })]);
  expect(unaccepted.status).not.toBe(0);
  expect(String(lastRun(harness.liveRoot).refused)).toMatch(/unconfined residual/u);
  // The reviewed grant: admitted, and the launch runs.
  const admitted = await harness.runLive(1, ['--session-work-activation', grantAt(join(world.directory, 'grant'),
    { ...answer, invocationPolicyDigest: policyDigest, acceptedResiduals: [...answer.acceptedResiduals, SESSION_WORK_RESIDUAL] })]);
  expect(admitted.status, `${admitted.stderr}\n${readFileSync(join(harness.liveRoot, 'runs.jsonl'), 'utf8')}`).toBe(0);
}, 120_000);
