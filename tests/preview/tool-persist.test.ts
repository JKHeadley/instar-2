// Part Thirteen §9 (docs/17-harness-adapters), the persistent workspace and the kept harness session (plan row #400, MF5):
// a conversation's files stay in its private workspace across turns, bounded by its volume and by the root's workspace
// count (Rule 60); the kept harness session is a cache subordinate to the journal, resumed only while nothing it may hold
// has changed, and rotated, ended or recovered from the journal in every other case. The stand-in harness below behaves as
// the pinned Claude Code 2.1.280 was observed to (probe, PROGRESS): `--session-id` writes `<id>.jsonl` under the
// workspace's projects directory, `--resume` continues that same id, and a resume of a missing transcript fails.
import { appendFileSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, expect, it } from 'vitest';
import { createJournalWorker, openPreviewJournal } from './journal-test-worker.js';
import { prepareJournalEnvelope } from './journal-envelope.js';
import { decisionWithinFloor } from './model-call-boundary.js';
import { conclusionText, parseModelJson } from './model-json.js';
import { SINGLE_MACHINE_PROFILE } from './activation-authority.js';
import { subscriptionSessionArgs, subscriptionToolsPolicy, SUBSCRIPTION_TOOL_SESSION_ENV } from '../../src/assembly/production-provider.js';
// @ts-expect-error The runner side stays plain JavaScript.
import { conversationWorkspace, detachScratch, planSession, readSession, removeSessionFiles, runToolTurn, sessionFactsDigest, sessionTranscript, TOOL_SESSION_LIMITS, TOOL_WORKSPACES_KEPT } from './tool-turn.mjs';

const key = new Uint8Array(32).fill(5);
const roots: string[] = [];
afterEach(() => roots.splice(0).forEach(root => rmSync(root, { recursive: true, force: true })));
const dir = (base = tmpdir()) => { const root = realpathSync(mkdtempSync(join(base, 'tool-persist-'))); roots.push(root); return root; };
const plainScratch = (volume: string) => { mkdirSync(join(volume, 'vol'), { recursive: true, mode: 0o700 }); return realpathSync(join(volume, 'vol')); };
const keep = () => true;
const genesis = (maxCalls = 400) => ({ kind: 'genesis' as const, bot: '12345678', chat: '7654321', operator: '7654321', grant: 'grant:preview',
  configurationDigest: 'sha256:offline', expires: 9_999_999_999_999, maxCalls, maxReplies: 40, maxTurns: 40, maxBytes: 32768, cursor: 0 });
type Turn = { workspace: string; stateDirectory: string; session?: { id: string; resume: boolean } };
type Seen = { session: Turn['session']; history: string; prepared: string; workspace: string };

/** The harness as observed: a new id creates its transcript, a resume continues it and fails when it is gone. What it
 * "remembers" is exactly the transcript; `seen` records the context each turn had (transcript + this turn's input). */
function standInHarness(store: string, act: (turn: Turn, seen: Seen) => unknown = () => ({ state: 'complete', value: 'Done.' })) {
  const seen: Seen[] = [];
  const invoke = async (turn: Turn, prepared: string) => {
    if (!turn.session) throw Error('stand-in: a kept session was expected');
    const path = sessionTranscript(store, turn.workspace, turn.session.id);
    if (turn.session.resume && !existsSync(path)) return { state: 'uncertain' };
    const history = turn.session.resume ? readFileSync(path, 'utf8') : '';
    mkdirSync(join(path, '..'), { recursive: true });
    appendFileSync(path, `${JSON.stringify({ type: 'user', prompt: prepared })}\n`);
    const entry = { session: turn.session, history, prepared, workspace: turn.workspace };
    seen.push(entry);
    return act(turn, entry);
  };
  return { seen, invoke };
}
function turnOptions(journal: ReturnType<typeof openPreviewJournal>, root: string, store: string, invoke: (turn: Turn) => Promise<unknown>,
  extra: Record<string, unknown> = {}) {
  return { journal, root, prepared: '{"q":1}', promptLimit: 32768, deniedRoots: [root], operations: SINGLE_MACHINE_PROFILE.operations,
    now: () => 1_790_000_000_000, redactText: (text: string) => text, fallback: async () => ({ result: 'text-only' }),
    scratch: plainScratch, detach: keep, unmount: keep, authority: 'activation-ref sha256:tools',
    session: { store, harness: '2.1.280 claude-sonnet-5' }, invoke, ...extra };
}
const traceSession = (journal: ReturnType<typeof openPreviewJournal>) => journal.view.toolTurns?.sessions;

