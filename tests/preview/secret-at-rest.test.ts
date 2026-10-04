// The secrets floor for the files this tool runner writes, for the tested values only: after a completed turn, the
// tested secret values sit under a root only as ciphertext under the storage key, which lives in the runner's environment
// alone (never the harness's environment, argv or a file). It does not show every runner-written file is secret-free at
// every moment: the admission record holds a tool result's credential in plaintext until the end-of-turn scrub, and an
// opaque literal in mcp.json is not detected. This test drives a root through the paths that handle secret values (a credential handed over in chat, with
// and without custody, a tool turn whose MCP server takes a credential by SecretRef and whose tool result carries
// credentials) and then reads every byte under the root. It does not close the file tools' admission-to-open race
// (docs/defects/2026-10-03-file-tool-swap-race.md, OPEN): that race reaches files other owners wrote, which no code here
// can change.
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, realpathSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { createJournalWorker, openPreviewJournal } from './journal.js';
import { createSecretCustody, secretRef } from './secret-custody.js';
import { SINGLE_MACHINE_PROFILE } from './activation-authority.js';
import { redact } from '../../src/recall/redact.js';
// @ts-expect-error The runner side stays plain JavaScript.
import { prepareToolTurn, readRootMcp, runToolTurn, TOOL_HOOK_SCRIPT } from './tool-turn.mjs';

const key = new Uint8Array(32).fill(41);
// Synthetic values only, never a real secret: a GitHub-shaped token and a Telegram-shaped bot token.
const GITHUB = `ghp_${'Q7'.repeat(18)}`, TELEGRAM = `87654321:${'Zx'.repeat(17)}A`;
const KEY_FORMS = [Buffer.from(key).toString('hex'), Buffer.from(key).toString('base64')];
const update = (id: number, text: string) => ({ update_id: id,
  message: { message_id: id, chat: { id: 7654321, type: 'private' }, from: { id: 7654321 }, text } });
const genesis = { kind: 'genesis' as const, bot: '12345678', chat: '7654321', operator: '7654321',
  grant: 'grant:preview', configurationDigest: 'sha256:offline', expires: 9999999999999,
  maxCalls: 20, maxReplies: 20, maxTurns: 20, maxBytes: 32768, cursor: 0 };
const plainScratch = (turn: string) => { mkdirSync(join(turn, 'vol'), { recursive: true, mode: 0o700 }); return realpathSync(join(turn, 'vol')); };

/** Every regular file under `dir` (symlinks not followed) whose bytes contain one of `values`, by relative path. */
function plaintextHolders(dir: string, values: readonly string[]): string[] {
  const found: string[] = [];
  const walk = (at: string) => {
    for (const name of readdirSync(at)) {
      const path = join(at, name), info = statSync(path, { throwIfNoEntry: false });
      if (!info) continue;
      if (info.isDirectory()) walk(path);
      else if (info.isFile()) { const bytes = readFileSync(path); if (values.some(value => bytes.includes(value))) found.push(path.slice(dir.length + 1)); }
    }
  };
  walk(dir);
  return found.sort();
}

