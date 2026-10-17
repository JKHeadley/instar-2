import { spawnSync } from 'node:child_process';
import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, it } from 'vitest';

it.each(['waiting', 'sending', 'accepted', 'ordinary', 'closed', 'different-process'])(
  'independent deadline retains its brake for %s recovery', state => {
    const root = mkdtempSync(join(tmpdir(), 'deadline-recovery-'));
    const name = `instar20-${'a'.repeat(24)}`, identity = `${name}:123:456`;
    const deadline = Date.now() + 100, journal = join(root, 'sessions.json'), calls = join(root, 'calls');
    const tmux = join(root, 'tmux.mjs');
    try {
      writeFileSync(tmux, `#!${process.execPath}\nimport { appendFileSync } from 'node:fs';\n`
        + `appendFileSync(${JSON.stringify(calls)}, JSON.stringify(process.argv.slice(2))+'\\n');\n`
        + `if(process.argv[2]==='display-message') console.log(${JSON.stringify(state === 'different-process' ? '999:456' : '123:456')});\n`);
      chmodSync(tmux, 0o700);
      writeFileSync(journal, JSON.stringify({ deliveries: [], resumes: {}, sessions: [{ name, identity, turnDeadline: deadline,
        turnStartedAt: deadline - 1000, closedAt: state === 'closed' ? deadline - 10 : null,
        ...(state === 'ordinary' ? {} : { rateRecovery: { state, dueAt: deadline - 50 } }) }] }));
      writeFileSync(join(root, `${name}.stop.json`), JSON.stringify({ kind: 'turn-closed', at: deadline - 20 }));
      const result = spawnSync(process.execPath, [fileURLToPath(new URL('../../scripts/session-deadline-watchdog.mjs', import.meta.url)),
        journal, root, tmux, name, identity, String(deadline)], { encoding: 'utf8', timeout: 5000 });
      expect(result.status, result.stderr).toBe(0);
      let observed = '';
      try { observed = readFileSync(calls, 'utf8'); } catch { /* No call is the ordinary closed-turn result. */ }
      expect(observed.includes('kill-session')).toBe(!['ordinary', 'closed', 'different-process'].includes(state));
    } finally { rmSync(root, { recursive: true, force: true }); }
  });
