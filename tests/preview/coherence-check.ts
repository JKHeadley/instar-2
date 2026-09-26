/** The post-reply coherence check: one deterministic pass over a reply the
 * preview already sent (or tried to send), against a short, explicit list of
 * constitutional rules (docs/01-the-rules.md) that a capped, tool-less preview
 * can break in words. It runs after the reply, never before it: judging a
 * moment live is reserved for the irreversible cases (rule 4), and the live
 * secret check already runs before every send. It decides nothing. A finding is
 * a signal (rule 86) carried as a short note in the next turn's packet; the
 * model reads its own reply and decides whether a correction is due (rule 10).
 *
 * There is deliberately no model call. The preview activation binds one model
 * and one system prompt, the attempt allowance is small, and each extra call is
 * a CLI start; the retrospective desk review judges patterns with the best model. */
import { redact } from '../../src/recall/redact.js';
import { terms } from '../../src/recall/lexical.js';

/** Related rule numbers from docs/01-the-rules.md, not complete rule checks.
 * The capability-claim patterns for 84 do not establish generated briefing;
 * the quote patterns for 96 do not establish full-history or clock grounding.
 * The live outbound secret refusal is separate from Rule 100, which governs
 * secure storage before consumption and credential expiry. */
export const COHERENCE_RULES = Object.freeze({
  84: 'Agent Awareness (partial signal): possible unsupported capability claim',
  89: 'Truthful Provenance: who said something is never blurred',
  96: 'A Session Grounds in Its Full History (partial signal): possible ungrounded memory claim',
  26: 'Verify the State, Not Its Symbol: API acceptance is not delivery or reading',
  106: 'A Link Handed to a Human Works: no localhost or machine-only paths',
});

export interface CoherenceFinding { rule: number; check: string; excerpt: string }
export interface CoherenceInput {
  /** The model's reply text, without the PREVIEW prefix. */
  readonly reply: string;
  /** Earlier accepted operator messages, oldest first (every conversation). */
  readonly earlier: readonly string[];
}

/** Most findings kept per reply; a note is a nudge, not a report. */
export const COHERENCE_FINDING_LIMIT = 3;

const clip = (text: string) => {
  const one = redact(text.replace(/\s+/gu, ' ').trim()).text;
  return one.length > 90 ? `${one.slice(0, 87)}...` : one;
};
const normal = (text: string) => text.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();

