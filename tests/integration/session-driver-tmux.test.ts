import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { expect, it } from 'vitest';
import { chunkLiteralForTmux } from '../../src/assembly/production-session-driver.js';

const tmux = '/opt/homebrew/bin/tmux';
const available = spawnSync(tmux, ['-V'], { encoding: 'utf8' }).status === 0;

it.skipIf(!available)('real tmux literal chunks reach only the exact session', () => {
  const socket = `instar20-test-${randomUUID().slice(0, 8)}`;
  const name = `instar20-${randomUUID().replaceAll('-', '').slice(0, 24)}`;
  const run = (args: string[]) => spawnSync(tmux, ['-L', socket, ...args], { encoding: 'utf8', timeout: 3000 });
  try {
    expect(run(['new-session', '-d', '-s', name, '--', '/bin/cat']).status).toBe(0);
    const payload = '🙂'.repeat(2200);
    for (const chunk of chunkLiteralForTmux(payload))
      expect(run(['send-keys', '-t', `=${name}:`, '-l', '--', chunk]).status).toBe(0);
    expect(run(['send-keys', '-t', `=${name}:`, 'Enter']).status).toBe(0);
    const pane = run(['capture-pane', '-p', '-t', `=${name}:`, '-S', '-200']).stdout;
    expect(pane).toContain('🙂');
  } finally {
    run(['kill-session', '-t', `=${name}:`]);
    run(['kill-server']);
  }
});
