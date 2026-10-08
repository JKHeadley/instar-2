// Rule 115, the native tool rule (Part Thirteen §9 in docs/17-harness-adapters): Instar's own agent loop. Each step is a model
// call (a stub here, real in tests/integration/native-loop-live.test.ts); every proposed call goes through the SAME admission
// hook executable, call slots and record a harness tool turn uses; admitted calls run inside the turn's workspace and the shell
// runs under the sandbox; the loop runs as runToolTurn's invoke, so the call reservation, journaled trace and consistency check
// are the tool turn's own. Both sides of each decision: admitted and refused calls, an answer and a request, the step cap and
// one step short of it, a stop, a failed step, and the tools' boundary: a path swapped into a link after admission, a blocking
// read under a stop, a stopped fetch and a bounded body, and the resource owner's memory and process ceilings. Recorded real model outputs replay through the step
// parser (Rule 106 / observer #106).
import { execFileSync, spawn } from 'node:child_process';
import { once } from 'node:events';
import { existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
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
import { NATIVE_EXECUTION, NATIVE_STEPS_ROLE, nativeShellProfile, nativeStepEnvelope, parseNativeStep, runHook, runNativeLoop } from './native-loop.mjs';
// @ts-expect-error Physical host JavaScript stays outside pure core.
import { createResourceOwner, RESOURCE_CEILINGS } from '../../scripts/resource-owner.mjs';

type Owner = { execute: (input: unknown, work?: string) => Promise<unknown>; attach: (options: object) => Promise<unknown> };
let owner: Owner;
// RLIMIT_NPROC counts the whole user ID: other gate workers can consume the 32 slots between
// census and fork. Match resource-owner.test.ts's finite fixture allowance for non-cap tests.
// The dedicated memory/process-ceiling cases below still construct their own tight owners.
const fixtureCeilings = { ...RESOURCE_CEILINGS, launch: { ...RESOURCE_CEILINGS.launch, processCount: 256 } };
beforeAll(async () => { owner = createResourceOwner(fixtureCeilings); await owner.attach({}); });

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
  operations?: readonly string[]; effectPolicy?: object; maxSteps?: number; stopped?: () => boolean; setup?: (workspace: string) => void;
  fetch?: typeof fetch; maxCalls?: number; resources?: Owner; hook?: (turn: { hook: { node: string; script: string }; workspace: string }) => { node: string; script: string } } = {}) {
  const root = dir(), journal = journalAt(root, options.maxCalls), id = 'telegram:12345678:update:7';
  const envelopes: string[] = [];
  let stateDirectory = '', workspace = '';
  const outcome = await runToolTurn({ journal, root, id, prepared: PREPARED, promptLimit: 32768, deniedRoots: [root],
    operations: options.operations ?? SINGLE_MACHINE_PROFILE.operations, ...(options.effectPolicy ? { effectPolicy: options.effectPolicy } : {}), now: () => 1, redactText: (text: string) => text,
    fallback: async () => ({ result: 'fallback' }), scratch: plainScratch, detach: keepDetached,
    invoke: async (turn: { stateDirectory: string; workspace: string; hook: { node: string; script: string } }) => {
      stateDirectory = turn.stateDirectory; workspace = turn.workspace;
      options.setup?.(turn.workspace);
      return runNativeLoop({ turn: options.hook ? { ...turn, hook: options.hook(turn) } : turn, prepared: PREPARED, promptLimit: 32768,
        stopped: options.stopped ?? (() => false), maxSteps: options.maxSteps, fetch: options.fetch, resources: options.resources ?? owner,
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
    // The tool turn's whole liability (cint-L44: w4-toolsfull reserves its subagent budget for every tool turn; the native loop
    // starts no subagent, so the reservation is conservative, never short).
    expect(run.journal.view.calls).toBe(SUBSCRIPTION_TOOL_LIMITS.maxTurns - 1 + SUBSCRIPTION_TOOL_LIMITS.maxChildren * SUBSCRIPTION_TOOL_LIMITS.childMaxTurns);
    expect(readToolTrace(run.stateDirectory)).toMatchObject({ consistent: true, admitted: 3, refused: 0 });
  });

  it('refuses a path outside the workspace and a consequential effect, and reports each refusal to the next step', async () => {
    const outside = dir(); writeFileSync(join(outside, 'secret.txt'), 'CANARY-NATIVE-0001');
    const run = await nativeTurn([
      ask(['Read', { file_path: join(outside, 'secret.txt') }], ['Write', { file_path: '../escape.txt', content: 'x' }],
        ['Bash', { command: 'true', dangerouslyDisableSandbox: true }], ['Glob', { pattern: '/etc/*' }]),
      answer('All refused.')]);
    const rows = admission(run.stateDirectory).filter(row => row.phase === 'pre');
    expect(rows.map(row => [row.tool, row.decision])).toEqual([['Read', 'deny'], ['Write', 'deny'], ['Bash', 'deny'], ['Glob', 'deny']]);
    // cint-L44: the hook is cint-L43's, so an unsandboxed command meets the effect doorway's four tests and is refused.
    expect(rows[2].reason).toMatch(/effect doorway refused tool:unsandboxed/u);
    expect(admission(run.stateDirectory).some(row => row.phase === 'post')).toBe(false);
    expect(JSON.stringify(run.envelopes)).not.toContain('CANARY-NATIVE-0001');
    expect(JSON.parse(JSON.parse(run.envelopes[1]!).messages.at(-1).content).steps[0].calls.map((call: { decision: string }) => call.decision))
      .toEqual(['deny', 'deny', 'deny', 'deny']);
    expect(run.outcome.result.native).toEqual({ models: 2, steps: 1, calls: 0, ended: 'answered', unresolved: [] });
    // A tool the hook admits as ordinary work but the native loop has no executor for (w4-toolsfull admits NotebookEdit in the
    // workspace) is reported to the model as an error result, recorded by the hook's post phase; nothing runs.
    const other = await nativeTurn([ask(['NotebookEdit', { notebook_path: 'a.ipynb', new_source: 'x' }]), answer('no notebook tool')]);
    const pre = admission(other.stateDirectory).filter(row => row.phase === 'pre');
    expect(pre.map(row => [row.tool, row.decision])).toEqual([['NotebookEdit', 'allow']]);
    expect(JSON.parse(admission(other.stateDirectory).find(row => row.phase === 'post').result)).toEqual({ error: 'no native executor for NotebookEdit' });
    expect(existsSync(join(other.workspace, 'a.ipynb'))).toBe(false);
  });

  it('runs a web read of a public host as one GET whose redirect is reported, never followed; a host the policy marks is the doorway\'s', async () => {
    const seen: Array<[string, RequestInit | undefined]> = [];
    const fake = (async (url: string, init?: RequestInit) => { seen.push([url, init]);
      return new Response('moved', { status: 302, headers: { location: 'http://127.0.0.1:4042/health' } }); }) as unknown as typeof fetch;
    // A literal public address, so the hook's host check does not depend on this machine's name resolution (cint-L43's rule:
    // a web read of a public host is ordinary; only a host the operator's effect policy names goes to the doorway).
    const url = 'https://93.184.215.14/page';
    const marked = await nativeTurn([ask(['WebFetch', { url }]), answer('refused')], { fetch: fake,
      effectPolicy: { type: 'PreviewEffectPolicy', resourceLevelUsd: 0, policySensitive: ['93.184.215.14'], registered: [], grants: [] } });
    expect(admission(marked.stateDirectory).filter(row => row.phase === 'pre').map(row => [row.tool, row.decision])).toEqual([['WebFetch', 'deny']]);
    expect(seen).toHaveLength(0);
    const run = await nativeTurn([ask(['WebFetch', { url }]), answer('redirected')], { fetch: fake });
    expect(seen).toHaveLength(1);
    expect(seen[0]![0]).toBe(url);
    expect(seen[0]![1]).toMatchObject({ method: 'GET', redirect: 'manual' });
    const post = admission(run.stateDirectory).find(row => row.phase === 'post');
    expect(JSON.parse(post.result)).toMatchObject({ status: 302, location: 'http://127.0.0.1:4042/health' });
  });

  it('edits, globs and greps inside the workspace, and never lists through a link that leaves it', async () => {
    const outside = dir(); writeFileSync(join(outside, 'hidden-name.txt'), 'x');
    const run = await nativeTurn([
      ask(['Write', { file_path: 'src/a.txt', content: 'alpha one\nbeta two\n' }], ['Edit', { file_path: 'src/a.txt', old_string: 'beta', new_string: 'gamma' }],
        ['Bash', { command: `ln -s ${outside} out && echo linked` }], ['Glob', { pattern: '**/*.txt' }], ['Glob', { pattern: 'out/*' }],
        ['Grep', { pattern: 'gamma', output_mode: 'content' }], ['Edit', { file_path: 'src/a.txt', old_string: 'missing', new_string: 'x' }]),
      answer('ok')]);
    expect(readFileSync(join(run.workspace, 'src/a.txt'), 'utf8')).toBe('alpha one\ngamma two\n');
    const posts = admission(run.stateDirectory).filter(row => row.phase === 'post').map(row => JSON.parse(row.result));
    // The setup really made the link (the sandboxed shell ran), so the empty listing below is the boundary, not a missing link.
    expect(posts[2]).toMatchObject({ exitCode: 0, stdout: 'linked\n' });
    expect(lstatSync(join(run.workspace, 'out')).isSymbolicLink()).toBe(true);
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
    // One step of eight past the cap (32 at cint-L43, w4-toolsfull's per-step count).
    const asks = Math.ceil(SUBSCRIPTION_TOOL_LIMITS.maxToolCalls / 8) + 1;
    const run = await nativeTurn([...Array.from({ length: asks }, () => eight), answer('capped')]);
    const pre = admission(run.stateDirectory).filter(row => row.phase === 'pre');
    expect(pre.filter(row => row.decision === 'allow')).toHaveLength(SUBSCRIPTION_TOOL_LIMITS.maxToolCalls);
    const capped = new RegExp(`per-step call cap ${String(SUBSCRIPTION_TOOL_LIMITS.maxToolCalls)} reached`, 'u');
    expect(pre.filter(row => row.decision === 'deny').every(row => capped.test(row.reason))).toBe(true);
    expect(pre).toHaveLength(asks * 8);
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
    const profile = nativeShellProfile('/private/tmp/itt-abc', '/usr/local/bin/node');
    expect(profile).toContain('(deny default)');
    expect(profile).toContain('(literal "/usr/local/bin/node")');
    expect(profile).toContain('(deny network*)');
    expect(profile).not.toContain('network-outbound');
    // With the turn's checkpoint, the one place a command may reach is its loopback port, and its tools' locations are read.
    const reach = nativeShellProfile('/private/tmp/itt-abc', '/usr/local/bin/node', { port: 40123, reads: ['/Library/Developer/CommandLineTools'] });
    expect(reach).toContain('(deny network*)');
    expect(reach).toContain('(allow network-outbound (remote ip "localhost:40123"))');
    expect(reach).toContain('(subpath "/Library/Developer/CommandLineTools")');
    for (const bad of [{ port: 0, reads: [] }, { port: 40123, reads: ['/private/tmp/itt-abc/x'] }, { port: 40123, reads: ['rel'] }])
      expect(() => nativeShellProfile('/private/tmp/itt-abc', '/usr/local/bin/node', bad)).toThrow(/egress checkpoint/u);
    expect(profile).toContain('(allow file-write* (subpath "/private/tmp/itt-abc")');
    expect(profile).toContain('(subpath "/usr/bin")');
    // Both sides of the host configuration (the gate run of 2026-10-07: a confined shell with no readable /private/etc
    // reached its own checkpoint in neither profile). It is machinery again, by both spellings, and the host's own record
    // is refused after it — last rule wins in SBPL, and the kernel decides on the resolved path, so `/etc/hosts`, a
    // concatenated or globbed spelling of it and a `..` escape are one refused target.
    for (const text of [profile, reach] as string[]) {
      expect(text).toMatch(/\(allow file-read\* file-map-executable .*\(subpath "\/private\/etc"\).*\(subpath "\/etc"\)/u);
      expect(text).toContain('(deny file-read-data (subpath "/private/etc/hosts"))');
      const lines = text.split('\n');
      expect(lines.findIndex(line => line.startsWith('(deny file-read-data (subpath "/private/etc/hosts")')))
        .toBeGreaterThan(lines.findIndex(line => line.startsWith('(allow file-read* file-map-executable')));
    }
    expect(() => nativeShellProfile('/private/etc/x', '/usr/local/bin/node')).toThrow(/overlaps/u);
    expect(() => nativeShellProfile('/private/tmp/a b', '/usr/local/bin/node')).toThrow(/absolute and plain/u);
    expect(() => nativeShellProfile('/usr/share/x', '/usr/local/bin/node')).toThrow(/overlaps/u);
    expect(() => nativeShellProfile('/private/tmp/itt-abc', '/private/tmp/itt-abc/node')).toThrow(/outside the scratch/u);
    expect(() => nativeShellProfile('/private/tmp/itt-abc', 'node')).toThrow(/node path/u);
  });

  it('a sandboxed command reads and writes only its scratch volume, reaches no network and signals nothing outside', async () => {
    const outside = dir(); writeFileSync(join(outside, 'canary.txt'), 'CANARY-NATIVE-0002');
    const script = ['echo "env: $(env | grep -c CLAUDE_CODE_)"', `echo "outside-read: $(cat ${join(outside, 'canary.txt')} 2>&1)"`,
      `echo "outside-write: $( (echo x > ${join(outside, 'w.txt')}) 2>&1)"`,
      'echo "network: $(curl -s -m 5 --noproxy "*" -o /dev/null -w "%{http_code}" http://127.0.0.1:9 2>&1) exit=$?"',
      'echo "checkpoint: $(curl -s -m 5 -o /dev/null -w "%{http_code}" http://127.0.0.1:9 2>&1) exit=$?"',
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
    // cint-L44: the same request through the turn's checkpoint reaches it and is refused there, on the record.
    expect(out).toMatch(/checkpoint: 403 exit=0/u);
    expect(readFileSync(join(run.stateDirectory, 'egress.jsonl'), 'utf8')).toMatch(/"host":"127\.0\.0\.1".*"decision":"deny".*"kind":"scope"/u);
    expect(out).toMatch(/signal: .*Operation not permitted/u);
    expect(out).toContain('own-tmp: ok');
  });
});

/** A hook that runs the real admission hook unchanged and then, after a `pre` decision, runs `after` (a statement of
 * JavaScript with `input`, the call's payload, in scope): a deterministic stand-in for a change that lands between the
 * admission and the tool's execution. */
function wrappedHook(root: string, after: string) {
  return (turn: { hook: { node: string; script: string } }) => {
    const script = join(root, `hook-${String(Math.random()).slice(2)}.mjs`);
    writeFileSync(script, `import { spawnSync } from 'node:child_process'; import * as fs from 'node:fs';
const raw = fs.readFileSync(0), input = JSON.parse(String(raw));
const real = spawnSync(${JSON.stringify(turn.hook.node)}, [${JSON.stringify(turn.hook.script)}, ...process.argv.slice(2)], { input: raw, env: {} });
process.stdout.write(real.stdout); process.stderr.write(real.stderr);
if (process.argv[2] === 'pre') { ${after} }
process.exitCode = real.status ?? 1;`);
    return { node: turn.hook.node, script };
  };
}

describe('the tools\' execution boundary', () => {
  it('a file the hook admitted that turns into a link out of the workspace before it runs is refused; an ordinary one is read', async () => {
    const outside = dir(), canary = join(outside, 'canary.txt'); writeFileSync(canary, 'CANARY-NATIVE-0004');
    const swap = `if (input.tool_input.file_path === 'doc.txt') { const ws = ${JSON.stringify('WS')};
  fs.rmSync(ws + '/doc.txt'); fs.symlinkSync(${JSON.stringify(canary)}, ws + '/doc.txt'); }`;
    let workspace = '';
    const run = await nativeTurn([ask(['Read', { file_path: 'doc.txt' }], ['Read', { file_path: 'plain.txt' }]), answer('read')], {
      setup: ws => { workspace = ws; writeFileSync(join(ws, 'doc.txt'), 'ordinary'); writeFileSync(join(ws, 'plain.txt'), 'ordinary neighbour'); },
      hook: turn => wrappedHook(dir(), swap.replace('"WS"', JSON.stringify(workspace)))(turn) });
    const rows = admission(run.stateDirectory);
    // The real hook admitted both (the file was ordinary when it decided), and the swap really happened after that decision.
    expect(rows.filter(row => row.phase === 'pre').map(row => row.decision)).toEqual(['allow', 'allow']);
    expect(lstatSync(join(run.workspace, 'doc.txt')).isSymbolicLink()).toBe(true);
    const posts = rows.filter(row => row.phase === 'post').map(row => JSON.parse(row.result));
    expect(posts[0].error).toMatch(/EPERM|operation not permitted/iu);
    expect(posts[1]).toEqual({ content: 'ordinary neighbour' });
    expect(JSON.stringify(rows)).not.toContain('CANARY-NATIVE-0004');
    expect(JSON.stringify(run.envelopes)).not.toContain('CANARY-NATIVE-0004');
  });

  it('a stop ends a read blocked on a FIFO: the loop settles at once, the blocked worker is ended, nothing further runs', { timeout: 15000 }, async () => {
    let stop = false, latchedAt = 0;
    const run = await nativeTurn((_envelope, index) => {
      if (index === 0) setTimeout(() => { stop = true; latchedAt = performance.now(); }, 500);
      return ask(['Read', { file_path: 'pipe' }], ['Write', { file_path: 'after.txt', content: 'x' }]);
    }, { stopped: () => stop, setup: ws => execFileSync('/usr/bin/mkfifo', [join(ws, 'pipe')]) });
    const settled = performance.now() - latchedAt;
    expect(stop).toBe(true);
    expect(settled).toBeLessThan(3000);
    expect(run.envelopes).toHaveLength(1);
    expect(run.outcome.result).toMatchObject({ state: 'uncertain', native: { ended: 'stopped', calls: 1 } });
    const post = admission(run.stateDirectory).find(row => row.phase === 'post');
    expect(JSON.parse(post.result)).toMatchObject({ interrupted: 'stopped' });
    expect(existsSync(join(run.workspace, 'after.txt'))).toBe(false);
  });

  it('a stop latched while the hook decided: the admitted call is recorded as stopped and never dispatched', async () => {
    const root = dir(), marker = join(root, 'decided');
    const run = await nativeTurn([ask(['Write', { file_path: 'never.txt', content: 'x' }]), answer('unreached')],
      { stopped: () => existsSync(marker), hook: wrappedHook(root, `fs.writeFileSync(${JSON.stringify(marker)}, '1');`) });
    expect(run.outcome.result).toMatchObject({ state: 'uncertain', native: { ended: 'stopped' } });
    const rows = admission(run.stateDirectory);
    expect(rows.find(row => row.phase === 'pre').decision).toBe('allow');
    expect(JSON.parse(rows.find(row => row.phase === 'post').result)).toEqual({ error: 'stopped before dispatch', interrupted: 'stopped' });
    expect(existsSync(join(run.workspace, 'never.txt'))).toBe(false);
    expect(readToolTrace(run.stateDirectory)).toMatchObject({ consistent: true });
  });

  it('a stop aborts a pending fetch at once, and a body larger than the limit is read only up to it, then cancelled', { timeout: 15000 }, async () => {
    const network = [...SINGLE_MACHINE_PROFILE.operations, 'tool:network'];
    let stop = false, aborted = false;
    const hanging = ((_url: string, init?: RequestInit) => new Promise((_resolve, reject) => {
      setTimeout(() => { stop = true; }, 200);
      init?.signal?.addEventListener('abort', () => { aborted = true; reject(init.signal?.reason); });
    })) as unknown as typeof fetch;
    const started = performance.now();
    const stopped = await nativeTurn([ask(['WebFetch', { url: 'https://example.com/slow' }]), answer('unreached')],
      { operations: network, fetch: hanging, stopped: () => stop });
    expect(performance.now() - started).toBeLessThan(5000);
    expect(aborted).toBe(true);
    expect(stopped.outcome.result).toMatchObject({ native: { ended: 'stopped' } });
    expect(JSON.parse(admission(stopped.stateDirectory).find(row => row.phase === 'post').result)).toMatchObject({ interrupted: 'stopped' });
    // An endless body: the reader takes chunks only until the limit, then cancels the stream.
    let pulled = 0, cancelled = false;
    const endless = (async () => new Response(new ReadableStream({
      pull(controller) { pulled += 65536; controller.enqueue(new Uint8Array(65536).fill(97)); },
      cancel() { cancelled = true; } }), { status: 200, headers: { 'content-type': 'text/plain' } })) as unknown as typeof fetch;
    const big = await nativeTurn([ask(['WebFetch', { url: 'https://example.com/big' }]), answer('read')], { operations: network, fetch: endless });
    // The recorded result is clipped for the record; its head carries the status and the truncation.
    const recorded = String(admission(big.stateDirectory).find(row => row.phase === 'post').result);
    expect(recorded).toContain(`"status":200,"contentType":"text/plain","truncatedAtBytes":${String(NATIVE_EXECUTION.fetchBodyBytes)}`);
    expect(cancelled).toBe(true);
    expect(pulled).toBeLessThanOrEqual(NATIVE_EXECUTION.fetchBodyBytes + 3 * 65536);
    // An ordinary small body is returned whole.
    const small = await nativeTurn([ask(['WebFetch', { url: 'https://example.com/small' }]), answer('read')], { operations: network,
      fetch: (async () => new Response('hello body', { status: 200 })) as unknown as typeof fetch });
    expect(JSON.parse(admission(small.stateDirectory).find(row => row.phase === 'post').result)).toMatchObject({ status: 200, body: 'hello body' });
  });

  it('every tool launch passes the host resource owner: its memory and process ceilings end a command over them; ordinary work runs', { timeout: 30000 }, async () => {
    const small = createResourceOwner({ ...RESOURCE_CEILINGS,
      launch: { ...RESOURCE_CEILINGS.launch, memoryBytes: 96 * 1024 * 1024, processCount: 6 } }) as Owner;
    await small.attach({});
    const run = await nativeTurn([ask(
      ['Bash', { command: 'echo ordinary' }],
      ['Bash', { command: '/usr/bin/perl -e \'$x = "a" x 400_000_000; sleep 10\'' }],
      ['Bash', { command: 'for i in 1 2 3 4 5 6 7 8 9 10; do /bin/sleep 10 & done; wait' }],
      ['Read', { file_path: 'note.txt' }]), answer('done')],
      { resources: small, setup: ws => writeFileSync(join(ws, 'note.txt'), 'still fine') });
    const posts = admission(run.stateDirectory).filter(row => row.phase === 'post').map(row => JSON.parse(row.result));
    expect(posts[0]).toMatchObject({ stdout: 'ordinary\n', exitCode: 0 });
    expect(posts[1]).toMatchObject({ exitCode: null, interrupted: 'memory' });
    // The tree's process count is sampled against the ceiling; the user ID's kernel process limit may refuse forks first.
    expect(posts[2].interrupted === 'processes' || /fork|Resource temporarily unavailable/iu.test(String(posts[2].stderr))).toBe(true);
    expect(posts[3]).toEqual({ content: 'still fine' });
    // Every launch, the ones the owner ended on a ceiling included, had its end proven by the owner under the sandbox join.
    expect(run.outcome.result.native.unresolved).toEqual([]);
    // Nothing the launches started is left running: the owner verified every launch's cleanup in a complete census.
    const view = (small as unknown as { snapshot: () => { counters: { cleanupUnresolved: number; completed: number; killed: Record<string, number> };
      lastLaunch: { cleanup: string } } }).snapshot();
    expect(view.counters).toMatchObject({ cleanupUnresolved: 0, completed: 4 });
    expect(view.counters.killed.memory).toBe(1);
    expect(view.lastLaunch.cleanup).toBe('verified');
  });

  /** A Bash call that daemonizes the way a real one does: a node child in a new session, at the root directory (outside the whole
   * scratch volume, so outside the launch's working area), its stdio closed, and its parent gone at once, so the owner's group,
   * ancestry and working-area joins all miss it. It prints the daemon's pid; `after` runs in the foreground after that. */
  const daemonize = (node: string, after = '') => ['Bash', { command: `"${node}" daemon.mjs > pid.txt && cat pid.txt${after}` }] as [string, Record<string, unknown>];
  const DAEMON = `import { spawn } from 'node:child_process';
const child = spawn('/bin/sleep', ['300'], { detached: true, stdio: 'ignore', cwd: '/' });
child.unref(); process.stdout.write(String(child.pid));`;
  const alive = (pid: number) => { try { process.kill(pid, 0); return true; } catch { return false; } };
  const settled = async (pid: number) => { for (let i = 0; i < 50 && alive(pid); i++) await new Promise(done => setTimeout(done, 20)); return !alive(pid); };

  // Keep the neighbor owned by this test, with no sleep deadline or orphaning shell. A pipe holds it idle until cleanup.
  // ChildProcess.kill handles an already-exited child; cleanup must never replace a failed containment assertion with ESRCH.
  const outsideProcess = async () => {
    const child = spawn('/bin/cat', [], { stdio: ['pipe', 'ignore', 'ignore'] });
    const closed = new Promise<void>(resolve => child.once('close', () => resolve()));
    await once(child, 'spawn');
    const pid = child.pid!;
    return { pid, close: async () => { child.kill('SIGKILL'); await closed; } };
  };

  it('neighbor cleanup reaps its own live child and preserves an error after that child already exited', async () => {
    const neighbor = await outsideProcess();
    expect(alive(neighbor.pid)).toBe(true);
    await neighbor.close();
    expect(alive(neighbor.pid)).toBe(false);
    const original = new Error('containment assertion');
    await expect((async () => {
      try { throw original; } finally { await neighbor.close(); }
    })()).rejects.toBe(original);
  });

  it('a detached descendant outside the working area is ended when its call completes; a process outside the sandbox is not', { timeout: 20000 }, async () => {
    const neighbor = await outsideProcess();
    let node = '';
    try {
      const run = await nativeTurn((_envelope, index) => index === 0 ? ask(['Write', { file_path: 'daemon.mjs', content: DAEMON }], daemonize(node))
        : answer('done'), { hook: turn => { node = turn.hook.node; return turn.hook; } });
      const posts = admission(run.stateDirectory).filter(row => row.phase === 'post').map(row => JSON.parse(row.result));
      const daemon = Number(posts[1].stdout);
      expect(Number.isSafeInteger(daemon) && daemon > 1).toBe(true);
      expect(await settled(daemon)).toBe(true);
      expect(alive(neighbor.pid)).toBe(true);
      expect(run.outcome.result).toMatchObject({ native: { ended: 'answered', unresolved: [] } });
    } finally { await neighbor.close(); }
  });

  it('the stop ends a detached descendant that left the group, its parent and the working area while its call still runs', { timeout: 20000 }, async () => {
    let node = '', workspace = '', stop = false, observed = '';
    const run = await nativeTurn((_envelope, index) => {
      if (index !== 0) return answer('unreached');
      const watch = setInterval(() => {
        const file = join(workspace, 'pid.txt');
        if (!existsSync(file) || !readFileSync(file, 'utf8').trim()) return;
        const pid = readFileSync(file, 'utf8').trim();
        // The daemon is live and outside every join the owner holds: parent gone (ppid 1), its own group, cwd elsewhere.
        const row = execFileSync('/bin/ps', ['-o', 'pid=,ppid=,pgid=', '-p', pid], { encoding: 'utf8' }).trim();
        if (row.split(/\s+/u)[1] !== '1') return;
        clearInterval(watch);
        observed = row; stop = true;
      }, 20);
      return ask(['Write', { file_path: 'daemon.mjs', content: DAEMON }], daemonize(node, '; /bin/sleep 30'));
    }, { stopped: () => stop, hook: turn => { node = turn.hook.node; workspace = turn.workspace; return turn.hook; } });
    const [pid = 0, ppid, pgid] = observed.split(/\s+/u).map(Number);
    expect(ppid).toBe(1);
    expect(pgid).toBe(pid);
    expect(run.outcome.result).toMatchObject({ state: 'uncertain', native: { ended: 'stopped', unresolved: [] } });
    expect(await settled(pid)).toBe(true);
    const rows = admission(run.stateDirectory).filter(row => row.phase === 'post').map(row => JSON.parse(row.result));
    expect(rows[1]).toMatchObject({ interrupted: 'stopped' });
  });

  it('a command that ends its own shell and worker by exact PID ends only those: the owner proves the cleanup, the next call runs', { timeout: 20000 }, async () => {
    const neighbor = await outsideProcess();
    try {
      // The first call tries the exact test-owned neighbor PID; the sandbox must refuse it. The second ends its
      // own shell ($$) and native worker ($PPID), leaving the external owner to prove cleanup and run the next call.
      const run = await nativeTurn([ask(['Bash', { command: `kill -TERM ${neighbor.pid}` }],
        ['Bash', { command: 'echo "$$ $PPID" > ended-pids.txt; kill -9 "$PPID" "$$"' }], ['Bash', { command: 'echo after' }]), answer('done')]);
      const posts = admission(run.stateDirectory).filter(row => row.phase === 'post').map(row => JSON.parse(row.result));
      expect(posts[0]).toMatchObject({ exitCode: 1 });
      expect(posts[0].stderr).toMatch(/Operation not permitted/u);
      expect(posts[1].error).toMatch(/^tool worker failed \(exit /u);
      const ended = readFileSync(join(run.workspace, 'ended-pids.txt'), 'utf8').trim().split(/\s+/u).map(Number);
      expect(ended).toHaveLength(2);
      for (const pid of ended) { expect(Number.isSafeInteger(pid) && pid > 1).toBe(true); expect(await settled(pid)).toBe(true); }
      expect(posts[2]).toMatchObject({ stdout: 'after\n', exitCode: 0 });
      expect(run.outcome.result.native.unresolved).toEqual([]);
      expect(alive(neighbor.pid)).toBe(true);
    } finally { await neighbor.close(); }
  });

  /** A detached node child, in a new session with its parent gone, that holds ~400 MiB while its launcher keeps running in the
   * foreground: either inside the launch's own temporary directory (the scratch volume: the working-area join reaches it) or at
   * the root directory, outside the whole volume (only the sandbox join reaches it). */
  const big = (cwd: string) => `import { spawn } from 'node:child_process';
const child = spawn(process.execPath, ['-e', 'const b = Buffer.alloc(400 * 1024 * 1024, 7); setInterval(() => { b[0] = (b[0] + 1) % 251; }, 200);'],
  { detached: true, stdio: 'ignore', cwd: ${cwd} });
child.unref(); process.stdout.write(String(child.pid));`;

  it.each([['inside the scratch volume', 'process.env.TMPDIR'], ['at the root directory, outside the volume', "'/'"]])('accounts for a detached child %s and ends it over the memory ceiling while its launcher runs', { timeout: 30000 }, async (_where, cwd) => {
    const small = createResourceOwner({ ...RESOURCE_CEILINGS,
      launch: { ...RESOURCE_CEILINGS.launch, memoryBytes: 96 * 1024 * 1024, processCount: 8 } }) as Owner;
    await small.attach({});
    let node = '', workspace = '', daemon = 0;
    try {
      // Write the big-child launcher, then run it (printing the child's pid to a workspace file) and stay alive in the
      // foreground long enough for a sample to see the child's memory. The child detached into the sibling tmp directory,
      // inside the scratch volume: the working-area join reaches it, its memory counts against the launch, and the owner
      // ends it. The memory kill clears the call's stdout, so the test reads the child's pid from the workspace file live.
      const run = await nativeTurn((_envelope, index) => {
        if (index !== 0) return answer('done');
        const watch = setInterval(() => {
          try { const pid = Number(readFileSync(join(workspace, 'pid.txt'), 'utf8').trim()); if (pid > 1) { daemon = pid; clearInterval(watch); } } catch { /* not written yet */ }
        }, 20);
        return ask(['Write', { file_path: 'big.mjs', content: big(cwd) }], ['Bash', { command: `"${node}" big.mjs > pid.txt && /bin/sleep 6` }]);
      }, { resources: small, hook: turn => { node = turn.hook.node; workspace = turn.workspace; return turn.hook; } });
      const posts = admission(run.stateDirectory).filter(row => row.phase === 'post').map(row => JSON.parse(row.result));
      // The launcher's own call is ended on the memory ceiling the detached child pushed the launch over: proof the join
      // reaches a child inside the volume (a bare launcher plus sleep is far under 96 MiB).
      expect(posts[1]).toMatchObject({ exitCode: null, interrupted: 'memory' });
      expect(Number.isSafeInteger(daemon) && daemon > 1).toBe(true);
      // The detached child is gone: the owner killed it as a joined member, not a bystander.
      expect(await settled(daemon)).toBe(true);
      expect(run.outcome.result.native.unresolved).toEqual([]);
      const view = (small as unknown as { snapshot: () => { counters: { killed: Record<string, number> } } }).snapshot();
      expect(view.counters.killed.memory).toBe(1);
    } finally { if (daemon > 1) try { process.kill(daemon, 'SIGKILL'); } catch { /* already gone */ } }
  });

  it('the stop ends a daemon outside the volume even when the workload suspended its whole sandbox first', { timeout: 20000 }, async () => {
    // The command daemonizes a child at the root directory (new session, parent gone, outside the scratch volume), then
    // suspends every process of its own sandbox, its own shell and the worker included. Nothing inside the sandbox can act;
    // the owner, outside it, still joins the daemon by its sandbox identity, ends it on the stop, and proves the cleanup.
    let node = '', workspace = '', stop = false, daemon = 0;
    try {
      const run = await nativeTurn((_envelope, index) => {
        if (index !== 0) return answer('unreached');
        const watch = setInterval(() => {
          try { const pid = Number(readFileSync(join(workspace, 'pid.txt'), 'utf8').trim()); if (pid > 1) { daemon = pid; clearInterval(watch); setTimeout(() => { stop = true; }, 1500); } } catch { /* not written yet */ }
        }, 20);
        return ask(['Write', { file_path: 'daemon.mjs', content: DAEMON }], daemonize(node, '; kill -STOP "$(cat pid.txt)" "$PPID" "$$"'));
      }, { stopped: () => stop, hook: turn => { node = turn.hook.node; workspace = turn.workspace; return turn.hook; } });
      // The loop settled (it never waits on anything inside the sandbox) and reported the stop.
      expect(run.outcome.result).toMatchObject({ state: 'uncertain', native: { ended: 'stopped', unresolved: [] } });
      expect(Number.isSafeInteger(daemon) && daemon > 1).toBe(true);
      expect(await settled(daemon)).toBe(true);
    } finally { if (daemon > 1) try { process.kill(daemon, 'SIGKILL'); } catch { /* already gone */ } }
  });

  it('files the workload plants in the scratch volume carry no cleanup authority: a forged pid, a FIFO and a forged marker change nothing', { timeout: 20000 }, async () => {
    // The old sweeper's file shapes, planted by the workload itself: a pid file naming a process outside the sandbox, a FIFO
    // under a pid-file name and a forged completion marker. The cleanup path reads no workload file, so the neighbour lives,
    // the loop never blocks, and the launch's end is still proven by the owner's own census.
    const neighbor = await outsideProcess();
    try {
      const started = performance.now();
      const run = await nativeTurn([ask(['Bash', { command: `cd .. && echo ${neighbor.pid} > .sweep-forged.pid && /usr/bin/mkfifo .sweep-fifo.pid && : > .sweep-fifo && echo planted` }],
        ['Bash', { command: 'echo after' }]), answer('done')]);
      expect(performance.now() - started).toBeLessThan(10000);
      const posts = admission(run.stateDirectory).filter(row => row.phase === 'post').map(row => JSON.parse(row.result));
      expect(posts[0]).toEqual({ stdout: 'planted\n', stderr: '', exitCode: 0 });
      expect(posts[1]).toMatchObject({ stdout: 'after\n', exitCode: 0 });
      expect(run.outcome.result).toMatchObject({ native: { ended: 'answered', unresolved: [] } });
      expect(alive(neighbor.pid)).toBe(true);
    } finally { await neighbor.close(); }
  });

  it('refuses to run without a host resource owner', async () => {
    await expect(nativeTurn([answer('x')], { resources: {} as Owner })).rejects.toThrow(/no host resource owner/u);
  });
});
