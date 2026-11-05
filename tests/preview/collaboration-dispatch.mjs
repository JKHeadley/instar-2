// The journal launcher's collaboration effect consumer. It reuses the installed
// owner authorization, physical Bot API custodian, shared claim and message
// sender. No fixture authority, independent sender or private topic map lives here.
import { redact } from '../../src/recall/redact.js';
import { classifyTelegramTopic } from './telegram-send-outcome.mjs';
export function createCollaborationDispatch({ journal, authorization, held, disclosure, shared,
  sendTelegram, physical, tokenReference, credential }) {
  return async (id, effect) => {
    const target = `collaboration:${id}`;
    const prepared = journal.view.collaboration?.attempts.find(attempt => attempt.id === id);
    const current = () => prepared?.dispatched === true && prepared.outcome === undefined
      && JSON.stringify(prepared.effect) === JSON.stringify(effect) && typeof prepared.authorization === 'string'
      && authorization(effect) === prepared.authorization;
    if (!current()) return { kind: 'refused', reason: 'collaboration requires current owner and existing Telegram role/scope grant' };
    const text = effect.kind === 'topic' ? effect.name : effect.text;
    if (held(text) !== 'clear' || redact(text).count > 0)
      return { kind: 'refused', reason: 'collaboration held-secret check refused' };
    try { await disclosure(); } catch { return { kind: 'refused', reason: 'collaboration audience binding refused' }; }
    if (!current()) return { kind: 'refused', reason: 'collaboration authority changed' };
    if (effect.kind === 'message') {
      const html = text.replace(/&/gu, '&amp;').replace(/</gu, '&lt;').replace(/>/gu, '&gt;');
      const provenance = journal.signOutbound('infrastructure', { target, chat: journal.view.genesis.chat, thread: effect.topic, body: html });
      const outcome = await sendTelegram({ text: html, expectedText: text, chat: journal.view.genesis.chat, thread: effect.topic,
        target, provenance, current, silent: effect.silent });
      return outcome.kind === 'accepted' ? { kind: 'accepted', id: outcome.message }
        : { kind: outcome.kind === 'refused' || outcome.kind === 'not-sent' ? 'refused' : 'unknown', reason: outcome.reason };
    }
    // The hub already durably prepared and replicated this exact intent and its
    // dispatch fence. Take the SAME shared dispatch claim as the message sender.
    if (shared) { const refused = await shared.admit(target, () => current() ? null : 'collaboration authority changed');
      if (refused !== null) return refused; }
    if (!current()) return { kind: 'refused', reason: 'collaboration stopped before physical dispatch' };
    let outcome = { kind: 'unknown', reason: 'topic transport interrupted' };
    try {
      outcome = classifyTelegramTopic(physical.invoke({ token: tokenReference, method: 'createForumTopic',
        body: { chat_id: journal.view.genesis.chat, name: effect.name }, timeoutMs: 30000 }, credential()), effect.name);
      return outcome;
    } finally { if (shared) await shared.outcome(target, outcome.kind); }
  };
}
