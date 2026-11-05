// Carryover row 03: the production session IO's transcript tail reader for the carried detectors.
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync, realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, expect, it } from 'vitest';
// @ts-expect-error -- host composition module is JavaScript, exercised at runtime.
import { createProductionSessionIO } from '../../scripts/production-session-io.mjs';

const roots: string[] = [];
afterEach(() => { for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }); });
const ID = '0f3c2a9e-1b2c-4d5e-8f90-123456789abc';
function fixture() {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'session-io-transcript-'))); roots.push(root);
  const home = join(root, 'home'), state = join(root, 'state'), project = join(root, 'project');
  for (const dir of [home, state, project]) mkdirSync(dir, { recursive: true });
  const io = createProductionSessionIO({ stateDirectory: state, home, configHome: home, cwd: project }) as {
    readTranscriptTail(framework: string, id: string, cwd: string, configHome: string, maxBytes?: number): { sessionUuid: string; entries: { type: string; timestampMs?: number; message?: unknown }[]; path: string; size: number; mtime: number } | null;
  };
  const folder = join(home, 'projects', project.replace(/[/.]/g, '-'));
  mkdirSync(folder, { recursive: true });
  const file = join(folder, `${ID}.jsonl`);
  return { io, home, project, folder, file };
}

it('parses the tail into typed entries with epoch timestamps, skipping a partial first line and malformed lines', () => {
  const f = fixture();
  const rows = [
    { type: 'user', timestamp: '2026-11-04T10:00:00.000Z', message: { role: 'user', content: 'hi' }, uuid: 'u1', padding: 'x'.repeat(1500) },
    { type: 'assistant', timestamp: '2026-11-04T10:00:05.000Z', message: { role: 'assistant', stop_reason: 'tool_use', content: [{ type: 'tool_use', id: 't1', name: 'Bash', input: { command: 'ls' } }] } },
    { type: 'progress', timestamp: 'not a date' },
  ];
  writeFileSync(f.file, `${rows.map(row => JSON.stringify(row)).join('\n')}\n{"broken":\n`);
  const whole = f.io.readTranscriptTail('claude-code', ID, f.project, f.home)!;
  expect(whole.sessionUuid).toBe(ID); expect(whole.path).toBe(f.file); expect(whole.size).toBeGreaterThan(0);
  expect(whole.entries).toEqual([
    { type: 'user', timestampMs: Date.parse('2026-11-04T10:00:00.000Z'), message: { content: 'hi' } },
    { type: 'assistant', timestampMs: Date.parse('2026-11-04T10:00:05.000Z'), message: { stop_reason: 'tool_use', content: [{ type: 'tool_use', id: 't1', name: 'Bash', input: { command: 'ls' } }] } },
    { type: 'progress' },
  ]);
  // A bounded tail drops the partial line it starts in.
  const bounded = f.io.readTranscriptTail('claude-code', ID, f.project, f.home, 1024)!;
  expect(bounded.entries.length).toBeLessThan(whole.entries.length);
  expect(bounded.entries.at(-1)).toEqual({ type: 'progress' });
  expect(bounded.size).toBe(whole.size);
});

it('returns null for another framework, a non-uuid id, an absent file, a symlink or an unbounded request', () => {
  const f = fixture();
  writeFileSync(f.file, `${JSON.stringify({ type: 'user', timestamp: '2026-11-04T10:00:00.000Z' })}\n`);
  expect(f.io.readTranscriptTail('codex-cli', ID, f.project, f.home)).toBeNull();
  expect(f.io.readTranscriptTail('claude-code', 'not-a-uuid', f.project, f.home)).toBeNull();
  expect(f.io.readTranscriptTail('claude-code', '0f3c2a9e-1b2c-4d5e-8f90-123456789abd', f.project, f.home)).toBeNull();
  const linked = '0f3c2a9e-1b2c-4d5e-8f90-123456789abe';
  symlinkSync(f.file, join(f.folder, `${linked}.jsonl`));
  expect(f.io.readTranscriptTail('claude-code', linked, f.project, f.home)).toBeNull();
  expect(f.io.readTranscriptTail('claude-code', ID, f.project, f.home, 16)).toBeNull();
  expect(f.io.readTranscriptTail('claude-code', ID, f.project, f.home, 64 * 1024 * 1024)).toBeNull();
  expect(f.io.readTranscriptTail('claude-code', ID, f.project, f.home)!.entries).toHaveLength(1);
});
