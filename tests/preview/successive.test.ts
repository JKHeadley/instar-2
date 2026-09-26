// @ts-nocheck -- offline evidence for the successive-turn preview adapter. Physical Telegram
// and the subscription CLI are file-backed substitutes; every owner, the accepted driver,
// recall and the context packet are the real ones. No live network or model is contacted.
import { afterEach, expect, it } from 'vitest';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { SUBSCRIPTION_CONVERSATION_SYSTEM_PROMPT, SUBSCRIPTION_PREVIEW_EXPIRY, subscriptionConversationPolicy,
  subscriptionInvocationPolicy, subscriptionPolicyFor, validateSubscriptionActivation } from '../../src/assembly/production-provider.js';
import { effectFixture } from '../effects/fixture.js';
import { providerFixture } from '../model-provider/fixture.js';
import { createEffectSpine, installOperationDefinition } from '../../src/effects/index.js';
import { json, privateKey, refused } from '../facts/fixtures.js';
import { encoded } from './stage2-provider.js';
import { HOST_OUTAGE_TEXT, initializeSuccessiveRoot, openPreviewState, validateSuccessiveRoot } from './state.js';
import { SOURCE_PINS, carryPredecessorCursor, measureSuccessive, retainIncompleteBoot, sourcePacket } from './successive.js';
import { OPERATOR, offlineAuthorization, offlineProfile, successiveWorld } from './successive-fixture.js';

afterEach(async () => { await new Promise<void>(done => setImmediate(done)); });

const packetOf = (model: { stdin: string }) => {
  const envelope = JSON.parse(model.stdin);
  return { envelope, context: JSON.parse(envelope.messages[1].content) };
};

/** One real child process per phase: the restart evidence is a fresh process that
 * reconstructs the installed owners from the retained root, never shared memory. */
function runChild(world, cycles: number, limits = {}) {
  const worker = join(world.directory, 'worker.mjs');
  writeFileSync(worker, `import { successiveWorld } from ${JSON.stringify(join(process.cwd(), 'tests/preview/successive-fixture.ts'))};
const w = successiveWorld(process.argv[2]);
// As the launcher does: a stopped or expired trial never composes, polls or calls.
if (w.state().read().stop === null) {
  const c = w.compose({ limits: JSON.parse(process.argv[4]) });
  try { await c.run({ maxCycles: Number(process.argv[3]), baseBackoffMs: 1, maxBackoffMs: 2, sleep: w.sleep }); }
  finally { c.close(); }
}
`);
  return new Promise<number>((resolve, reject) => {
    const env = { ...process.env }; delete env.INSTAR_TELEGRAM_LIVE_TEST;
    const child = spawn(process.execPath, ['--no-warnings', '--loader', './scripts/slice-ts-loader.mjs', worker,
      world.directory, String(cycles), JSON.stringify(limits)], { cwd: process.cwd(), env, stdio: ['ignore', 'pipe', 'pipe'] });
    let stderr = ''; child.stderr.on('data', data => { stderr += data; });
    const timer = setTimeout(() => { child.kill('SIGKILL'); reject(Error(`successive worker timeout; retained at ${world.directory}`)); }, 1_500_000);
    child.on('error', reject);
    child.on('exit', code => { clearTimeout(timer); if (code === 0) resolve(0); else reject(Error(`successive worker ${code}: ${stderr}`)); });
  });
}

