// Rule 115, the native tool rule (Part Thirteen §9 in docs/17-harness-adapters): Instar's own agent loop. Each step is a model
// call (a stub here, real in tests/integration/native-loop-live.test.ts); every proposed call goes through the SAME admission
// hook executable, call slots and record a harness tool turn uses; admitted calls run inside the turn's workspace and the shell
// runs under the sandbox; the loop runs as runToolTurn's invoke, so the call reservation, journaled trace and consistency check
// are the tool turn's own. Both sides of each decision: admitted and refused calls, an answer and a request, the step cap and
// one step short of it, a stop, a failed step, and the shell's boundary. Recorded real model outputs replay through the step
// parser (Rule 106 / observer #106).
import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { openPreviewJournal } from './journal.js';
import { NATIVE_TOOL_LIMITS, NATIVE_TOOL_NAMES, SUBSCRIPTION_CONVERSATION_SYSTEM_PROMPT, SUBSCRIPTION_NATIVE_FRAMING,
  SUBSCRIPTION_NATIVE_SYSTEM_PROMPT, SUBSCRIPTION_TOOL_LIMITS, subscriptionConversationPolicy, subscriptionNativePolicy,
  subscriptionPolicyFor } from '../../src/assembly/production-provider.js';
import { SINGLE_MACHINE_PROFILE } from './activation-authority.js';
import { encoded } from './canonical.js';
import { conclusionText, parseModelJson } from './model-json.js';
// @ts-expect-error The runner side stays plain JavaScript.
import { prepareToolTurn, readToolTrace, runToolTurn } from './tool-turn.mjs';
// @ts-expect-error The runner side stays plain JavaScript.
import { NATIVE_STEPS_ROLE, nativeShellProfile, nativeStepEnvelope, parseNativeStep, runHook, runNativeLoop } from './native-loop.mjs';

const key = new Uint8Array(32).fill(9);
const roots: string[] = [];
afterEach(() => roots.splice(0).forEach(root => rmSync(root, { recursive: true, force: true })));
const dir = () => { const root = realpathSync(mkdtempSync(join(tmpdir(), 'native-loop-'))); roots.push(root); return root; };
/** The scratch volume's stand-in where the test root sits on the RAM disk; the live test uses the real volume. */
const plainScratch = (turn: string) => { mkdirSync(join(turn, 'vol'), { mode: 0o700 }); return realpathSync(join(turn, 'vol')); };
const keepDetached = () => true;
const journalAt = (root: string, maxCalls = 40) => openPreviewJournal(join(root, 'journal.encrypted'), key, { kind: 'genesis',
  bot: '12345678', chat: '7654321', operator: '7654321', grant: 'grant:preview', configurationDigest: 'sha256:offline',
  expires: 9_999_999_999_999, maxCalls, maxReplies: 10, maxTurns: 10, maxBytes: 32768, cursor: 0 });
const PREPARED = JSON.stringify({ provider: 'anthropic', model: 'claude-sonnet-5', messages: [{ role: 'user', content: 'make a note' },
  { role: 'context', content: '{}' }] });
type Step = { state: string; value?: string; failureClass?: string };
const answer = (value: string): Step => ({ state: 'complete', value });
const ask = (...calls: Array<[string, Record<string, unknown>]>): Step =>
  answer(JSON.stringify({ calls: calls.map(([tool, input]) => ({ tool, input })) }));
const admission = (stateDirectory: string) => readFileSync(join(stateDirectory, 'admission.jsonl'), 'utf8').trim().split('\n')
  .map(line => JSON.parse(line));

