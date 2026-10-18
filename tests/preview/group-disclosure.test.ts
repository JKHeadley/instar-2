import { expect, it, vi } from 'vitest';
import type { OperatorMessageRecords } from './activation-authority.js';
import { resolveGroupDisclosure, verifyGroupAudience } from './group-disclosure.js';
import { now, sealKey, scope, grant, records, authority, membership } from './group-carry-fixture.js';

const resolve = (record: unknown = authority(), owner: OperatorMessageRecords | null = records) =>
  resolveGroupDisclosure(scope, record, now, owner, sealKey);

it('resolves only the scoped TEST grant through the existing seal and operator message provenance', () => {
  expect(resolve()).toMatchObject({ kind: 'resolved', grant: grant.id });
  expect(resolve(null).kind).toBe('refused');
  expect(resolve({ ...authority(), seal: 'changed' }).kind).toBe('refused');
  expect(resolve(authority(), null).kind).toBe('refused');
  expect(resolveGroupDisclosure(scope, authority(), now, records, new Uint8Array(32)).kind).toBe('refused');
});
it.each(['sourceRoot', 'destinationRoot', 'chat', 'operator', 'bot'] as const)('refuses a changed scope field %s', field => {
  expect(resolve(authority({ scope: { ...scope, [field]: 'other' } })).kind).toBe('refused');
});
it.each([
  { words: 'invented yes' }, { issuedAt: now + 1 }, { expiresAt: now }, { grantor: '99' },
  { grantee: 'other' }, { custodian: 'other' }, { source: { kind: 'telegram-message' as const, topicId: 1, messageId: 3 } },
])('refuses an unsourced, expired or uncovered grant %j', change => {
  expect(resolve(authority(change)).kind).toBe('refused');
});
it('revocation immediately withdraws disclosure; a forged or future withdrawal does not', () => {
  expect(resolve(authority({}, [{ grantId: grant.id, at: now, by: scope.operator, source: 'withdrawal' }])).kind).toBe('refused');
  expect(resolve(authority({}, [{ grantId: grant.id, at: now + 1, by: scope.operator, source: 'withdrawal' }])).kind).toBe('resolved');
});
it('verifies both identified members, the bot identity, forum and count, with no assertion standing in for a read', async () => {
  expect(await verifyGroupAudience(scope, membership())).toBe(true);
  for (const count of [0, 1, 3, '2', null]) expect(await verifyGroupAudience(scope,
    membership((m, _b, v) => m === 'getChatMemberCount' ? count : v))).toBe(false);
  for (const status of ['left', 'kicked', 'restricted']) expect(await verifyGroupAudience(scope,
    membership((m, b, v) => m === 'getChatMember' && b.user_id === scope.operator
      ? { status, user: { id: Number(scope.operator), is_bot: false } } : v))).toBe(false);
  expect(await verifyGroupAudience(scope, async () => { throw Error('offline'); })).toBe(false);
  expect(await verifyGroupAudience(scope, membership((m, _b, v) => m === 'getMe' ? { id: 99, is_bot: true } : v))).toBe(false);
  expect(await verifyGroupAudience(scope, membership((m, _b, v) => m === 'getChatMember'
    ? { status: 'member', user: { id: 99, is_bot: false } } : v))).toBe(false);
  for (const exposure of [{ username: 'public_forum' }, { active_usernames: ['public_forum'] },
    { linked_chat_id: -100999 }, { is_forum: false }, { id: -100999 }])
    expect(await verifyGroupAudience(scope, membership((m, _b, v) => m === 'getChat' ? { ...v as object, ...exposure } : v))).toBe(false);
  let counts = 0;
  expect(await verifyGroupAudience(scope, membership((m, _b, v) => m === 'getChatMemberCount' ? ++counts === 1 ? 2 : 3 : v))).toBe(false);
});

it('brackets four concurrent observations with two counts in three read rounds', async () => {
  vi.useFakeTimers();
  try {
    let active = 0, peak = 0, finished = false;
    const calls: string[] = [], answer = membership();
    const checking = verifyGroupAudience(scope, async (method, body) => {
      calls.push(method); active++; peak = Math.max(peak, active);
      await new Promise(resolve => setTimeout(resolve, 1000));
      active--; return answer(method, body);
    }).then(value => { finished = true; return value; });
    expect(calls).toEqual(['getChatMemberCount']);
    await vi.advanceTimersByTimeAsync(1000);
    expect(active).toBe(4); expect(peak).toBe(4);
    expect(calls).toEqual(['getChatMemberCount', 'getChat', 'getMe', 'getChatMember', 'getChatMember']);
    await vi.advanceTimersByTimeAsync(1000);
    expect(active).toBe(1); expect(calls.at(-1)).toBe('getChatMemberCount');
    await vi.advanceTimersByTimeAsync(999); expect(finished).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(await checking).toBe(true); expect(active).toBe(0); expect(calls).toHaveLength(6);
  } finally { vi.useRealTimers(); }
});

for (const failed of ['getChat', 'getMe', scope.operator, scope.bot]) {
  for (const failure of ['throw', 'reject', 'unknown'] as const) {
    it(`settles all sibling reads before refusing ${failed} ${failure}`, async () => {
      vi.useFakeTimers();
      try {
        let active = 0, counts = 0, finished = false;
        const answer = membership();
        const checking = verifyGroupAudience(scope, (method, body) => {
          if (method === 'getChatMemberCount') { counts++; return answer(method, body); }
          if ((body.user_id ?? method) === failed) {
            if (failure === 'throw') throw Error('synchronous transport failure');
            if (failure === 'reject') return Promise.reject(Error('transport failure'));
            return Promise.resolve({ ok: false });
          }
          active++;
          return new Promise(resolve => setTimeout(() => { active--; resolve(answer(method, body)); }, 1000));
        }).then(value => { finished = true; return value; });
        await vi.advanceTimersByTimeAsync(999);
        expect(active).toBe(3); expect(finished).toBe(false);
        await vi.advanceTimersByTimeAsync(1);
        expect(await checking).toBe(false); expect(active).toBe(0); expect(counts).toBe(1);
      } finally { vi.useRealTimers(); }
    });
  }
}

it('refuses an audience join during the parallel observations and short-circuits an already wider audience', async () => {
  const calls: string[] = [];
  let count = 2;
  const answer = membership((method, _body, value) => method === 'getChatMemberCount' ? count : value);
  const read: typeof answer = async (method, body) => {
    calls.push(method);
    if (method === 'getMe') count = 3;
    return answer(method, body);
  };
  expect(await verifyGroupAudience(scope, read)).toBe(false);
  expect(calls).toHaveLength(6); expect(calls.at(-1)).toBe('getChatMemberCount');
  calls.length = 0;
  expect(await verifyGroupAudience(scope, read)).toBe(false);
  expect(calls).toEqual(['getChatMemberCount']);
});
