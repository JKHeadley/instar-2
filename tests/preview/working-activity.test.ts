import { expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
// @ts-expect-error Host-only JavaScript reader.
import { admissionActivity, createWorkingActivities } from './working-activity.mjs';
const pre = (id: string, input: object = { description: 'Run the build', command: 'npm run build' }) => JSON.stringify({ phase: 'pre', id, tool: 'Bash', input: JSON.stringify(input), decision: 'allow' }) + '\n';
const post = (id: string) => JSON.stringify({ phase: 'post', id, tool: 'Bash' }) + '\n';
it('prefers the self-written description; completed work is explicit, malformed, denied or empty activity is silent', () => {
  expect(admissionActivity(pre('a'), 0, 'claim')).toMatchObject({ text: 'Status: Run the build' });
  expect(admissionActivity(pre('a') + post('a'), 0, 'claim')?.text).toBe('Status: no tool step running');
  expect(admissionActivity(pre('a', { command: 'npm run build' }) + post('a'), 0, 'claim')?.text).toBe('Status: no tool step running');
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
  bytes += pre('current'); expect(reader.current('one')?.text).toBe('Status: Run the build');
  expect(reader.current('two')).toBeNull();
  now = 10002; expect(reader.current('one')).toBeNull();
  reader.observe('one', 'claim', 'working'); expect(reader.current('one')).not.toBeNull();
  bytes += post('current'); expect(reader.current('one')?.text).toBe('Status: no tool step running');
  bytes += pre('next'); reader.observe('one', null, 'end'); expect(reader.current('one')).toBeNull();
});
it('replays real native tool admission bytes from the 2026-10-03 live task, without fabricated activity', () => {
  const record = JSON.parse(readFileSync(new URL('./fixtures/native-loop/live-2026-10-03/task.json', import.meta.url), 'utf8'));
  const rows: string[] = record.admission.trim().split('\n');
  expect(admissionActivity(rows[0] + '\n', 0, 'live-task')?.text).toBe('Status: Write: note.txt');
  expect(admissionActivity(rows.slice(0, 2).join('\n') + '\n', 0, 'live-task')?.text).toBe('Status: no tool step running');
  expect(admissionActivity(rows.slice(0, 3).join('\n') + '\n', 0, 'live-task')?.text).toBe('Status: Bash: wc -c note.txt');
  expect(admissionActivity(record.admission, 0, 'live-task')?.text).toBe('Status: no tool step running');
});
