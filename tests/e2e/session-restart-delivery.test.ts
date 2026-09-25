import { spawnSync } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { chmodSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, it } from 'vitest';
import { assemblyRuntimeFixture } from '../assembly/runtime-fixture.js';
import { value } from '../facts/fixtures.js';
import { createProductionSessionDriver } from '../../src/assembly/production-session-driver.js';
// @ts-expect-error physical JS host is intentionally outside the pure core
import { createProductionSessionIO } from '../../scripts/production-session-io.mjs';

const tmux = '/opt/homebrew/bin/tmux';
const available = spawnSync(tmux, ['-V'], { encoding: 'utf8' }).status === 0;
const hash = (text: string) => `sha256:${createHash('sha256').update(text).digest('hex')}`;
it.skipIf(!available)('one boot redelivery after server dies between durable record and tmux injection', () => {
  const root = mkdtempSync(join(tmpdir(), 'instar20-restart-'));
  const socket = `instar20-restart-${randomUUID().slice(0, 8)}`;
  const executable = join(root, 'prompt.sh');
  writeFileSync(executable, '#!/bin/sh\nprintf "❯ "\nwhile IFS= read -r line; do printf "\\nseen:%s\\n❯ " "$line"; done\n');
  chmodSync(executable, 0o700);
  const physical = createProductionSessionIO({ stateDirectory: root, tmuxPath: tmux,
    home: root, configHome: root, cwd: root });
  const io = { ...physical, tmux: (args: readonly string[]) => physical.tmux(['-L', socket, ...args]) };
  const f = assemblyRuntimeFixture();
  const config = { operatorOwnUse: true as const, confinement: 'unconfined' as const, framework: 'claude-code' as const,
    executable, cwd: root, home: root, configHome: root, context: f.c, io,
    now: Date.now, stopped: () => false, resolveIntake: () => 'restart message',
    maxSessions: 1, turnDeadlineMs: 3000, readyTimeoutMs: 3000, protectedSessions: [] };
  try {
    const first = createProductionSessionDriver(config);
    const identity = value(first.launch({ operation: 'launch', claim: 'topic', artifact: 'sha256:test',
      incarnation: 'inc', workingScope: root, handles: [] }));
    const name = identity.split(':')[0]!;
    const baseline = hash(io.tmux(['capture-pane', '-p', '-t', `=${name}:`, '-S', '-80']).stdout.trim());
    const record = { operation: 'delivery', identity, intake: 'input', digest: hash('restart message'),
      text: 'restart message', state: 'prepared', baseline, redeliveries: 0, evidence: '' };
    const worker = fileURLToPath(new URL('./session-restart-delivery-worker.mjs', import.meta.url));
    const child = spawnSync(process.execPath, [worker, root, Buffer.from(JSON.stringify(record)).toString('base64url')],
      { encoding: 'utf8', timeout: 3000 });
    expect(child.signal).toBe('SIGKILL');
    expect(io.load().deliveries[0]?.state).toBe('prepared');
    const restarted = createProductionSessionDriver(config);
    expect(value(restarted.bootSweep())).toEqual(['delivery:redelivered']);
    let output = '';
    for (let attempt = 0; attempt < 15 && !output.includes('seen:restart message'); attempt++) {
      output = io.tmux(['capture-pane', '-p', '-t', `=${name}:`, '-S', '-30']).stdout;
      if (!output.includes('seen:restart message')) io.sleep(50);
    }
    expect(output).toContain('seen:restart message');
    expect(value(restarted.bootSweep())).toEqual([]);
    expect(io.load().deliveries[0]?.redeliveries).toBe(1);
    value(restarted.stop());
  } finally {
    for (const row of io.load().sessions) io.tmux(['kill-session', '-t', `=${row.name}:`]);
    io.tmux(['kill-server']);
    rmSync(root, { recursive: true, force: true });
  }
});