it('answers two naturally polled turns with prior history and sources at provider IO, then after a restart answers a distinct turn with no resend and ends admission at the attempt cap', async () => {
  const world = successiveWorld();
  const limits = { providerAttempts: 3, replies: 3 };
  world.say('What is Instar for?');
  world.answer('Instar exists to make coherence something an AI cannot lose.');
  world.say('From now on keep answers under twenty words. What did I ask first?');
  world.answer('You first asked what Instar is for.');
  expect(await runChild(world, 8, limits)).toBe(0);
  expect(world.models()).toHaveLength(2);
  expect(world.sends()).toHaveLength(2);
  const first = packetOf(world.models()[0]), second = packetOf(world.models()[1]);
  // Both calls use the separately bound conversation framing and its exact system prompt.
  for (const model of world.models()) {
    expect(model.args).toEqual(subscriptionConversationPolicy('claude-offline-exact-1').args);
    expect(measureSuccessive(model.stdin, 32768).prompt).toBeLessThanOrEqual(32768);
  }
  expect(first.envelope.messages[0].content).toBe('What is Instar for?');
  expect(first.context.packet.history).toEqual([]);
  // The second turn's actual provider bytes carry the first turn and the pinned sources.
  expect(second.envelope.messages[0].content).toContain('What did I ask first?');
  expect(second.context.packet.history).toEqual([{ update: 100, user: 'What is Instar for?',
    answer: 'Instar exists to make coherence something an AI cannot lose.',
    outcome: 'answer accepted; Telegram accepted the reply' }]);
  const sources = second.context.packet.sources;
  expect(sources.map(source => source.id)).toEqual(['purpose:name', 'purpose:purpose', 'purpose:coherency', 'capability-note']);
  expect(sources[1].text).toContain('Make coherence something an AI cannot lose.');
  expect(sources[1].provenance).toMatchObject({ path: 'docs/00-the-purpose.md', excerptSha256: SOURCE_PINS['purpose:purpose'] });
  expect(second.context.packet.now.epochMs).toBeGreaterThan(0);
  expect(second.context.packet.audience.participants).toEqual([`telegram:v1:user:${OPERATOR}`]);
  expect(world.sends().map(send => send.body.text)).toEqual([
    'PREVIEW — experimental test agent; production safeguards incomplete.\nInstar exists to make coherence something an AI cannot lose.',
    'PREVIEW — experimental test agent; production safeguards incomplete.\nYou first asked what Instar is for.']);

  // Restart: a fresh process, a foreign sender's message and a distinct third turn.
  world.say('Someone else asks for the secret plan.', 999001, 999001);
  world.say('Thanks. Summarise our conversation.');
  world.answer('We discussed what Instar is for.');
  expect(await runChild(world, 8, limits)).toBe(0);
  expect(world.models()).toHaveLength(3);
  expect(world.sends()).toHaveLength(3);
  const third = packetOf(world.models()[2]);
  expect(third.context.packet.history.map(row => row.user)).toEqual(['What is Instar for?',
    'From now on keep answers under twenty words. What did I ask first?']);
  expect(world.models()[2].stdin).not.toContain('secret plan');
  // No earlier input was re-asked and no earlier answer was re-sent.
  expect(new Set(world.models().map(model => packetOf(model).envelope.messages[0].content)).size).toBe(3);
  expect(new Set(world.sends().map(send => send.body.text)).size).toBe(3);

  // The durable attempt cap (3 here, 16 live) ends admission visibly: no further poll or call.
  const pollsBefore = world.telegram().filter(row => row.method === 'getUpdates').length;
  world.say('One more question?');
  expect(await runChild(world, 4, limits)).toBe(0);
  expect(world.models()).toHaveLength(3);
  expect(world.sends()).toHaveLength(3);
  expect(world.telegram().filter(row => row.method === 'getUpdates').length).toBe(pollsBefore);
  expect(world.state().read().stop?.reason).toBe('capacity');
  expect(JSON.parse(readFileSync(join(world.root, 'successive-state.json'), 'utf8')).hold)
    .toMatchObject({ code: 'ATTEMPTS_EXHAUSTED', lengths: { attempts: 3 } });
}, 3_600_000);

