// @ts-nocheck -- process-level fixture; physical ports are replaced by its test loader.
import { expect, it } from 'vitest';
import { lstatSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { cutoverHarness } from './journal-cutover-harness.mjs';
import { offlineProfile, successiveWorld } from './successive-fixture.js';
import { codeDigestOf, installationRows, installationStatusLines, installedCodeOf, installedUpdateFrom, updateDelivery, updatePacketItem } from './installation.js';

const message = (world, id, text) => ({ update_id: id, message: { message_id: 100 + id,
  from: { id: Number(world.configuration.operatorSenderId), is_bot: false, first_name: 'Justin' },
  chat: { id: Number(world.configuration.chatId), type: 'private' }, date: Math.floor(Date.now() / 1000), text } });
const install = (codeDigest, briefingDigest, revision = null) => ({ revision, codeDigest, briefingDigest, files: 1,
  harness: 'preview-journal-native', stallClasses: 9, doorway: 'claude-code-subscription' });
const row = (launch, value) => JSON.stringify({ v: 1, launch, pid: 1, install: value });

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
