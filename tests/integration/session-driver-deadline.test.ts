import { spawnSync } from 'node:child_process';
import { chmodSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { expect, it } from 'vitest';
// @ts-expect-error physical JS host is intentionally outside the pure core
import { createProductionSessionIO } from '../../scripts/production-session-io.mjs';

const tmux = '/opt/homebrew/bin/tmux';
const available = spawnSync(tmux, ['-V'], { encoding: 'utf8' }).status === 0;
it.skipIf(!available)('independent deadline kills only the exact tmux identity after the server is absent', () => {
  const root = mkdtempSync(join(tmpdir(), 'instar20-deadline-'));
  const socket = `instar20-deadline-${randomUUID().slice(0, 8)}`;
  const wrapper = join(root, 'tmux');
  writeFileSync(wrapper, `#!/bin/sh\nexec ${tmux} -L ${socket} "$@"\n`);
  chmodSync(wrapper, 0o700);
  const io = createProductionSessionIO({ stateDirectory: root, tmuxPath: wrapper,
    home: root, configHome: root, cwd: root });
  const name = `instar20-${randomUUID().replaceAll('-', '').slice(0, 24)}`;
  try {
    expect(io.tmux(['new-session', '-d', '-s', name, '--', '/bin/cat']).code).toBe(0);
    const stamp = io.tmux(['display-message', '-p', '-t', `=${name}:`, '#{pane_pid}:#{session_created}']).stdout.trim();
    const identity = `${name}:${stamp}`, deadline = Date.now() + 300;
    io.save({ sessions: [{ name, identity, turnDeadline: deadline, turnStartedAt: Date.now(), closedAt: null }],
      deliveries: [], resumes: {} });
    io.armDeadline(name, identity, deadline);
    let alive = true;
    for (let attempt = 0; attempt < 25 && alive; attempt++) {
      io.sleep(50);
      alive = io.tmux(['has-session', '-t', `=${name}:`]).code === 0;
    }
    expect(alive).toBe(false);
  } finally {
    io.tmux(['kill-session', '-t', `=${name}:`]); io.tmux(['kill-server']);
    rmSync(root, { recursive: true, force: true });
  }
});
