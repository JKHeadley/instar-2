import { afterEach, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { admissionArgs } from '../../src/assembly/production-session-driver.js';
// @ts-expect-error Host-only projection.
import { admissionActivity, createWorkingActivities } from './working-activity.mjs';

const fixture = new URL('./fixtures/progress-stale-2026-10-16/', import.meta.url);
const prefix = readFileSync(new URL('first-progress-admission-prefix.jsonl', fixture), 'utf8');
const captured = JSON.parse(readFileSync(new URL('failed-completions.json', fixture), 'utf8')) as {
  failures: { use: { id: string; name: string; input: object }; completion: { result: string; isError: boolean } }[];
};
const claim = 'conversation-0818985ed014457789ca2241189ba345-1';
const roots: string[] = [];
afterEach(() => { for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }); });
const runFailure = (over: object = {}, index = 0) => {
  const root = mkdtempSync(join(tmpdir(), 'progress-failure-')); roots.push(root);
  // A failure must not report an effect success to this unreachable checkpoint.
  writeFileSync(join(root, 'config.json'), JSON.stringify({ gate: 'http://127.0.0.1:1/unreachable' }));
  const { use, completion } = captured.failures[index]!;
  // The live run had no failure hook installed. Replay its exact recorded id, input and
  // failed result in the documented failure-event envelope; this envelope is reconstructed.
  const input = { hook_event_name: 'PostToolUseFailure', tool_use_id: use.id,
    tool_name: use.name, tool_input: use.input, error: completion.result, ...over };
  const result = spawnSync(process.execPath, [join(__dirname, 'tool-admission-hook.mjs'), 'post', root],
    { input: JSON.stringify(input), encoding: 'utf8', timeout: 3000 });
  let bytes = ''; try { bytes = readFileSync(join(root, 'admission.jsonl'), 'utf8'); } catch { /* invalid evidence */ }
  return { result, bytes };
};

it('registers failure completion on the actual session launch, retaining the existing timeout', () => {
  const args = admissionArgs('claude-code', { command: (id, phase) => `/node /hook.mjs ${phase} /state/${id}`, timeoutSeconds: 600 }, claim);
  const settings = JSON.parse(args[1]!);
  expect(settings.hooks.PostToolUseFailure).toEqual(settings.hooks.PostToolUse);
  expect(settings.hooks.PostToolUseFailure[0].hooks[0].timeout).toBe(600);
});

it('replays message 744 exact raw prefix/hash, then clears the ended step through the executable failure hook', () => {
  expect(createHash('sha256').update(prefix).digest('hex')).toBe('259e71a4c73df06aa0dcce2c9678417ec31b92b30ecf1e5e93a23ce7bbcb5fd9');
  expect(admissionActivity(prefix, 0, claim)).toEqual({ text: 'Status: List workspace contents',
    step: 'bd1def8ea6ccdde4bbb04fbe6186621d5252625deb70b687025681528f9ff934' });
  const { result, bytes } = runFailure();
  expect(result.status).toBe(0);
  expect(JSON.parse(bytes)).toMatchObject({ phase: 'post-failure', id: captured.failures[0]!.use.id });
  expect(admissionActivity(prefix + bytes, 0, claim)?.text).toBe('Status: no tool step running');
});

it.each([0, 1, 2])('recorded failure %i stays failed; matched activity closes and final answer removes the observation', index => {
  const { use, completion } = captured.failures[index]!;
  expect(completion.isError).toBe(true);
  let bytes = '', now = 1;
  const reader = createWorkingActivities({ read: () => bytes, now: () => now });
  reader.observe('turn', claim, 'start');
  bytes = JSON.stringify({ phase: 'pre', id: use.id, tool: use.name, input: JSON.stringify(use.input), decision: 'allow' }) + '\n';
  reader.observe('turn', claim, 'working');
  expect(reader.current('turn')?.text).not.toBe('Status: no tool step running');
  const failed = runFailure({}, index); expect(failed.result.status).toBe(0);
  const row = JSON.parse(failed.bytes);
  expect(row.phase).toBe('post-failure'); expect(row.result).toBe(JSON.stringify(completion.result));
  bytes += failed.bytes;
  expect(reader.current('turn')?.text).toBe('Status: no tool step running');
  now += 10001; expect(reader.current('turn')).toBeNull();
  reader.observe('turn', claim, 'working'); expect(reader.current('turn')).not.toBeNull();
  reader.observe('turn', claim, 'end'); expect(reader.current('turn')).toBeNull();
});

it.each([{ tool_use_id: 'different-occurrence' }, { tool_name: 'Read' }, { agent_id: 'child' }])('a mismatched failure does not close another occurrence: %j', over => {
  const { bytes, result } = runFailure(over); expect(result.status).toBe(0);
  expect(admissionActivity(prefix + bytes, 0, claim)?.text).toBe('Status: List workspace contents');
});

it.each([{ tool_use_id: null }, { tool_name: null }, { error: null }])('malformed failure evidence stays unknown: %j', over => {
  const { bytes, result } = runFailure(over);
  expect(result.status).not.toBe(0); expect(bytes).toBe('');
  expect(admissionActivity(prefix + bytes, 0, claim)?.text).toBe('Status: List workspace contents');
});

it('an effect failure closes activity without making a successful post or a new admission decision', () => {
  const { bytes, result } = runFailure({ tool_name: 'mcp__service__send' });
  expect(result.status).toBe(0); expect(result.stdout).toBe('');
  expect(JSON.parse(bytes)).toMatchObject({ phase: 'post-failure', tool: 'mcp__service__send' });
});

it('closes only the completed occurrence, preserves concurrent work, and ignores duplicate failure completion', () => {
  const { bytes } = runFailure();
  const concurrent = JSON.stringify({ phase: 'pre', id: 'still-running', tool: 'Bash',
    input: JSON.stringify({ description: 'Inspect the failed test', command: 'cat report.txt' }), decision: 'allow' }) + '\n';
  expect(admissionActivity(prefix + concurrent + bytes + bytes, 0, claim)?.text).toBe('Status: Inspect the failed test');
  expect(admissionActivity(prefix + concurrent + bytes + JSON.stringify({ phase: 'post', id: 'still-running', tool: 'Bash' }) + '\n', 0, claim)?.text)
    .toBe('Status: no tool step running');
  // A partial failure row is not completion evidence. A corrupt complete record is unknown.
  expect(admissionActivity(prefix + bytes.trimEnd(), 0, claim)?.text).toBe('Status: List workspace contents');
  expect(admissionActivity(prefix + '{broken}\n', 0, claim)).toBeNull();
  expect(admissionActivity(bytes, 0, claim)).toBeNull(); // no admitted occurrence in this turn
});
