// @ts-nocheck -- process-level fixture; physical ports are replaced by its test loader.
// Build 9: required proofs run on the live runner, and status reports their actual results (Rules 9, 26, 43, 62, 73).
import { expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { cutoverHarness } from './journal-cutover-harness.mjs';
import { readProofs } from './proof-log.js';
import { offlineProfile, successiveWorld } from './successive-fixture.js';

const args = ['--no-warnings', '--loader', './scripts/slice-ts-loader.mjs', 'tests/preview/journal-agent.mjs'];
const key = Buffer.alloc(32, 19).toString('hex');
type Posture = { plan: string; posture: string; required: boolean; last: { disposition: string } | null };
type Row = { id: string; protection: string; liveProof: { state: string; update: number | null }; metrics: { unreached: string[] };
  graduation: { overdue: boolean } | null };
type Status = { proofs: Posture[]; capabilities: Row[]; protection: { dark: string[] }; proofLog: { unreadable: number };
  stepCoverage: Record<string, { boundary: string; state: string }[]> };

it('runs the startup and due proofs on the live runner, reports them, and records a live proof only for an accepted reply', () => {
  const world = successiveWorld(), harness = cutoverHarness(world, offlineProfile);
  const operator = Number(world.configuration.operatorSenderId), chat = Number(world.configuration.chatId);
  const message = (update_id: number, text: string) => ({ update_id, message: { message_id: 100 + update_id,
    from: { id: operator, is_bot: false, first_name: 'Justin' }, chat: { id: chat, type: 'private' }, date: Math.floor(Date.now() / 1000), text } });
  harness.setUpdates([message(1, 'What is the marker? Juniper.')]);
  const launched = harness.launchLive(12);
  expect(launched.status, launched.stderr).toBe(0);

  const log = readProofs(join(harness.liveRoot, 'proofs.jsonl'));
  expect(log.unreadable).toBe(0);
  const plans = log.proofs.map(row => row.plan);
  expect(plans[0]).toBe('startup');
  for (const plan of ['telegram-identity', 'journal-restore', 'reply-drain', 'reply-review-reached', 'provider-outcomes', 'summary-checked'])
    expect(plans).toContain(plan);
  // The optional step observer is off in this launch: it is never run and never counted.
  expect(plans).not.toContain('step-check-reached');
  const byPlan = new Map(log.proofs.map(row => [row.plan, row]));
  expect(byPlan.get('startup')).toMatchObject({ disposition: 'passed', observed: { identity: 8820318295, stepCheck: false } });
  expect(byPlan.get('telegram-identity')!.disposition).toBe('passed');
  expect(byPlan.get('journal-restore')).toMatchObject({ disposition: 'passed', observed: { restored: true } });
  // Each plan ran once: a recorded attempt is not due again inside its cadence.
  expect(plans.length).toBe(new Set(plans).size);

  const status = JSON.parse(harness.status().stdout) as Status;
  const posture = new Map(status.proofs.map(row => [row.plan, row]));
  expect(posture.get('startup')!.posture).toBe('healthy');
  expect(posture.get('journal-restore')!.posture).toBe('healthy');
  expect(posture.get('telegram-identity')!.posture).toBe('healthy');
  expect(posture.get('step-check-reached')).toMatchObject({ required: false, posture: 'inactive' });
  expect(status.protection.dark).toEqual(['preview.step-check']);
  const rows = new Map(status.capabilities.map(row => [row.id, row]));
  expect(rows.get('preview.step-check')).toMatchObject({ protection: 'dark', graduation: { overdue: Date.now() >= 1790726400000 } });
  expect(rows.get('preview.channel-memory')!.protection).toBe('off-in-this-launch');
  expect(rows.get('preview.reply')!.liveProof.state).toBe('missing');
  for (const row of status.capabilities) if (row.protection === 'enabled') expect(row.metrics.unreached, row.id).toEqual([]);
  expect(status.stepCoverage['operator-reply']!.find(row => row.boundary === 'prepare-packet')!.state).toBe('missing');

  const record = (update: string, capability = 'preview.reply') => spawnSync(process.execPath, [...args, 'record-live-proof',
    '--root', harness.liveRoot, '--capability', capability, '--update', update],
  { cwd: process.cwd(), env: { ...process.env, INSTAR_SECRET_PREVIEW_STORAGE_KEY: key }, encoding: 'utf8', timeout: 20000 });
  expect(record('7').status).toBe(1);
  expect(record('1', 'preview.stop').status).toBe(1);
  const accepted = record('1');
  expect(accepted.status, accepted.stderr).toBe(0);
  const after = JSON.parse(harness.status().stdout) as Status;
  expect(after.capabilities.find(row => row.id === 'preview.reply')!.liveProof).toMatchObject({ state: 'recorded', update: 1 });

  // A torn line in the durable log is counted, never read as a result.
  writeFileSync(join(harness.liveRoot, 'proofs.jsonl'), `${readFileSync(join(harness.liveRoot, 'proofs.jsonl'), 'utf8')}{"v":1,"plan":`);
  expect((JSON.parse(harness.status().stdout) as Status).proofLog.unreadable).toBe(1);
}, 60000);

it('answers the operator status pull with the proof posture', () => {
  const world = successiveWorld(), harness = cutoverHarness(world, offlineProfile);
  const operator = Number(world.configuration.operatorSenderId), chat = Number(world.configuration.chatId);
  harness.setUpdates([{ update_id: 1, message: { message_id: 101, from: { id: operator, is_bot: false, first_name: 'Justin' },
    chat: { id: chat, type: 'private' }, date: Math.floor(Date.now() / 1000), text: 'status' } }]);
  const launched = harness.launchLive(3);
  expect(launched.status, launched.stderr).toBe(0);
  const sent = harness.calls().filter(call => call.kind === 'send').map(call => call.text as string);
  expect(sent).toHaveLength(1);
  expect(sent[0]).toMatch(/Proofs: \d+\/\d+ healthy/u);
  expect(sent[0]).toMatch(/Capabilities: \d+ on, 1 dark \(preview\.step-check\)/u);
}, 60000);

it('records a stop live proof only after an observed latch with nothing sent past it', () => {
  const world = successiveWorld(), harness = cutoverHarness(world, offlineProfile);
  harness.setUpdates([]);
  expect(harness.launchLive(2).status).toBe(0);
  const env = { ...process.env, INSTAR_SECRET_PREVIEW_STORAGE_KEY: key };
  const run = (...rest: string[]) => spawnSync(process.execPath, [...args, ...rest, '--root', harness.liveRoot],
    { cwd: process.cwd(), env, encoding: 'utf8', timeout: 20000 });
  const cursor = String(JSON.parse(harness.status().stdout).cursor);
  expect(run('record-live-proof', '--capability', 'preview.stop', '--update', cursor).status).toBe(1);
  expect(run('stop').status).toBe(0);
  expect(run('record-live-proof', '--capability', 'preview.stop', '--update', String(Number(cursor) + 1)).status).toBe(1);
  const recorded = run('record-live-proof', '--capability', 'preview.stop', '--update', cursor);
  expect(recorded.status, recorded.stderr).toBe(0);
  expect(JSON.parse(recorded.stdout)).toMatchObject({ fact: 'stop-latched', messageId: null, capability: 'preview.stop' });
}, 60000);
