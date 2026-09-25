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
  } finally { rmSync(root, { recursive: true, force: true }); }
});
