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

it('the shipped full-input snapshot survives native compaction and changes the exact worker revision', async () => {
  // @ts-expect-error The production physical boundary is a native ESM script.
  const { createProductionSessionIO, createSessionGrounding } = await import('../../scripts/production-session-io.mjs');
  const root = mkdtempSync(join(tmpdir(), 'instar20-grounding-'));
  const script = fileURLToPath(new URL('../../scripts/session-hooks/stop.mjs', import.meta.url));
  const io = createProductionSessionIO({ stateDirectory: root, home: root, configHome: root, cwd: root });
  const name = `instar20-${'b'.repeat(24)}`, worker = { launch: `${name}:123:1` };
  io.save({ sessions: [{ name, identity: worker.launch }], deliveries: [], resumes: {} });
  const grounding = createSessionGrounding(() => io, 'main');
  const text = `Full current operation, instructions and packet\n${'é'.repeat(90000)}`;
  try {
    expect(grounding.revision(worker)).toBe('[]');
    grounding.save(worker, text);
    const compact = spawnSync(process.execPath, [script, 'compact'], { env: { PATH: '/usr/bin:/bin',
      INSTAR_SESSION_NAME: name, INSTAR_SESSION_INBOX: io.inboxDirectory, INSTAR_SESSION_GROUNDING_FILE: grounding.file() },
    input: JSON.stringify({ session_id: 'exact-session' }), encoding: 'utf8' });
    expect(compact.status).toBe(0);
    expect(JSON.parse(compact.stdout).hookSpecificOutput.additionalContext).toBe(text);
    expect(JSON.parse(grounding.revision(worker))).toEqual([expect.objectContaining({ kind: 'compact', sessionId: 'exact-session' })]);
    const revision = grounding.revision(worker);
    grounding.save(worker, 'the next complete input');
    expect(readFileSync(grounding.file(), 'utf8')).toBe('the next complete input');
    expect(grounding.revision(worker)).toBe(revision);
    expect(createSessionGrounding(() => io, '123').file()).not.toBe(grounding.file());
    expect(() => grounding.revision({ launch: 'another-worker' })).toThrow('grounding worker missing');
    expect(() => grounding.save(worker, 'x'.repeat(1_048_577))).toThrow('outside delivery bound');
    writeFileSync(grounding.file(), 'x'.repeat(1_048_577));
    const tooLarge = spawnSync(process.execPath, [script, 'compact'], { env: { PATH: '/usr/bin:/bin',
      INSTAR_SESSION_NAME: name, INSTAR_SESSION_INBOX: io.inboxDirectory, INSTAR_SESSION_GROUNDING_FILE: grounding.file() },
    input: JSON.stringify({ session_id: 'exact-session' }), encoding: 'utf8' });
    expect(tooLarge.status).toBe(2); expect(tooLarge.stdout).toBe('');
  } finally { rmSync(root, { recursive: true, force: true }); }
});
