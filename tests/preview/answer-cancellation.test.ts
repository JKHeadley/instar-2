// @ts-nocheck -- the physical liveness functions are JavaScript, as in the launcher.
import { expect, it } from 'vitest';
import { cancellationProbe, recordLiveness } from './answer-cancellation.mjs';
import { subscriptionCallOutcome } from './call-diagnostics.mjs';
import { mkdtempSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

it('rereads a failed record then continues an in-flight call without caching authority', () => {
  let reads = 0, now = 0;
  const activation = recordLiveness(() => { if (++reads === 1) throw Error('read interrupted'); return '{}'; }, '{}', 'activation-not-live');
  const poll = cancellationProbe({ stop: () => false, activation, now: () => now });
  expect(poll()).toBe(false); now = 25; expect(poll()).toBe(false); expect(reads).toBe(2);
});
it('bounds persistent unreadability by both a clock and a fixed read count', () => {
  let now = 0;
  const poll = () => cancellationProbe({ stop: () => false, activation: () => 'records-unreadable', now: () => now });
  const clock = poll(); expect(clock()).toBe(false); now = 200; expect(clock()).toBe('records-unreadable');
  now = 0; const count = poll(); for (let i = 0; i < 8; i++) expect(count()).toBe(false);
  expect(count()).toBe('records-unreadable');
});
it.each(['activation-not-live', 'tools-grant-not-live'])('a present withdrawn record cancels immediately: %s', reason => {
  const record = recordLiveness(() => '{"withdrawn":true}', '{}', reason);
  const poll = cancellationProbe({ stop: () => false, activation: () => 'records-unreadable', tools: record, now: () => 0 });
  expect(poll()).toBe(reason);
});
it('a real stop file wins during the read allowance', () => {
  const path = join(mkdtempSync(join(tmpdir(), 'answer-stop-')), 'stop');
  const poll = cancellationProbe({ stop: () => existsSync(path) ? 'stop-file' : false,
    activation: () => 'records-unreadable', now: () => 0 });
  expect(poll()).toBe(false); writeFileSync(path, 'stop'); expect(poll()).toBe('stop-file');
});
it.each(['worker-stop', 'stop-file', 'journal-stop', 'activation-not-live', 'tools-grant-not-live', 'records-unreadable'])(
  'the recorded diagnostic names %s', reason => {
    const outcome = subscriptionCallOutcome({ signal: 'SIGKILL', cancellationReason: reason, limited: true, stdout: '' }, 1, 1, 100, 100);
    expect(outcome.diagnostic.cancellationReason).toBe(reason);
  });
it('readable revoked or expired authority does not receive an unreadability allowance', () => {
  const probe = recordLiveness(() => '{}', '{}', 'tools-grant-not-live', () => { throw Error('revoked or expired'); });
  expect(probe()).toBe('tools-grant-not-live');
});
it('the launcher passes the bounded probe to its physical IO and retains strict admission', () => {
  const source = readFileSync(new URL('./journal-agent.mjs', import.meta.url), 'utf8');
  expect(source).toContain('stopped: cancelled, work');
  expect(source).toContain("if (toolTurn && !toolsActive()) throw Error('preview: tool activation withdrawn')");
});

it('unreadable authority refuses a new admission without borrowing the running-call allowance', () => {
  const poll = cancellationProbe({ stop: () => false, activation: () => 'records-unreadable', now: () => 0 });
  expect(poll('admission')).toBe('records-unreadable');
  expect(poll()).toBe(false);
});
