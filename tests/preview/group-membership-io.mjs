import { ModelDisclosureRefused } from './reply-check.js';
import { setTimeout as delay } from 'node:timers/promises';
import { MembershipUnavailable, verifyGroupAudience } from './group-disclosure.js';

/** Audience reads use the existing confined Telegram bridge and its credential redaction.
 * One retry is safe for these reads only: never retry completed membership evidence. */
export function groupMembershipReader(physical, credential, tokenRef, binding, wait = delay) {
  return async (method, body) => {
    if (!['getChat', 'getChatMemberCount', 'getChatMember', 'getMe'].includes(method)) throw Error('group carry: read method refused');
    for (let attempt = 0; attempt < 2; attempt++) {
      let reply;
      try { reply = await physical.poll({ token: tokenRef, method, body, timeoutMs: 5000,
        ...(method === 'getMe' ? { identityBinding: binding } : {}) }, credential()); }
      catch (error) {
        if (error instanceof Error && ['TimeoutError', 'AbortError'].includes(error.name))
          reply = { kind: 'uncertain', limitation: 'timeout' };
        else throw new MembershipUnavailable(false, 'unavailable');
      }
      const cause = reply.kind === 'uncertain' && reply.limitation === 'timeout' ? 'timeout'
        : reply.kind === 'response' && reply.status === 429 ? 'rate-limit'
          : reply.kind === 'response' && reply.status >= 500 && reply.status <= 599 ? 'server-error' : undefined;
      if (cause) {
        if (attempt === 0) { await wait(250); continue; }
        throw new MembershipUnavailable(true, cause);
      }
      if (method === 'getMe' && reply.kind === 'identity') return { ok: true, result: reply.identity };
      if (reply.kind !== 'response' || reply.status !== 200) throw new MembershipUnavailable(false, 'unavailable');
      try { return JSON.parse(reply.bytes); }
      catch { throw new MembershipUnavailable(false, 'unavailable'); }
    }
    throw new MembershipUnavailable(false, 'unavailable');
  };
}

/** The shipped pre-provider checkpoint. Its typed errors are proof of no provider dispatch. */
export async function requireGroupDisclosureFor(scope, permission, read) {
  if (permission().kind !== 'resolved') throw new ModelDisclosureRefused('group-grant-refused');
  let readFailed = false, transient = false;
  const audience = await verifyGroupAudience(scope, read, error => {
    readFailed = true; transient = error instanceof MembershipUnavailable && error.transient;
  });
  if (!audience) throw new ModelDisclosureRefused(readFailed ? 'group-membership-unavailable' : 'group-membership-changed', transient);
  if (permission().kind !== 'resolved') throw new ModelDisclosureRefused('group-grant-refused');
}