it('keeps a file the agent wrote on one turn for the next turn of the same conversation, and never shows it to another', async () => {
  const root = dir(), store = join(root, 'projects'), journal = openPreviewJournal(join(root, 'journal.encrypted'), key, genesis());
  const reads: (string | null)[] = [];
  const harness = standInHarness(store, turn => {
    const note = join(turn.workspace, 'note.txt');
    reads.push(existsSync(note) ? readFileSync(note, 'utf8') : null);
    if (!existsSync(note)) writeFileSync(note, 'kiwi-7731');
    return { state: 'complete', value: 'Done.' };
  });
  for (const update of [1, 2]) await runToolTurn(turnOptions(journal, root, store, (turn: Turn) => harness.invoke(turn, `turn ${update}`),
    { id: `telegram:12345678:update:${update}` }));
  // Turn 1 found nothing and wrote the file; turn 2 read it back from the same workspace.
  expect(reads).toEqual([null, 'kiwi-7731']);
  expect(journal.view.toolTurns?.sessions).toMatchObject({ fresh: 1, resumed: 1 });
  // Another conversation of the same root gets its own, empty workspace.
  const other = conversationWorkspace(root, 'telegram/bot-12345678/chat-999');
  expect(other.key).not.toBe(conversationWorkspace(root, '12345678:7654321').key);
  await runToolTurn(turnOptions(journal, root, store, (turn: Turn) => harness.invoke(turn, 'other'),
    { id: 'telegram:12345678:update:3', conversation: 'telegram/bot-12345678/chat-999' }));
  expect(reads).toEqual([null, 'kiwi-7731', null]);
  journal.close();
});

const hdiutil = existsSync('/usr/bin/hdiutil');
it.runIf(hdiutil)('keeps the file on the real fixed-size volume across an unmount between turns', { timeout: 120000 }, async () => {
  // Ordinary storage (a disk image cannot be mounted from the RAM disk), the real attach and unmount.
  const root = dir('/private/tmp'), store = join(root, 'projects'), journal = openPreviewJournal(join(root, 'journal.encrypted'), key, genesis());
  const reads: (string | null)[] = [], mounts: string[] = [];
  const harness = standInHarness(store, turn => {
    const note = join(turn.workspace, 'note.txt');
    mounts.push(turn.workspace);
    reads.push(existsSync(note) ? readFileSync(note, 'utf8') : null);
    if (!existsSync(note)) writeFileSync(note, 'kiwi-7731');
    return { state: 'complete', value: 'Done.' };
  });
  try {
    for (const update of [1, 2]) await runToolTurn({ ...turnOptions(journal, root, store, (turn: Turn) => harness.invoke(turn, `turn ${update}`),
      { id: `telegram:12345678:update:${update}` }), scratch: undefined, detach: undefined, unmount: undefined });
    expect(reads).toEqual([null, 'kiwi-7731']);
    // The same working directory both turns (the kept session needs it), and the volume is not left mounted.
    expect(mounts[0]).toBe(mounts[1]);
    expect(mounts[0]).toMatch(/^\/private\/tmp\/itw-[0-9a-f]{12}\/ws$/u);
    expect(existsSync(join(mounts[0]!, 'note.txt'))).toBe(false);
  } finally {
    const space = conversationWorkspace(root, '12345678:7654321');
    expect(detachScratch(space.directory)).toBe(true);
    journal.close();
  }
});