/** One native turn through runToolTurn: the scripted steps answer in order; returns what the loop, journal and hook recorded. */
async function nativeTurn(script: Step[] | ((envelope: string, index: number) => Step | Promise<Step>), options: {
  operations?: readonly string[]; maxSteps?: number; stopped?: () => boolean; setup?: (workspace: string) => void;
  fetch?: typeof fetch; maxCalls?: number } = {}) {
  const root = dir(), journal = journalAt(root, options.maxCalls), id = 'telegram:12345678:update:7';
  const envelopes: string[] = [];
  let stateDirectory = '', workspace = '';
  const outcome = await runToolTurn({ journal, root, id, prepared: PREPARED, promptLimit: 32768, deniedRoots: [root],
    operations: options.operations ?? SINGLE_MACHINE_PROFILE.operations, now: () => 1, redactText: (text: string) => text,
    fallback: async () => ({ result: 'fallback' }), scratch: plainScratch, detach: keepDetached,
    invoke: async (turn: { stateDirectory: string; workspace: string }) => {
      stateDirectory = turn.stateDirectory; workspace = turn.workspace;
      options.setup?.(turn.workspace);
      return runNativeLoop({ turn, prepared: PREPARED, promptLimit: 32768, stopped: options.stopped ?? (() => false),
        maxSteps: options.maxSteps, fetch: options.fetch,
        step: async (envelope: string, index: number) => {
          envelopes.push(envelope);
          return typeof script === 'function' ? script(envelope, index) : script[index] ?? answer('done');
        } });
    } });
  return { outcome, journal, envelopes, stateDirectory, workspace, root };
}

describe('the native framing', () => {
  it('is its own policy: text-only single-turn calls, a distinct digest, and a system prompt naming the native tools', () => {
    const native = subscriptionNativePolicy('claude-sonnet-5'), conversation = subscriptionConversationPolicy('claude-sonnet-5');
    expect(native.framing).toBe(SUBSCRIPTION_NATIVE_FRAMING);
    expect(encoded(native).hash).not.toBe(encoded(conversation).hash);
    // Same text-only shape: no harness tools, one turn, safe mode, no MCP servers.
    for (const flag of ['--safe-mode', '--max-turns', '--strict-mcp-config']) expect(native.args).toContain(flag);
    expect(native.args[native.args.indexOf('--tools') + 1]).toBe('');
    expect(native.args[native.args.indexOf('--max-turns') + 1]).toBe('1');
    expect(native.args[native.args.indexOf('--system-prompt') + 1]).toBe(SUBSCRIPTION_NATIVE_SYSTEM_PROMPT);
    expect(SUBSCRIPTION_NATIVE_SYSTEM_PROMPT).not.toBe(SUBSCRIPTION_CONVERSATION_SYSTEM_PROMPT);
    expect(SUBSCRIPTION_NATIVE_SYSTEM_PROMPT).not.toContain('You have no tools');
    for (const tool of NATIVE_TOOL_NAMES) expect(SUBSCRIPTION_NATIVE_SYSTEM_PROMPT).toContain(`${tool} {`);
    expect(SUBSCRIPTION_NATIVE_SYSTEM_PROMPT).toContain(`role:${NATIVE_STEPS_ROLE}`);
    expect(subscriptionPolicyFor('claude-sonnet-5', SUBSCRIPTION_NATIVE_FRAMING).system).toBe(SUBSCRIPTION_NATIVE_SYSTEM_PROMPT);
    // The step cap is exactly the liability a tool turn reserves.
    expect(NATIVE_TOOL_LIMITS.maxSteps).toBe(SUBSCRIPTION_TOOL_LIMITS.maxTurns);
    expect(Buffer.byteLength(SUBSCRIPTION_NATIVE_SYSTEM_PROMPT) + 16384).toBeLessThan(native.maxPromptBytes);
  });
});

