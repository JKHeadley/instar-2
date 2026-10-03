// Part Thirteen §9 (docs/17-harness-adapters), the shell's network through the turn's egress checkpoint, on the real pinned
// harness: Claude Code 2.1.280 runs each turn with the shipped tools policy and settings, the real admission hook, the real
// sandbox, the real egress checkpoint and the real scratch volume, through runToolTurn. Only the model is scripted: a local
// Messages endpoint answers each harness request with the next recorded tool call, so the commands are exactly the ones
// named here and nothing is spent. Gated: INSTAR_SHELLNET_HARNESS=<path to the pinned claude executable> runs it, and
// INSTAR_TOOL_TURN_CASE=<name> selects one case. Each case's admission record, tool results and journal rows are stored
// verbatim under fixtures/tool-turn/shellnet-2026-10-03 and replayed offline by tests/preview/tool-admission.test.ts
// (Rule 36). Nothing is sent to any chat. The scratch root sits on ordinary storage (/private/tmp), as a live root does.
import { createServer, type Server } from 'node:http';
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { execFileSync, spawn } from 'node:child_process';
import { dirname, join } from 'node:path';
import { afterAll, expect, it } from 'vitest';
import { subscriptionToolSettings, subscriptionToolsPolicy, SUBSCRIPTION_THINKING_ENV } from '../../src/assembly/production-provider.js';
import type { SubscriptionToolTurn } from '../../src/assembly/production-provider.js';
import { openPreviewJournal } from '../preview/journal.js';
import { SINGLE_MACHINE_PROFILE } from '../preview/activation-authority.js';
import { redact } from '../../src/recall/redact.js';
// @ts-expect-error The runner side stays plain JavaScript.
import { runToolTurn, scratchMounted } from '../preview/tool-turn.mjs';

const HARNESS = process.env.INSTAR_SHELLNET_HARNESS;
const ONLY = process.env.INSTAR_TOOL_TURN_CASE;
const run = (name: string) => typeof HARNESS === 'string' && HARNESS.length > 0 && (ONLY === undefined || ONLY === name);
const MODEL = 'claude-sonnet-5';
const RECORD = join(__dirname, '../preview/fixtures/tool-turn/shellnet-2026-10-03');
const scratch = run('reads') || run('writes') ? realpathSync(mkdtempSync('/private/tmp/tool-net-')) : '';
afterAll(() => { if (scratch) rmSync(scratch, { recursive: true, force: true }); });

type Row = Record<string, unknown> & { phase: string };
type ToolCall = { name: string; input: Record<string, unknown> };
/** A scripted Messages endpoint: each request that offers tools is answered with the next scripted tool call, then with the
 * final text; any other request (a side call) gets a short text. Every request body is kept. */
function scriptedModel(calls: ToolCall[], final: string) {
  const requests: unknown[] = [];
  let next = 0;
  const server: Server = createServer((req, res) => {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      const parsed = body ? JSON.parse(body) as { stream?: boolean; tools?: unknown[]; model?: string } : {};
      requests.push({ url: req.url, body: parsed });
      const main = Array.isArray(parsed.tools) && parsed.tools.length > 0;
      const call = main && next < calls.length ? calls[next++] : null;
      const text = main ? final : 'ok';
      const id = `msg_${String(requests.length)}`;
      const block = call ? { type: 'tool_use', id: `toolu_${String(requests.length)}`, name: call.name, input: call.input } : { type: 'text', text };
      const stop = call ? 'tool_use' : 'end_turn';
      const usage = { input_tokens: 10, output_tokens: 10 };
      if (!parsed.stream) {
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ id, type: 'message', role: 'assistant', model: parsed.model ?? MODEL, content: [block], stop_reason: stop, usage }));
        return;
      }
      res.writeHead(200, { 'content-type': 'text/event-stream' });
      const event = (type: string, data: object) => res.write(`event: ${type}\ndata: ${JSON.stringify({ type, ...data })}\n\n`);
      event('message_start', { message: { id, type: 'message', role: 'assistant', model: parsed.model ?? MODEL, content: [], stop_reason: null, usage } });
      if (call) {
        event('content_block_start', { index: 0, content_block: { type: 'tool_use', id: block.type === 'tool_use' ? block.id : '', name: call.name, input: {} } });
        event('content_block_delta', { index: 0, delta: { type: 'input_json_delta', partial_json: JSON.stringify(call.input) } });
      } else {
        event('content_block_start', { index: 0, content_block: { type: 'text', text: '' } });
        event('content_block_delta', { index: 0, delta: { type: 'text_delta', text } });
      }
      event('content_block_stop', { index: 0 });
      event('message_delta', { delta: { stop_reason: stop, stop_sequence: null }, usage: { output_tokens: 10 } });
      event('message_stop', {});
      res.end();
    });
  });
  return { server, requests, used: () => next };
}

