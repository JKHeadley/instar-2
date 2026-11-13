// @ts-nocheck -- process-level fixture; physical ports are replaced by its test loader.
// Build 9: required proofs run on the live runner, status reports their actual results, a live proof binds to the
// capability's own outcome, and an unwritable proof log never stops the conversation (Rules 9, 14, 26, 43, 62, 73, 95).
import { expect, it } from 'vitest';
import { execFile } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { cutoverHarness } from './journal-cutover-harness.mjs';
import { initializeUpdateRuntime, writeUpdateRuntime } from '../../scripts/update.mjs';
import { readProofs } from './proof-log.js';
import { offlineProfile, successiveWorld } from './successive-fixture.js';
import { SUBSCRIPTION_PREVIEW_EXPIRY } from '../../src/assembly/production-provider.js';

// Await child completion so Vitest can service its reporting IPC during real launches.
const command = (argv, env) => new Promise(resolve => {
  execFile(process.execPath, argv, { cwd: process.cwd(), env, encoding: 'utf8', timeout: 30000 },
    (error, stdout, stderr) => resolve({ status: error ? error.code ?? 1 : 0, stdout, stderr, error }));
});
const statusOf = async harness => {
  const result = await harness.statusOf();
  expect(result.status, result.stderr || `status child signal: ${result.signal}`).toBe(0);
  return JSON.parse(result.stdout);
};

// The recorded activation has a fixed reviewed expiry. Exercise its valid window with an
// injected child clock that advances consistently across processes; never extend the
// production allowance to keep a fixture alive.
const fixtureNow = 1790520001000;
const clockOrigin = Date.now();
const clockImport = (now: number) => 'data:text/javascript,' + encodeURIComponent(
  `const actualNow = Date.now; Date.now = () => ${now} + actualNow() - ${clockOrigin};`);
const args = ['--no-warnings', '--import', clockImport(fixtureNow), '--loader', './scripts/slice-ts-loader.mjs', 'tests/preview/journal-agent.mjs'];
const key = Buffer.alloc(32, 19).toString('hex');
const setup = (now = fixtureNow) => {
  const world = successiveWorld(), harness = cutoverHarness(world, offlineProfile, {
    NODE_OPTIONS: [process.env.NODE_OPTIONS, `--import=${clockImport(now)}`].filter(Boolean).join(' '),
  });
  const operator = Number(world.configuration.operatorSenderId), chat = Number(world.configuration.chatId);
  const message = (update_id, text) => ({ update_id, message: { message_id: 100 + update_id,
    from: { id: operator, is_bot: false, first_name: 'Justin' }, chat: { id: chat, type: 'private' }, date: Math.floor(now / 1000), text } });
  const record = (capability, update, ...extra) => command([...args, 'record-live-proof',
    '--root', harness.liveRoot, '--capability', capability, '--update', String(update), ...extra], { ...process.env, INSTAR_SECRET_PREVIEW_STORAGE_KEY: key });
  return { world, harness, message, record };
};

// activation-stop-1108: the activation end date is a reminder, never a stop: the same recorded activation launches past it.
it('launches the same recorded activation past its end date and polls', async () => {
  const { harness } = setup(SUBSCRIPTION_PREVIEW_EXPIRY + 1);
  harness.setUpdates([]);
  const launched = (await harness.runLive(2));
  expect(launched.status, launched.stderr).toBe(0);
  const runs = readFileSync(join(harness.liveRoot, 'runs.jsonl'), 'utf8').trim().split('\n').filter(Boolean).map(JSON.parse);
  expect(runs.some(row => row.reason === 'refused before launch')).toBe(false);
  expect(existsSync(join(harness.directory, 'telegram.jsonl'))).toBe(true);
}, 60000);

