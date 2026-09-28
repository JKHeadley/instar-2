// @ts-nocheck -- process-level fixture; physical ports are replaced by its test loader.
// Build 9: required proofs run on the live runner, status reports their actual results, a live proof binds to the
// capability's own outcome, and an unwritable proof log never stops the conversation (Rules 9, 14, 26, 43, 62, 73, 95).
import { expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { cutoverHarness } from './journal-cutover-harness.mjs';
import { readProofs } from './proof-log.js';
import { offlineProfile, successiveWorld } from './successive-fixture.js';

const args = ['--no-warnings', '--loader', './scripts/slice-ts-loader.mjs', 'tests/preview/journal-agent.mjs'];
const key = Buffer.alloc(32, 19).toString('hex');
const setup = () => {
  const world = successiveWorld(), harness = cutoverHarness(world, offlineProfile);
  const operator = Number(world.configuration.operatorSenderId), chat = Number(world.configuration.chatId);
  const message = (update_id, text) => ({ update_id, message: { message_id: 100 + update_id,
    from: { id: operator, is_bot: false, first_name: 'Justin' }, chat: { id: chat, type: 'private' }, date: Math.floor(Date.now() / 1000), text } });
  const record = (capability, update, ...extra) => spawnSync(process.execPath, [...args, 'record-live-proof',
    '--root', harness.liveRoot, '--capability', capability, '--update', String(update), ...extra],
  { cwd: process.cwd(), env: { ...process.env, INSTAR_SECRET_PREVIEW_STORAGE_KEY: key }, encoding: 'utf8', timeout: 20000 });
  return { world, harness, message, record };
};

it('runs the startup and due proofs on the live runner and reports them against the declared inventory', () => {
  const { harness, message } = setup();
  harness.setUpdates([message(1, 'What is the marker? Juniper.')]);
  const launched = harness.launchLive(20);
  expect(launched.status, launched.stderr).toBe(0);

  const log = readProofs(join(harness.liveRoot, 'proofs.jsonl'));
  expect(log).toMatchObject({ available: true, unreadable: 0 });
  const plans = log.proofs.map(row => row.plan);
  expect(plans[0]).toBe('startup');
  for (const plan of ['telegram-identity', 'journal-restore', 'reply-drain', 'reply-delivered', 'reply-review-reached', 'provider-outcomes'])
    expect(plans).toContain(plan);
  // The optional step observer is off in this launch: it is never run and never counted.
  expect(plans).not.toContain('step-check-reached');
  const byPlan = new Map(log.proofs.map(row => [row.plan, row]));
  expect(byPlan.get('startup')).toMatchObject({ disposition: 'passed', observed: { identity: 8820318295, stepCheck: false } });
  expect(byPlan.get('journal-restore')).toMatchObject({ disposition: 'passed', observed: { restored: true, differing: null } });
  expect(byPlan.get('reply-delivered')).toMatchObject({ disposition: 'passed' });
  expect(plans.length).toBe(new Set(plans).size);

  const status = JSON.parse(harness.status().stdout);
  const posture = new Map(status.proofs.map(row => [row.plan, row]));
  for (const plan of ['startup', 'journal-restore', 'telegram-identity', 'reply-delivered']) expect(posture.get(plan).posture, plan).toBe('healthy');
  expect(posture.get('reply-review-reached').last.observed).toMatchObject({ sentAnswers: 1 });
  expect(posture.get('step-check-reached')).toMatchObject({ required: false, posture: 'inactive' });
  expect(status.protection.inventoryGaps).toEqual([]);
  expect(status.protection.dark).toEqual(['preview.step-check']);
  expect(status.protection.gap).toEqual([]);
  // Record-referencing declarations wait for a register that can resolve them: reported, never dropped.
  expect(status.protection.pendingRegistration).toContain('preview.reply');
  const rows = new Map(status.capabilities.map(row => [row.id, row]));
  // Held notices, reminders and stops were never exercised: those capabilities are not confirmed.
  for (const id of ['preview.held-reply-notice', 'preview.reminders', 'preview.stop']) expect(rows.get(id).protection, id).toBe('unconfirmed');
  expect(rows.get('preview.channel-memory').protection).toBe('off-in-this-launch');
  expect([rows.get('preview.reply').registered, rows.get('preview.rolling-summary').registered]).toEqual([false, true]);
  expect(rows.get('preview.reply').liveProof.state).toBe('missing');
  for (const row of status.capabilities) if (row.enabled) expect(row.metrics.unreached, row.id).toEqual([]);
  const reply = status.stepCoverage['operator-reply'];
  expect(reply.rows.find(row => row.boundary === 'prepare-packet')).toMatchObject({ population: 1, state: 'missing' });
  expect(status.duties.find(row => row.id === 'preview.duty.every-reply-reviewed').posture).toBeDefined();

  // A torn line in the durable log is counted, never read as a result.
  writeFileSync(join(harness.liveRoot, 'proofs.jsonl'), `${readFileSync(join(harness.liveRoot, 'proofs.jsonl'), 'utf8')}{"v":1,"plan":`);
  expect(JSON.parse(harness.status().stdout).proofLog.unreadable).toBe(1);
}, 60000);

it('records a live proof only for the capability’s own outcome, never an unrelated turn or a disabled capability', () => {
  const { harness, message, record } = setup();
  harness.setUpdates([message(1, 'What is the marker? Juniper.'), message(2, 'status')]);
  expect(harness.launchLive(12).status).toBe(0);
  // Astra's counterexamples: each of these was accepted before.
  expect(record('preview.reminders', 1).status).toBe(1);
  expect(record('preview.channel-memory', 1, '--desk-observation', 'arrived').stderr).toMatch(/had preview\.channel-memory off/u);
  expect(record('preview.status-pull', 1).status).toBe(1);
  expect(record('preview.reply', 2).status).toBe(1);
  expect(record('preview.memory', 1).stderr).toMatch(/desk-recorded semantic observation/u);
  const reply = record('preview.reply', 1), status = record('preview.status-pull', 2);
  expect(reply.status, reply.stderr).toBe(0);
  expect(status.status, status.stderr).toBe(0);
  const startup = readProofs(join(harness.liveRoot, 'proofs.jsonl')).proofs.find(row => row.plan === 'startup');
  expect(JSON.parse(reply.stdout)).toMatchObject({ capability: 'preview.reply', update: 1, generation: startup.generation,
    version: startup.observed['version:preview.reply'], fact: 'outcome-observed' });
  const rows = new Map(JSON.parse(harness.status().stdout).capabilities.map(row => [row.id, row]));
  expect(rows.get('preview.reply').liveProof).toMatchObject({ state: 'recorded', update: 1 });
  expect(rows.get('preview.status-pull').liveProof).toMatchObject({ state: 'recorded', update: 2 });
}, 60000);

it('answers the operator status pull with the proof posture', () => {
  const { harness, message } = setup();
  harness.setUpdates([message(1, 'status')]);
  const launched = harness.launchLive(3);
  expect(launched.status, launched.stderr).toBe(0);
  const sent = harness.calls().filter(call => call.kind === 'send').map(call => call.text);
  expect(sent).toHaveLength(1);
  expect(sent[0]).toMatch(/Proofs: \d+\/\d+ healthy/u);
  expect(sent[0]).toMatch(/Capabilities: \d+ confirmed, \d+ unconfirmed, 1 dark \(preview\.step-check\)/u);
}, 60000);

it('an unwritable proof log is reported and retried; intake and replies continue (Rules 14, 95)', () => {
  const { harness, message } = setup();
  harness.setUpdates([]);
  expect(harness.launchLive(2).status).toBe(0);
  const path = join(harness.liveRoot, 'proofs.jsonl');
  rmSync(path); mkdirSync(path);
  harness.setUpdates([message(1, 'Can you reply?')]);
  const before = harness.calls().length;
  const launched = harness.launchLive(3);
  expect(launched.status, launched.stderr).toBe(0);
  expect(launched.stderr).toMatch(/proof log unavailable/u);
  expect(harness.calls().slice(before).filter(call => call.kind === 'send')).toHaveLength(1);
  const status = JSON.parse(harness.status().stdout);
  expect(status.proofLog.available).toBe(false);
  expect(status.proofs.every(row => row.posture !== 'healthy')).toBe(true);
  // Restoring the store lets proofs record again; nothing from the failed launch was counted.
  rmSync(path, { recursive: true });
  expect(harness.launchLive(2).status).toBe(0);
  expect(readProofs(path).proofs[0].plan).toBe('startup');
}, 90000);

it('records a stop live proof only after an observed latch with nothing sent past it', () => {
  const { harness } = setup();
  harness.setUpdates([]);
  expect(harness.launchLive(2).status).toBe(0);
  const env = { ...process.env, INSTAR_SECRET_PREVIEW_STORAGE_KEY: key };
  const run = (...rest) => spawnSync(process.execPath, [...args, ...rest, '--root', harness.liveRoot],
    { cwd: process.cwd(), env, encoding: 'utf8', timeout: 20000 });
  const cursor = String(JSON.parse(harness.status().stdout).cursor);
  expect(run('record-live-proof', '--capability', 'preview.stop', '--update', cursor).status).toBe(1);
  expect(run('stop').status).toBe(0);
  expect(run('record-live-proof', '--capability', 'preview.stop', '--update', String(Number(cursor) + 1)).status).toBe(1);
  const recorded = run('record-live-proof', '--capability', 'preview.stop', '--update', cursor);
  expect(recorded.status, recorded.stderr).toBe(0);
  expect(JSON.parse(recorded.stdout)).toMatchObject({ fact: 'outcome-observed', messageId: null, capability: 'preview.stop' });
  expect(JSON.parse(harness.status().stdout).capabilities.find(row => row.id === 'preview.stop').outcomes[0]).toMatchObject({ posture: 'unavailable', confirmed: true });
}, 60000);

it("records a delivered requested summary's live proof through the command at its synthetic update, and reads it back", async () => {
  const { mkdtempSync, realpathSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const { createJournalWorker, openPreviewJournal } = await import('./journal-test-worker.js');
  const { appendProof } = await import('./proof-log.js');
  const { appendRun } = await import('./self-state.js');
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'preview-summary-live-proof-')));
  try {
    const start = Date.UTC(2026, 8, 26, 17), daily = 'send me a summary of today every day at 6 pm';
    let now = start;
    const journal = openPreviewJournal(join(root, 'journal.encrypted'), Buffer.from(key, 'hex'), { kind: 'genesis', bot: '12345678', chat: '7654321',
      operator: '7654321', grant: 'grant:summary', configurationDigest: 'sha256:summary', expires: Date.UTC(2026, 9, 10), maxCalls: 30, maxReplies: 30,
      maxTurns: 30, maxBytes: 12000, cursor: 0 });
    let sends = 0;
    const worker = createJournalWorker(journal, { now: () => now, stopped: () => false, timeZone: 'America/Los_Angeles', checkOutbound: () => {},
      model: async input => JSON.stringify(input.question.startsWith('[Scheduled summary') ? { reply: 'The day in brief.', memory: [], dated: [] }
        : { reply: 'Okay.', memory: [], dated: [], summaries: [{ quote: daily, when: 'every day at 6 pm', period: 'today', repeat: 'daily' }] }),
      send: async () => ++sends });
    worker.intake([{ update_id: 1, message: { chat: { id: 7654321, type: 'private' }, from: { id: 7654321 }, text: daily, date: start / 1000 } }]);
    await worker.drain();
    now = Date.UTC(2026, 8, 27, 1); await worker.sendReminders();
    const summary = journal.view.order.find(turn => turn.requestedSummary);
    expect(summary).toMatchObject({ update: 1.0009765625, sent: 2 });
    journal.close();
    // The launch history that executed it: one run and its startup record carrying the capability versions.
    appendRun(join(root, 'runs.jsonl'), { v: 1, launch: start - 10, pid: 1 });
    appendProof(join(root, 'proofs.jsonl'), { v: 1, plan: 'startup', planVersion: 'p', generation: 'g1', startedAt: start - 20, completedAt: start - 20,
      disposition: 'passed', observed: { stepCheck: false, agentState: false, 'version:preview.requested-summaries': 'v1' }, detail: '', observedAt: null, capture: null });
    const env = { ...process.env, INSTAR_SECRET_PREVIEW_STORAGE_KEY: key };
    const record = update => spawnSync(process.execPath, [...args, 'record-live-proof', '--root', root, '--capability', 'preview.requested-summaries',
      '--update', String(update)], { cwd: process.cwd(), env, encoding: 'utf8', timeout: 20000 });
    expect(record(1).status).toBe(1); // the operator's source message is not the summary outcome
    expect(record(1.1).status).toBe(1); // off the journal's update grid
    const recorded = record(summary.update);
    expect(recorded.status, recorded.stderr).toBe(0);
    expect(JSON.parse(recorded.stdout)).toMatchObject({ capability: 'preview.requested-summaries', update: 1.0009765625, messageId: 2, version: 'v1' });
    const log = readProofs(join(root, 'proofs.jsonl'));
    expect(log).toMatchObject({ unreadable: 0, refused: [] });
    expect(log.liveProofs).toEqual([expect.objectContaining({ update: 1.0009765625, capability: 'preview.requested-summaries' })]);
  } finally { rmSync(root, { recursive: true, force: true }); }
}, 60000);
