// Part Twelve on the live answer and work path (tests/preview/effect-doorway.mjs): a tool call that could make a
// consequential effect reaches the effect doorway, which admits or refuses it by the journal's four legacy
// consequential-effect tests; ordinary work in the turn's own workspace never calls it. Both sides of every test,
// the policy decoder, the register term it reads, the real executable hook on recorded tool calls (Rule 106: the
// spike's real WebFetch calls and the live scope turn), and one tool turn on a scratch root through runToolTurn:
// an ordinary write admitted with no doorway call and a consequential effect refused, journaled, counted in
// status and carried below the answer.
import { spawn, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, afterEach, beforeAll, expect, it } from 'vitest';
import { deriveProfile } from '../../src/index.js';
import { openPreviewJournal } from './journal.js';
import { SINGLE_MACHINE_PROFILE } from './activation-authority.js';
import { startClearHeldCheck } from './held-check-stub.js';
import { openReplyNotices, validAnswerNotices } from './credential-reminders.js';
import { SUBSCRIPTION_TOOL_LIMITS } from '../../src/assembly/production-provider.js';
// @ts-expect-error The doorway, the hook and the runner side stay plain JavaScript: the harness runs them without a loader.
import { admitEffect, classifyEffect, decodeEffectPolicy, effectDoorwayStatusLines, refusedEffectNotices, toolEffectProposal, CONSEQUENTIAL_TESTS, DEFAULT_EFFECT_POLICY, IRREVERSIBLE_TERM, termHolds } from './effect-doorway.mjs';
// @ts-expect-error The runner side stays plain JavaScript.
import { runToolTurn, TOOL_HOOK_SCRIPT } from './tool-turn.mjs';

const OPS = [...SINGLE_MACHINE_PROFILE.operations];
const SHAPE = JSON.parse(readFileSync(join(__dirname, '../../register-source/bootstrap-shape.json'), 'utf8'));
const roots: string[] = [];
afterEach(() => roots.splice(0).forEach(root => rmSync(root, { recursive: true, force: true })));
const dir = (prefix: string) => { const root = realpathSync(mkdtempSync(join(tmpdir(), prefix))); roots.push(root); return root; };
const grant = (over: object) => ({ id: 'grant:test', effect: 'tool:network', approves: ['scope'], source: 'telegram:102965:121996',
  custodian: 'desk', recovery: 'remove the grant from the policy file; the next tool turn reads it again', ...over });
const policy = (over: object = {}) => decodeEffectPolicy({ type: 'PreviewEffectPolicy', resourceLevelUsd: 0, policySensitive: [],
  registered: [], grants: [], ...over });
const held = (verdict: { tests: Record<string, boolean> }) => CONSEQUENTIAL_TESTS.filter((test: string) => verdict.tests[test]);

it('reads the register\'s own irreversible term, and evaluates it as part one\'s deriveProfile does', () => {
  expect(IRREVERSIBLE_TERM).toEqual(SHAPE.derivedFrom.irreversible);
  const terms = { owner: 'part-three' as const, derivedFrom: SHAPE.derivedFrom };
  for (const reversibility of ['reversible', 'costly', 'irreversible'] as const) {
    const profile = { type: 'Profile', schemaVersion: 1, consequence: 'external', reversibility, reach: 'world', surface: 'none',
      repeats: { kind: 'no' } } as never;
    const derived = deriveProfile(profile, terms, 'test');
    expect(derived.kind).toBe('Success');
    expect(termHolds(SHAPE.derivedFrom.irreversible, { reversibility })).toBe((derived as { value: { irreversible: boolean } }).value.irreversible);
  }
});