// Held probe evidence (register-contract-map): each probe named here executes on the real launcher and passes.
it('P9-PREVIEW-startup P9-PREVIEW-store-agreements P9-PREVIEW-journal-restore P9-PREVIEW-telegram-identity P9-PREVIEW-reply-delivered P9-PREVIEW-reply-drain P9-PREVIEW-reply-review-reached runs the startup and due proofs on the live runner and reports them against the declared inventory', async () => {
  const { harness, message } = setup();
  harness.setUpdates([message(1, 'What is the marker? Juniper.')]);
  const launched = (await harness.runLive(20));
  expect(launched.status, launched.stderr).toBe(0);

  const log = readProofs(join(harness.liveRoot, 'proofs.jsonl'));
  expect(log).toMatchObject({ available: true, unreadable: 0 });
  const plans = log.proofs.map(row => row.plan);
  expect(plans[0]).toBe('startup');
  for (const plan of ['telegram-identity', 'journal-restore', 'store-agreements', 'reply-drain', 'reply-delivered', 'reply-review-reached', 'provider-outcomes'])
    expect(plans).toContain(plan);
  // The optional step observer is off in this launch: it is never run and never counted.
  expect(plans).not.toContain('step-check-reached');
  const byPlan = new Map(log.proofs.map(row => [row.plan, row]));
  expect(byPlan.get('startup')).toMatchObject({ disposition: 'passed', observed: { identity: 12345678, stepCheck: false } });
  expect(byPlan.get('journal-restore')).toMatchObject({ disposition: 'passed', observed: { restored: true, differing: null } });
  expect(byPlan.get('reply-delivered')).toMatchObject({ disposition: 'passed' });
  for (const plan of ['telegram-identity', 'reply-drain', 'reply-review-reached']) expect(byPlan.get(plan).disposition, plan).toBe('passed');
  // Rule 33: build 11's declared comparisons (plus media-custody) ran at launch through this executor, each verdict durable in agreements.jsonl.
  expect(byPlan.get('store-agreements')).toMatchObject({ disposition: 'passed', observed: { declared: 5, disagree: 0, unchecked: 0 } });
  expect(plans.indexOf('store-agreements')).toBe(1);
  expect(plans.length).toBe(new Set(plans).size);

  const status = (await statusOf(harness));
  const posture = new Map(status.proofs.map(row => [row.plan, row]));
  for (const plan of ['startup', 'journal-restore', 'store-agreements', 'telegram-identity', 'reply-delivered']) expect(posture.get(plan).posture, plan).toBe('healthy');
  expect(status.storeAgreements.every(row => row.lastCheckedAt !== null)).toBe(true);
  expect(posture.get('reply-review-reached').last.observed).toMatchObject({ sentAnswers: 1 });
  expect(posture.get('step-check-reached')).toMatchObject({ required: false, posture: 'inactive' });
  expect(status.protection.inventoryGaps).toEqual([]);
  expect(status.protection.dark).toEqual(['preview.attribution-check']);
  expect(status.protection.retired).toEqual(['preview.step-check']);
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
  expect((await statusOf(harness)).proofLog.unreadable).toBe(1);
}, 60000);

it('P9-PREVIEW-status-answered records a live proof only for the capability’s own outcome, never an unrelated turn or a disabled capability', async () => {
  const { harness, message, record } = setup();
  harness.setUpdates([message(1, 'What is the marker? Juniper.'), message(2, 'status')]);
  expect((await harness.runLive(12)).status).toBe(0);
  // The status pull in this launch is answered and the status-answered probe proves Telegram accepted it.
  expect(readProofs(join(harness.liveRoot, 'proofs.jsonl')).proofs.find(row => row.plan === 'status-answered')).toMatchObject({ disposition: 'passed' });
  // Astra's counterexamples: each of these was accepted before.
  expect((await record('preview.reminders', 1)).status).toBe(1);
  expect((await record('preview.channel-memory', 1, '--desk-observation', 'arrived')).stderr).toMatch(/had preview\.channel-memory off/u);
  expect((await record('preview.status-pull', 1)).status).toBe(1);
  expect((await record('preview.reply', 2)).status).toBe(1);
  expect((await record('preview.memory', 1)).stderr).toMatch(/desk-recorded semantic observation/u);
  const reply = await record('preview.reply', 1), status = await record('preview.status-pull', 2);
  expect(reply.status, reply.stderr).toBe(0);
  expect(status.status, status.stderr).toBe(0);
  const startup = readProofs(join(harness.liveRoot, 'proofs.jsonl')).proofs.find(row => row.plan === 'startup');
  expect(JSON.parse(reply.stdout)).toMatchObject({ capability: 'preview.reply', update: 1, generation: startup.generation,
    version: startup.observed['version:preview.reply'], fact: 'outcome-observed' });
  const rows = new Map((await statusOf(harness)).capabilities.map(row => [row.id, row]));
  expect(rows.get('preview.reply').liveProof).toMatchObject({ state: 'recorded', update: 1 });
  expect(rows.get('preview.status-pull').liveProof).toMatchObject({ state: 'recorded', update: 2 });
}, 60000);

