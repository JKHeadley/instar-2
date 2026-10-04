// The secrets floor held at the source (docs/defects/2026-10-03-file-tool-swap-race.md): the file tools are checked
// when the hook admits a call, not when the harness opens the file, so the floor cannot rest on which paths a tool can
// reach. It rests on what is on disk: every file a root holds carries a secret value only as ciphertext under the
// storage key, which lives in the runner's environment alone (never the harness's environment, argv or a file). This
// test drives a root through the paths that handle secret values (a credential handed over in chat, with and without
// custody, a tool turn with the root's MCP servers) and then reads every byte under the root.
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, realpathSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { createJournalWorker, openPreviewJournal } from './journal.js';
import { createSecretCustody } from './secret-custody.js';
// @ts-expect-error The runner side stays plain JavaScript.
import { prepareToolTurn, readRootMcp } from './tool-turn.mjs';

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
    // The root's MCP servers: an env block refuses, so no credential reaches the turn's copy; the accepted file
    // (commands and arguments only) is copied into the admission state.
    writeFileSync(join(root, 'mcp.json'), JSON.stringify({ mcpServers: { notes: { command: '/usr/bin/true', env: { TOKEN: GITHUB } } } }));
    expect(() => readRootMcp(root)).toThrow(/only command and args/u);
    writeFileSync(join(root, 'mcp.json'), JSON.stringify({ mcpServers: { notes: { command: '/usr/bin/true', args: ['--read-only'] } },
      reads: ['mcp__notes__lookup'] }));
    const turn = prepareToolTurn({ root, operation: 'telegram:1:update:1', attempt: 0, operations: [], mcp: readRootMcp(root), scratch: plainScratch });
    expect(turn.mcp?.servers).toEqual(['notes']);
    if (vaulted) expect(readdirSync(join(root, 'vault')).length).toBeGreaterThan(0);
    // The property: no file anywhere under the root holds a credential or the storage key in plaintext.
    expect(plaintextHolders(root, [GITHUB, TELEGRAM, ...KEY_FORMS])).toEqual([]);
    // The other side: the sweep sees a plaintext value when one is there (a file the operator placed by hand).
    writeFileSync(join(root, 'operator-note.txt'), `left here: ${TELEGRAM}`);
    expect(plaintextHolders(root, [GITHUB, TELEGRAM, ...KEY_FORMS])).toEqual(['operator-note.txt']);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