it('holds each of the legacy risk flags and the separate sign-off tests on one side and not on the other', () => {
  // All four false: a registered internal, reversible, free effect is ordinary and admitted.
  const internal = policy({ registered: [{ effect: 'tool:mcp', target: 'mcp__notes__append', consequence: 'data', reversibility: 'reversible',
    reach: 'agent', costUsd: 0, source: 'telegram:102965:121996' }] });
  const ordinary = admitEffect({ effect: 'tool:mcp', target: 'mcp__notes__append' }, internal, OPS);
  expect(ordinary).toMatchObject({ consequential: false, admitted: true, disposition: 'ordinary' });
  expect(held(ordinary)).toEqual([]);
  // irreversible: the same tool registered irreversible.
  const irr = policy({ registered: [{ effect: 'tool:mcp', target: 'mcp__notes__append', consequence: 'data', reversibility: 'irreversible',
    reach: 'agent', costUsd: 0, source: 's' }] });
  expect(held(classifyEffect({ effect: 'tool:mcp', target: 'mcp__notes__append' }, irr))).toEqual(['irreversible']);
  // resources: a cost above the operator's level, and an unknown cost; at the level it does not hold.
  const priced = (costUsd: number | null, resourceLevelUsd = 0.5) => classifyEffect({ effect: 'tool:mcp', target: 'mcp__notes__append' },
    policy({ resourceLevelUsd, registered: [{ effect: 'tool:mcp', target: 'mcp__notes__append', consequence: 'money', reversibility: 'reversible',
      reach: 'agent', costUsd, source: 's' }] }));
  expect(held(priced(0.51))).toEqual(['resources']);
  expect(held(priced(null))).toEqual(['resources']);
  expect(held(priced(0.5))).toEqual([]);
  // scope: reaching the world without a grant; a live scope grant places it inside; an expired or other-target grant does not.
  expect(held(classifyEffect({ effect: 'tool:network', target: 'example.com' }, DEFAULT_EFFECT_POLICY))).toEqual(['scope']);
  expect(held(classifyEffect({ effect: 'tool:network', target: 'example.com' }, policy({ grants: [grant({ target: 'example.com' })] })))).toEqual([]);
  expect(held(classifyEffect({ effect: 'tool:network', target: 'other.org' }, policy({ grants: [grant({ target: 'example.com' })] })))).toEqual(['scope']);
  expect(held(classifyEffect({ effect: 'tool:network', target: 'example.com' }, policy({ grants: [grant({ expiresAt: 100 })] }), { now: 100 })))
    .toEqual(['scope']);
  expect(held(classifyEffect({ effect: 'tool:network', target: 'example.com' }, policy({ grants: [grant({ expiresAt: 100 })] }), { now: 99 })))
    .toEqual([]);
  // policySensitive: a matter the operator marked, by effect or by target; an unmarked one does not hold.
  const granted = policy({ grants: [grant({})], policySensitive: ['bank.example'] });
  expect(held(classifyEffect({ effect: 'tool:network', target: 'bank.example' }, granted))).toEqual(['policySensitive']);
  expect(held(classifyEffect({ effect: 'tool:network', target: 'news.example' }, granted))).toEqual([]);
});

