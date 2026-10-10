import { createHash } from 'node:crypto';
import { authoritySealKey, sealAuthorityRecord, type OperatorMessageRecords } from './activation-authority.js';
import { resolveGroupDisclosure, type GroupCarryScope, type GroupDisclosureGrant, type MembershipRead } from './group-disclosure.js';
export const now = 1791623700000, key = new Uint8Array(32).fill(71), sealKey = authoritySealKey(key);
export const scope: GroupCarryScope = { sourceRoot: '/test/private', destinationRoot: '/test/group',
  chat: '-1001234', operator: '7654321', bot: '12345678' };
const words = 'TEST fixture only: carry my private memory into this operator-only group.';
export const grant: GroupDisclosureGrant = { id: 'TEST-group-grant', grantor: scope.operator, grantee: 'echo-desk',
  words, source: { kind: 'telegram-message', topicId: 1, messageId: 2 }, issuedAt: now - 1000,
  action: 'carry-private-journal', scope, audience: 'operator-and-agent-bot-only', surface: 'telegram-forum',
  custodian: scope.operator, recovery: 'stop-use-on-revocation-or-audience-change' };
export const records: OperatorMessageRecords = {
  messages: [{ topicId: 1, messageId: 2, text: words, timestamp: new Date(grant.issuedAt).toISOString(),
    fromUser: true, forwarded: false, provenance: 'user', telegramUserId: Number(scope.operator) }],
  provenance: [{ topicId: 1, messageId: 2, classification: 'human', topicBound: true,
    bodyHash: createHash('sha256').update(words).digest('hex') }],
  bindings: { 1: { platform: 'telegram', uid: scope.operator, boundFrom: 'authenticated-inbound',
    establishmentEvidence: { kind: 'authenticated-inbound', authorization: 'telegram-is-authorized-sender',
      ingress: 'telegram-polling', senderUid: scope.operator, messageId: '2' } } } };
export const authority = (change: Partial<GroupDisclosureGrant> = {}, revocations: unknown[] = []) =>
  sealAuthorityRecord({ type: 'PreviewActivationAuthority', schemaVersion: 1, grants: [], waivers: [],
    revocations, groupDisclosureGrants: [{ ...grant, ...change }] }, sealKey);
export const membership = (override?: (method: string, body: Record<string, string>, value: unknown) => unknown): MembershipRead =>
  async (method, body) => {
    const value = method === 'getChat' ? { id: Number(scope.chat), type: 'supergroup', is_forum: true }
      : method === 'getMe' ? { id: Number(scope.bot), is_bot: true }
        : method === 'getChatMemberCount' ? 2
          : { status: 'member', user: { id: Number(body.user_id), is_bot: body.user_id === scope.bot } };
    return { ok: true, result: override ? override(method, body, value) : value };
  };

export function permissionFor(subject: GroupCarryScope) {
  const owner: OperatorMessageRecords = {
    messages: records.messages.map(raw => ({ ...(raw as object), telegramUserId: Number(subject.operator) })),
    provenance: records.provenance,
    bindings: { 1: { platform: 'telegram', uid: subject.operator, boundFrom: 'authenticated-inbound',
      establishmentEvidence: { kind: 'authenticated-inbound', authorization: 'telegram-is-authorized-sender',
        ingress: 'telegram-polling', senderUid: subject.operator, messageId: '2' } } },
  };
  return resolveGroupDisclosure(subject, authority({ scope: subject, grantor: subject.operator, custodian: subject.operator }), now, owner, sealKey);
}