it('resumes the kept session while nothing it may hold changed, and records each use in the journal', async () => {
  const root = dir(), store = join(root, 'projects'), journal = openPreviewJournal(join(root, 'journal.encrypted'), key, genesis());
  const harness = standInHarness(store);
  for (const update of [1, 2, 3]) await runToolTurn(turnOptions(journal, root, store, (turn: Turn) => harness.invoke(turn, `message ${update}`),
    { id: `telegram:12345678:update:${update}` }));
  const [first, second, third] = harness.seen;
  expect(first!.session).toEqual({ id: expect.stringMatching(/^[0-9a-f-]{36}$/u), resume: false });
  expect(second!.session).toEqual({ id: first!.session!.id, resume: true });
  expect(third!.session).toEqual({ id: first!.session!.id, resume: true });
  // The kept session carried the earlier turns' context.
  expect(third!.history).toContain('message 1'); expect(third!.history).toContain('message 2');
  expect(traceSession(journal)).toEqual({ resumed: 2, fresh: 1, changed: 0, lost: 0, bounded: 0, ended: 0 });
  // Replay reaches the same projection.
  const reopened = openPreviewJournal(join(root, 'journal.encrypted'), key);
  expect(reopened.view.toolTurns).toEqual(journal.view.toolTurns);
  reopened.close(); journal.close();
});

// Live proof room 2026-09-30, cint-L13 72fb5a82, update 715672779: the real model's (claude-sonnet-5) verbatim answer to
// "Your replies are too long — keep them to two sentences.", which records a `prefer` memory change (Rule 106 replay).
type Recorded = { update: number; text: string; answerOutput: string };
const misfire = JSON.parse(readFileSync(new URL('./fixtures/proofroom-memory-misfire-715672853-2026-09-30.json', import.meta.url), 'utf8')) as
  { genesis: { bot: string; chat: string; operator: string; grant: string; configurationDigest: string }; turns: Recorded[] };
/** What the live subscription port hands the worker for a complete result (journal-agent invokeSubscription). */
function livePort(raw: string) {
  const extracted = parseModelJson(raw, { wrapped: 'accept' }), decision = extracted.ok ? extracted.value as { type?: unknown; floor?: unknown;
    conclusion?: { subject?: unknown; value?: unknown } } : null;
  const value = decision?.type === 'Decision' && decision.conclusion?.subject === 'preview-stage2-answer'
    && decisionWithinFloor(decision) ? conclusionText(decision.conclusion.value) : null;
  return value === null ? { state: 'complete' as const, failureClass: 'malformed' as const } : { state: 'complete' as const, value };
}

/** The real worker with tool turns through runToolTurn and the stand-in harness; `answer` decides each turn's output. */
function toolWorld(answer: (input: { id: string; question: string; context: string }, seen: Seen) => unknown, g = genesis()) {
  const root = dir(), store = join(root, 'projects'), now = 1_790_826_000_000;
  const journal = openPreviewJournal(join(root, 'journal.encrypted'), key, g);
  const harness = standInHarness(store);
  const sends: string[] = [];
  const worker = createJournalWorker(journal, { now: () => now, stopped: () => false,
    prepareModel: input => prepareJournalEnvelope(input, 'claude-sonnet-5', g.grant, now, 32768),
    toolRoute: () => true,
    model: async input => {
      if (input.id.startsWith('summary:')) return { state: 'complete' as const, failureClass: 'malformed' as const };
      const ran = await runToolTurn({ ...turnOptions(journal, root, store, async (turn: Turn) =>
        harness.invoke(turn, String(input.prepared)).then(() => answer(input, harness.seen.at(-1)!)), { id: input.id, prepared: String(input.prepared),
        conversation: `telegram/bot-${g.bot}/chat-${g.chat}` }), completed: (result: { state?: string }) => result?.state === 'complete' });
      // As journal-agent's model port does: a complete result hands the worker its text.
      const result = ran.result as { state: string; value?: string };
      return result.value === undefined ? { state: 'complete' as const, failureClass: 'malformed' as const } : result.value;
    }, send: async input => { sends.push(input.text); return sends.length; }, checkOutbound: () => {} });
  const update = (id: number, text: string) => ({ update_id: id, message: { chat: { id: Number(g.chat), type: 'private' },
    from: { id: Number(g.operator) }, text, date: Math.floor(now / 1000) + (id % 1000) } });
  return { root, store, journal, harness, worker, update, sends };
}