it('admits a consequential effect only when every held test is answered, and names what would admit a refused one', () => {
  // Unregistered MCP: worst reachable classification, refused on one machine whatever is granted (the closed set is fixed).
  const send = admitEffect({ effect: 'tool:mcp', target: 'mcp__gmail__send' }, policy({ grants: [grant({ effect: 'tool:mcp',
    approves: ['scope', 'resources'], resourceLevelUsd: 5 })] }), OPS);
  expect(send).toMatchObject({ admitted: false, disposition: 'refused', consequential: true });
  expect(held(send)).toEqual(['irreversible', 'resources']);
  expect(send.reason).toMatch(/durability.*an irreversible act follows its durable cause/u);
  expect(send.admits).toMatch(/second enrolled machine/u);
  expect(send.admits).toContain('provider-call, telegram:ordinary-reply, slack:ordinary-reply');
  expect(send.reason).toMatch(/tell the user plainly/u);
  // An irreversible effect that IS an operation of the accepted closed set is admitted as such (the reply's own route).
  expect(admitEffect({ effect: 'telegram:ordinary-reply' }, policy({ registered: [{ effect: 'telegram:ordinary-reply', consequence: 'attention',
    reversibility: 'irreversible', reach: 'operator', costUsd: 0, source: 'P-08' }], grants: [grant({ effect: 'telegram:ordinary-reply' })] }), OPS))
    .toMatchObject({ admitted: true, disposition: 'closed-set' });
  // Resources: a grant naming a level that covers a registered cost admits; one below it, or an unknown cost, does not.
  const paid = (costUsd: number | null, level: number) => admitEffect({ effect: 'tool:mcp', target: 'mcp__api__call' }, policy({
    registered: [{ effect: 'tool:mcp', target: 'mcp__api__call', consequence: 'money', reversibility: 'reversible', reach: 'agent', costUsd, source: 's' }],
    grants: [grant({ effect: 'tool:mcp', approves: ['resources'], resourceLevelUsd: level })] }), OPS);
  expect(paid(0.2, 0.25)).toMatchObject({ admitted: true, disposition: 'granted', grant: 'grant:test' });
  expect(paid(0.3, 0.25)).toMatchObject({ admitted: false, admits: expect.stringContaining('registered cost') });
  expect(paid(null, 100)).toMatchObject({ admitted: false });
  // Policy-sensitive: refused until a grant approves that matter; then admitted under it.
  const sensitive = (approves: string[]) => admitEffect({ effect: 'tool:network', target: 'bank.example' },
    policy({ policySensitive: ['bank.example'], grants: [grant({ approves })] }), OPS);
  expect(sensitive(['scope'])).toMatchObject({ admitted: false, admits: expect.stringContaining('policy-sensitive') });
  expect(sensitive(['scope', 'policySensitive'])).toMatchObject({ admitted: true, disposition: 'granted' });
  // Scope alone: refused by default, ordinary once granted.
  expect(admitEffect({ effect: 'tool:network', target: 'example.com' }, DEFAULT_EFFECT_POLICY, OPS))
    .toMatchObject({ admitted: false, admits: expect.stringContaining('a role is granted once, at onboarding') });
  expect(admitEffect({ effect: 'tool:network', target: 'example.com' }, policy({ grants: [grant({})] }), OPS))
    .toMatchObject({ admitted: true, disposition: 'ordinary' });
});

it('decodes only a closed effect policy: every grant names its source, custodian and recovery', () => {
  expect(() => decodeEffectPolicy({ type: 'PreviewEffectPolicy', resourceLevelUsd: 0, policySensitive: [], registered: [], grants: [], extra: 1 }))
    .toThrow(/unknown field extra/u);
  for (const field of ['source', 'custodian', 'recovery']) {
    const bad = grant({}) as Record<string, unknown>; delete bad[field];
    expect(() => policy({ grants: [bad] })).toThrow(/grant grant:test/u);
  }
  expect(() => policy({ grants: [grant({ approves: ['resources'] })] })).toThrow(/grant/u);
  expect(() => policy({ grants: [grant({ approves: ['irreversible'] })] })).toThrow(/grant/u);
  expect(() => policy({ registered: [{ effect: 'tool:mcp', consequence: 'data', reversibility: 'sometimes', reach: 'agent', costUsd: 0, source: 's' }] }))
    .toThrow(/registration/u);
  expect(() => policy({ resourceLevelUsd: -1 })).toThrow(/resourceLevelUsd/u);
  // The runner hands a decoded policy (or the default) to the hook's config, where it is decoded again: both round-trip.
  const decoded = policy({ grants: [grant({})], policySensitive: ['bank.example'] });
  expect(decodeEffectPolicy(JSON.parse(JSON.stringify(decoded)))).toEqual(decoded);
  expect(decodeEffectPolicy(JSON.parse(JSON.stringify(DEFAULT_EFFECT_POLICY)))).toEqual(DEFAULT_EFFECT_POLICY);
});