it.each([['with custody', true], ['without custody', false]])('a root holds no secret value in plaintext: chat credentials %s, a tool turn with MCP servers', async (_name, vaulted) => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'secret-at-rest-')));
  try {
    const journal = openPreviewJournal(join(root, 'journal.encrypted'), key, genesis);
    const custody = createSecretCustody(root, key, () => 1000);
    const worker = createJournalWorker(journal, { now: () => 1000, stopped: () => false, ...(vaulted ? { secrets: custody } : {}),
      model: async () => 'Noted.', send: async () => 77, checkOutbound: () => {} });
    worker.intake([update(1, `my github token is ${GITHUB}`), update(2, `and the bot token ${TELEGRAM}`)]);
    await worker.drain();
    expect(journal.view.order.length).toBe(2);
    // The root's MCP servers: a credential written literally in an env value refuses (the SecretRef form is the way to
    // give one); an ordinary env setting is kept and copied into the admission state.
    writeFileSync(join(root, 'mcp.json'), JSON.stringify({ mcpServers: { notes: { command: '/usr/bin/true', env: { TOKEN: GITHUB } } } }));
    expect(() => readRootMcp(root)).toThrow(/holds a credential literally; give it as \{"secretRef"/u);
    writeFileSync(join(root, 'mcp.json'), JSON.stringify({ mcpServers: { notes: { command: '/usr/bin/true', args: ['--read-only'],
      env: { LOG_LEVEL: 'info' } } }, reads: ['mcp__notes__lookup'] }));
    const turn = prepareToolTurn({ root, operation: 'telegram:1:update:1', attempt: 0, operations: [], mcp: readRootMcp(root), scratch: plainScratch });
    expect(turn.mcp?.servers).toEqual(['notes']);
    expect(JSON.parse(readFileSync(turn.mcp.config, 'utf8')).mcpServers.notes.env).toEqual({ LOG_LEVEL: 'info' });
    if (vaulted) expect(readdirSync(join(root, 'vault')).length).toBeGreaterThan(0);
    // The property: no file anywhere under the root holds the tested credentials or the storage key in plaintext.
    expect(plaintextHolders(root, [GITHUB, TELEGRAM, ...KEY_FORMS])).toEqual([]);
    // The other side: the sweep sees a plaintext value when one is there (a file the operator placed by hand).
    writeFileSync(join(root, 'operator-note.txt'), `left here: ${TELEGRAM}`);
    expect(plaintextHolders(root, [GITHUB, TELEGRAM, ...KEY_FORMS])).toEqual(['operator-note.txt']);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

/** Runs `command` like the harness launches an MCP server, with the harness's environment (no runner secret), and resolves
 * its stdout. */
const launch = (server: { command: string; args?: string[]; env?: Record<string, string> }) => new Promise<string>((resolve, reject) => {
  const child = spawn(server.command, server.args ?? [], { env: { PATH: process.env.PATH ?? '', ...(server.env ?? {}) } });
  let out = '', err = '';
  child.stdout.on('data', chunk => { out += chunk; });
  child.stderr.on('data', chunk => { err += chunk; });
  child.on('error', reject);
  child.on('exit', code => code === 0 ? resolve(out) : reject(Error(`exit ${code}: ${err}`)));
});
/** Runs the real admission hook once (pre or post) with `call` on stdin. */
const hook = (mode: string, state: string, call: object) => new Promise<void>((resolve, reject) => {
  const child = spawn(process.execPath, [TOOL_HOOK_SCRIPT, mode, state], { stdio: ['pipe', 'ignore', 'pipe'] });
  let err = '';
  child.stderr.on('data', chunk => { err += chunk; });
  child.on('exit', code => code === 0 ? resolve() : reject(Error(`hook ${mode} exit ${code}: ${err}`)));
  child.stdin.end(JSON.stringify(call));
});

it('an MCP server takes its credential by SecretRef: that server alone gets the value, an ordinary env setting still works, and no file under the root holds it after the turn', async () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'secret-at-rest-mcp-')));
  try {
    const journal = openPreviewJournal(join(root, 'journal.encrypted'), key, { ...genesis, maxCalls: 60 });
    const custody = createSecretCustody(root, key, () => 1000);
    // An opaque synthetic credential (no recognisable shape): only the runner's exact-value scrub can find it.
    const OPAQUE = `zq-${'4f'.repeat(20)}`, hash = (value: string) => createHash('sha256').update(value).digest('hex');
    const ref = custody.store({ value: OPAQUE, kind: 'api-key', source: 'test' });
    // A stand-in server: it reports a digest of the credential it was given (never the value) and its ordinary setting.
    const report = join(root, 'report.cjs');
    writeFileSync(report, "const v = process.env.TOKEN; process.stdout.write(JSON.stringify({ token: v ? require('crypto')"
      + ".createHash('sha256').update(v).digest('hex') : null, level: process.env.LOG_LEVEL ?? null }));\n");
    writeFileSync(join(root, 'mcp.json'), JSON.stringify({ mcpServers: {
      keyed: { command: process.execPath, args: [report], env: { TOKEN: { secretRef: ref.name }, LOG_LEVEL: 'debug' } },
      plain: { command: process.execPath, args: [report], env: { LOG_LEVEL: 'info' } } }, reads: ['mcp__keyed__lookup'] }));
    const mcp = readRootMcp(root);
    expect(mcp.secrets).toEqual({ keyed: { TOKEN: ref.name }, plain: {} });
    let socket = '';
    const outcome = await runToolTurn({ journal, root, id: 'telegram:12345678:update:1', prepared: '{"q":1}', promptLimit: 32768,
      deniedRoots: [root], operations: SINGLE_MACHINE_PROFILE.operations, now: () => 10, redactText: (text: string) => redact(text).text,
      fallback: async () => ({ result: 'text-only' }), scratch: plainScratch, detach: () => true, mcp,
      resolveSecret: (name: string) => custody.resolve(secretRef(name)),
      invoke: async (turn: { stateDirectory: string; mcp: { config: string; socket: string } }) => {
        socket = turn.mcp.socket;
        const servers = JSON.parse(readFileSync(turn.mcp.config, 'utf8')).mcpServers;
        // The launch configuration holds the SecretRef's server behind the launcher and no value.
        expect(JSON.stringify(servers)).not.toContain(OPAQUE);
        const [keyed, plain] = [JSON.parse(await launch(servers.keyed)), JSON.parse(await launch(servers.plain))];
        // The intended server got the value (and its ordinary setting); the other server got only its ordinary setting.
        expect(keyed).toEqual({ token: hash(OPAQUE), level: 'debug' });
        expect(plain).toEqual({ token: null, level: 'info' });
        // The value is handed out once: a second launch presenting the same nonce gets nothing.
        await expect(launch(servers.keyed)).rejects.toThrow(/no credentials served for keyed/u);
        // The real hook records a tool result carrying the opaque value and a recognisable credential.
        await hook('pre', turn.stateDirectory, { tool_use_id: 't1', tool_name: 'mcp__keyed__lookup', tool_input: { key: 'a' } });
        await hook('post', turn.stateDirectory, { tool_use_id: 't1', tool_name: 'mcp__keyed__lookup',
          tool_response: { content: [{ type: 'text', text: `found ${OPAQUE} and ${GITHUB}` }] } });
        expect(readFileSync(join(turn.stateDirectory, 'admission.jsonl'), 'utf8')).toContain(OPAQUE);
        return 'answer';
      } });
    expect(outcome.result).toBe('answer');
    expect(outcome.trace.calls[0]).toMatchObject({ tool: 'mcp__keyed__lookup', decision: 'allow' });
    expect(String(outcome.trace.calls[0].result)).toContain(`[credential: SecretRef preview/${ref.name}]`);
    expect(existsSync(socket)).toBe(false);
    // When the turn ends, no file under the root holds either tested value or the storage key.
    expect(plaintextHolders(root, [OPAQUE, GITHUB, ...KEY_FORMS])).toEqual([]);
    // The other side: a credential the vault cannot open refuses the tool turn (answered without tools, nothing launched).
    let launched = 0;
    const refused = await runToolTurn({ journal, root, id: 'telegram:12345678:update:2', prepared: '{"q":1}', promptLimit: 32768,
      deniedRoots: [root], operations: SINGLE_MACHINE_PROFILE.operations, now: () => 11, redactText: (text: string) => text,
      fallback: async () => ({ result: 'text-only' }), scratch: plainScratch, detach: () => true, mcp,
      resolveSecret: () => { throw Error('missing'); }, invoke: async () => { launched++; } });
    expect([refused, launched, journal.view.toolTurns?.refusedCredential]).toEqual([{ result: 'text-only' }, 0, 1]);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