it('rotates the kept session when a recorded answer (the live 715672779 preference) changes a journal fact', async () => {
  const [preference] = misfire.turns as [Recorded];
  const g = { ...genesis(), ...misfire.genesis };
  const w = toolWorld(input => input.question === preference.text ? livePort(preference.answerOutput) : { state: 'complete', value: 'Fine.' }, g);
  w.worker.intake([w.update(preference.update - 1, 'Hello there.')]); await w.worker.drain();
  w.worker.intake([w.update(preference.update, preference.text)]); await w.worker.drain();
  w.worker.intake([w.update(preference.update + 1, 'And now?')]); await w.worker.drain();
  expect(w.journal.view.memory).toMatchObject([{ mode: 'prefer' }]);
  const [one, two, three] = w.harness.seen;
  // Turn two resumed (nothing had changed yet); the preference it recorded rotates the session for turn three.
  expect(two!.session).toEqual({ id: one!.session!.id, resume: true });
  expect(three!.session!.resume).toBe(false);
  expect(three!.session!.id).not.toBe(one!.session!.id);
  expect(existsSync(sessionTranscript(w.store, conversationWorkspacePath(w, g), one!.session!.id))).toBe(false);
  expect(traceSession(w.journal)).toMatchObject({ resumed: 1, fresh: 2, changed: 1 });
  w.journal.close();
});
const conversationWorkspacePath = (w: { root: string }, g: { bot: string; chat: string } = genesis()) => {
  const space = conversationWorkspace(w.root, `telegram/bot-${g.bot}/chat-${g.chat}`);
  return realpathSync(join(space.directory, 'vol', 'ws'));
};

it('honours a forget in the journal although the kept session held the fact: the next turn starts fresh and never sees it', async () => {
  const fact = 'My locker code is 4417.';
  const w = toolWorld((input, seen) => {
    if (input.question.startsWith('Please stop remembering')) {
      // The positive neighbour: before the forget is recorded the kept session still holds the fact.
      expect(seen.session!.resume).toBe(true); expect(seen.history).toContain('4417');
      const source = JSON.parse(input.context).memoryCandidates?.find((item: { message: string }) => item.message.includes(fact));
      return { state: 'complete', value: JSON.stringify({ reply: 'Done.', memory: [{ mode: 'forget', source: source.id, quote: fact }] }) };
    }
    return { state: 'complete', value: 'Noted.' };
  });
  w.worker.intake([w.update(1, fact)]); await w.worker.drain();
  w.worker.intake([w.update(2, `Please stop remembering this fact: ${fact}`)]); await w.worker.drain();
  expect(w.journal.view.memory).toMatchObject([{ mode: 'forget', quote: fact }]);
  w.worker.intake([w.update(3, 'What is my locker code?')]); await w.worker.drain();
  const [first, second, third] = w.harness.seen;
  expect(second!.session).toEqual({ id: first!.session!.id, resume: true });
  // After the forget: a new session; nothing the old one held reaches the turn (its transcript is gone), and the
  // journal's own packet withholds the forgotten clause.
  expect(third!.session!.resume).toBe(false);
  expect(third!.history).toBe('');
  expect(third!.prepared).not.toContain('4417');
  expect(existsSync(sessionTranscript(w.store, conversationWorkspacePath(w), first!.session!.id))).toBe(false);
  const rows = w.journal.view.toolTurns!;
  expect(rows.sessions).toMatchObject({ resumed: 1, fresh: 2, changed: 1 });
  expect(w.sends).toHaveLength(3);
  w.journal.close();
});

it('survives the loss of the session: a missing transcript, an unreadable record or an interrupted turn start fresh from the journal', async () => {
  const root = dir(), store = join(root, 'projects'), journal = openPreviewJournal(join(root, 'journal.encrypted'), key, genesis());
  const harness = standInHarness(store);
  const run = (update: number) => runToolTurn(turnOptions(journal, root, store, (turn: Turn) => harness.invoke(turn, `m${update}`),
    { id: `telegram:12345678:update:${update}`, completed: (r: { state?: string }) => r?.state === 'complete' }));
  await run(1);
  const space = conversationWorkspace(root, '12345678:7654321'), first = harness.seen[0]!.session!.id;
  // The transcript disappears (a cleanup, a disk loss): detected before dispatch, never resumed blindly.
  rmSync(sessionTranscript(store, realpathSync(join(space.directory, 'vol', 'ws')), first));
  const lost = await run(2);
  expect(lost.session).toMatchObject({ resume: false, reason: 'lost: the transcript is missing' });
  expect(lost.result).toEqual({ state: 'complete', value: 'Done.' });
  // An unreadable record.
  writeFileSync(join(space.directory, 'session.json'), '{not json');
  expect((await run(3)).session).toMatchObject({ resume: false, reason: 'lost: the session record is unreadable' });
  // A crash after dispatch leaves the record open: the next turn does not resume a session whose last turn is unknown.
  const record = readSession(space.directory).value;
  writeFileSync(join(space.directory, 'session.json'), JSON.stringify({ ...record, open: true }));
  expect((await run(4)).session).toMatchObject({ resume: false, reason: 'interrupted: the last turn did not settle' });
  expect(traceSession(journal)).toMatchObject({ fresh: 4, lost: 3, resumed: 0 });
  journal.close();
});