it('routes only the tools that could make a consequential effect', () => {
  expect(toolEffectProposal('mcp__gmail__send', {})).toEqual({ effect: 'tool:mcp', target: 'mcp__gmail__send' });
  expect(toolEffectProposal('WebFetch', { url: 'https://example.com/a' })).toEqual({ effect: 'tool:network', target: 'example.com' });
  expect(toolEffectProposal('WebSearch', { query: 'x' })).toEqual({ effect: 'tool:network', target: 'web-search' });
  expect(toolEffectProposal('Bash', { command: 'ls', dangerouslyDisableSandbox: true })).toEqual({ effect: 'tool:unsandboxed' });
  for (const [tool, input] of [['Bash', { command: 'rm -rf build' }], ['Write', { file_path: 'a' }], ['Read', {}], ['Edit', {}], ['Glob', {}], ['Grep', {}]] as const)
    expect(toolEffectProposal(tool, input)).toBeNull();
});

// Plan #507: outward calls ask the runner's held-secret check first; a stand-in answers `clear` (held-check-stub.ts).
let HELD_CHECK = '';
let stopHeldCheck = () => {};
beforeAll(async () => { const stub = await startClearHeldCheck(); HELD_CHECK = stub.path; stopHeldCheck = stub.stop; });
afterAll(() => stopHeldCheck());
/** A turn's state laid out as prepareToolTurn writes it, for the real hook. */
function hookTurn(over: object = {}) {
  const root = dir('effect-hook-');
  for (const sub of ['ws', 'state', 'tmp']) mkdirSync(join(root, sub));
  const ws = join(root, 'ws'), state = join(root, 'state');
  writeFileSync(join(state, 'config.json'), JSON.stringify({ workspace: ws, tmp: join(root, 'tmp'), maxCalls: 50, maxWriteBytes: 1048576,
    operations: OPS, irreversibleTerm: SHAPE.derivedFrom.irreversible, heldCheck: HELD_CHECK, ...over }));
  return { root, ws, state };
}
const runHook = (state: string, call: object, mode = 'pre') => spawnSync(process.execPath, [TOOL_HOOK_SCRIPT, mode, state],
  { input: JSON.stringify(call), encoding: 'utf8' });
/** The same hook, run without blocking this process: inside runToolTurn the runner answers the hook's held-secret check
 * on its turn socket in this process (plan #507), as the real runner does while the harness waits on its hook. */
const runHookAsync = (state: string, call: object, mode = 'pre') => new Promise<{ status: number | null; stdout: string }>((resolve, reject) => {
  const child = spawn(process.execPath, [TOOL_HOOK_SCRIPT, mode, state]);
  let stdout = '';
  child.stdout.on('data', chunk => { stdout += chunk; });
  child.on('error', reject);
  child.on('close', status => resolve({ status, stdout }));
  child.stdin.end(JSON.stringify(call));
});
const admissionRows = (state: string) => readFileSync(join(state, 'admission.jsonl'), 'utf8').trim().split('\n').map(line => JSON.parse(line));

