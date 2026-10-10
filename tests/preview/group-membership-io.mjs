/** Audience reads use the existing confined Telegram bridge and its credential redaction. */
export function groupMembershipReader(physical, credential, tokenRef, binding) {
  return async (method, body) => {
    if (!['getChat', 'getChatMemberCount', 'getChatMember', 'getMe'].includes(method)) throw Error('group carry: read method refused');
    const reply = await physical.poll({ token: tokenRef, method, body, timeoutMs: 5000,
      ...(method === 'getMe' ? { identityBinding: binding } : {}) }, credential());
    if (method === 'getMe' && reply.kind === 'identity') return { ok: true, result: reply.identity };
    if (reply.kind !== 'response' || reply.status !== 200) throw Error('group carry: membership unavailable');
    return JSON.parse(reply.bytes);
  };
}
