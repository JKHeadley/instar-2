// Remembering is not permission to reveal. Recall returns every relevant exchange; this is
// the single place deciding whether one may be shown to a given audience. Fail closed:
// unknown audience or visibility never widens reveal.
import type { Audience, RecalledExchange, RevealVerdict } from './contracts.js';

export function mayReveal(exchange: RecalledExchange, audience: Audience): RevealVerdict {
  if (exchange.visibility === 'public') return { reveal: true };
  if (exchange.visibility !== 'participants') return { reveal: false, reason: 'private' };
  if (!audience.participants.length) return { reveal: false, reason: 'no-audience' };
  const allowed = new Set(exchange.audience);
  return audience.participants.every(p => allowed.has(p)) ? { reveal: true } : { reveal: false, reason: 'outside-audience' };
}