describe('the step parser', () => {
  it('reads a tool request only from an object with calls and no reply; everything else concluded is the answer', () => {
    expect(parseNativeStep('{"calls":[{"tool":"Write","input":{"file_path":"a","content":"b"}}]}'))
      .toEqual({ kind: 'calls', calls: [{ tool: 'Write', input: { file_path: 'a', content: 'b' } }] });
    expect(parseNativeStep('```json\n{"calls":[{"tool":"Bash","input":{"command":"ls"}}]}\n```').kind).toBe('calls');
    expect(parseNativeStep('The count is 11.')).toEqual({ kind: 'answer' });
    expect(parseNativeStep('{"reply":"Done","calls":[{"tool":"Bash","input":{}}]}')).toEqual({ kind: 'answer' });
    expect(parseNativeStep('{"reply":"Done","directives":[]}')).toEqual({ kind: 'answer' });
    expect(parseNativeStep('{"calls":[]}').kind).toBe('malformed');
    expect(parseNativeStep('{"calls":[{"tool":"Bash","input":"ls"}]}').kind).toBe('malformed');
    expect(parseNativeStep(JSON.stringify({ calls: Array.from({ length: NATIVE_TOOL_LIMITS.maxCallsPerStep + 1 }, () => ({ tool: 'Glob', input: {} })) })).kind)
      .toBe('malformed');
    expect(parseNativeStep(JSON.stringify({ calls: Array.from({ length: NATIVE_TOOL_LIMITS.maxCallsPerStep }, () => ({ tool: 'Glob', input: {} })) })).kind)
      .toBe('calls');
    expect(parseNativeStep('')).toEqual({ kind: 'empty' });
    expect(parseNativeStep('   ')).toEqual({ kind: 'empty' });
  });

  it('replays recorded real model outputs: answers stay answers, and nothing recorded reads as a tool request', () => {
    // live-declarations-2026-09-28: raw claude-sonnet-5 Decision bytes (string and object answers); tool-turn live-2026-10-03:
    // real tool-turn answers; proofroom cascade 2026-09-30: real delivered answers and real uncertain summary outcomes.
    const declarations = JSON.parse(readFileSync(join(__dirname, 'fixtures/live-declarations-2026-09-28.json'), 'utf8'));
    const raws: string[] = [...declarations.current.answers, ...declarations.fixed.answers];
    const concluded = raws.map(raw => { const parsed = parseModelJson(raw, { wrapped: 'accept' });
      return parsed.ok ? conclusionText((parsed.value as { conclusion: { value: unknown } }).conclusion.value as never) : null; });
    expect(concluded.length).toBeGreaterThanOrEqual(8);
    expect(concluded.some(text => typeof text === 'string' && text.startsWith('{"reply"'))).toBe(true);
    for (const text of concluded) expect(parseNativeStep(text).kind).toBe('answer');
    for (const name of ['task', 'scope', 'r6-fixed', 'call-cap']) {
      const record = JSON.parse(readFileSync(join(__dirname, `fixtures/tool-turn/live-2026-10-03/${name}.json`), 'utf8'));
      expect(parseNativeStep(record.answer).kind).toBe('answer');
    }
    const cascade = JSON.parse(readFileSync(join(__dirname, 'fixtures/proofroom-summary-cascade-stall-2026-09-30.json'), 'utf8'));
    const delivered = cascade.rows.filter((row: { kind: string }) => row.kind === 'answer').map((row: { text: string }) => row.text);
    expect(delivered.length).toBeGreaterThan(10);
    for (const text of delivered) expect(parseNativeStep(text).kind).toBe('answer');
    const uncertain = cascade.rows.filter((row: { state?: string }) => row.state === 'uncertain');
    expect(uncertain.length).toBeGreaterThan(5);
  });

  it('a recorded uncertain or empty step ends the loop with that outcome unchanged, running nothing', async () => {
    const cascade = JSON.parse(readFileSync(join(__dirname, 'fixtures/proofroom-summary-cascade-stall-2026-09-30.json'), 'utf8'));
    const uncertain = cascade.rows.find((row: { state?: string }) => row.state === 'uncertain');
    const failed = await nativeTurn([{ state: uncertain.state }]);
    expect(failed.outcome.result).toMatchObject({ state: 'uncertain', native: { models: 1, steps: 0, calls: 0, ended: 'step-failed' } });
    const empty = await nativeTurn([answer('')]);
    expect(empty.outcome.result).toMatchObject({ state: 'complete', failureClass: 'empty', native: { ended: 'step-failed' } });
    expect(existsSync(join(empty.stateDirectory, 'admission.jsonl'))).toBe(false);
  });
});

