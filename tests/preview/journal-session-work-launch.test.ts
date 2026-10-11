// Part fifteen §5 (docs/19-scheduled-work) at the real launcher: the delegated-session path is
// enabled only by a reviewed session grant — an activation record bound to the doorway's session
// policy, sealed by the operator's authority and accepting the admitted-session residual. An answer
// activation offered as a session grant refuses the launch before anything runs; a real grant is
// admitted and the launcher runs normally.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { encoded } from '../../src/assembly/boundary.js';
import { subscriptionSessionPolicy } from '../../src/assembly/production-provider.js';
import { SESSION_WORK_RESIDUAL } from '../../src/assembly/production-session-work.js';
// @ts-expect-error the cutover harness stays plain JavaScript, run by the launcher without a loader
import { cutoverHarness } from './journal-cutover-harness.mjs';
import { offlineActivationAuthority, offlineProfile, successiveWorld } from './successive-fixture.js';
import { OFFLINE_STORAGE_KEY } from './successive-fixture.js';
import { openPreviewJournal } from './journal.js';
import { appendGroupCarry } from './group-carry.js';
import { authoritySealKey, sealAuthorityRecord } from './activation-authority.js';
import { resolveGroupDisclosure } from './group-disclosure.js';
import { pathToFileURL } from 'node:url';
import { createJournalWorker, MINIMAL_WORKER_WAIT_MS } from './journal-test-worker.js';

const grantAt = (directory: string, record: Record<string, unknown>) => {
  mkdirSync(directory, { recursive: true });
  writeFileSync(join(directory, 'session-activation.json'), JSON.stringify(record));
  writeFileSync(join(directory, 'activation-authority.json'), JSON.stringify(offlineActivationAuthority(record)));
  return join(directory, 'session-activation.json');
};
const lastRun = (root: string) => existsSync(join(root, 'runs.jsonl'))
  ? readFileSync(join(root, 'runs.jsonl'), 'utf8').split('\n').filter(line => line.trim())
    .map(line => JSON.parse(line) as Record<string, unknown>).filter(row => 'exit' in row).at(-1) ?? {}
  : {};

it('refuses an answer activation offered as a session grant, and admits a sealed session grant', async () => {
  const world = successiveWorld(), harness = cutoverHarness(world, offlineProfile);
  harness.setUpdates([]);
  const answer = world.activation();
  // The answer activation binds the conversation policy, not the session policy: refused before launch.
  const refused = await harness.runLive(1, ['--session-work-activation', grantAt(join(world.directory, 'wrong-grant'), answer)]);
  expect(refused.status).not.toBe(0);
  expect(lastRun(harness.liveRoot)).toMatchObject({ reason: 'refused before launch' });
  expect(String(lastRun(harness.liveRoot).refused)).toMatch(/policy differs/u);
  // A session grant that does not accept the admitted-session residual is refused too.
  const policyDigest = encoded(subscriptionSessionPolicy(world.model)).hash;
  const unaccepted = await harness.runLive(1, ['--session-work-activation',
    grantAt(join(world.directory, 'no-residual'), { ...answer, invocationPolicyDigest: policyDigest })]);
  expect(unaccepted.status).not.toBe(0);
  expect(String(lastRun(harness.liveRoot).refused)).toMatch(/admitted-session residual/u);
  // The reviewed grant: admitted, and the launch runs.
  const admitted = await harness.runLive(1, ['--session-work-activation', grantAt(join(world.directory, 'grant'),
    { ...answer, invocationPolicyDigest: policyDigest, acceptedResiduals: [...answer.acceptedResiduals, SESSION_WORK_RESIDUAL] })]);
  expect(admitted.status, `${admitted.stderr}\n${readFileSync(join(harness.liveRoot, 'runs.jsonl'), 'utf8')}`).toBe(0);
}, 120_000);