it('replays the recorded tool calls of real harness runs through the real hook: the doorway fires exactly on the consequential ones (Rule 106)', () => {
  // The spike's real runs (fixtures/tool-turn/spike-cab6b51d) and the live scope, task and doorway turns (fixtures/tool-turn/live-2026-10-03;
  // the doorway turn is this unit's own live run, session dca478d2-9a8a-471a-9144-1b21d98ad59b).
  const SPIKE = join(__dirname, 'fixtures/tool-turn/spike-cab6b51d');
  const PREFIX = '/Users/dabombstudio/.instar/agents/echo/.worktrees/w4-toolsreuse/scratch/w4-toolsreuse-run';
  const recorded: { tool: string; input: Record<string, unknown> }[] = [];
  for (const run of ['b1-hook', 'b3-hook-tight', 'c1-task', 'd1-turncap', 'd2-callcap', 'e2-workflow'])
    for (const line of readFileSync(join(SPIKE, run, 'admission.jsonl'), 'utf8').trim().split('\n')) {
      const row = JSON.parse(line); if (row.phase === 'pre' || row.phase === undefined) recorded.push({ tool: row.tool, input: row.input });
    }
  for (const name of ['scope', 'task', 'doorway']) {
    const live = JSON.parse(readFileSync(join(__dirname, `fixtures/tool-turn/live-2026-10-03/${name}.json`), 'utf8'));
    for (const line of String(live.admission).trim().split('\n')) {
      const row = JSON.parse(line); if (row.phase === 'pre') recorded.push({ tool: row.tool, input: JSON.parse(row.input) });
    }
  }
  const { root, state } = hookTurn();
  let doorway = 0, ordinary = 0;
  recorded.forEach((call, index) => {
    const input = JSON.parse(JSON.stringify(call.input).split(PREFIX).join(root));
    const r = runHook(state, { tool_name: call.tool, tool_input: input, tool_use_id: `toolu_${String(index)}` });
    expect(r.status).toBe(0);
  });
  for (const row of admissionRows(state)) {
    // A web read is ordinary work under the tools grant (w4-toolsfull) unless the effect policy names it; this replay runs
    // with no policy, so the doorway fires on every other proposal and never on a web read.
    const webRead = row.tool === 'WebFetch' || row.tool === 'WebSearch';
    const consequential = toolEffectProposal(row.tool, JSON.parse(row.input)) !== null && !webRead;
    expect([row.tool, row.doorway !== undefined]).toEqual([row.tool, consequential]);
    // The spike's real WebFetch calls (example.org): a public host, so admitted as a web read, or refused for scope by the
    // hook's own resolution when the name does not resolve here; never the doorway's.
    if (webRead) expect([row.tool, row.kind]).toEqual([row.tool, row.decision === 'allow' ? 'network-read' : 'scope']);
    if (row.doorway && row.tool === 'Bash') {
      doorway++;
      // The live turn's unsandboxed command: refused on three tests, with what would admit it.
      expect(row).toMatchObject({ decision: 'deny', kind: 'unsandboxed', doorway: { effect: 'tool:unsandboxed', disposition: 'refused',
        tests: { irreversible: true, resources: true, scope: true, policySensitive: false } } });
    } else ordinary++;
  }
  expect([recorded.length, doorway, ordinary]).toEqual([recorded.length, 1, recorded.length - 1]);
  // The live doorway turn: the recorded hook decision is what the replay reaches, and the model's recorded answer reported the
  // refusal and what would admit it; the refusal notice for that turn is one line the journal accepts below such an answer.
  const live = JSON.parse(readFileSync(join(__dirname, 'fixtures/tool-turn/live-2026-10-03/doorway.json'), 'utf8'));
  const liveDeny = String(live.admission).trim().split('\n').map((line: string) => JSON.parse(line)).find((row: { tool: string; phase: string }) => row.tool === 'Bash' && row.phase === 'pre');
  const replayDeny = admissionRows(state).find(row => row.tool === 'Bash' && row.doorway);
  expect(liveDeny.decision).toBe('deny');
  expect(replayDeny.doorway.refusedFor).toEqual(['durability', 'role', 'sign-off']);
  expect(replayDeny.reason).toContain('an irreversible act follows its durable cause');
  expect(String(live.answer)).toMatch(/refused, not executed/u);
  expect(String(live.answer)).toContain('What would admit it');
  const notice = refusedEffectNotices(live.effectDoorway.recent.map((item: object) => ({ ...item, turn: 'telegram:12345678:update:1', attempt: 0, n: 2 })),
    'telegram:12345678:update:1')[0];
  expect(validAnswerNotices([notice], `${String(live.answer)}\n\n${notice.line}`)).toBe(true);
  // The live task turn's ordinary Write, Read and Bash calls were admitted with no doorway call.
  const task = admissionRows(state).filter(row => ['Write', 'Read', 'Bash'].includes(row.tool) && row.decision === 'allow');
  expect(task.length).toBeGreaterThan(0);
  expect(task.every(row => row.doorway === undefined)).toBe(true);
});