describe('the loop', () => {
  it('creates a file, runs a command and answers with the value; every call admitted by the hook and journaled', async () => {
    const run = await nativeTurn([
      ask(['Write', { file_path: 'note.txt', content: 'hello tools' }]),
      ask(['Bash', { command: 'wc -c note.txt' }], ['Read', { file_path: 'note.txt' }]),
      answer('note.txt holds 11 bytes (step 2, call 1: wc -c).')]);
    const result = run.outcome.result;
    expect(result).toMatchObject({ state: 'complete', value: 'note.txt holds 11 bytes (step 2, call 1: wc -c).',
      native: { models: 3, steps: 2, calls: 3, ended: 'answered' } });
    expect(readFileSync(join(run.workspace, 'note.txt'), 'utf8')).toBe('hello tools');
    const rows = admission(run.stateDirectory);
    expect(rows.filter(row => row.phase === 'pre').map(row => [row.tool, row.decision, row.n])).toEqual([['Write', 'allow', 1], ['Bash', 'allow', 2], ['Read', 'allow', 3]]);
    const bash = rows.find(row => row.phase === 'post' && row.tool === 'Bash');
    expect(JSON.parse(bash.result)).toMatchObject({ exitCode: 0 });
    expect(JSON.parse(bash.result).stdout).toMatch(/^\s*11 note\.txt/u);
    // The second step saw the first step's call, decision and result as quoted data.
    const second = JSON.parse(run.envelopes[1]!).messages.at(-1);
    expect(second.role).toBe(NATIVE_STEPS_ROLE);
    expect(JSON.parse(second.content)).toMatchObject({ remaining: { steps: NATIVE_TOOL_LIMITS.maxSteps - 2 },
      steps: [{ step: 1, calls: [{ tool: 'Write', decision: 'allow' }] }] });
    // runToolTurn's own accounting: one reserved turn, the trace journaled, consistent.
    expect(run.journal.view.toolTurns).toMatchObject({ invocations: 1, toolCalls: 3, toolRefusals: 0, inconsistent: 0, open: [] });
    expect(run.journal.view.calls).toBe(SUBSCRIPTION_TOOL_LIMITS.maxTurns - 1);
    expect(readToolTrace(run.stateDirectory)).toMatchObject({ consistent: true, admitted: 3, refused: 0 });
  });

  it('refuses a path outside the workspace and an unregistered effect, and reports each refusal to the next step', async () => {
    const outside = dir(); writeFileSync(join(outside, 'secret.txt'), 'CANARY-NATIVE-0001');
    const run = await nativeTurn([
      ask(['Read', { file_path: join(outside, 'secret.txt') }], ['Write', { file_path: '../escape.txt', content: 'x' }],
        ['WebFetch', { url: 'https://example.com' }], ['NotebookEdit', { notebook_path: 'a' }], ['Glob', { pattern: '/etc/*' }]),
      answer('All refused.')]);
    const rows = admission(run.stateDirectory).filter(row => row.phase === 'pre');
    expect(rows.map(row => [row.tool, row.decision])).toEqual([['Read', 'deny'], ['Write', 'deny'], ['WebFetch', 'deny'],
      ['NotebookEdit', 'deny'], ['Glob', 'deny']]);
    expect(rows[2].reason).toMatch(/effect doorway: the installed profile registers no tool:network operation/u);
    expect(admission(run.stateDirectory).some(row => row.phase === 'post')).toBe(false);
    expect(JSON.stringify(run.envelopes)).not.toContain('CANARY-NATIVE-0001');
    expect(JSON.parse(JSON.parse(run.envelopes[1]!).messages.at(-1).content).steps[0].calls.map((call: { decision: string }) => call.decision))
      .toEqual(['deny', 'deny', 'deny', 'deny', 'deny']);
    expect(run.outcome.result.native).toEqual({ models: 2, steps: 1, calls: 0, ended: 'answered' });
  });

  it('runs WebFetch only when the installed profile registers it, as one GET whose redirect is reported, never followed', async () => {
    const seen: Array<[string, RequestInit | undefined]> = [];
    const fake = (async (url: string, init?: RequestInit) => { seen.push([url, init]);
      return new Response('moved', { status: 302, headers: { location: 'http://127.0.0.1:4042/health' } }); }) as unknown as typeof fetch;
    const run = await nativeTurn([ask(['WebFetch', { url: 'https://example.com/page' }]), answer('redirected')],
      { operations: [...SINGLE_MACHINE_PROFILE.operations, 'tool:network'], fetch: fake });
    expect(seen).toHaveLength(1);
    expect(seen[0]![0]).toBe('https://example.com/page');
    expect(seen[0]![1]).toMatchObject({ method: 'GET', redirect: 'manual' });
    const post = admission(run.stateDirectory).find(row => row.phase === 'post');
    expect(JSON.parse(post.result)).toMatchObject({ status: 302, location: 'http://127.0.0.1:4042/health' });
  });

  it('edits, globs and greps inside the workspace, and never lists through a link that leaves it', async () => {
    const outside = dir(); writeFileSync(join(outside, 'hidden-name.txt'), 'x');
    const run = await nativeTurn([
      ask(['Write', { file_path: 'src/a.txt', content: 'alpha one\nbeta two\n' }], ['Edit', { file_path: 'src/a.txt', old_string: 'beta', new_string: 'gamma' }],
        ['Bash', { command: `ln -s ${outside} out` }], ['Glob', { pattern: '**/*.txt' }], ['Glob', { pattern: 'out/*' }],
        ['Grep', { pattern: 'gamma', output_mode: 'content' }], ['Edit', { file_path: 'src/a.txt', old_string: 'missing', new_string: 'x' }]),
      answer('ok')]);
    expect(readFileSync(join(run.workspace, 'src/a.txt'), 'utf8')).toBe('alpha one\ngamma two\n');
    const posts = admission(run.stateDirectory).filter(row => row.phase === 'post').map(row => JSON.parse(row.result));
    expect(posts[3]).toEqual({ files: ['src/a.txt'] });
    expect(posts[4]).toEqual({ files: [] });
    expect(posts[5].matches).toBe('src/a.txt:2:gamma two');
    expect(posts[6]).toEqual({ error: 'old_string not found' });
    expect(JSON.stringify(run.envelopes)).not.toContain('hidden-name');
  });

  it('a malformed request costs a step and is reported; the answer after it is the result', async () => {
    const run = await nativeTurn([answer('{"calls":[]}'), answer('Recovered.')]);
    expect(run.outcome.result).toMatchObject({ value: 'Recovered.', native: { models: 2, steps: 1, calls: 0, ended: 'answered' } });
    expect(JSON.parse(JSON.parse(run.envelopes[1]!).messages.at(-1).content).steps[0].calls[0]).toMatchObject({ tool: null, decision: 'deny' });
  });

  it('stops at the step cap without running the last request, and answers one step short of it', async () => {
    const forever = () => ask(['Bash', { command: 'echo again' }]);
    const capped = await nativeTurn(forever, { maxSteps: 3 });
    expect(capped.envelopes).toHaveLength(3);
    expect(capped.outcome.result).toMatchObject({ failureClass: 'step-cap', native: { models: 3, steps: 3, calls: 2, ended: 'step-cap' } });
    expect(admission(capped.stateDirectory).filter(row => row.phase === 'pre')).toHaveLength(2);
    expect(JSON.parse(JSON.parse(capped.envelopes[2]!).messages.at(-1).content).remaining).toEqual({ steps: 0 });
    const neighbour = await nativeTurn((_envelope, index) => index < 2 ? forever() : answer('done at the last step'), { maxSteps: 3 });
    expect(neighbour.outcome.result).toMatchObject({ value: 'done at the last step', native: { ended: 'answered' } });
  });

  it('holds the per-turn tool-call cap through the hook\'s slots across steps', async () => {
    const eight = ask(...Array.from({ length: 8 }, (_, i) => ['Bash', { command: `echo ${String(i)}` }] as [string, Record<string, unknown>]));
    const run = await nativeTurn([eight, eight, eight, answer('capped')]);
    const pre = admission(run.stateDirectory).filter(row => row.phase === 'pre');
    expect(pre.filter(row => row.decision === 'allow')).toHaveLength(SUBSCRIPTION_TOOL_LIMITS.maxToolCalls);
    expect(pre.filter(row => row.decision === 'deny').every(row => /per-step call cap 16 reached/u.test(row.reason))).toBe(true);
    expect(pre).toHaveLength(24);
  });

  it('ends on the operator\'s stop: a running command is killed by its own process group, and no further step runs', async () => {
    let stop = false;
    const started = performance.now();
    const run = await nativeTurn((_envelope, index) => { if (index === 0) setTimeout(() => { stop = true; }, 300); return ask(['Bash', { command: 'sleep 30; echo late' }]); },
      { stopped: () => stop });
    expect(performance.now() - started).toBeLessThan(5000);
    expect(run.envelopes).toHaveLength(1);
    expect(run.outcome.result).toMatchObject({ state: 'uncertain', native: { ended: 'stopped' } });
    const post = admission(run.stateDirectory).find(row => row.phase === 'post');
    expect(JSON.parse(post.result)).toMatchObject({ interrupted: 'stopped' });
    expect(JSON.parse(post.result).stdout).not.toContain('late');
  });

  it('a hook that cannot decide refuses the call (fail closed)', async () => {
    const root = dir();
    const turn = prepareToolTurn({ root, operation: 'telegram:1:update:2', attempt: 0, operations: [], scratch: plainScratch });
    rmSync(join(turn.stateDirectory, 'config.json'));
    expect(await runHook(turn.hook, turn.stateDirectory, 'pre', { tool_name: 'Read', tool_input: { file_path: 'a' }, tool_use_id: 'x' }))
      .toMatchObject({ decision: 'deny' });
  });
});

