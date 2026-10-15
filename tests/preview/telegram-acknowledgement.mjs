// Rules 42, 63, 87: called only after the existing signed notice intent and dispatch claim.
// An ambiguous reaction is not followed by text: it might already have reached the user.
// The rewalk4 capture (updates 840342886–840342918) saw reactions at 7–8 seconds
// from intake, but every 500 ms API wait expired. Allow ten seconds for a receipt;
// this is a bounded engineering allowance, not a measured transport percentile.
export function reactionAcknowledgement(invoke, chat, message) {
  let reply;
  try { reply = invoke('setMessageReaction', { chat_id: chat, message_id: message,
    reaction: [{ type: 'emoji', emoji: '👀' }] }, 10000); }
  catch { return { kind: 'unknown', reason: 'reaction transport failed' }; }
  if (reply?.kind === 'uncertain' && reply.sent === false) return null;
  if (reply?.kind !== 'response') return { kind: 'unknown', reason: 'reaction transport uncertain' };
  let payload;
  try { payload = JSON.parse(reply.bytes); } catch { return { kind: 'unknown', reason: 'reaction response unreadable' }; }
  if (reply.status === 200 && payload?.ok === true && payload.result === true)
    return { kind: 'accepted', message, acknowledgementPath: 'reaction' };
  // Telegram's explicit ok:false is a failed API operation, including unsupported reactions.
  if (payload?.ok === false) return null;
  return { kind: 'unknown', reason: 'reaction receipt differs from intent' };
}

// A typing indicator expires at Telegram after five seconds. Refresh only while this admitted
// answer is current, for at most two minutes / 30 calls; a failed refresh breaks the loop.
// Timers are machine-local, disposable, and never reconstructed as a message-send obligation.
export function createReplyTyping({ invoke, allowed, now, after }) {
  const active = new Map();
  const key = (chat, thread) => JSON.stringify([chat, thread ?? null]);
  const stop = (chat, thread) => { const id = key(chat, thread), entry = active.get(id);
    active.delete(id); entry?.cancel?.(); };
  const start = (chat, thread, current) => {
    stop(chat, thread);
    const id = key(chat, thread), entry = { until: now() + 120000, calls: 0, cancel: null };
    active.set(id, entry);
    const tick = async () => {
      const live = () => active.get(id) === entry && current() && now() < entry.until && entry.calls < 30;
      try {
        if (!live() || !await allowed() || !live()) { if (active.get(id) === entry) stop(chat, thread); return; }
        entry.calls++;
        const reply = invoke('sendChatAction', { chat_id: chat, action: 'typing',
          ...(thread === undefined ? {} : { message_thread_id: thread }) }, 1000);
        if (reply?.kind !== 'response' || reply.status !== 200 || JSON.parse(reply.bytes)?.result !== true) {
          if (active.get(id) === entry) stop(chat, thread); return;
        }
        if (live()) entry.cancel = after(4000, () => { void tick(); });
        else if (active.get(id) === entry) stop(chat, thread);
      } catch { if (active.get(id) === entry) stop(chat, thread); }
    };
    // Let the acknowledgement receipt reach the journal before starting another transport.
    entry.cancel = after(0, () => { void tick(); });
  };
  return { start, stop };
}