it('boots a recorded root after the native host file artifact changes', async () => {
  const world = successiveWorld();
  const hostFile = readFileSync(join(process.cwd(), 'scripts/production-boot-io.mjs'));
  const digest = (bytes: Buffer) => `sha256:${createHash('sha256').update(bytes).digest('hex')}`;
  const oldArtifact = digest(hostFile);
  const newArtifact = digest(Buffer.concat([hostFile, Buffer.from('\n// deliberate rebuild\n')]));
  expect(newArtifact).not.toBe(oldArtifact);
  const first = world.compose({ hostFileArtifact: oldArtifact });
  try {
    expect(first.rows().find(row => row.kind === 'assembly-AdapterConformance').body.record.artifact).toBe(oldArtifact);
    await first.run({ maxCycles: 1, baseBackoffMs: 1, maxBackoffMs: 2, sleep: world.sleep });
  } finally { first.close(); }
  expect(existsSync(join(world.root, 'successive-checkpoint.json'))).toBe(true);

  const second = world.compose({ hostFileArtifact: newArtifact });
  try {
    expect(second.built.owners.grounding.harness.describe().artifact).toBe(oldArtifact);
    expect(second.rows().filter(row => row.kind === 'assembly-AdapterConformance')).toHaveLength(1);
  } finally { second.close(); }
  expect(world.models()).toHaveLength(0);
  expect(world.sends()).toHaveLength(0);
}, 900_000);

it('refuses the provider call when the stop latch is set after preparation, keeping the admitted turn', async () => {
  const world = successiveWorld();
  world.say('Please answer this.');
  const c = world.compose({ hooks: { beforeProvider: () => world.state().latchStop('operator') } });
  let facts;
  try { await c.run({ maxCycles: 3, baseBackoffMs: 1, maxBackoffMs: 2, sleep: world.sleep }); facts = c.rows(); }
  finally { c.close(); }
  expect(world.models()).toHaveLength(0);
  expect(world.sends()).toHaveLength(0);
  expect(world.state().read().stop?.reason).toBe('operator');
  // Seven and Eight prepared the request before the latch; no dispatch claim followed it.
  expect(facts.filter(row => row.kind === 'effect-provider-ProviderEffectRequest')).toHaveLength(1);
  expect(facts.filter(row => row.kind === 'intake-admitted')).toHaveLength(1);
  expect(facts.filter(row => row.kind === 'transport-AdmissionReservation'
    && ['dispatch-claimed', 'consumed'].includes(row.body.record?.state)
    && facts.some(request => request.kind === 'effect-provider-ProviderEffectRequest'
      && request.body.record?.id === row.body.record?.request))).toHaveLength(0);
}, 600_000);

it('holds an over-envelope turn before any provider call and never trims its retained context', async () => {
  const world = successiveWorld();
  const long = `Long question ${'x'.repeat(7000)}`;
  world.say(long);
  const c = world.compose({ limits: { maxPromptBytes: 8192 } });
  let packet;
  try {
    await c.run({ maxCycles: 3, baseBackoffMs: 1, maxBackoffMs: 2, sleep: world.sleep });
    const turns = JSON.parse(readFileSync(join(world.root, 'successive-state.json'), 'utf8')).turns;
    packet = JSON.parse(c.capture(Object.values(turns)[0].packet.reference));
  } finally { c.close(); }
  expect(world.models()).toHaveLength(0);
  expect(world.sends()).toHaveLength(0);
  const sidecar = JSON.parse(readFileSync(join(world.root, 'successive-state.json'), 'utf8'));
  expect(sidecar.hold).toMatchObject({ code: 'INPUT_BOUND', lengths: { maximum: 8192 } });
  expect(sidecar.hold.lengths.prompt).toBeGreaterThan(8192);
  expect(world.state().read().stop?.reason).toBe('capacity');
  expect(packet.question).toBe(long);
}, 600_000);

