import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, it } from 'vitest';

it('Stop receipt is durable and SessionStart(compact) returns grounding from a local file', () => {
  const root = mkdtempSync(join(tmpdir(), 'instar20-hook-'));
  const script = fileURLToPath(new URL('../../scripts/session-hooks/stop.mjs', import.meta.url));
  const grounding = join(root, 'grounding.txt');
  writeFileSync(grounding, 'Retained operator context.');
  const env = { PATH: '/usr/bin:/bin', INSTAR_SESSION_NAME: `instar20-${'a'.repeat(24)}`,
    INSTAR_SESSION_INBOX: root, INSTAR_SESSION_GROUNDING_FILE: grounding };
  try {
    const stop = spawnSync(process.execPath, [script], { env, input: JSON.stringify({ session_id: 'id' }), encoding: 'utf8' });
    expect(stop.status).toBe(0);
    const compact = spawnSync(process.execPath, [script, 'compact'], { env,
      input: JSON.stringify({ session_id: 'id' }), encoding: 'utf8' });
    expect(compact.status).toBe(0);
    expect(JSON.parse(compact.stdout).hookSpecificOutput.additionalContext).toBe('Retained operator context.');
    expect(readdirSync(root).filter(name => name.endsWith('.json')).map(name =>
      JSON.parse(readFileSync(join(root, name), 'utf8')).kind).sort()).toEqual(['compact', 'turn-closed']);
    expect(readdirSync(root).filter(name => name.endsWith('.json')).map(name =>
      JSON.parse(readFileSync(join(root, name), 'utf8')).receiptId)).toEqual([
      expect.stringMatching(/^[0-9a-f-]{36}$/), expect.stringMatching(/^[0-9a-f-]{36}$/),
    ]);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

// The keys and task shapes of a real Claude Code 2.1.280 Stop, recorded 2026-11-07 with a logging hook.
it.each([
  ['running helpers and shells', [{ id: 'a78afa9d873f954db', type: 'subagent', status: 'running', description: 'd', agent_type: 'general-purpose' },
    { id: 'boc9lx4cx', type: 'shell', status: 'running', description: 'd', command: 'sleep 40' }], 2],
  ['nothing left running', [], 0],
  ['only finished work', [{ id: 'x', type: 'shell', status: 'completed' }], 0],
  ['a harness that reports nothing', undefined, undefined],
])('the Stop receipt carries the harness count for %s', (_name, tasks, expected) => {
  const root = mkdtempSync(join(tmpdir(), 'instar20-hook-'));
  const script = fileURLToPath(new URL('../../scripts/session-hooks/stop.mjs', import.meta.url));
  try {
    const stop = spawnSync(process.execPath, [script], { encoding: 'utf8',
      env: { PATH: '/usr/bin:/bin', INSTAR_SESSION_NAME: `instar20-${'a'.repeat(24)}`, INSTAR_SESSION_INBOX: root },
      input: JSON.stringify({ session_id: 'id', hook_event_name: 'Stop', stop_hook_active: false, last_assistant_message: 'x',
        session_crons: [], ...(tasks === undefined ? {} : { background_tasks: tasks }) }) });
    expect(stop.status, stop.stderr).toBe(0);
    const [receipt] = readdirSync(root).filter(name => name.endsWith('.json')).map(name => JSON.parse(readFileSync(join(root, name), 'utf8')));
    expect(receipt.background).toBe(expected);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