// A first-person claim of an action this preview cannot take: it has no tools,
// cannot browse, run code, schedule, or send anything but this one reply.
const claimedDone = /\bI(?:'ve| have| just|'ve just| have just)? (?:scheduled|set (?:up )?an? (?:reminder|alarm|timer|meeting)|searched (?:the web|online|for)|browsed|googled|looked (?:it |that |this )?up online|(?:ran|executed) (?:the |your |a |that |this )?(?:code|script|command|tests?|query|build)|emailed|sent (?:an? |the )?(?:email|dm|text|invite|message to|note to)|notified|pinged|created (?:an? |the )?(?:file|ticket|issue|pr|pull request|document|doc|calendar|event|reminder)|opened (?:an? |the )?(?:pr|pull request|issue|ticket)|deployed|pushed|committed|saved (?:it|that|this) (?:to|in)|booked|ordered|filed)\b/iu;
const claimedLater = /\bI(?:'ll| will| am going to|'m going to) (?:remind you|follow up|check back|check in (?:with you )?later|get back to you|message you|text you|ping you|email|send you|let you know when|keep an eye|monitor|schedule|look (?:it |that |this )?up|search (?:for|the web|online)|browse|run (?:the |it|that|this)|notify)\b/iu;
// Certainty about delivery or reading: the preview only ever sees Bot API acceptance.
const deliveryClaim = /\b(?:you(?:'ve| have)?(?: already)? (?:received|got|read|seen) my (?:message|reply|answer|note)|you (?:already )?saw my (?:message|reply|answer)|(?:my|the|that) (?:message|reply|answer) (?:was|has been|got) (?:delivered|received|read))\b/iu;
// A reference to something the operator said before.
const memoryRef = /\b(?:you (?:told me|said|mentioned|wrote|asked)|as (?:you|we) (?:said|discussed|mentioned|agreed)|(?:earlier|before|last time|yesterday),? you)\b/iu;
const quotedMemory = /\byou (?:told me|said|wrote|mentioned)[,:]?\s*(?:that\s*)?["“”']([^"“”]{8,240})["“”]/giu;
// Direct speech attributed to a named person.
const speech = /\b([A-Z][\p{L}'-]+(?: [A-Z][\p{L}'-]+)?) (?:said|says|told (?:you|me|us)|wrote|confirmed|promised|agreed|stated|insisted|asked)\b/gu;
const reported = /\b(?:you (?:said|told|mentioned|wrote|reported)|according to you|per you|you've said|as you put it|your (?:message|note|report))\b/iu;
const notNames = new Set(['I', 'You', 'We', 'They', 'He', 'She', 'It', 'This', 'That', 'Someone', 'Everyone', 'Nobody',
  'Instar', 'Telegram', 'Claude', 'PREVIEW', 'Preview', 'The', 'Who', 'Which', 'Nothing']);
const machineLink = /(?:\b(?:https?:\/\/)?(?:localhost|127\.0\.0\.1|0\.0\.0\.0)(?::\d+)?(?:\/\S*)?|\bfile:\/\/\S+|(?:^|\s)(?:~\/|\/Users\/|\/home\/|\/tmp\/|\/var\/)\S+)/iu;

const sentences = (text: string) => text.split(/(?<=[.!?])\s+|\n+/u).filter(Boolean);

/** Deterministic, bounded, and pure: the same reply and journal give the same findings. */
export function checkReply(input: CoherenceInput): CoherenceFinding[] {
  const found: CoherenceFinding[] = [];
  const add = (rule: number, check: string, excerpt: string) => {
    if (found.length < COHERENCE_FINDING_LIMIT && !found.some(item => item.check === check))
      found.push({ rule, check, excerpt: clip(excerpt) });
  };
  const reply = input.reply.slice(0, 8192);
  const said = input.earlier.map(normal);
  const known = new Set(input.earlier.flatMap(text => terms(text)));
  for (const sentence of sentences(reply)) {
    const done = claimedDone.exec(sentence) ?? claimedLater.exec(sentence);
    if (done) add(84, 'claimed an action or tool this preview does not have', sentence);
    if (deliveryClaim.test(sentence)) add(26, 'stated delivery or reading as certain; only Telegram API acceptance is known', sentence);
    if (memoryRef.test(sentence) && input.earlier.length === 0)
      add(96, 'referred to something said earlier, but the journal holds no earlier message', sentence);
    for (const match of sentence.matchAll(quotedMemory)) {
      const quote = normal(match[1]!);
      if (quote && !said.some(text => text.includes(quote))) add(96, 'quoted the operator with words no earlier message contains', sentence);
    }
    if (!reported.test(sentence)) for (const match of sentence.matchAll(speech)) {
      // "Then Sam said" captures two words; only the words the journal knows as a name count.
      const name = match[1]!.split(' ').filter(word => !notNames.has(word) && terms(word).some(term => known.has(term))).join(' ');
      if (name) add(89, `gave ${clip(name)} words that are known only from the operator's own report`, sentence);
    }
    if (machineLink.test(sentence)) add(106, 'handed over a localhost or machine-only path the operator cannot open', sentence);
  }
  return found;
}

/** The note the next packet carries: which reply, what, and why. */
export function correctionNote(findings: readonly CoherenceFinding[]) {
  return findings.map(item => ({ rule: item.rule, ruleName: COHERENCE_RULES[item.rule as keyof typeof COHERENCE_RULES] ?? '',
    possibleProblem: item.check, inYourReply: item.excerpt }));
}