it('redacts an inbound credential before provider IO and never sends a credential-bearing answer', async () => {
  const world = successiveWorld();
  const token = '8820318295:AAEexampleSyntheticTokenValue_01234'; expect(token.split(':')[1]).toHaveLength(35);
  world.say(`My bot token is ${token}, keep it safe. What is 2+2?`);
  world.answer('Four. Your key sk-ant-api03-SYNTHETICSYNTHETICSYNTHETICSYNTHETIC is safe.');
  const c = world.compose({});
  try { await c.run({ maxCycles: 4, baseBackoffMs: 1, maxBackoffMs: 2, sleep: world.sleep }); } finally { c.close(); }
  expect(world.models()).toHaveLength(1);
  expect(world.models()[0].stdin).not.toContain(token);
  expect(world.models()[0].stdin).toContain('[redacted credential]');
  // The credential-bearing answer is refused at the outbound boundary: nothing is sent.
  expect(world.sends()).toHaveLength(0);
}, 900_000);

it('binds the conversation framing separately and keeps the historical v2 policy byte-identical', () => {
  const model = 'claude-offline-exact-1';
  const v2 = subscriptionPolicyFor(model), conversation = subscriptionPolicyFor(model, 'preview-conversation-v1');
  expect(encoded(v2.policy).hash).toBe(encoded(subscriptionInvocationPolicy(model)).hash);
  expect(conversation.policy.framing).toBe('preview-conversation-v1');
  expect(conversation.policy.maxPromptBytes).toBe(32768);
  expect(conversation.system).toBe(SUBSCRIPTION_CONVERSATION_SYSTEM_PROMPT);
  expect(encoded(conversation.policy).hash).not.toBe(encoded(v2.policy).hash);
  const activation = (policy) => ({ type: 'SubscriptionActivationRecord', schemaVersion: 1,
    reference: offlineProfile.activationReference, waiver: 'w', p11: 'p', reviewedHead: 'h', trial: 't',
    baseConfigurationDigest: 'd', profileDigest: encoded(offlineProfile).hash, executable: offlineProfile.executable,
    artifact: offlineProfile.artifact, version: '2.1.280', model, invocationPolicyDigest: encoded(policy).hash,
    expectedAccount: offlineProfile.expectedAccount, observedAccount: offlineProfile.expectedAccount, authSource: 'claude.ai',
    operatorAssertion: 'a', assertedAt: 1, observer: 'o', observedAt: 2, method: 'm', safeCaptureReference: 's',
    extraUsage: 'operator-asserted/unobservable', extraUsageReason: 'r', subscriptionLimit: 'unobservable',
    subscriptionLimitReason: 'r', acceptedResiduals: ['UNKNOWN charge'], expiresAt: SUBSCRIPTION_PREVIEW_EXPIRY });
  expect(() => validateSubscriptionActivation(activation(conversation.policy), offlineProfile, model, 3,
    'preview-conversation-v1')).not.toThrow();
  expect(() => validateSubscriptionActivation(activation(v2.policy), offlineProfile, model, 3,
    'preview-conversation-v1')).toThrow('policy differs');
  expect(() => validateSubscriptionActivation(activation(conversation.policy), offlineProfile, model, 3)).toThrow('policy differs');
});

it('lets only a provider-call definition carry the measured 32768-byte envelope', () => {
  expect(() => effectFixture(undefined, 'executor:1', { maxBytes: 4097 })).toThrow('finite operation bounds');
  const install = (maxBytes: number, suffix: string) => {
    const f = providerFixture();
    const original = f.all().find(row => row.kind === 'effect-OperationDefinition').body.record;
    const definition = { ...original, id: `provider-definition-${suffix}`, version: `provider-definition-${suffix}`, maxBytes };
    const approval = f.authorize({ id: `provider-approval-${suffix}`, artifact: f.capture(encoded(definition).bytes), base: 'provider-base' });
    f.host.current().versions.push({ id: definition.version, subject: definition.feature, content: json(definition),
      contentHash: encoded(definition).hash, since: f.opening.id, supersedes: [original.version], approvedIn: approval,
      base: approval.base, landedIn: null });
    return installOperationDefinition(definition, f.host, createEffectSpine(f.host, { context: f.context, privateKey }, f.store));
  };
  const exact = install(32768, 'exact'); expect(exact.kind === 'Success' ? 'ok' : exact.detail).toBe('ok');
  expect(refused(install(32769, 'over'))).toContain('finite operation bounds');
});

