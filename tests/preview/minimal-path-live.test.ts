// @ts-nocheck -- process-level fixture; physical ports are replaced by its test loader.
/** Rule 15 on the real runner (Eleven §5): past the turn allowance a single-machine installation gives its
 * one limited answer only under the operator's accepted P-08 single-machine policy. Real journal-agent
 * children with file-backed ports: the register generation, the conversation lease and its fence are
 * observed by the runner itself; nothing here supplies a dependency flag. */
import { expect, it } from 'vitest';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { authoritySealKey, sealAuthorityRecord, singleMachineProfileDigest, SINGLE_MACHINE_PROFILE } from './activation-authority.js';
import { cutoverHarness } from './journal-cutover-harness.mjs';
import { readRuns } from './self-state.js';
import { OFFLINE_STORAGE_KEY, offlineActivationAuthority, offlineOperatorMessage, offlineProfile, successiveWorld,
  writeOperatorRecords } from './successive-fixture.js';

const ACCEPT_WORDS = 'I accept the single-machine profile and its loss model for this preview.';
const update = (world, id, text) => ({ update_id: id, message: { message_id: 100 + id,
  from: { id: Number(world.configuration.operatorSenderId), is_bot: false, first_name: 'Justin' },
  chat: { id: Number(world.configuration.chatId), type: 'private' }, date: Math.floor(Date.now() / 1000), text } });
const sends = harness => harness.calls().filter(call => call.kind === 'send');
const statusOf = async harness => JSON.parse((await harness.statusOf()).stdout);
/** The desk's step: the operator's acceptance message is in the messaging owner's records, and the desk
 * seals an authority record that names it for this trial and the current profile. */
const recordAcceptance = (world, change = {}) => {
  const grant = offlineOperatorMessage(1, 1, 'offline approval stand-in'), waiver = offlineOperatorMessage(1, 2, 'offline waiver stand-in');
  const accepted = offlineOperatorMessage(1, 3, ACCEPT_WORDS), activation = world.activation();
  writeOperatorRecords(join(world.directory, 'operator-records'), [grant, waiver, accepted]);
  const { seal: _seal, ...body } = offlineActivationAuthority(activation);
  writeFileSync(join(world.directory, 'activation-authority.json'), JSON.stringify(sealAuthorityRecord({ ...body,
    installationPolicies: [{ id: 'p08-single-machine', policy: 'P-08', shape: 'single-machine', grantor: String(world.configuration.operatorSenderId),
      words: ACCEPT_WORDS, source: { kind: 'telegram-message', topicId: 1, messageId: 3 }, acceptedAt: Date.parse(accepted.message.timestamp),
      subject: { trial: activation.trial, profile: SINGLE_MACHINE_PROFILE.id, profileDigest: singleMachineProfileDigest() }, ...change }] },
  authoritySealKey(OFFLINE_STORAGE_KEY))));
};
const twoMessages = world => [update(world, 1, 'What is the marker? Juniper.'), update(world, 2, 'Are you there?')];
const ONE_TURN = ['--max-turns', '1'];

it('without the accepted single-machine policy the message past the allowance is kept, the outage is owned and visible, and nothing is sent for it', async () => {
  const world = successiveWorld(), harness = cutoverHarness(world, offlineProfile);
  harness.setUpdates(twoMessages(world));
  const run = await harness.runLive(4, ONE_TURN);
  expect(run.status, run.stderr).toBe(0);
  expect(run.stderr).toContain('limited answers past a cap are inhibited: no operator acceptance of the single-machine profile (P-08) is recorded for this installation');
  // Only the ordinary answer inside the allowance went out.
  expect(sends(harness)).toHaveLength(1);
  const status = await statusOf(harness);
  expect(status.turns).toBe(2);
  expect(status.minimalReserve).toMatchObject({ reserveTurns: 1, limitedAnswers: [],
    // The runner observed its own register generation, lease and fence: the accepted policy is the only thing missing.
    outages: [{ update: 2, missing: ['installation-policy'], repair: expect.stringContaining('accepts the single-machine profile once (P-08)') }],
    installation: { shape: 'single-machine', registerCurrent: true, policy: { state: 'not-accepted', reason: expect.stringContaining('no operator acceptance') } } });
  expect(status.minimalReserve.installation.register).toMatch(/^sha256:/u);
  expect(readRuns(join(harness.liveRoot, 'runs.jsonl')).launches.at(-1).reason).not.toMatch(/fail|refus/iu);
}, 120000);