it('ends the session at a stop, a withdrawal or a failed turn, removing what it held at once', async () => {
  const root = dir(), store = join(root, 'projects'), journal = openPreviewJournal(join(root, 'journal.encrypted'), key, genesis());
  let stopped = false, fail = false, authority = 'activation-ref sha256:tools';
  const harness = standInHarness(store, () => { if (fail) throw Error('launch failed'); return { state: stopped ? 'uncertain' : 'complete', value: 'x' }; });
  const run = (update: number) => runToolTurn(turnOptions(journal, root, store, (turn: Turn) => harness.invoke(turn, `m${update}`),
    { id: `telegram:12345678:update:${update}`, stopped: () => stopped, authority }));
  await run(1);
  const ws = realpathSync(join(conversationWorkspace(root, '12345678:7654321').directory, 'vol', 'ws'));
  const id = harness.seen[0]!.session!.id;
  stopped = true;
  const stop = await run(2);
  expect(stop.session).toMatchObject({ id, resume: true });
  // The stop ended it now: the transcript is gone, and the trace says so.
  expect(existsSync(sessionTranscript(store, ws, id))).toBe(false);
  stopped = false;
  expect((await run(3)).session).toMatchObject({ resume: false, reason: 'stopped or withdrawn' });
  // A tools authority that changed (a withdrawn and re-issued grant, a new policy) never resumes the old session.
  authority = 'activation-ref sha256:other';
  expect((await run(4)).session).toMatchObject({ resume: false, reason: 'authority, harness or model changed' });
  fail = true;
  await expect(run(5)).rejects.toThrow('launch failed');
  fail = false;
  expect((await run(6)).session).toMatchObject({ resume: false, reason: 'the turn failed' });
  expect(traceSession(journal)).toMatchObject({ ended: 2, changed: 1 });
  journal.close();
});

it('rotates at the declared bounds: turns, transcript size and a compaction', () => {
  const store = '/s', workspace = '/private/tmp/itw-0123456789ab/ws', facts = 'sha256:f', binding = 'b';
  const value = { v: 1, id: '11111111-2222-4333-8444-555555555555', binding, facts, workspace, turns: 1, open: false };
  const plan = (record: object, size: number, text = '{}') => planSession({ record: { state: 'present', value: { ...value, ...record } }, binding, facts,
    store, workspace, stat: () => size, read: () => text, newId: () => '99999999-2222-4333-8444-555555555555' });
  expect(plan({}, 10)).toMatchObject({ resume: true, turn: 2 });
  expect(plan({ turns: TOOL_SESSION_LIMITS.maxTurns - 1 }, 10)).toMatchObject({ resume: true });
  expect(plan({ turns: TOOL_SESSION_LIMITS.maxTurns }, 10)).toMatchObject({ resume: false, reason: 'turn bound' });
  expect(plan({}, TOOL_SESSION_LIMITS.maxTranscriptBytes - 1)).toMatchObject({ resume: true });
  expect(plan({}, TOOL_SESSION_LIMITS.maxTranscriptBytes)).toMatchObject({ resume: false, reason: 'size bound' });
  expect(plan({}, 10, '{"type":"system","subtype":"compact_boundary"}')).toMatchObject({ resume: false, reason: 'compacted' });
  expect(plan({ facts: 'sha256:old' }, 10)).toMatchObject({ resume: false, reason: 'the journal changed a fact', previous: { id: value.id } });
  expect(planSession({ record: { state: 'absent' }, binding, facts, store, workspace, newId: () => 'n' })).toMatchObject({ resume: false, reason: 'new', previous: null });
});