it.each([false, true])('drains a queued group turn despite the poll/audience interleaving, session work=%s', async enabled => {
  const world = successiveWorld(), harness = cutoverHarness(world, offlineProfile);
  const answer = world.activation(), at = 1790000000000;
  const scope = { sourceRoot: join(world.directory, 'carry-source'), destinationRoot: harness.liveRoot,
    chat: '-1001234', operator: world.configuration.operatorSenderId, bot: world.configuration.botId };
  const session = { ...answer, invocationPolicyDigest: encoded(subscriptionSessionPolicy(world.model)).hash,
    acceptedResiduals: [...answer.acceptedResiduals, SESSION_WORK_RESIDUAL] };
  const authority = sealAuthorityRecord({ ...offlineActivationAuthority(answer),
    grants: [...offlineActivationAuthority(answer).grants, ...offlineActivationAuthority(session).grants],
    groupDisclosureGrants: [{ id: 'TEST-carry', grantor: scope.operator, grantee: 'echo-desk',
      words: 'offline approval stand-in', source: { kind: 'telegram-message', topicId: 1, messageId: 1 },
      issuedAt: at, action: 'carry-private-journal', scope, audience: 'operator-and-agent-bot-only',
      surface: 'telegram-forum', custodian: scope.operator, recovery: 'stop-use-on-revocation-or-audience-change' }] },
  authoritySealKey(OFFLINE_STORAGE_KEY));
  const recordsRoot = join(world.directory, 'operator-records');
  const records = { messages: readFileSync(join(recordsRoot, 'telegram-messages.jsonl'), 'utf8').trim().split('\n').map(line => JSON.parse(line)),
    provenance: readFileSync(join(recordsRoot, 'asp-classifications.jsonl'), 'utf8').trim().split('\n').map(line => JSON.parse(line)),
    bindings: JSON.parse(readFileSync(join(recordsRoot, 'state/topic-operators.json'), 'utf8')) };
  const permission = resolveGroupDisclosure(scope, authority, at, records, authoritySealKey(OFFLINE_STORAGE_KEY));
  const genesis = { kind: 'genesis' as const, origin: 'test' as const, bot: scope.bot, operator: scope.operator,
    chat: scope.operator, grant: answer.trial, configurationDigest: answer.baseConfigurationDigest,
    expires: answer.expiresAt, maxCalls: 100, maxReplies: 100, maxTurns: 100, maxBytes: 65536, cursor: 0 };
  const source = openPreviewJournal(join(scope.sourceRoot, 'journal.encrypted'), OFFLINE_STORAGE_KEY, genesis);
  const destination = openPreviewJournal(join(harness.liveRoot, 'journal.encrypted'), OFFLINE_STORAGE_KEY,
    { ...genesis, chat: scope.chat, forum: true });
  appendGroupCarry(destination, source, scope, permission, true, at, () => false);
  source.close(); destination.close();
  const activation = grantAt(join(world.directory, 'session-grant'), session);
  const authorityPath = join(world.directory, 'both-authority.json');
  writeFileSync(authorityPath, JSON.stringify(authority));
  const membership = join(world.directory, 'membership.mjs'), loader = join(world.directory, 'membership-loader.mjs');
  writeFileSync(membership, `import { writeFileSync, rmSync } from 'node:fs';
  export { requireGroupDisclosureFor } from ${JSON.stringify(pathToFileURL(join(process.cwd(), 'tests/preview/group-membership-io.mjs')).href)};
  let count = 0;
  const marker = ${JSON.stringify(join(world.directory, 'audience-busy'))};
  export const groupMembershipReader = () => async (method, body) => {
    if (method === 'getChat') writeFileSync(marker, 'busy');
    await new Promise(resolve => setTimeout(resolve, 5));
    if (method === 'getChatMemberCount' && ++count % 2 === 0) rmSync(marker, {force:true});
    const scope = ${JSON.stringify(scope)};
    return { ok: true, result: method === 'getChat' ? { id: Number(scope.chat), type: 'supergroup', is_forum: true }
      : method === 'getMe' ? { id: Number(scope.bot), is_bot: true }
      : method === 'getChatMemberCount' ? 2 : { status: 'member', user: { id: Number(body.user_id), is_bot: body.user_id === scope.bot } } };
  };`);
  writeFileSync(loader, `export async function resolve(s,c,n) {
    if (c.parentURL?.endsWith('/journal-agent.mjs') && s.endsWith('/group-membership-io.mjs'))
      return {url:${JSON.stringify(pathToFileURL(membership).href)},shortCircuit:true};
    return n(s,c);
  }`);
  harness.setUpdates([{ update_id: 969390337, message: { message_id: 10, message_thread_id: 3,
    chat: { id: Number(scope.chat), type: 'supergroup', is_forum: true },
    from: { id: Number(scope.operator) }, text: 'What is the marker?' } }]);
  world.configuration.chatId = scope.chat;
  const run = await harness.runLive(10, [...(enabled ? ['--session-work-activation', activation] : []), '--authority-record', authorityPath,
    '--forum', 'true'], { NODE_OPTIONS: `--loader ${loader}`, INSTAR_PREVIEW_TEST_TELEGRAM_ENDPOINT: 'http://127.0.0.1:1',
      INSTAR_PREVIEW_CUTOVER_POLL_DELAY_MS: '1', INSTAR_PREVIEW_CUTOVER_UPDATES_AFTER_POLL: '2',
      INSTAR_PREVIEW_CUTOVER_DRAIN_INTERLEAVE: '1' });
  expect(run.status, `${run.stderr} ${JSON.stringify(lastRun(harness.liveRoot))}`).toBe(0);
  expect(harness.calls().filter((row: { kind: string }) => row.kind === 'send')).toHaveLength(1);
  expect(harness.calls().find((row: { kind: string }) => row.kind === 'send')).toMatchObject({ thread: 3 });
  const replay = openPreviewJournal(join(harness.liveRoot, 'journal.encrypted'), OFFLINE_STORAGE_KEY, undefined, undefined, true);
  expect(replay.view.order[0]?.reserved).toBe(true);
  expect(replay.view.order[0]?.sent).toBeDefined();
  replay.close();
}, 120_000);