it('with the operator\'s accepted policy the same kept message gets exactly one limited answer, accepted by the send seam, and never a second', async () => {
  const world = successiveWorld(), harness = cutoverHarness(world, offlineProfile);
  harness.setUpdates(twoMessages(world));
  expect((await harness.runLive(4, ONE_TURN)).status).toBe(0);
  expect(sends(harness)).toHaveLength(1);
  // The single step: the operator's acceptance is recorded and sealed; the runner is restarted.
  recordAcceptance(world);
  const run = await harness.runLive(4, ONE_TURN);
  expect(run.status, run.stderr).toBe(0);
  expect(run.stderr).not.toContain('inhibited');
  const sent = sends(harness);
  expect(sent).toHaveLength(2);
  // The fixed limited answer (no model call): it says the message is kept and what clears the allowance.
  expect(sent[1].text).toMatch(/^/u);
  expect(sent[1].text).not.toContain('Juniper is the marker');
  expect(sent[1].text).toContain('I got your message and saved it');
  const status = await statusOf(harness);
  expect(status.minimalReserve).toMatchObject({ outages: [], limitedAnswers: [{ update: 2, reason: 'turns', covers: [2], state: 'api-accepted' }],
    installation: { shape: 'single-machine', registerCurrent: true, policy: { state: 'accepted', id: 'p08-single-machine',
      acceptance: 'telegram:topic:1:message:3', profile: 'single-machine-v1', standing: expect.stringContaining('not device-signed') } } });
  expect(status.minimalReserve.repliesUsedThisHour).toBe(1);
  expect(status.replies).toBe(1);                         // the limited answer spends the reserve, not an ordinary reply
  // A further launch repeats nothing.
  expect((await harness.runLive(3, ONE_TURN)).status).toBe(0);
  expect(sends(harness)).toHaveLength(2);
}, 180000);

it('an acceptance for another profile, or one the operator never sent, settles nothing on the real runner', async () => {
  const world = successiveWorld(), harness = cutoverHarness(world, offlineProfile);
  harness.setUpdates(twoMessages(world));
  recordAcceptance(world, { subject: { trial: world.activation().trial, profile: SINGLE_MACHINE_PROFILE.id, profileDigest: 'sha256:an-older-profile' } });
  const stale = await harness.runLive(4, ONE_TURN);
  expect(stale.status, stale.stderr).toBe(0);
  expect(stale.stderr).toContain('covers a different profile, operation set or loss model');
  expect(sends(harness)).toHaveLength(1);
  recordAcceptance(world, { words: 'I accept everything.' });
  const invented = await harness.runLive(3, ONE_TURN);
  expect(invented.status, invented.stderr).toBe(0);
  expect(invented.stderr).toContain('does not resolve to an authenticated operator message');
  expect(sends(harness)).toHaveLength(1);
  expect((await statusOf(harness)).minimalReserve).toMatchObject({ limitedAnswers: [], outages: [{ update: 2, missing: ['installation-policy'] }] });
}, 180000);

it('the status pull names the gap before it bites, and reports the reserve once the policy is accepted', async () => {
  const world = successiveWorld(), harness = cutoverHarness(world, offlineProfile);
  harness.setUpdates([update(world, 1, 'status')]);
  expect((await harness.runLive(3)).status).toBe(0);
  expect(sends(harness)).toHaveLength(1);
  expect(sends(harness)[0].text).toContain('Past a cap: limited answers are not available (missing: installation-policy). Messages are kept. To clear: the operator accepts the single-machine profile once (P-08)');
  recordAcceptance(world);
  harness.setUpdates([update(world, 2, 'status')]);
  expect((await harness.runLive(3)).status).toBe(0);
  expect(sends(harness)).toHaveLength(2);
  expect(sends(harness)[1].text).toContain('Past a cap: each kept message gets one limited answer from the reserve.');
  expect(sends(harness)[1].text).not.toContain('not available');
}, 180000);
