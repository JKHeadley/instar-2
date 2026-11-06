// Carryover row 40 (One Memory), the served-cycle proof: the shipped launcher's own poll loop runs the per-cycle
// relationship step (journal-agent.mjs `relationshipStep`) on real roots. A private root emits its changed people into its
// own journal only while a sealed grant names it as a carry source; a carried group root refreshes from its predecessor
// when a poll is empty, under the current verified audience; both are read back through the shipped `status` command and
// the journals themselves. Negative controls at the same boundary: no grant (dark), a new member, a re-seeded predecessor,
// a stop. Only the physical Telegram port and the model route are the cutover fixture's; every owner, the driver, the
// journal and the carry are real. No live Telegram, model, provider or root is touched.
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { expect, it } from 'vitest';
// @ts-expect-error the cutover harness stays plain JavaScript, run by the launcher without a loader
import { cutoverHarness } from './journal-cutover-harness.mjs';
import { OFFLINE_STORAGE_KEY, offlineActivationAuthority, offlineProfile, successiveWorld } from './successive-fixture.js';
import { createJournalWorker, openPreviewJournal } from './journal-test-worker.js';
import { appendGroupCarry, carryOrigin } from './group-carry.js';
import { authoritySealKey, sealAuthorityRecord } from './activation-authority.js';
import { resolveGroupDisclosure } from './group-disclosure.js';

const AT = 1790000000000, FORUM = '-1001234';
const ENDPOINT = { INSTAR_PREVIEW_TEST_TELEGRAM_ENDPOINT: 'http://127.0.0.1:1' };
const operatorRecords = (directory: string) => ({
  messages: readFileSync(join(directory, 'telegram-messages.jsonl'), 'utf8').trim().split('\n').map(line => JSON.parse(line)),
  provenance: readFileSync(join(directory, 'asp-classifications.jsonl'), 'utf8').trim().split('\n').map(line => JSON.parse(line)),
  bindings: JSON.parse(readFileSync(join(directory, 'state/topic-operators.json'), 'utf8')) });
/** An honest summarizer for the in-process summary pass: names people by quoting the operator's messages exactly. */
const summarizer = (names: readonly string[]) => (context: string) => {
  const packet = JSON.parse(context) as { history: { user: string }[] };
  const people = packet.history.flatMap(turn => names.filter(name => turn.user.includes(name)).map(name => ({ name, quote: turn.user })));
  return JSON.stringify({ summary: 'Earlier turns named some people the operator met.', people });
};