async function harnessCase(name: string, calls: ToolCall[]) {
  const root = join(scratch, name), home = join(scratch, `${name}-home`), config = join(scratch, `${name}-config`);
  for (const dir of [root, home, config]) mkdirSync(dir, { mode: 0o700 });
  const model = scriptedModel(calls, 'done');
  await new Promise<void>(done => model.server.listen(0, '127.0.0.1', () => done()));
  const port = (model.server.address() as { port: number }).port;
  const journal = openPreviewJournal(join(root, 'journal.encrypted'), new Uint8Array(32).fill(3), { kind: 'genesis', bot: '12345678',
    chat: '7654321', operator: '7654321', grant: 'grant:scratch', configurationDigest: 'sha256:scratch', expires: 9999999999999,
    maxCalls: 40, maxReplies: 10, maxTurns: 10, maxBytes: 32768, cursor: 0 });
  const appended: unknown[] = [];
  const recorder = { get view() { return journal.view; }, append: (row: never) => { appended.push(row); return journal.append(row); } };
  const policy = subscriptionToolsPolicy(MODEL);
  let stateDirectory = '', code: number | null = null, stdout = '';
  const outcome = await runToolTurn({ journal: recorder, root, id: 'telegram:12345678:update:1', prepared: 'Run the scripted steps.',
    promptLimit: 32768, deniedRoots: [root, home, config], operations: SINGLE_MACHINE_PROFILE.operations, now: () => Date.now(),
    redactText: (t: string) => redact(t).text, authority: 'scripted harness test', fallback: async () => ({ result: 'fallback' }),
    invoke: (turn: SubscriptionToolTurn) => new Promise(done => {
      stateDirectory = turn.stateDirectory;
      // The launch the shipped route makes (args, settings, clean environment), with the model endpoint scripted.
      const child = spawn(HARNESS!, [...policy.args, '--settings', subscriptionToolSettings(turn, home)], { cwd: turn.workspace,
        env: { PATH: policy.path, HOME: home, CLAUDE_CONFIG_DIR: config, ANTHROPIC_API_KEY: 'scripted-model-no-account',
          ANTHROPIC_BASE_URL: `http://127.0.0.1:${String(port)}`, CLAUDE_CODE_MAX_RETRIES: '0', CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: '1',
          ...SUBSCRIPTION_THINKING_ENV, CLAUDE_CODE_TMPDIR: turn.scratch }, stdio: ['pipe', 'pipe', 'ignore'] });
      const timer = setTimeout(() => child.kill('SIGKILL'), policy.timeout);
      child.stdout.on('data', chunk => { stdout += chunk; });
      child.on('close', exit => { clearTimeout(timer); code = exit; done({ code: exit }); });
      child.stdin.end('Run the scripted steps.');
    }) }).catch((error: Error) => ({ error: error.message }));
  await new Promise<void>(done => model.server.close(() => done()));
  // The checkpoint ended with the turn: no process still serves this turn's state directory.
  const survivors = execFileSync('/bin/ps', ['-axo', 'pid=,command='], { encoding: 'utf8' }).split('\n')
    .filter(line => line.includes('egress-checkpoint.mjs') && line.includes(stateDirectory));
  const admission = readFileSync(join(stateDirectory, 'admission.jsonl'), 'utf8');
  const rows = admission.trim().split('\n').filter(Boolean).map(line => JSON.parse(line) as Row);
  const record = { name, harness: '2.1.280 (pinned), scripted model endpoint', calls, scriptedCallsUsed: model.used(), exitCode: code, survivors,
    error: 'error' in outcome ? outcome.error : null, mountedAfter: scratchMounted(dirname(stateDirectory)), admission,
    toolTurns: journal.view.toolTurns, journalRows: appended, frame: stdout.slice(0, 4000) };
  mkdirSync(RECORD, { recursive: true });
  writeFileSync(join(RECORD, `${name}.json`), `${JSON.stringify(record, null, 2)}\n`);
  return { ...record, rows };
}
const egress = (rows: Row[]) => rows.filter(row => row.phase === 'egress');
const results = (rows: Row[]) => rows.filter(row => row.phase === 'post' && row.tool === 'Bash').map(row => String(row.result));
const bash = (command: string): ToolCall => ({ name: 'Bash', input: { command, description: 'scripted step' } });