it('one tool turn on a scratch root: an ordinary write is admitted with no doorway call; a consequential effect reaches the doorway', async () => {
  const key = new Uint8Array(32).fill(5), extra = SUBSCRIPTION_TOOL_LIMITS.maxTurns - 1, id = 'telegram:12345678:update:21';
  const open = (root: string) => openPreviewJournal(join(root, 'journal.encrypted'), key, { kind: 'genesis', bot: '12345678', chat: '7654321',
    operator: '7654321', grant: 'grant:preview', configurationDigest: 'sha256:offline', expires: 9_999_999_999_999, maxCalls: extra + 4,
    maxReplies: 10, maxTurns: 10, maxBytes: 32768, cursor: 0 });
  let lastRoot = '';
  const turnOnce = async (effectPolicy: object | undefined, consequential: object) => {
    const root = dir('effect-turn-'); lastRoot = root;
    const journal = open(root);
    const outcome = await runToolTurn({ journal, root, id, prepared: '{"q":1}', promptLimit: 32768, deniedRoots: [root], operations: OPS,
      effectPolicy, irreversibleTerm: SHAPE.derivedFrom.irreversible, now: () => 1_000, redactText: (text: string) => text,
      fallback: async () => ({ result: 'text-only' }),
      scratch: (turn: string) => { mkdirSync(join(turn, 'vol'), { mode: 0o700 }); return realpathSync(join(turn, 'vol')); }, detach: () => true,
      // The harness's side of the turn: each call goes through the real executable hook exactly as Claude Code runs it.
      invoke: async (turn: { workspace: string; stateDirectory: string }) => {
        const config = JSON.parse(readFileSync(join(turn.stateDirectory, 'config.json'), 'utf8'));
        expect(config.irreversibleTerm).toEqual(SHAPE.derivedFrom.irreversible);
        const write = { tool_name: 'Write', tool_input: { file_path: join(turn.workspace, 'note.txt'), content: 'hello doorway' }, tool_use_id: 'w' };
        expect((await runHookAsync(turn.stateDirectory, write)).stdout).toBe('');
        writeFileSync(join(turn.workspace, 'note.txt'), 'hello doorway');
        expect((await runHookAsync(turn.stateDirectory, { ...write, tool_response: 'created' }, 'post')).status).toBe(0);
        const effect = { ...consequential, tool_use_id: 'c' };
        const r = await runHookAsync(turn.stateDirectory, effect);
        if (!/"permissionDecision":"deny"/u.test(r.stdout)) await runHookAsync(turn.stateDirectory, { ...effect, tool_response: 'ok' }, 'post');
        return 'answer';
      } });
    expect(outcome.result).toBe('answer');
    return journal;
  };
  // Default policy (nothing outward): the unsandboxed shell reaches the doorway and is refused.
  const refused = await turnOnce(DEFAULT_EFFECT_POLICY, { tool_name: 'Bash', tool_input: { command: 'echo outside', dangerouslyDisableSandbox: true } });
  const trace = refused.view.toolTurns;
  expect(trace).toMatchObject({ toolCalls: 1, toolRefusals: 1, inconsistent: 0, open: [] });
  expect(refused.view.effectDoorway).toMatchObject({ proposed: 1, ordinary: 0, granted: 0, closedSet: 0, refused: 1 });
  const decision = refused.view.effectDoorway!.recent[0]!;
  expect(decision).toMatchObject({ turn: id, attempt: 0, n: 2, effect: 'tool:unsandboxed', disposition: 'refused',
    tests: { irreversible: true, resources: true, scope: true, policySensitive: false } });
  // The refusal rides below this answer as one notice the journal accepts, and only on this turn's answer.
  const notices = refusedEffectNotices(refused.view.effectDoorway!.recent, id);
  expect(notices).toHaveLength(1);
  expect(notices[0].line).toMatch(/^Effect doorway: a tool:unsandboxed step was refused, because durability; role; sign-off/u);
  expect(notices[0].line).toMatch(/What would admit it: a second enrolled machine/u);
  expect(validAnswerNotices([notices[0]], `answer\n\n${notices[0].line}`)).toBe(true);
  expect(openReplyNotices([], notices, id)).toHaveLength(1);
  expect(refusedEffectNotices(refused.view.effectDoorway!.recent, 'telegram:12345678:update:22')).toEqual([]);
  // Status reports the doorway's decisions.
  const status = effectDoorwayStatusLines(refused.view.effectDoorway).join('\n');
  expect(status).toMatch(/1 effect\(s\) reached it from tool turns \(0 ordinary, 0 admitted under an operator grant, 0 admitted in the accepted closed set, 1 refused\)/u);
  expect(status).toMatch(/refused: tool:unsandboxed — tests held: irreversible, resources, scope\./u);
  // Replay reaches the same projection.
  expect(open(lastRoot).view.effectDoorway).toEqual(refused.view.effectDoorway);
  // The other side: a web read the operator's policy registers reaches the doorway (w4-toolsfull makes an unnamed public web
  // read ordinary without it), and under a recorded scope grant for that host it is admitted as ordinary. A literal public
  // address keeps the hook's own name resolution out of the test. The runner passes the policy it decoded
  // (journal-agent.mjs effectPolicyOf), which the hook decodes again.
  const admitted = await turnOnce(policy({ grants: [grant({ target: '93.184.215.14' })], registered: [{ effect: 'tool:network',
    target: '93.184.215.14', consequence: 'external', reversibility: 'reversible', reach: 'world', costUsd: 0, source: 'telegram:102965:121996' }] }),
    { tool_name: 'WebFetch', tool_input: { url: 'https://93.184.215.14/', prompt: 'title' } });
  expect(admitted.view.toolTurns).toMatchObject({ toolCalls: 2, toolRefusals: 0, inconsistent: 0 });
  expect(admitted.view.effectDoorway).toMatchObject({ proposed: 1, ordinary: 1, refused: 0 });
  expect(refusedEffectNotices(admitted.view.effectDoorway!.recent, id)).toEqual([]);
  // A doorway decision the journal cannot account for (an admitted call carrying a refusal) is refused at the row.
  expect(() => refused.append({ kind: 'tool-turn', phase: 'reserved', id: 'telegram:12345678:update:30', attempt: 1, calls: 1, at: 2_000 } as never)).not.toThrow();
  expect(() => refused.append({ kind: 'tool-turn', phase: 'trace', id: 'telegram:12345678:update:30', attempt: 1, consistent: true, workspaceBytes: 0,
    at: 2_001, calls: [{ n: 1, tool: 'WebFetch', input: '{}', decision: 'allow', reason: 'r', kind: 'network', result: null,
      doorway: { effect: 'tool:network', tests: { irreversible: false, resources: false, scope: true, policySensitive: false }, disposition: 'refused' } }] } as never))
    .toThrow(/effect doorway decision/u);
});