it('answers the operator status pull with the proof posture', async () => {
  const { harness, message } = setup();
  harness.setUpdates([message(1, 'status')]);
  const launched = (await harness.runLive(3));
  expect(launched.status, launched.stderr).toBe(0);
  const sent = harness.calls().filter(call => call.kind === 'send').map(call => call.text);
  expect(sent).toHaveLength(1);
  expect(sent[0]).toMatch(/Proofs: \d+\/\d+ healthy/u);
  expect(sent[0]).toMatch(/Capabilities: \d+ confirmed, \d+ unconfirmed, 1 dark \(preview\.attribution-check\), 1 retired \(preview\.step-check\)/u);
  expect(sent[0]).not.toMatch(/graduation overdue/u);
  // Rules 72/73: the one dark capability is named with its dated graduation, never counted as protection.
  expect(sent[0]).toMatch(/Graduation: preview\.attribution-check — test-agent missing, development-agent missing, fleet missing; deadline 2026-11-21 \(recorded 2026-11-08\)/u);
}, 60000);

it.each([false, true])('refuses the retired step check plainly before effects, scrubs held values (%s); off still runs', async held => {
  const { harness, message } = setup();
  harness.setUpdates([message(1, 'hello')]);
  const refused = await harness.runLive(2, ['--step-check', 'true'],
    held ? { INSTAR_SECRET_ASTRA_FIXTURE: '2026-10-20' } : {});
  expect(refused.status).not.toBe(0);
  if (held) {
    expect(refused.stderr).not.toContain('2026-10-20');
    expect(refused.stderr).toContain('preview: the step check is retired (');
    expect(refused.stderr).toContain('launch without --step-check true');
  } else expect(refused.stderr).toContain('preview: the step check is retired (2026-10-20, no live evidence); launch without --step-check true');
  // Not one Telegram call, not even the identity check: the refusal comes before any polling or sending.
  expect(existsSync(join(harness.directory, 'telegram.jsonl'))).toBe(false);
  const off = await harness.runLive(2, ['--step-check', 'false']);
  expect(off.status, off.stderr).toBe(0);
}, 120000);

it('an unwritable proof log is reported and retried; intake and replies continue (Rules 14, 95)', async () => {
  const { harness, message } = setup();
  harness.setUpdates([]);
  expect((await harness.runLive(2)).status).toBe(0);
  const path = join(harness.liveRoot, 'proofs.jsonl');
  rmSync(path); mkdirSync(path);
  harness.setUpdates([message(1, 'Can you reply?')]);
  const before = harness.calls().length;
  const launched = (await harness.runLive(3));
  expect(launched.status, launched.stderr).toBe(0);
  expect(launched.stderr).toMatch(/proof log unavailable/u);
  expect(harness.calls().slice(before).filter(call => call.kind === 'send')).toHaveLength(1);
  const status = (await statusOf(harness));
  expect(status.proofLog.available).toBe(false);
  expect(status.proofs.every(row => row.posture !== 'healthy')).toBe(true);
  // Restoring the store lets proofs record again; nothing from the failed launch was counted.
  rmSync(path, { recursive: true });
  expect((await harness.runLive(2)).status).toBe(0);
  expect(readProofs(path).proofs[0].plan).toBe('startup');
}, 90000);

it('records a stop live proof only after an observed latch with nothing sent past it', async () => {
  const { harness } = setup();
  harness.setUpdates([]);
  expect((await harness.runLive(2)).status).toBe(0);
  const env = { ...process.env, INSTAR_SECRET_PREVIEW_STORAGE_KEY: key };
  const run = (...rest) => command([...args, ...rest, '--root', harness.liveRoot], env);
  const cursor = String((await statusOf(harness)).cursor);
  expect((await run('record-live-proof', '--capability', 'preview.stop', '--update', cursor)).status).toBe(1);
  expect((await run('stop')).status).toBe(0);
  expect((await run('record-live-proof', '--capability', 'preview.stop', '--update', String(Number(cursor) + 1))).status).toBe(1);
  const recorded = await run('record-live-proof', '--capability', 'preview.stop', '--update', cursor);
  expect(recorded.status, recorded.stderr).toBe(0);
  expect(JSON.parse(recorded.stdout)).toMatchObject({ fact: 'outcome-observed', messageId: null, capability: 'preview.stop' });
  expect((await statusOf(harness)).capabilities.find(row => row.id === 'preview.stop').outcomes[0]).toMatchObject({ posture: 'unavailable', confirmed: true });
}, 60000);