it('the shipped launcher emits a private root\'s people per served cycle only under a sealed source grant, and a carried group root refreshes when idle under the verified audience; a new member, a re-seeded predecessor, no grant and a stop each leave the journals unchanged', async () => {
  const world = successiveWorld(), harness = cutoverHarness(world, offlineProfile), answer = world.activation();
  const privateRoot = harness.liveRoot, groupRoot = join(world.directory, 'cutover-group');
  mkdirSync(privateRoot, { recursive: true }); mkdirSync(groupRoot, { recursive: true });
  const privatePath = join(privateRoot, 'journal.encrypted'), groupPath = join(groupRoot, 'journal.encrypted');
  const scope = { sourceRoot: privateRoot, destinationRoot: groupRoot, chat: FORUM,
    operator: world.configuration.operatorSenderId, bot: world.configuration.botId };
  const genesis = { kind: 'genesis' as const, origin: 'test' as const, bot: scope.bot, operator: scope.operator, chat: scope.operator,
    grant: answer.trial, configurationDigest: answer.baseConfigurationDigest, expires: answer.expiresAt,
    maxCalls: 100, maxReplies: 100, maxTurns: 100, maxBytes: 65536, cursor: 0 };
  const names = ['Sam Ruiz', 'Ana Lima', 'Zed Quill', 'Priya Nair'];
  /** The private root's real summary pass, in process: one more operator message, then a summary that names its people. */
  let nextUpdate = 1;
  const privateSays = async (text: string) => {
    const journal = openPreviewJournal(privatePath, OFFLINE_STORAGE_KEY, existsSync(privatePath) ? undefined : genesis);
    const worker = createJournalWorker(journal, { origin: 'test', now: () => AT + nextUpdate * 60_000, stopped: () => false,
      model: async input => input.id.startsWith('summary:') ? summarizer(names)(input.context) : 'Noted.',
      send: async () => 1, checkOutbound: () => {} });
    worker.intake([{ update_id: nextUpdate, message: { message_id: 500 + nextUpdate, chat: { id: Number(scope.operator), type: 'private' },
      from: { id: Number(scope.operator) }, text, date: Math.floor((AT + nextUpdate * 60_000) / 1000) } }]);
    nextUpdate++;
    await worker.drain(); await worker.summarizeIfNeeded(true);
    const people = journal.view.people.map(note => note.name), emits = journal.view.relationshipEmits.length;
    journal.close(); return { people, emits };
  };
  // The sealed authority: the activation grant plus a group disclosure grant naming the private root as a carry source.
  const authority = (withGrant: boolean) => sealAuthorityRecord({ ...offlineActivationAuthority(answer),
    groupDisclosureGrants: withGrant ? [{ id: 'TEST-served-source', grantor: scope.operator, grantee: 'echo-desk',
      words: 'offline approval stand-in', source: { kind: 'telegram-message', topicId: 1, messageId: 1 },
      issuedAt: AT, action: 'carry-private-journal', scope, audience: 'operator-and-agent-bot-only',
      surface: 'telegram-forum', custodian: scope.operator, recovery: 'stop-use-on-revocation-or-audience-change' }] : [] },
  authoritySealKey(OFFLINE_STORAGE_KEY));
  const authorityPath = join(world.directory, 'served-authority.json');
  const grant = (withGrant: boolean) => writeFileSync(authorityPath, JSON.stringify(authority(withGrant)));
  // The membership reader the group runner's audience check reads, with the member count as a file the test flips.
  const countPath = join(world.directory, 'member-count'), membership = join(world.directory, 'membership.mjs'), loader = join(world.directory, 'membership-loader.mjs');
  writeFileSync(countPath, '2');
  writeFileSync(membership, `import { readFileSync } from 'node:fs';
  export const groupMembershipReader = () => async (method, body) => {
    const scope = ${JSON.stringify(scope)};
    return { ok: true, result: method === 'getChat' ? { id: Number(scope.chat), type: 'supergroup', is_forum: true }
      : method === 'getMe' ? { id: Number(scope.bot), is_bot: true }
        : method === 'getChatMemberCount' ? Number(readFileSync(${JSON.stringify(countPath)}, 'utf8'))
          : { status: 'member', user: { id: Number(body.user_id), is_bot: body.user_id === scope.bot } } };
  };`);
  writeFileSync(loader, `export async function resolve(s, c, n) {
    if (s.endsWith('/group-membership-io.mjs')) return { url: ${JSON.stringify(pathToFileURL(membership).href)}, shortCircuit: true };
    return n(s, c);
  }`);
  const groupEnv = { ...ENDPOINT, NODE_OPTIONS: `--loader ${loader}` };
  harness.setUpdates([]);
  const statusOf = async (root: string) => {
    const result = await harness.statusOn(root, groupEnv);
    expect(result.status, result.stderr).toBe(0);
    return JSON.parse(result.stdout) as { relationshipEmits: number; groupCarryRefreshes: number };
  };
  /** One served launch of the private root (its own poll loop, no updates), with or without the source grant on the record. */
  const servePrivate = async (withGrant: boolean) => {
    world.configuration.chatId = scope.operator;
    const run = await harness.runLive(2, withGrant ? ['--authority-record', authorityPath] : [], ENDPOINT);
    expect(run.status, run.stderr).toBe(0);
    return run.stderr;
  };
  /** One served launch of the carried group root (forum mode, empty poll), under the record at authorityPath. */
  const serveGroup = async () => {
    world.configuration.chatId = FORUM;
    const runner = harness.startRunner(groupRoot, 'live', 2, ['--forum', 'true', '--authority-record', authorityPath], groupEnv);
    const exit = await runner.exited;
    return { ...exit, ...runner.output };
  };

  // 1. The private root knows two people from its real summary pass; nothing has been emitted.
  expect(await privateSays('I met Sam Ruiz at the arboretum; he is an engineer. Ana Lima moved to Lisbon.')).toEqual({ people: ['Sam Ruiz', 'Ana Lima'], emits: 0 });
  // 2. Negative: a served cycle with NO source grant on the record emits nothing (the emitter is dark, silently).
  const dark = await servePrivate(false);
  expect(dark).not.toMatch(/relationship/u);
  expect((await statusOf(privateRoot)).relationshipEmits).toBe(0);
  // 3. Positive: with the sealed source grant, the same loop emits one put per person in its first served cycle.
  grant(true);
  const emitted = await servePrivate(true);
  expect(emitted).toMatch(/relationship emits 2 put, 0 delete/u);
  expect((await statusOf(privateRoot)).relationshipEmits).toBe(2);
  // 4. A change after a restart: a new person named, summarized in process, emitted by the next served cycle; an unchanged
  //    projection then emits nothing more.
  expect((await privateSays('Zed Quill joined the team today.')).people).toEqual(['Sam Ruiz', 'Ana Lima', 'Zed Quill']);
  expect(await servePrivate(true)).toMatch(/relationship emits 1 put, 0 delete/u);
  expect((await statusOf(privateRoot)).relationshipEmits).toBe(3);
  expect(await servePrivate(true)).not.toMatch(/relationship emits/u);
  // 5. The group root carries the private root (three emits superseded by the snapshot), then the predecessor changes once more.
  {
    const source = openPreviewJournal(privatePath, OFFLINE_STORAGE_KEY), destination = openPreviewJournal(groupPath, OFFLINE_STORAGE_KEY, { ...genesis, chat: FORUM, forum: true });
    // The shipped runner reads wall time. Using September's AT here after its
    // November emits re-scored old people (1 -> 3) and legitimately added two puts.
    // Use the same clock domain, then assert identities/content, not just a count.
    const carryAt = Date.now();
    const before = source.view.relationshipEmits.map(emit => structuredClone(emit));
    expect(before.map(emit => [emit.seq, emit.op, emit.data.name, emit.data.origin])).toEqual([
      [1, 'put', 'Sam Ruiz', carryOrigin(scope)], [2, 'put', 'Ana Lima', carryOrigin(scope)],
      [3, 'put', 'Zed Quill', carryOrigin(scope)],
    ]);
    expect(new Set(before.map(emit => emit.recordKey)).size).toBe(3);
    const permission = resolveGroupDisclosure(scope, authority(true), carryAt, operatorRecords(join(world.directory, 'operator-records')), authoritySealKey(OFFLINE_STORAGE_KEY));
    if (permission.kind !== 'resolved') throw Error(permission.reason);
    expect(appendGroupCarry(destination, source, scope, permission, true, carryAt, () => false)).toBe('carried');
    expect(source.view.relationshipEmits).toEqual(before);
    expect(destination.view.groupCarry!.emitsThrough).toBe(before.at(-1)!.seq);
    const snapshotRecords = destination.view.groupCarry!.entries.filter(entry => entry.kind === 'person')
      .map(entry => JSON.parse(entry.text) as Record<string, unknown>);
    const content = (data: Record<string, unknown>) => { const { hlc: _hlc, observed: _observed, ...record } = data; return record; };
    expect(snapshotRecords.map(content)).toEqual(before.map(emit => content(emit.data)));
    const sourceSize = source.size, destinationSize = destination.size;
    expect(appendGroupCarry(destination, source, scope, permission, true, carryAt, () => false)).toBe('already-carried');
    expect(source.size).toBe(sourceSize); expect(destination.size).toBe(destinationSize);
    expect(source.view.relationshipEmits).toEqual(before);
    expect(destination.view.groupCarry!.entries.filter(entry => entry.kind === 'person')).toHaveLength(3);
    source.close(); destination.close();
  }
  expect((await privateSays('Priya Nair will review the plans on Friday.')).people).toHaveLength(4);
  expect(await servePrivate(true)).toMatch(/relationship emits 1 put, 0 delete/u);
  expect((await statusOf(privateRoot)).relationshipEmits).toBe(4);
  // 6. Positive: the carried group root's own served loop, idle, applies the one emit after the snapshot under the verified audience.
  const refreshed = await serveGroup();
  expect(refreshed.status, refreshed.stderr).toBe(0);
  expect(refreshed.stderr).toMatch(/relationship refresh applied 1 \(through 4, 0 remaining\)/u);
  expect((await statusOf(groupRoot)).groupCarryRefreshes).toBe(1);
  {
    const replay = openPreviewJournal(groupPath, OFFLINE_STORAGE_KEY, undefined, undefined, true);
    expect(replay.view.groupCarryRefreshes.map(refresh => [refresh.from, refresh.through])).toEqual([[3, 4]]);
    const records = replay.view.groupCarryRefreshes[0]!.records.map(text => JSON.parse(text) as { name: string; origin: string });
    expect(records.map(record => [record.name, record.origin])).toEqual([['Priya Nair', carryOrigin(scope)]]);
    replay.close();
  }
  // Nothing new on the predecessor: the next idle cycle applies nothing and writes nothing.
  const idle = await serveGroup();
  expect(idle.status, idle.stderr).toBe(0);
  expect(idle.stderr).not.toMatch(/relationship refresh applied/u);
  expect((await statusOf(groupRoot)).groupCarryRefreshes).toBe(1);
  // 7. Negative: a new member in the group. The predecessor has a fresh emit, the audience is not operator-only: held, nothing applied.
  expect((await privateSays('Sam Ruiz moved to Porto.')).people).toHaveLength(5);
  expect(await servePrivate(true)).toMatch(/relationship emits 1 put, 0 delete/u);
  writeFileSync(countPath, '3');
  const stranger = await serveGroup();
  expect(stranger.stderr).toMatch(/relationship step held: group carry: operator-only audience refused/u);
  expect((await statusOf(groupRoot)).groupCarryRefreshes).toBe(1);
  writeFileSync(countPath, '2');
  // 8. Negative: the predecessor re-seeded at the same path (a different genesis): refused as a changed lineage, nothing applied.
  renameSync(privatePath, `${privatePath}.aside`);
  openPreviewJournal(privatePath, OFFLINE_STORAGE_KEY, { ...genesis, grant: 'TEST-reseeded-grant' }).close();
  const reseeded = await serveGroup();
  expect(reseeded.stderr).toMatch(/relationship step held: group carry: predecessor lineage changed/u);
  expect((await statusOf(groupRoot)).groupCarryRefreshes).toBe(1);
  rmSync(privatePath); renameSync(`${privatePath}.aside`, privatePath);
  // 9. Negative: the grant withdrawn from the record. The private root emits nothing for a further change; the group root refuses.
  grant(false);
  expect((await privateSays('Ana Lima is visiting next week.')).people).toHaveLength(6);
  expect(await servePrivate(true)).not.toMatch(/relationship emits/u);
  expect((await statusOf(privateRoot)).relationshipEmits).toBe(5);
  const ungranted = await serveGroup();
  expect(ungranted.stderr).toMatch(/relationship step held: group carry: /u);
  expect((await statusOf(groupRoot)).groupCarryRefreshes).toBe(1);
  grant(true);
  // 10. Negative: a stop on the group root. The runner does not serve, so no refresh happens although one is pending.
  writeFileSync(join(groupRoot, 'preview-stop.json'), JSON.stringify({ latchedAt: AT, reason: 'operator' }));
  const stopped = await serveGroup();
  expect(stopped.stderr).not.toMatch(/relationship refresh applied/u);
  expect((await statusOf(groupRoot)).groupCarryRefreshes).toBe(1);
  rmSync(join(groupRoot, 'preview-stop.json'));
  // 11. With the grant back and the audience operator-only, the pending emit is applied: the posture is recoverable, not latched.
  const recovered = await serveGroup();
  expect(recovered.status, recovered.stderr).toBe(0);
  expect(recovered.stderr).toMatch(/relationship refresh applied 1 \(through 5, 0 remaining\)/u);
  expect((await statusOf(groupRoot)).groupCarryRefreshes).toBe(2);
  expect(harness.calls().filter((row: { kind: string }) => row.kind === 'send')).toHaveLength(0);
}, 300_000);
