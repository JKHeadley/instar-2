import { expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
// @ts-expect-error Host-only JavaScript reader.
import { admissionActivity, createWorkingActivities } from './working-activity.mjs';
const pre = (id: string, input: object = { description: 'Run the build', command: 'npm run build' }) => JSON.stringify({ phase: 'pre', id, tool: 'Bash', input: JSON.stringify(input), decision: 'allow' }) + '\n';
const post = (id: string) => JSON.stringify({ phase: 'post', id, tool: 'Bash' }) + '\n';
it('prefers the self-written description; completed work is explicit, malformed, denied or empty activity is silent', () => {
  expect(admissionActivity(pre('a'), 0, 'claim')).toMatchObject({ text: 'Status: Run the build', running: true });
  expect(admissionActivity(pre('a') + post('a'), 0, 'claim')?.text).toBe('Status: latest main-session tool call ended');
  expect(admissionActivity(pre('a', { command: 'npm run build' }) + post('a'), 0, 'claim')?.text).toBe('Status: latest main-session tool call ended');
  expect(admissionActivity(pre('a').replace('allow', 'deny'), 0, 'claim')).toBeNull();
  expect(admissionActivity(pre('a', {}), 0, 'claim')).toBeNull();
  expect(admissionActivity('{bad}\n', 0, 'claim')).toBeNull();
  expect(admissionActivity(null, 0, 'claim')).toBeNull();
});
it('a current admission and fresh live observation are both required, scoped to the operation', () => {
  let bytes = pre('old'), now = 1;
  const reader = createWorkingActivities({ read: () => bytes, now: () => now });
  reader.observe('one', 'claim', 'start'); reader.observe('one', 'claim', 'working');
  expect(reader.current('one')).toBeNull(); // previous turn is never activity for this message
  bytes += pre('current'); reader.observe('one', 'claim', 'working'); expect(reader.current('one')?.text).toBe('Status: Run the build');
  expect(reader.current('two')).toBeNull();
  now = 10002; expect(reader.current('one')).toBeNull();
  reader.observe('one', 'claim', 'working'); expect(reader.current('one')).toBeNull();
  bytes += post('current'); reader.observe('one', 'claim', 'working'); expect(reader.current('one')).toBeNull();
  bytes += pre('next'); reader.observe('one', null, 'end'); expect(reader.current('one')).toBeNull();
});
it('replays real native tool admission bytes from the 2026-10-03 live task, without fabricated activity', () => {
  const record = JSON.parse(readFileSync(new URL('./fixtures/native-loop/live-2026-10-03/task.json', import.meta.url), 'utf8'));
  const rows: string[] = record.admission.trim().split('\n');
  expect(admissionActivity(rows[0] + '\n', 0, 'live-task')?.text).toBe('Status: Write: note.txt');
  expect(admissionActivity(rows.slice(0, 2).join('\n') + '\n', 0, 'live-task')?.text).toBe('Status: latest main-session tool call ended');
  expect(admissionActivity(rows.slice(0, 3).join('\n') + '\n', 0, 'live-task')?.text).toBe('Status: Bash: wc -c note.txt');
  expect(admissionActivity(record.admission, 0, 'live-task')?.text).toBe('Status: latest main-session tool call ended');
});

it('a background launch ending says nothing about its still-running child', () => {
  const record = JSON.parse(readFileSync(new URL('./fixtures/tool-turn/full-2026-10-03/full.json', import.meta.url), 'utf8'));
  const rows = record.admission.trim().split('\n').map((line: string) => JSON.parse(line));
  const root = rows.find((row: { phase: string; tool: string }) => row.phase === 'pre' && row.tool === 'Agent');
  const child = rows.find((row: { phase: string; agent?: string }) => row.phase === 'pre' && row.agent);
  expect(root.id).toBe('toolu_011UxyZm7R9tq2cESA3VTdtL');
  expect(child.id).toBe('toolu_01DijeyW41oZMVY7foS3BJKD');
  // Captured root/child admissions; the background flag and launch acknowledgement
  // construct the reviewer's supported asynchronous neighbor, not a captured async run.
  const launch = { ...root, input: JSON.stringify({ ...JSON.parse(root.input), run_in_background: true }) };
  const ended = { phase: 'post', id: root.id, tool: 'Agent', agent: child.agent,
    result: JSON.stringify({ status: 'async_launched', agentId: child.agent }) };
  const bytes = (items: object[]) => items.map(row => JSON.stringify(row) + '\n').join('');
  const running = admissionActivity(bytes([launch, child]), 0, 'async-neighbor');
  expect(running?.text).toBe('Status: Compute 6*7 via Bash');
  const completed = admissionActivity(bytes([launch, ended, child]), 0, 'async-neighbor');
  expect(completed?.text).toBe('Status: latest main-session tool call ended');
  expect(completed?.step).toBe(running?.step);
  expect(running?.running).toBe(true);
  expect(completed?.running).toBe(false);
  expect(admissionActivity(bytes([child]), 0, 'async-neighbor')).toBeNull();
  expect(admissionActivity(bytes([launch, ended, child]) + pre('next'), 0, 'async-neighbor')?.text)
    .toBe('Status: Run the build');
});
it('fresh polls cannot renew unchanged tool evidence; only advancing admitted work renews liveness', () => {
  let bytes = '', now = 1;
  const reader = createWorkingActivities({ read: () => bytes, now: () => now });
  reader.observe('one', 'claim', 'start');
  bytes = pre('a'); reader.observe('one', 'claim', 'working');
  expect(reader.current('one')?.text).toBe('Status: Run the build');
  now = 120001; reader.observe('one', 'claim', 'working');
  expect(reader.current('one')).toBeNull();
  bytes += pre('b'); reader.observe('one', 'claim', 'working');
  expect(reader.current('one')?.text).toBe('Status: Run the build');
});
it('unreadable start establishes a baseline on recovery instead of announcing old work', () => {
  let bytes: string | null = null;
  const reader = createWorkingActivities({ read: () => bytes, now: () => 1 });
  reader.observe('one', 'claim', 'start');
  bytes = pre('old'); reader.observe('one', 'claim', 'working');
  expect(reader.current('one')).toBeNull();
  bytes += pre('new'); reader.observe('one', 'claim', 'working');
  expect(reader.current('one')).not.toBeNull();
});
it('a failed observation and recovery do not freshen the same stale step', () => {
  let bytes: string | null = '', now = 1;
  const reader = createWorkingActivities({ read: () => bytes, now: () => now });
  reader.observe('one', 'claim', 'start');
  bytes = pre('old'); reader.observe('one', 'claim', 'working');
  now = 20000; bytes = null; reader.observe('one', 'claim', 'working');
  bytes = pre('old'); reader.observe('one', 'claim', 'working');
  expect(reader.current('one')).toBeNull();
});

it('a clock rollback cannot make future observation current', () => {
  let bytes = '', now = 10;
  const reader = createWorkingActivities({ read: () => bytes, now: () => now });
  reader.observe('one', 'claim', 'start'); bytes = pre('a'); reader.observe('one', 'claim', 'working');
  now = 9; expect(reader.current('one')).toBeNull();
  now = 10; expect(reader.current('one')?.running).toBe(true);
  bytes += post('a'); expect(reader.current('one')?.running).toBe(false);
});

it('completion is reflected without renewing evidence and rollback polls cannot revive a future step', () => {
  let bytes = '', now = 10;
  const reader = createWorkingActivities({ read: () => bytes, now: () => now });
  reader.observe('one', 'claim', 'start');
  bytes = pre('a'); reader.observe('one', 'claim', 'working');
  now = 9; reader.observe('one', 'claim', 'working'); expect(reader.current('one')).toBeNull();
  now = 20; reader.observe('one', 'claim', 'working');
  bytes += post('a'); expect(reader.current('one')).toMatchObject({ running: false, observedAt: 10 });
  now = 10011; reader.observe('one', 'claim', 'working'); expect(reader.current('one')).toBeNull();
});

it('an unobserved new step cannot borrow the previous step timestamp', () => {
  let bytes = '', now = 1;
  const reader = createWorkingActivities({ read: () => bytes, now: () => now });
  reader.observe('one', 'claim', 'start');
  bytes = pre('a'); reader.observe('one', 'claim', 'working');
  now = 2; bytes += post('a') + pre('b');
  expect(reader.current('one')).toBeNull();
  reader.observe('one', 'claim', 'working');
  expect(reader.current('one')).toMatchObject({ running: true, observedAt: 2 });
});