it('keys the kept session to every journal fact it may hold: corrections, forgets, closures, grants and the stop', () => {
  const root = dir(), journal = openPreviewJournal(join(root, 'journal.encrypted'), key, genesis());
  const base = sessionFactsDigest(journal.view);
  expect(sessionFactsDigest(journal.view)).toBe(base);
  for (const change of [{ memory: [{ mode: 'forget', source: 's', quote: 'q', trigger: 't' }] }, { reminderGrant: 'grant:r' },
    { closed: new Map([[1, { by: 'x' }]]) }, { stop: { reason: 'stop', at: 1 } }, { operatorRequests: [{ id: 'r' }] }, { expiryAuthority: 'a' }])
    expect(sessionFactsDigest({ ...journal.view, ...change })).not.toBe(base);
  journal.close();
});

it('bounds the root\'s tool storage: past the kept workspaces a further conversation runs in a fresh one-turn workspace, and nothing is deleted', async () => {
  const root = dir(), store = join(root, 'projects'), journal = openPreviewJournal(join(root, 'journal.encrypted'), key, genesis());
  const harness = standInHarness(store);
  const turnDirs: string[] = [];
  const conversations = Array.from({ length: TOOL_WORKSPACES_KEPT + 1 }, (_, index) => `telegram/bot-1/chat-${String(index)}`);
  const detached: string[] = [];
  const run = (index: number, conversation: string, write: string) => runToolTurn(turnOptions(journal, root, store, async (turn: Turn & { session?: unknown }) => {
    if (turn.session) return harness.invoke(turn, conversation);
    turnDirs.push(turn.workspace);
    return { state: 'complete', value: existsSync(join(turn.workspace, 'note.txt')) ? 'found' : (writeFileSync(join(turn.workspace, 'note.txt'), write), 'wrote') };
  }, { id: `telegram:12345678:update:${String(index)}`, conversation, detach: (d: string) => { detached.push(d); return true; } }));
  for (const [index, conversation] of conversations.slice(0, TOOL_WORKSPACES_KEPT).entries()) await run(index + 1, conversation, 'x');
  // The fifth conversation: no kept workspace and no kept session; its one-turn workspace goes after each turn.
  const extra = conversations.at(-1)!;
  const first = await run(10, extra, 'only this turn');
  expect(first.session).toBeNull();
  expect(first.result).toEqual({ state: 'complete', value: 'wrote' });
  expect(detached).toHaveLength(1);
  expect(readdirSync(join(root, 'workspaces'))).toHaveLength(TOOL_WORKSPACES_KEPT);
  // Every kept conversation still has its files and its session: nothing was deleted to make room (Rule 7).
  for (const seen of harness.seen) expect(existsSync(sessionTranscript(store, seen.workspace, seen.session!.id))).toBe(true);
  // A second turn of the overflowing conversation gets a new one-turn workspace, and the journal counts both.
  const again = await run(11, extra, 'again');
  expect(again.result).toEqual({ state: 'complete', value: 'wrote' });
  expect(new Set(turnDirs).size).toBe(2);
  expect(journal.view.toolTurns?.overflow).toBe(2);
  // The kept conversations keep using their workspaces.
  expect((await run(12, conversations[0]!, 'x')).session).toMatchObject({ resume: true });
  journal.close();
});

it('removes only the exact session files it names', () => {
  const root = dir(), store = join(root, 'projects'), ws = '/private/tmp/itw-0123456789ab/ws', id = '0f4c2b1e-8d7a-4c3b-9e2f-1a2b3c4d5e6f';
  const transcript = sessionTranscript(store, ws, id), neighbour = join(transcript, '..', 'other.jsonl');
  mkdirSync(join(transcript.slice(0, -'.jsonl'.length), 'subagents'), { recursive: true });
  writeFileSync(transcript, 'x'); writeFileSync(neighbour, 'y');
  expect(removeSessionFiles(store, ws, '../other')).toBe(false);
  expect(existsSync(neighbour)).toBe(true);
  expect(removeSessionFiles(store, ws, id)).toBe(true);
  expect(existsSync(transcript)).toBe(false); expect(existsSync(transcript.slice(0, -'.jsonl'.length))).toBe(false);
  expect(existsSync(neighbour)).toBe(true);
});