it.each([false, true])('answers an operator turn with session work enabled=%s', async enabled => {
  const world = successiveWorld(), harness = cutoverHarness(world, offlineProfile);
  harness.setUpdates([{ update_id: 969390337, message: { message_id: 10,
    chat: { id: Number(world.configuration.chatId), type: 'private' },
    from: { id: Number(world.configuration.operatorSenderId) }, text: 'What is the marker?' } }]);
  const answer = world.activation();
  const activation = grantAt(join(world.directory, 'session-grant'), { ...answer,
    invocationPolicyDigest: encoded(subscriptionSessionPolicy(world.model)).hash,
    acceptedResiduals: [...answer.acceptedResiduals, SESSION_WORK_RESIDUAL] });
  const run = await harness.runLive(3, enabled ? ['--session-work-activation', activation] : []);
  expect(run.status, `${run.stderr} ${JSON.stringify(lastRun(harness.liveRoot))}`).toBe(0);
  expect(harness.calls().filter((row: { kind: string }) => row.kind === 'send')).toHaveLength(1);
}, 120_000);

it('the activated runner delegates a due obligation and answers ordinary intake on the model route', async () => {
  const world = successiveWorld(), harness = cutoverHarness(world, offlineProfile), answer = world.activation();
  const activation = grantAt(join(world.directory, 'session-grant'), { ...answer,
    invocationPolicyDigest: encoded(subscriptionSessionPolicy(world.model)).hash,
    acceptedResiduals: [...answer.acceptedResiduals, SESSION_WORK_RESIDUAL] });
  const root = openPreviewJournal(join(harness.liveRoot, 'journal.encrypted'), OFFLINE_STORAGE_KEY, {
    kind: 'genesis', origin: 'test', bot: world.configuration.botId, chat: world.configuration.chatId,
    operator: world.configuration.operatorSenderId, grant: answer.trial, configurationDigest: answer.baseConfigurationDigest,
    expires: answer.expiresAt, maxCalls: 100, maxReplies: 100, maxTurns: 100, maxBytes: 65536, cursor: 0 });
  const hold = 'I will compare the two plans and bring back the result.';
  const seed = createJournalWorker(root, { origin: 'test', now: () => 1790000000000, stopped: () => false,
    model: async () => JSON.stringify({ reply: hold, memory: [], openLoops: [{ kind: 'deferral', quote: hold, waitsOn: 'nothing' }] }),
    send: async () => 1, checkOutbound: () => {} });
  seed.intake([{ update_id: 1, message: { chat: { id: Number(world.configuration.chatId), type: 'private' },
    from: { id: Number(world.configuration.operatorSenderId) }, text: 'Compare the two plans later.' } }]);
  await seed.drain();
  expect(root.view.commitments, JSON.stringify(root.view.order)).toHaveLength(1); root.close();
  const session = join(world.directory, 'session.mjs');
  const log = join(world.directory, 'delegated.jsonl');
  writeFileSync(session, `import { appendFileSync } from 'node:fs';
    export { SESSION_WORK_LIMITS } from ${JSON.stringify(pathToFileURL(join(process.cwd(), 'src/assembly/production-session-work.ts')).href)};
    export const createSessionWorkPort = () => ({ kind: 'Success', value: { available: () => true, stop: () => {},
      run: async input => { appendFileSync(${JSON.stringify(log)}, JSON.stringify(input) + '\\n');
        return { state: 'complete', text: JSON.stringify({ outcome: 'report', report: 'The comparison is ready.' }) }; } } });`);
  harness.setUpdates([{ update_id: 2, message: { chat: { id: Number(world.configuration.chatId), type: 'private' },
    from: { id: Number(world.configuration.operatorSenderId) }, text: 'What is the marker?' } }]);
  const run = await harness.runLive(5, ['--session-work-activation', activation], {
    INSTAR_PREVIEW_CUTOVER_SESSION_PORT: pathToFileURL(session).href, INSTAR_PREVIEW_TEST_TELEGRAM_ENDPOINT: 'http://127.0.0.1:1' });
  expect(run.status, `${run.stderr} ${JSON.stringify(lastRun(harness.liveRoot))}`).toBe(0);
  const done = openPreviewJournal(join(harness.liveRoot, 'journal.encrypted'), OFFLINE_STORAGE_KEY, undefined, undefined, true);
  expect(existsSync(log), JSON.stringify({work:done.view.obligationWork, commitments:done.view.commitments, calls:done.view.calls, stderr:run.stderr})).toBe(true);
  done.close();
  const delegated = readFileSync(log, 'utf8').trim().split('\n').map(line => JSON.parse(line));
  expect(delegated).toHaveLength(1);
  expect(delegated[0].operation).toMatch(/^obligation-/u);
  expect(delegated[0].context).toContain(hold);
  expect(harness.calls().filter((row: { kind: string }) => row.kind === 'send')).toHaveLength(1);
}, 120_000);

