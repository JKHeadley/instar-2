/** Private-to-forum lineage permission. Nothing here creates an operator approval. */
import { authorityDigest, authorityRecordIsSealed, PREVIEW_DESK, resolveOperatorMessage,
  type OperatorMessageRecords, type OperatorMessageRef } from './activation-authority.js';

export interface GroupCarryScope {
  sourceRoot: string; destinationRoot: string; chat: string; operator: string; bot: string;
}
export interface GroupDisclosureGrant {
  id: string; grantor: string; grantee: string; words: string; source: OperatorMessageRef;
  issuedAt: number; expiresAt?: number; action: 'carry-private-journal'; scope: GroupCarryScope;
  audience: 'operator-and-agent-bot-only'; surface: 'telegram-forum';
  custodian: string; recovery: 'stop-use-on-revocation-or-audience-change';
}
export type DisclosureVerdict = { kind: 'resolved'; grant: string; digest: string; scope: GroupCarryScope; expiresAt?: number }
  | { kind: 'refused'; reason: string };
const object = (value: unknown): Record<string, unknown> => value !== null && typeof value === 'object'
  && !Array.isArray(value) ? value as Record<string, unknown> : {};
const time = (value: unknown): value is number => Number.isSafeInteger(value) && Number(value) > 0;
const text = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0;

/** Reads the same sealed disposition and messaging-owner provenance as activation grants. */
export function resolveGroupDisclosure(scope: GroupCarryScope, record: unknown, now: number,
  records: OperatorMessageRecords | null, sealKey: Uint8Array | null): DisclosureVerdict {
  const refuse = (reason: string): DisclosureVerdict => ({ kind: 'refused', reason });
  const r = object(record);
  if (r.type !== 'PreviewActivationAuthority' || r.schemaVersion !== 1 || !Array.isArray(r.revocations)
    || !authorityRecordIsSealed(record, sealKey)) return refuse('group disclosure authority is absent or unsealed');
  if (!time(now) || !Object.values(scope).every(text) || scope.sourceRoot === scope.destinationRoot)
    return refuse('group disclosure scope is invalid');
  const grants = Array.isArray(r.groupDisclosureGrants) ? r.groupDisclosureGrants : [];
  for (const raw of grants) {
    const g = object(raw), named = object(g.scope);
    if (!text(g.id) || g.grantor !== scope.operator || g.grantee !== PREVIEW_DESK
      || g.action !== 'carry-private-journal' || g.audience !== 'operator-and-agent-bot-only'
      || g.surface !== 'telegram-forum' || g.custodian !== scope.operator
      || g.recovery !== 'stop-use-on-revocation-or-audience-change'
      || !Object.entries(scope).every(([key, value]) => named[key] === value)
      || !time(g.issuedAt) || g.issuedAt > now || g.expiresAt !== undefined && (!time(g.expiresAt) || g.expiresAt <= now)) continue;
    const message = resolveOperatorMessage(g.source, scope.operator, records);
    if (!message || message.text !== g.words || message.at !== g.issuedAt) continue;
    if (r.revocations.some(raw => { const v = object(raw); return v.grantId === g.id && time(v.at)
      && v.at <= now && v.by === scope.operator && text(v.source); })) continue;
    return { kind: 'resolved', grant: g.id, digest: authorityDigest(record), scope: { ...scope },
      ...(g.expiresAt === undefined ? {} : { expiresAt: g.expiresAt as number }) };
  }
  return refuse('no current, sourced operator grant covers this exact private-to-group lineage');
}

export type MembershipRead = (method: 'getChat' | 'getChatMemberCount' | 'getChatMember' | 'getMe',
  body: Record<string, string>) => Promise<unknown>;
const result = (value: unknown) => { const r = object(value); if (r.ok !== true) throw Error('membership unavailable'); return r.result; };
/** Two members, both identified: a count alone or an administrator list cannot establish the audience.
 * Read count at both ends to reject an observed join during the probe. Unknown/restricted/left refuses.
 * Telegram offers no atomic membership-and-send transaction; the runner probes again at each dispatch. */
export async function verifyGroupAudience(scope: GroupCarryScope, read: MembershipRead): Promise<boolean> {
  try {
    if (!/^[1-9][0-9]*$/u.test(scope.operator) || !/^[1-9][0-9]*$/u.test(scope.bot)
      || scope.operator === scope.bot || !/^-[1-9][0-9]*$/u.test(scope.chat)) return false;
    const chat = object(result(await read('getChat', { chat_id: scope.chat })));
    if (String(chat.id) !== scope.chat || chat.type !== 'supergroup' || chat.is_forum !== true) return false;
    const me = object(result(await read('getMe', {})));
    if (String(me.id) !== scope.bot || me.is_bot !== true) return false;
    if (result(await read('getChatMemberCount', { chat_id: scope.chat })) !== 2) return false;
    for (const [id, bot] of [[scope.operator, false], [scope.bot, true]] as const) {
      const member = object(result(await read('getChatMember', { chat_id: scope.chat, user_id: id })));
      const user = object(member.user);
      if (String(user.id) !== id || user.is_bot !== bot || !['creator', 'administrator', 'member'].includes(String(member.status))) return false;
    }
    return result(await read('getChatMemberCount', { chat_id: scope.chat })) === 2;
  } catch { return false; }
}