it('pins source excerpts and refuses a changed purpose document', () => {
  const read = (path: string) => readFileSync(join(process.cwd(), path), 'utf8');
  const packet = sourcePacket(read, SOURCE_PINS, { providerAttempts: 16, expiresAt: SUBSCRIPTION_PREVIEW_EXPIRY });
  expect(packet.sources.at(-1).text).toContain('at most 16 model answers');
  expect(() => sourcePacket(path => read(path).replace('sits beneath it', 'sits above it'), SOURCE_PINS,
    { providerAttempts: 16, expiresAt: SUBSCRIPTION_PREVIEW_EXPIRY })).toThrow('source excerpt purpose:purpose changed');
});

it('initializes one authorized successor that inherits the latched trial, cursor, exclusions and obligations', () => {
  const directory = realpathSync(mkdtempSync(join(tmpdir(), 'preview-successor-')));
  const source = join(directory, 'a'), root = join(directory, 'b'), again = join(directory, 'c');
  for (const path of [source, root, again]) mkdirSync(path, { mode: 0o700 });
  const base = { machine: 'm', botId: '8820318295', botUsername: '@b', operatorSenderId: '7812716706', chatId: '7812716706',
    chatKind: 'private', forum: false, messageThreadId: null, maxPollSeconds: 1, maxBatchItems: 8, maxContextTurns: 8,
    maxContextBytes: 65536, expiresAt: SUBSCRIPTION_PREVIEW_EXPIRY, replyLimit: 6, replyWindowMs: 60000, errorLimit: 20,
    maxPendingTurns: 16, maxTrialTurns: 128 };
  const configuration = (r: string) => ({ ...base, root: r });
  const state = openPreviewState({ root: source, configuration: configuration(source), expiresAt: SUBSCRIPTION_PREVIEW_EXPIRY,
    now: () => 1790000000000, replyLimit: 6, replyWindowMs: 60000, errorLimit: 20, totalErrorLimit: 1000, maxPendingTurns: 16,
    maxTrialTurns: 128, create: true, hostNotice: { botId: base.botId, chatId: base.chatId, message: HOST_OUTAGE_TEXT } });
  state.noteError(); state.noteError();
  const init = (target: string, overrides = {}) => initializeSuccessiveRoot({ predecessorRoot: source, root: target,
    predecessorConfiguration: configuration(source), configuration: configuration(target),
    authorization: offlineAuthorization(1790000000500), quiescenceReference: 'quiesced', cutoff: 1790000000900,
    now: () => 1790000001000, ...overrides });
  expect(() => init(root)).toThrow('inherit stopped or latched');
  state.latchStop('operator');
  expect(() => init(root, { authorization: { ...offlineAuthorization(1790000000500), providerAttempts: 17 } }))
    .toThrow('authorization differs');
  const inherited = init(root);
  expect(inherited).toMatchObject({ stop: null, totalErrors: 2, consecutiveErrors: 0,
    trial: { id: state.read().trial.id, expiresAt: SUBSCRIPTION_PREVIEW_EXPIRY } });
  const record = validateSuccessiveRoot(root, inherited);
  expect(record).toMatchObject({ kind: 'successive', priorModelAttempts: 0, stop: { reason: 'operator' },
    cumulativeLimits: { dailyUsd: 5, totalUsd: 25, actualCharge: 'UNKNOWN', additionalProviderAttempts: 16, inheritedTotalErrors: 2 } });
  expect(JSON.parse(readFileSync(join(root, 'successive-state.json'), 'utf8'))).toMatchObject({ cursor: 0, hold: null,
    inheritedTotalErrors: 2, framing: 'preview-conversation-v1', activationDigest: null });
  expect(existsSync(join(root, '.preview-predecessor/preview-stop.json'))).toBe(true);
  expect(existsSync(join(source, 'preview-stop.json'))).toBe(true);
  // One use only: the exclusive marker refuses a second successor for the same trial.
  expect(() => init(again)).toThrow();
});