describe('the shell boundary', () => {
  it('builds the sandbox from the harness sandbox inputs and refuses an unsafe or overlapping scratch path', () => {
    const profile = nativeShellProfile('/private/tmp/itt-abc');
    expect(profile).toContain('(deny default)');
    expect(profile).toContain('(deny network*)');
    expect(profile).toContain('(allow file-write* (subpath "/private/tmp/itt-abc")');
    expect(profile).toContain('(subpath "/usr/bin")');
    expect(() => nativeShellProfile('/private/tmp/a b')).toThrow(/absolute and plain/u);
    expect(() => nativeShellProfile('/usr/share/x')).toThrow(/overlaps/u);
  });

  it('a sandboxed command reads and writes only its scratch volume, reaches no network and signals nothing outside', async () => {
    const outside = dir(); writeFileSync(join(outside, 'canary.txt'), 'CANARY-NATIVE-0002');
    const script = ['echo "env: $(env | grep -c CLAUDE_CODE_)"', `echo "outside-read: $(cat ${join(outside, 'canary.txt')} 2>&1)"`,
      `echo "outside-write: $( (echo x > ${join(outside, 'w.txt')}) 2>&1)"`,
      'echo "network: $(curl -s -m 5 -o /dev/null -w "%{http_code}" http://127.0.0.1:9 2>&1) exit=$?"',
      `echo "signal: $(kill -0 ${String(process.pid)} 2>&1)"`, 'echo "own-tmp: $( (echo t > "$TMPDIR/t" && echo ok) 2>&1)"',
      'echo "home-read: $(ls ~ 2>&1 | head -1)"'].join('\n');
    const run = await nativeTurn([ask(['Write', { file_path: 'check.sh', content: script }], ['Bash', { command: 'sh check.sh' }]), answer('checked')]);
    const out = JSON.parse(admission(run.stateDirectory).filter(row => row.phase === 'post')[1].result).stdout as string;
    expect(out).toContain('env: 0');
    expect(out).toMatch(/outside-read: .*Operation not permitted/u);
    expect(out).not.toContain('CANARY-NATIVE-0002');
    expect(out).toMatch(/outside-write: .*Operation not permitted/u);
    expect(existsSync(join(outside, 'w.txt'))).toBe(false);
    expect(out).not.toMatch(/network: [1-5][0-9][0-9] /u);
    expect(out).toMatch(/signal: .*Operation not permitted/u);
    expect(out).toContain('own-tmp: ok');
  });
});