it('the existing minimal path sends one holding reply in the topic during a long turn, then the result', async () => {
  const world = successiveWorld(), answer = world.activation();
  const journal = openPreviewJournal(join(world.directory, 'holding.encrypted'), OFFLINE_STORAGE_KEY, {
    kind: 'genesis', bot: world.configuration.botId, chat: '-1001234', forum: true,
    operator: world.configuration.operatorSenderId, grant: answer.trial, configurationDigest: answer.baseConfigurationDigest,
    expires: answer.expiresAt, maxCalls: 100, maxReplies: 100, maxTurns: 100, maxBytes: 65536, cursor: 0 });
  let now = 1790000000000, finish!: (text: string) => void;
  const sends: { text: string; thread?: number }[] = [];
  const worker = createJournalWorker(journal, { now: () => now, stopped: () => false,
    model: () => new Promise<string>(resolve => { finish = resolve; }),
    send: async input => { sends.push(input); return sends.length; }, checkOutbound: () => {} });
  worker.intake([{ update_id: 1, message: { chat: { id: -1001234, type: 'supergroup', is_forum: true },
    message_thread_id: 3, from: { id: Number(world.configuration.operatorSenderId) }, text: 'Compare the plans.' } }]);
  const draining = worker.drain();
  await new Promise(resolve => setImmediate(resolve));
  now += MINIMAL_WORKER_WAIT_MS - 1; await worker.minimal(); expect(sends).toHaveLength(0);
  now++; await worker.minimal(); await worker.minimal();
  expect(sends).toHaveLength(1);
  expect(sends[0]).toMatchObject({ thread: 3 });
  expect(sends[0]!.text).toContain('saved it');
  finish('The comparison is ready.'); await draining;
  expect(sends).toHaveLength(2); expect(sends[1]).toMatchObject({ thread: 3 });
  journal.close();
});