it('live entry shape: a successor with an inherited non-zero cursor survives a boot that failed mid-identity, then answers and restarts cleanly', async () => {
  const cursor = 969389546;
  const world = successiveWorld(undefined, { predecessorCursor: cursor });
  const successive = join(world.root, '.successive'), checkpoint = join(world.root, 'successive-checkpoint.json');
  // First start: the Telegram identity probe does not complete, as on the first live pass.
  const failing = physical => ({ invoke: (request, credential) => request.method === 'getMe'
    ? { kind: 'uncertain', limitation: 'transport', stage: 'fetch-failure' } : physical.invoke(request, credential) });
  expect(() => world.compose({ telegramIO: failing })).toThrow('Telegram transport uncertainty');
  expect(readdirSync(successive).length).toBeGreaterThan(0);
  expect(existsSync(checkpoint)).toBe(false);
  expect(world.telegram().filter(row => row.method !== 'getMe')).toHaveLength(0);

  // Restart: the incomplete store is retained aside (never deleted), boot is clean, and the
  // first physical poll is at the inherited cursor, backed by the carried durable journal.
  world.say('Hello after the restart. What is 2+2?');
  world.answer('Four.');
  const c = world.compose({});
  try { await c.run({ maxCycles: 4, baseBackoffMs: 1, maxBackoffMs: 2, sleep: world.sleep }); } finally { c.close(); }
  expect(existsSync(join(world.root, '.successive-incomplete-boot-1'))).toBe(true);
  expect(existsSync(checkpoint)).toBe(true);
  expect(world.telegram().find(row => row.method === 'getUpdates').body.offset).toBe(cursor);
  expect(world.models()).toHaveLength(1);
  expect(world.sends()).toHaveLength(1);
  expect(JSON.parse(readFileSync(join(world.root, 'successive-state.json'), 'utf8')).cursor).toBe(cursor + 1);

  // A later restart boots over the checkpointed store: nothing moved aside, nothing re-asked or resent.
  const again = world.compose({});
  try { await again.run({ maxCycles: 2, baseBackoffMs: 1, maxBackoffMs: 2, sleep: world.sleep }); } finally { again.close(); }
  expect(existsSync(join(world.root, '.successive-incomplete-boot-2'))).toBe(false);
  expect(world.models()).toHaveLength(1);
  expect(world.sends()).toHaveLength(1);
}, 1_800_000);

it('an idle driver outlives the per-turn attempt bound by far, then still answers exactly one real turn', async () => {
  // The live preview stopped every ~9 minutes: each idle cycle wrote a durable start and result
  // for both its step and its poll, so the 16-per-turn driver attempt bound (256 starts at 16
  // turns) was spent by idle polling alone. Two turns here bound starts at 32 (16 idle cycles).
  const world = successiveWorld();
  let polls = 0;
  const telegramIO = physical => ({ invoke: (request, credential) => {
    if (request.method === 'getUpdates' && ++polls === 60) {
      world.say('Are you still there after a long quiet spell?');
      world.answer('Yes, still here.');
    }
    return physical.invoke(request, credential);
  } });
  const c = world.compose({ limits: { providerAttempts: 2, replies: 2 }, telegramIO });
  let serving;
  try {
    await c.run({ maxCycles: 70, baseBackoffMs: 1, maxBackoffMs: 2, sleep: world.sleep });
    serving = c.status().serving;
  } finally { c.close(); }
  expect(polls).toBeGreaterThanOrEqual(69);
  expect(world.models()).toHaveLength(1);
  expect(world.sends()).toHaveLength(1);
  expect(world.sends()[0].body.text).toContain('Yes, still here.');
  // Clean exit closes the open idle attempt; no error was counted.
  expect(serving).toMatchObject({ turns: 1, replies: 1, totalErrors: 0, consecutiveErrors: 0, pendingAttempt: null });
}, 1_800_000);