it("records a requested action's live proof by the operator's request message, bound to the sent due turn that answered it", async () => {
  const { mkdtempSync, realpathSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const { createJournalWorker, openPreviewJournal } = await import('./journal-test-worker.js');
  const { appendProof } = await import('./proof-log.js');
  const { appendRun } = await import('./self-state.js');
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'preview-requested-action-live-proof-')));
  try {
    const start = Date.UTC(2026, 8, 26, 17), request = 'remind me today at 6 pm to call Priya';
    let now = start;
    const journal = openPreviewJournal(join(root, 'journal.encrypted'), Buffer.from(key, 'hex'), { kind: 'genesis', bot: '12345678', chat: '7654321',
      operator: '7654321', grant: 'grant:requested-action', configurationDigest: 'sha256:requested-action', expires: Date.UTC(2026, 9, 10), maxCalls: 30,
      maxReplies: 30, maxTurns: 30, maxBytes: 12000, cursor: 0 });
    let sends = 0;
    const worker = createJournalWorker(journal, { now: () => now, stopped: () => false, timeZone: 'America/Los_Angeles', checkOutbound: () => {},
      model: async input => JSON.stringify(input.id.startsWith('requested-action:') ? { reply: 'Time to call Priya.', memory: [], dated: [] }
        : { reply: 'Okay.', memory: [], dated: [{ quote: request, when: 'today at 6 pm', remind: true }] }),
      send: async () => ++sends });
    worker.intake([{ update_id: 1, message: { chat: { id: 7654321, type: 'private' }, from: { id: 7654321 }, text: request, date: start / 1000 } }]);
    await worker.drain();
    now = Date.UTC(2026, 8, 27, 1); await worker.sendRequested();
    const due = journal.view.order.find(turn => turn.requestedAction);
    expect(due).toMatchObject({ update: 1.0009765625, sent: 2 });
    journal.close();
    // The launch history that executed it: one run and its startup record carrying the capability versions.
    appendRun(join(root, 'runs.jsonl'), { v: 1, launch: start - 10, pid: 1 });
    appendProof(join(root, 'proofs.jsonl'), { v: 1, plan: 'startup', planVersion: 'p', generation: 'g1', startedAt: start - 20, completedAt: start - 20,
      disposition: 'passed', observed: { stepCheck: false, agentState: false, 'version:preview.reminders': 'v1' }, detail: '', observedAt: null, capture: null });
    const env = { ...process.env, INSTAR_SECRET_PREVIEW_STORAGE_KEY: key };
    const record = update => command([...args, 'record-live-proof', '--root', root, '--capability', 'preview.reminders',
      '--update', String(update)], env);
    expect((await record(due.update)).status).toBe(1); // the due turn is not an operator request message
    expect((await record(1.1)).status).toBe(1); // off the journal's update grid
    const recorded = await record(1);
    expect(recorded.status, recorded.stderr).toBe(0);
    expect(JSON.parse(recorded.stdout)).toMatchObject({ capability: 'preview.reminders', update: 1, messageId: 2, version: 'v1' });
    const log = readProofs(join(root, 'proofs.jsonl'));
    expect(log).toMatchObject({ unreadable: 0, refused: [] });
    expect(log.liveProofs).toEqual([expect.objectContaining({ update: 1, capability: 'preview.reminders' })]);
  } finally { rmSync(root, { recursive: true, force: true }); }
}, 60000);

// This is host-state evidence through the real runner, not a package-install proof.
it('P9-PREVIEW-update-bound records both a holding bound and refused backoff through the launcher', async () => {
  await initializeUpdateRuntime();
  for (const holding of [true, false]) {
    const { harness } = setup();
    harness.setUpdates([]);
    mkdirSync(harness.liveRoot, { recursive: true });
    writeUpdateRuntime(harness.liveRoot, 'updater', { lastCheck: '2026-09-27T12:00:00.000Z',
      nextAttemptAt: fixtureNow + (holding ? 6 * 3600000 : 0),
      failureState: { policy: { threshold: 3, windowMs: 86400000 }, lastAt: fixtureNow,
        failures: Array.from({ length: 3 }, () => ({ at: fixtureNow, kind: 'failure' })), pausedAt: fixtureNow } });
    const launched = harness.launchLive(20);
    expect(launched.status, launched.stderr).toBe(0);
    const proof = readProofs(join(harness.liveRoot, 'proofs.jsonl')).proofs.find(row => row.plan === 'update-bound');
    expect(proof).toMatchObject({ disposition: holding ? 'passed' : 'failed',
      observed: { failures: 3, resourceAllocation: 'six', pressureMatches: true } });
  }
}, 60000);