it.runIf(run('reads'))('reads: curl of a public page, git clone of a small public repository and npm install of a tiny package succeed through the checkpoint', { timeout: 400000 }, async () => {
  const record = await harnessCase('reads', [
    bash('curl -sS https://example.com | grep -o "<title>[^<]*</title>"; echo "curl-exit: $?"'),
    bash('git clone --depth 1 https://github.com/octocat/Hello-World.git hw && cat hw/README; echo "git-exit: $?"'),
    bash('mkdir pkg && cd pkg && npm install --no-audit --no-fund is-number@7.0.0 && node -e "console.log(require(\'is-number\')(5))"; echo "npm-exit: $?"')]);
  expect(record.error).toBeNull();
  expect(record.scriptedCallsUsed).toBe(3);
  const [curl, git, npm] = results(record.rows);
  expect(curl).toMatch(/<title>Example Domain<\/title>/u); expect(curl).toMatch(/curl-exit: 0/u);
  expect(git).toMatch(/Hello World/u); expect(git).toMatch(/git-exit: 0/u);
  expect(npm).toMatch(/true/u); expect(npm).toMatch(/npm-exit: 0/u);
  const reads = egress(record.rows).map(row => [row.method, String(row.url).split('/')[2], row.decision, row.kind]);
  expect(reads).toContainEqual(['GET', 'example.com', 'allow', 'network-read']);
  expect(reads).toContainEqual(['POST', 'github.com', 'allow', 'network-read']);
  expect(reads).toContainEqual(['GET', 'registry.npmjs.org', 'allow', 'network-read']);
  expect(egress(record.rows).every(row => row.decision === 'allow')).toBe(true);
  expect(record.toolTurns).toMatchObject({ invocations: 1, open: [], inconsistent: 0 });
  expect(record.survivors).toEqual([]);
  expect(record.mountedAfter).toBe(false);
});

it.runIf(run('writes'))('writes and this machine: a POST and a git push are refused at the doorway, loopback and a name pointing at loopback are refused', { timeout: 400000 }, async () => {
  const record = await harnessCase('writes', [
    bash('curl -sS -X POST -d note=hi https://httpbin.org/post; echo "post-exit: $?"'),
    bash('git init -q p && cd p && git -c user.name=t -c user.email=t@example.com commit -q --allow-empty -m x && '
      + 'GIT_TERMINAL_PROMPT=0 git push https://github.com/octocat/Hello-World.git HEAD:refs/heads/instar-probe; echo "push-exit: $?"'),
    bash('curl -sS -m 5 http://127.0.0.1:4042/health; echo "loopback-exit: $?"'),
    bash('curl -sS -m 5 http://localtest.me/; echo "name-exit: $?"')]);
  expect(record.error).toBeNull();
  expect(record.scriptedCallsUsed).toBe(4);
  const decided = egress(record.rows).map(row => [row.method, String(row.url).split('/')[2], row.decision, row.kind]);
  expect(decided).toContainEqual(['POST', 'httpbin.org', 'deny', 'network-write']);
  expect(decided.some(([method, host, decision, kind]) => method === 'GET' && host === 'github.com' && decision === 'deny' && kind === 'network-write')).toBe(true);
  expect(decided.some(([, host, decision, kind]) => host === 'localtest.me' && decision === 'deny' && kind === 'scope')).toBe(true);
  expect(decided.some(([, host]) => String(host).startsWith('127.0.0.1'))).toBe(false);
  const [post, push, loopback, local] = results(record.rows);
  expect(post).toMatch(/effect doorway/u); expect(post).not.toMatch(/"form"/u);
  expect(push).toMatch(/effect doorway/u); expect(push).toMatch(/push-exit: [1-9]/u);
  expect(loopback).toMatch(/loopback-exit: [1-9]/u); expect(loopback).not.toMatch(/"status"/u);
  expect(local).toMatch(/non-public address/u);
  expect(record.mountedAfter).toBe(false);
});