async function refusalWorker(reply: string) {
  const { createJournalWorker, openPreviewJournal: openWorkerJournal } = await import('./journal-test-worker.js');
  const root = dir('effect-worker-'), sent: string[] = [];
  const journal = openWorkerJournal(join(root, 'journal.encrypted'), new Uint8Array(32).fill(9), { kind: 'genesis', bot: '12345678', chat: '7654321',
    operator: '7654321', grant: 'grant:preview', configurationDigest: 'sha256:offline', expires: 9_999_999_999_999, maxCalls: 400,
    maxReplies: 200, maxTurns: 200, maxBytes: 8000, cursor: 0 });
  const T0 = 1_790_000_000_000;
  let firstToolTurn = true;
  const worker = createJournalWorker(journal, { now: () => T0, stopped: () => false, timeZone: 'UTC', prepareModel: input => input.context,
    // The same notice source journal-agent.mjs installs: this turn's refused effects ride first.
    replyNotices: (turn?: string) => turn === undefined ? [] : refusedEffectNotices(journal.view.effectDoorway?.recent ?? [], turn),
    model: async input => {
      if (input.id.startsWith('summary:')) return JSON.stringify({ summary: 'Small talk.', people: [], commitments: [], closed: [] });
      if (firstToolTurn) {
        firstToolTurn = false;
        // The tool turn inside this answer's model call, as runToolTurn journals it: the hook's real decision on the live call.
        const verdict = admitEffect({ effect: 'tool:unsandboxed' }, DEFAULT_EFFECT_POLICY, OPS);
        journal.append({ kind: 'tool-turn', phase: 'reserved', id: input.id, attempt: 0, calls: 1, at: T0 });
        journal.append({ kind: 'tool-turn', phase: 'trace', id: input.id, attempt: 0, consistent: true, workspaceBytes: 0, at: T0,
          calls: [{ n: 1, tool: 'Bash', input: '{"dangerouslyDisableSandbox":true}', decision: 'deny', reason: verdict.reason, kind: 'unsandboxed',
            doorway: { effect: verdict.effect, tests: verdict.tests, disposition: verdict.disposition, admits: verdict.admits }, result: null }] });
      }
      return JSON.stringify({ reply, memory: [] });
    },
    send: async input => { sent.push(input.text); return sent.length; }, checkOutbound: () => {} });
  let next = 1;
  const say = async (text: string) => {
    worker.intake([{ update_id: next++, message: { chat: { id: 7654321, type: 'private' }, from: { id: 7654321 }, text, date: Math.floor(T0 / 1000) } }]);
    await worker.drain();
  };
  return { journal, sent, say };
}

