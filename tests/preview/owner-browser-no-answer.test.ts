import { expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
// @ts-expect-error owner physical adapter
import { createOwnerBrowser } from './owner-browser.mjs';
const binding = { userDataDir: '/owned/chrome' };
const observed = (page = 'account-profile') => JSON.stringify({ status: 'observed', origin: 'https://github.com',
  path: page === 'account-profile' ? '/settings/profile' : '/EchoOfDawn?tab=repositories', account: 'EchoOfDawn', title: 'Account' });
function harness(replies: string[], options: { deadline?: number; tick?: number; stop?: boolean; withdraw?: boolean; executeTick?: number; abortAt?: number | undefined; stopAt?: number; withdrawAt?: number } = {}) {
  let calls = 0, clock = 0, stopped = false, current = binding, released = 0, reads = 0;
  const adapter = createOwnerBrowser({ binding: () => { reads++; return current; }, platform: 'darwin', uid: 501, now: () => clock,
    hold: async () => ({ release: async () => { released++; } }), scrub: (s: string) => s, held: () => 'clear',
    wait: async (ms: number) => { expect(ms).toBeLessThanOrEqual(250); clock += options.tick ?? ms;
      stopped = options.stop ?? false; if (options.withdraw) current = { userDataDir: '/other' }; },
    execute: async (command: string) => {
      if (command === '/bin/ps') return '81453 501 /Applications/Google Chrome.app/Contents/MacOS/Google Chrome --user-data-dir=/owned/chrome';
      const raw = replies[Math.min(calls++, replies.length - 1)];
      clock += options.executeTick ?? 0;
      if (options.stopAt !== undefined && clock >= options.stopAt) stopped = true;
      if (options.withdrawAt !== undefined && clock >= options.withdrawAt) current = { userDataDir: '/other' };
      if (options.abortAt !== undefined && clock >= options.abortAt) {
        clock = options.abortAt; throw Error('browser-helper-unavailable');
      }
      return raw;
    },
  });
  return { run: (input: unknown = { page: 'account-profile' }) => adapter({ input, stopped: () => stopped, deadline: options.deadline ?? 30000 }),
    counts: () => ({ calls, clock, released, reads }) };
}
it('retries an empty Apple event before observing the profile', async () => {
  for (const empty of ['{}', '', ' \n\t', '{ \n }']) {
    const h = harness([empty, observed()]);
    expect(await h.run()).toMatchObject({ status: 'observed' });
    expect(h.counts()).toMatchObject({ calls: 2, released: 1 });
    expect(h.counts().reads).toBeGreaterThanOrEqual(7);
  }
});
it('retries the second page without losing the first or changing observation order', async () => {
  const h = harness([observed(), '{}', observed('account-repositories')]);
  const result = await h.run({ pages: ['account-profile', 'account-repositories'] });
  expect(result.status).toBe('observed');
  expect(result.observations.map((row: { page: string }) => row.page)).toEqual(['account-profile', 'account-repositories']);
  expect(h.counts()).toMatchObject({ calls: 3, released: 1 });
});
it('exhausts either bound with an explicit no-answer reason, never a sign-out claim', async () => {
  for (const options of [{ tick: 0 }, { tick: 1000 }, { deadline: 500 }]) {
    const h = harness(['{}'], options);
    expect(await h.run()).toEqual({ status: 'unavailable', reason: 'browser-did-not-answer-in-time' });
    expect(h.counts().calls).toBe(options.tick === 0 ? 40 : options.tick === 1000 ? 15 : 2);
    expect(h.counts().released).toBe(1);
  }
});
it('keeps every actual page answer and nonempty malformed output final', async () => {
  for (const result of [{ status: 'unavailable' }, { status: 'login-required' }, { status: 'refused', reason: 'account-mismatch' },
    { status: 'refused', reason: 'navigation-scope' }]) {
    const h = harness([JSON.stringify(result), observed()]);
    expect(await h.run()).toEqual(result); expect(h.counts().calls).toBe(1);
  }
  for (const raw of ['not JSON', '{', 'null', '[]', '{"extra":true}', ' '.repeat(4097)]) {
    const h = harness([raw, observed()]);
    expect(await h.run()).toEqual({ status: 'unavailable' }); expect(h.counts().calls).toBe(1);
  }
});
it('stops between retries and rechecks the binding before any further evaluation', async () => {
  for (const options of [{ stop: true }, { withdraw: true }]) {
    const h = harness(['{}', observed()], options);
    expect(await h.run()).toEqual({ status: 'refused', reason: options.stop ? 'closed-or-stopped' : 'profile-withdrawn' });
    expect(h.counts()).toMatchObject({ calls: 1, released: 1 });
  }
});
it('replays recorded model and delivery shapes through the retry path without treating them as browser proof', async () => {
  const shapes = JSON.parse(readFileSync(new URL('./fixtures/retrospective-duty-followup-train-1-2026-10-08.json', import.meta.url), 'utf8')).otherShapes;
  for (const row of shapes) {
    const h = harness(['{}', row.raw], { tick: 0 });
    expect((await h.run()).status, row.id).toBe('unavailable');
    expect(h.counts().calls, row.id).toBe(row.raw.trim() === '' ? 40 : 2);
  }
});

it.each([undefined, 15000])('retains the no-answer reason when the bound ends inside a helper (abortAt=%s)', async (abortAt) => {
  const h = harness(['{}'], { executeTick: 2000, abortAt });
  expect(await h.run()).toEqual({ status: 'unavailable', reason: 'browser-did-not-answer-in-time' });
  expect(h.counts()).toMatchObject({ calls: 7, clock: abortAt ?? 15500, released: 1 });
});
it('actual stop still wins when a helper returns or aborts at the bound', async () => {
  for (const abortAt of [undefined, 15000]) {
    const h = harness(['{}'], { executeTick: 2000, stopAt: 15000, abortAt });
    expect(await h.run()).toEqual({ status: 'refused', reason: 'closed-or-stopped' });
    expect(h.counts()).toMatchObject({ calls: 7, released: 1 });
  }
});
it('withholds late page content and preserves binding withdrawal during the final helper', async () => {
  const replies = [...Array(6).fill('{}'), observed()];
  const timely = harness(replies, { executeTick: 1900 });
  expect(await timely.run()).toMatchObject({ status: 'observed' });
  expect(timely.counts()).toMatchObject({ calls: 7, released: 1 });
  const late = harness(replies, { executeTick: 2000 });
  expect(await late.run()).toEqual({ status: 'unavailable' });
  expect(late.counts()).toMatchObject({ calls: 7, released: 1 });
  const withdrawn = harness(replies, { executeTick: 2000, withdrawAt: 15000 });
  expect(await withdrawn.run()).toEqual({ status: 'refused', reason: 'profile-withdrawn' });
  expect(withdrawn.counts()).toMatchObject({ calls: 7, released: 1 });
});
it('does not relabel a helper failure before expiry as no-answer exhaustion', async () => {
  const h = harness(['{}'], { executeTick: 2000, abortAt: 4250 });
  expect(await h.run()).toEqual({ status: 'unavailable' });
  expect(h.counts()).toMatchObject({ calls: 2, released: 1 });
});