it('retains only a store that never completed boot, and never one a live process holds', () => {
  const directory = realpathSync(mkdtempSync(join(tmpdir(), 'preview-incomplete-')));
  const store = join(directory, '.successive'), checkpoint = join(directory, 'successive-checkpoint.json');
  expect(retainIncompleteBoot(store, checkpoint)).toBe(null);
  mkdirSync(join(store, '.boot-lease'), { recursive: true });
  writeFileSync(join(store, '.boot-lease', 'owner.json'), JSON.stringify({ pid: process.pid }));
  expect(() => retainIncompleteBoot(store, checkpoint)).toThrow('still held by a live process');
  // Serialized with lease acquisition: a held guard or an owner-less lease refuses, and nothing moves.
  writeFileSync(join(store, '.boot-lease', 'owner.json'), JSON.stringify({ pid: 2 ** 22 + 12345 }));
  mkdirSync(join(store, '.boot-lease-guard'));
  expect(() => retainIncompleteBoot(store, checkpoint)).toThrow('being acquired or recovered');
  rmSync(join(store, '.boot-lease-guard'), { recursive: true });
  rmSync(join(store, '.boot-lease', 'owner.json'));
  expect(() => retainIncompleteBoot(store, checkpoint)).toThrow('unreadable lease owner');
  expect(existsSync(store)).toBe(true);
  expect(existsSync(join(store, '.boot-lease-guard'))).toBe(false);
  // A failed rename (read-only parent) releases the guard in place, so the next start is not blocked.
  writeFileSync(join(store, '.boot-lease', 'owner.json'), JSON.stringify({ pid: 2 ** 22 + 12345 }));
  chmodSync(directory, 0o500);
  try { expect(() => retainIncompleteBoot(store, checkpoint)).toThrow(/EACCES|EPERM/); } finally { chmodSync(directory, 0o700); }
  expect(existsSync(store)).toBe(true);
  expect(existsSync(join(store, '.boot-lease-guard'))).toBe(false);
  // A dead owner's incomplete store is retained under the guard, which is released afterwards.
  writeFileSync(join(store, '.boot-lease', 'owner.json'), JSON.stringify({ pid: 2 ** 22 + 12345 }));
  const retained = retainIncompleteBoot(store, checkpoint);
  expect(retained).toBe(`${store}-incomplete-boot-1`);
  expect(existsSync(store)).toBe(false);
  expect(existsSync(join(retained!, '.boot-lease-guard'))).toBe(false);
  mkdirSync(store);
  writeFileSync(join(store, 'facts.encrypted'), 'x');
  writeFileSync(checkpoint, '{}');
  expect(retainIncompleteBoot(store, checkpoint)).toBe(null);
  expect(existsSync(store)).toBe(true);
});

it('carries the predecessor cursor journal only when it reaches the inherited cursor', () => {
  const world = successiveWorld(undefined, { predecessorCursor: 500 });
  const copied = new Map();
  const port = { preserve: (reference, bytes) => { copied.set(reference, bytes); return true; } };
  const key = Buffer.from(new Uint8Array(32).fill(19)).toString('hex');
  expect(carryPredecessorCursor(world.root, 'preview-test-machine', key, port, 0)).toBe(0);
  expect(copied.size).toBe(0);
  expect(carryPredecessorCursor(world.root, 'preview-test-machine', key, port, 500)).toBe(500);
  expect([...copied.keys()].map(reference => reference.split(':').slice(0, 3).join(':')).sort())
    .toEqual(['capture:telegram:cursor', 'capture:telegram:poll-499', 'capture:telegram:update-499']);
  expect(() => carryPredecessorCursor(world.root, 'preview-test-machine', key, port, 501)).toThrow('does not reach');
  expect(() => carryPredecessorCursor(world.root, 'another-machine', key, port, 500)).toThrow();
});