it('the worker carries this answer\'s own refused effect below it, once, and status counts it (journal-agent replyNotices wiring)', async () => {
  const { journal, sent, say } = await refusalWorker('I could not run that step.');
  await say('Run echo outside-sandbox without the sandbox.');
  expect(sent).toHaveLength(1);
  expect(sent[0]).toMatch(/I could not run that step\.\n\nEffect doorway: a tool:unsandboxed step was refused, because it cannot be undone by the agent alone/u);
  expect(journal.view.effectDoorway).toMatchObject({ proposed: 1, refused: 1 });
  // The next answer, with no refusal of its own, carries nothing from the earlier turn.
  await say('Thanks.');
  expect(sent).toHaveLength(2);
  expect(sent[1]).not.toContain('Effect doorway');
});

it('a long answer is shortened to keep its own refused effect in the one send (Part Twelve §3, Rule 42)', async () => {
  const { journal, sent, say } = await refusalWorker(`Here is the answer. ${'x'.repeat(3300)}`);
  await say('Run echo outside-sandbox without the sandbox.');
  expect(sent).toHaveLength(1);
  expect(sent[0]).toMatch(/^Here is the answer\. x+…\n\nEffect doorway: a tool:unsandboxed step was refused/u);
  expect(journal.view.effectDoorway).toMatchObject({ proposed: 1, refused: 1 });
  // A long answer with no refusal of its own is sent whole, with nothing appended.
  await say('Thanks.');
  expect(sent).toHaveLength(2);
  expect(sent[1]).not.toContain('Effect doorway');
  expect(sent[1]).not.toContain('…');
});
