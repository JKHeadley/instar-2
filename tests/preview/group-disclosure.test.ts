import { expect, it } from 'vitest';
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