it('passes the session to the harness per turn, outside the digest-bound policy, with its own memory and silent compaction off', () => {
  const args = subscriptionToolsPolicy('claude-sonnet-5').args;
  expect(args).not.toContain('--no-session-persistence');
  expect(args).not.toContain('--resume'); expect(args).not.toContain('--session-id');
  const id = '0f4c2b1e-8d7a-4c3b-9e2f-1a2b3c4d5e6f';
  expect(subscriptionSessionArgs({ id, resume: false })).toEqual(['--session-id', id]);
  expect(subscriptionSessionArgs({ id, resume: true })).toEqual(['--resume', id]);
  // No kept session: the harness persists nothing.
  expect(subscriptionSessionArgs(undefined)).toEqual(['--no-session-persistence']);
  for (const bad of ['--help', '../x', id.toUpperCase(), `${id} --print`]) expect(() => subscriptionSessionArgs({ id: bad, resume: true })).toThrow();
  expect(SUBSCRIPTION_TOOL_SESSION_ENV).toEqual({ CLAUDE_CODE_DISABLE_AUTO_MEMORY: '1', DISABLE_AUTO_COMPACT: '1' });
});

it('refuses a malformed session or workspace row, so a journal cannot claim a session or a workspace it does not name', () => {
  const root = dir(), journal = openPreviewJournal(join(root, 'journal.encrypted'), key, genesis());
  const id = 'telegram:12345678:update:1';
  for (const workspace of [{ key: 'ZZ', kept: true }, { key: '0123456789ab' }])
    expect(() => journal.append({ kind: 'tool-turn', phase: 'reserved', id, attempt: 0, calls: 7, workspace, at: 1 } as never)).toThrow(/tool turn workspace/u);
  journal.append({ kind: 'tool-turn', phase: 'reserved', id, attempt: 0, calls: 7, workspace: { key: '0123456789ab', kept: true }, at: 1 } as never);
  const session = { id: '0f4c2b1e-8d7a-4c3b-9e2f-1a2b3c4d5e6f', mode: 'resume', reason: 'resumed', turn: 2, kept: true, transcriptBytes: 10 };
  for (const bad of [{ ...session, id: 'x' }, { ...session, mode: 'fork' }, { ...session, kept: false }, { ...session, turn: 0 }])
    expect(() => journal.append({ kind: 'tool-turn', phase: 'trace', id, attempt: 0, calls: [], consistent: true, workspaceBytes: 0,
      session: bad, at: 2 } as never)).toThrow(/tool turn session/u);
  journal.append({ kind: 'tool-turn', phase: 'trace', id, attempt: 0, calls: [], consistent: true, workspaceBytes: 0, session, at: 2 } as never);
  expect(journal.view.toolTurns?.sessions).toEqual({ resumed: 1, fresh: 0, changed: 0, lost: 0, bounded: 0, ended: 0 });
  journal.close();
});

// Rule 36 / observer #106: the live runs' journal rows (fixtures/tool-turn/persist-2026-10-03, real pinned harness, real
// volume, real kept session) replay through the journal to the recorded outcome. The forget and stop runs predate one
// rename: their reserved rows' `workspace.retired: []` (always empty: nothing was retired) is now `workspace.kept: true`.
it('replays the live persist, forget and stop runs\' journal rows to the recorded session outcomes', () => {
  const expected: Record<string, object> = { persist: { resumed: 1, fresh: 2, lost: 1, changed: 0, ended: 0 },
    forget: { resumed: 1, fresh: 2, changed: 1, lost: 0, ended: 0 }, stop: { resumed: 0, fresh: 1, ended: 1 } };
  for (const name of Object.keys(expected)) {
    const recorded = JSON.parse(readFileSync(new URL(`./fixtures/tool-turn/persist-2026-10-03/${name}.json`, import.meta.url), 'utf8')) as
      { journalRows: Record<string, unknown>[] };
    const root = dir(), journal = openPreviewJournal(join(root, 'journal.encrypted'), key, genesis(200));
    for (const row of recorded.journalRows) {
      const workspace = row.workspace as { key: string; retired?: unknown[] } | undefined;
      if (workspace?.retired !== undefined) expect(workspace.retired).toEqual([]);
      journal.append((workspace ? { ...row, workspace: { key: workspace.key, kept: true } } : row) as never);
    }
    expect(journal.view.toolTurns?.sessions, name).toMatchObject(expected[name]!);
    expect(journal.view.toolTurns?.open, name).toEqual([]);
    journal.close();
  }
});
