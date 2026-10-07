// @ts-nocheck -- process-level fixture; physical ports are replaced by its test loader.
import { expect, it } from 'vitest';
import { lstatSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { cutoverHarness } from './journal-cutover-harness.mjs';
import { offlineProfile, successiveWorld } from './successive-fixture.js';
import { UNRECORDED, codeDigestOf, installationRows, installationStatusLines, installedCodeOf, installedUpdateFrom, staleAgainst,
  updateDelivery, updatePacketItem } from './installation.js';
import { createHash } from 'node:crypto';

const message = (world, id, text) => ({ update_id: id, message: { message_id: 100 + id,
  from: { id: Number(world.configuration.operatorSenderId), is_bot: false, first_name: 'Justin' },
  chat: { id: Number(world.configuration.chatId), type: 'private' }, date: Math.floor(Date.now() / 1000), text } });
const install = (codeDigest, briefingDigest, revision = null) => ({ revision, codeDigest, briefingDigest, files: 1,
  harness: 'preview-journal-native', stallClasses: 9, doorway: 'claude-code-subscription' });
const row = (launch, value) => JSON.stringify({ v: 1, launch, pid: 1, install: value });
/** J.sh's J1e excludes the operator's own "status" message by the sha of its text. */
const STATUS_SHA = `sha256:${createHash('sha256').update('status', 'utf8').digest('hex')}`;

it('a first recorded installation is not an update; changed code is, and a restart keeps the same update (Rule 44)', () => {
  const old = install('sha256:old', 'sha256:brief-a', 'aaaa1111'), now = install('sha256:new', 'sha256:brief-b', 'bbbb2222');
  expect(installedUpdateFrom(installationRows(row(10, old)), old, 20)).toBeNull();
  const update = installedUpdateFrom(installationRows([row(10, old), row(20, now)].join('\n')), now, 30);
  expect(update).toMatchObject({ at: 20, from: { revision: 'aaaa1111' }, to: { revision: 'bbbb2222' }, briefingChanged: true });
  expect(installedUpdateFrom(installationRows([row(10, old), row(20, now), row(30, now)].join('\n')), now, 40)?.at).toBe(20);
  expect(installedUpdateFrom(installationRows(row(10, install('sha256:old', 'sha256:brief-b'))), now, 20)?.briefingChanged).toBe(false);
  // Launches from builds that predate this record make the first recorded launch an update from an unrecorded build.
  const legacy = [JSON.stringify({ v: 1, launch: 5, pid: 1 }), JSON.stringify({ v: 1, launch: 5, exit: 6, reason: 'x' }),
    JSON.stringify({ v: 1, launch: 5, poll: 'failed', at: 5 })].join('\n');
  expect(installedUpdateFrom(installationRows(legacy), now, 20)).toMatchObject({ at: 20, from: { codeDigest: 'unrecorded' }, briefingChanged: null });
  expect(updatePacketItem(installedUpdateFrom(installationRows(legacy), now, 20)!).from).toBe('an unrecorded earlier build');
  expect(codeDigestOf([{ path: 'a', bytes: 'x' }, { path: 'b', bytes: 'y' }])).toBe(codeDigestOf([{ path: 'b', bytes: 'y' }, { path: 'a', bytes: 'x' }]));
  expect(codeDigestOf([{ path: 'a', bytes: 'x' }])).not.toBe(codeDigestOf([{ path: 'a', bytes: 'z' }]));
});

it('delivery is proven only by a sent answer whose recorded prompt carried the exact update', () => {
  const update = installedUpdateFrom(installationRows(row(10, install('sha256:old', 'sha256:a', 'aaaa'))), install('sha256:new', 'sha256:b', 'bbbb'), 20)!;
  const prompt = item => JSON.stringify({ messages: [{ role: 'context', content: JSON.stringify({ packet: { installedUpdate: item } }) }] });
  expect(updateDelivery(update, [{ update: 1, sentAt: 25, prompt: prompt({ ...updatePacketItem(update), to: 'other' }) }])).toBeNull();
  expect(updateDelivery(update, [{ update: 1, prompt: prompt(updatePacketItem(update)) }])).toBeNull();
  expect(updateDelivery(update, [{ update: 1, sentAt: 19, prompt: prompt(updatePacketItem(update)) }])).toBeNull();
  expect(updateDelivery(update, [{ update: 2, sentAt: 25, prompt: prompt(updatePacketItem(update)) }])).toEqual({ deliveredInReplyTo: 2 });
});

it('an existing installation updated in place carries the change into its next reply and reports its effective build (Rules 26, 44)', () => {
  const world = successiveWorld(), harness = cutoverHarness(world, offlineProfile);
  harness.setUpdates([message(world, 1, 'What is the marker? Juniper.')]);
  expect(harness.launchLive(2).status).toBe(0);
  const first = JSON.parse(harness.status().stdout).installation;
  expect(first).toMatchObject({ stale: false, update: null, harness: 'preview-journal-native', stallClasses: 9,
    doorway: 'claude-code-subscription' });
  expect(first.lastLaunch.codeDigest).toBe(first.installed.codeDigest);
  expect(first.lastLaunch.files).toBeGreaterThan(50);

  // The root was installed by an older build: its launch rows name other code and another briefing.
  const runsPath = join(harness.liveRoot, 'runs.jsonl');
  writeFileSync(runsPath, readFileSync(runsPath, 'utf8').replaceAll(first.lastLaunch.codeDigest, 'sha256:older-build')
    .replaceAll(first.briefingDigest, 'sha256:older-briefing'));
  harness.setUpdates([message(world, 1, 'What is the marker? Juniper.'), message(world, 2, 'What can you do now?')]);
  expect(harness.launchLive(2).status).toBe(0);
  const updated = JSON.parse(harness.status().stdout).installation;
  expect(updated.update).toMatchObject({ from: { codeDigest: 'sha256:older-build' }, briefingChanged: true });
  expect(updated.updateDelivered).toEqual({ deliveredInReplyTo: 2 });

  // A restart on the same code keeps the delivered update; the status reply shows the effective build.
  harness.setUpdates([message(world, 1, 'x'), message(world, 2, 'x'), message(world, 3, 'status')]);
  expect(harness.launchLive(2).status).toBe(0);
  const statusText = harness.calls().filter(call => call.kind === 'send').at(-1).text;
  expect(statusText).toContain('running code matches the installed files');
  expect(statusText).toContain('Harness: preview-journal-native via claude-code-subscription; 9 of 9 silent-stop classes covered.');
  expect(statusText).toMatch(/Update: from [0-9a-f]{8}; briefing changed; delivered in my reply to update 2\./u);
  expect(JSON.parse(harness.status().stdout).installation.updateDelivered).toEqual({ deliveredInReplyTo: 2 });
}, 90000);

it('a change to executed code outside the import graph (the Telegram bridge, the loader) is an installed update and a stale process (Rules 26, 44)', () => {
  const read = (path: string) => { try { return readFileSync(path); } catch { return null; } };
  const exists = (path: string) => { try { return lstatSync(path).isFile(); } catch { return false; } };
  const current = installedCodeOf(read, exists, 'rev1');
  const changed = (target: string) => installedCodeOf(path => path === target ? Buffer.concat([read(path)!, Buffer.from('\n// changed\n')]) : read(path), exists, 'rev1');
  // The imported-file neighbour and the two executed-only artifacts each change the installed code.
  for (const target of ['tests/preview/installation.ts', 'src/assembly/telegram-bot-api-bridge.mjs', 'scripts/slice-ts-loader.mjs'])
    expect(changed(target).codeDigest, target).not.toBe(current.codeDigest);
  // A file the runner never executes does not.
  expect(changed('tests/preview/journal-installation.test.ts').codeDigest).toBe(current.codeDigest);
  const bridgeOnly = changed('src/assembly/telegram-bot-api-bridge.mjs');
  const launched = { ...current, briefingDigest: 'sha256:b', harness: 'preview-journal-native', stallClasses: 9, doorway: 'claude-code-subscription' };
  expect(installationStatusLines(launched, 0, bridgeOnly, null, null, 'UTC')[0]).toContain('a restart is needed to run them');
  const next = { ...launched, codeDigest: bridgeOnly.codeDigest };
  expect(installedUpdateFrom(installationRows(row(10, launched)), next, 20)).toMatchObject({ from: { codeDigest: current.codeDigest },
    to: { codeDigest: bridgeOnly.codeDigest }, briefingChanged: false });
});

/**
 * Plan #616: the live build d4d33e16 failed J1e (rule 44) where bc10e616 passed. The two builds
 * differ in seventeen files and not one of them is in the runner's executed closure, so both
 * launches recorded the same codeDigest; the sameness test read only the digests, so the relaunch
 * of one root onto the new build was not an update. The record then kept the first build's install
 * time and lost its `from`, and the reply the status named as the delivering one was an hour and a
 * half older than the first reply after the switch.
 */
it('a relaunch on a new revision is an update even when the executed bytes are identical (Rule 44)', () => {
  const old = install('sha256:same-code', 'sha256:same-briefing', 'bc10e616');
  const now = install('sha256:same-code', 'sha256:same-briefing', 'd4d33e16');
  // The defect: identical digests, different revision, one root relaunched in place.
  const update = installedUpdateFrom(installationRows([row(10, old), row(20, old), row(30, now)].join('\n')), now, 31);
  expect(update).toMatchObject({ at: 30, from: { revision: 'bc10e616', codeDigest: 'sha256:same-code' },
    to: { revision: 'd4d33e16' }, briefingChanged: false });
  // The other side: a restart on the same build is not a new update, and keeps the one it carries.
  expect(installedUpdateFrom(installationRows([row(10, old), row(20, now), row(30, now)].join('\n')), now, 31)?.at).toBe(20);
  expect(installedUpdateFrom(installationRows([row(10, now), row(20, now)].join('\n')), now, 21)).toBeNull();
  // A fresh genesis is not an update, and an earlier launch that recorded nothing stays unrecorded.
  expect(installedUpdateFrom(installationRows(row(10, now)), now, 11)).toBeNull();
  expect(installedUpdateFrom(installationRows([JSON.stringify({ v: 1, launch: 10, pid: 1 }), row(20, now)].join('\n')), now, 21))
    .toMatchObject({ at: 20, from: { revision: null, codeDigest: 'unrecorded' }, briefingChanged: null });
  // An unknown revision on either side cannot prove a change: the digests decide alone.
  const unknown = install('sha256:same-code', 'sha256:same-briefing', null);
  expect(installedUpdateFrom(installationRows([row(10, unknown), row(20, now)].join('\n')), now, 21)).toBeNull();
  expect(installedUpdateFrom(installationRows([row(10, old), row(20, unknown)].join('\n')), unknown, 21)).toBeNull();
  // A launch row from a build that recorded no revision key at all is unknown too, not a change,
  // and its changed code is still an update.
  const noKey = JSON.stringify({ v: 1, launch: 10, pid: 1, install: { codeDigest: 'sha256:same-code',
    briefingDigest: 'sha256:same-briefing', files: 1, harness: 'preview-journal-native', stallClasses: 9,
    doorway: 'claude-code-subscription' } });
  expect(installedUpdateFrom(installationRows(noKey), now, 11)).toBeNull();
  expect(installedUpdateFrom(installationRows(noKey), install('sha256:later-code', 'sha256:same-briefing', 'd4d33e16'), 11))
    .toMatchObject({ at: 11, from: { codeDigest: 'sha256:same-code' }, to: { revision: 'd4d33e16' } });
  // The same rule decides staleness, so an in-place switch that was never restarted is visible.
  expect(staleAgainst(old, now)).toBe(true);
  expect(staleAgainst(old, old)).toBe(false);
  expect(staleAgainst(old, unknown)).toBe(false);
  expect(staleAgainst(old, { ...now, revision: 'bc10e616', codeDigest: 'sha256:other-code' })).toBe(true);
  expect(installationStatusLines(old, 0, now, null, null, 'UTC')[0]).toContain('a restart is needed to run them');
  expect(installationStatusLines(old, 0, old, null, null, 'UTC')[0]).toContain('running code matches the installed files');
});

it('the live proof room\'s own run log and sent turns now name the reply that carried the update (Rule 44)', () => {
  const live = JSON.parse(readFileSync(new URL('./fixtures/installation-relaunch-live-2026-10-07.json', import.meta.url), 'utf8')) as {
    observed: { update: { at: number }; updateDelivered: { deliveredInReplyTo: number } };
    runLog: Record<string, unknown>[];
    turns: { update: number; sentAt: number | null; prompted: boolean; textSha256: string; replyPrefix: string }[] };
  const rows = installationRows(live.runLog.map(entry => JSON.stringify(entry)).join('\n'));
  const last = rows.filter(entry => entry.codeDigest !== UNRECORDED).at(-1)!;
  expect(last.revision).toBe('d4d33e16e2c381a74216c339196f0ab71e4ef658');
  const update = installedUpdateFrom(rows, last, last.launch + 1)!;
  expect(update).toMatchObject({ at: last.launch, from: { revision: 'bc10e61632fbc9bba0b559218ae81b6eac7b2b35' },
    to: { revision: 'd4d33e16e2c381a74216c339196f0ab71e4ef658' } });
  // J1e's rule, over the turns the live run recorded: the first model-prompted reply sent at or
  // after the update, status replies excluded. It is the reply the live status named as delivering.
  const firstSent = (at: number) => live.turns.filter(turn => typeof turn.sentAt === 'number' && turn.sentAt >= at
    && turn.prompted && turn.textSha256 !== STATUS_SHA && !turn.replyPrefix.startsWith('PREVIEW — Status ('))
    .sort((a, b) => a.sentAt! - b.sentAt!)[0]?.update ?? null;
  expect(firstSent(update.at)).toBe(live.observed.updateDelivered.deliveredInReplyTo);
  // The recorded failure: the shipped record's `at` was the first build's install time, so J1e read
  // a reply sent an hour and a half before the switch.
  expect(live.observed.update.at).toBeLessThan(update.at);
  expect(firstSent(live.observed.update.at)).not.toBe(live.observed.updateDelivered.deliveredInReplyTo);
});

/**
 * The live scenario at the launch site, not only at the status read: the note the agent is told
 * comes from the update computed at launch, from a run log that does not yet hold this launch's
 * row. Proof room 2's relaunch changed only the revision — its digests were byte-identical — so
 * before the fix that site computed no update at all and the agent was never told its build moved.
 */
it('a relaunch whose only change is the revision is computed at launch and carried into the next reply (Rule 44)', () => {
  const world = successiveWorld(), harness = cutoverHarness(world, offlineProfile);
  harness.setUpdates([message(world, 1, 'What is the marker? Juniper.')]);
  expect(harness.launchLive(2).status).toBe(0);
  const first = JSON.parse(harness.status().stdout).installation;
  expect(typeof first.lastLaunch.revision).toBe('string');
  expect(first.update).toBeNull();

  // The root was installed by an earlier build of the same executed bytes: only the revision differs.
  const runsPath = join(harness.liveRoot, 'runs.jsonl');
  const older = 'bc10e61632fbc9bba0b559218ae81b6eac7b2b35';
  writeFileSync(runsPath, readFileSync(runsPath, 'utf8').replaceAll(first.lastLaunch.revision, older));
  harness.setUpdates([message(world, 1, 'What is the marker? Juniper.'), message(world, 2, 'What can you do now?')]);
  expect(harness.launchLive(2).status).toBe(0);
  const updated = JSON.parse(harness.status().stdout).installation;
  expect(updated.update).toMatchObject({ from: { revision: older, codeDigest: first.lastLaunch.codeDigest },
    to: { revision: first.lastLaunch.revision, codeDigest: first.lastLaunch.codeDigest }, briefingChanged: false });
  // at is this launch's install time, not the earlier build's: it is after the rewritten rows.
  expect(updated.update.at).toBe(updated.lastLaunch.launch);
  // The agent was actually told: the update rode the very next reply, which is the delivering one.
  expect(updated.updateDelivered).toEqual({ deliveredInReplyTo: 2 });
}, 90000);
