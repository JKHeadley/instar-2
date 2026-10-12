import { createHash } from 'node:crypto';
import { CAPABILITY_BRIEFING_PATH, CAPABILITY_SENTENCE_LABEL, CAPABILITY_SENTENCE_MARKER } from './briefing.js';

const sha256 = (text: string) => `sha256:${createHash('sha256').update(text, 'utf8').digest('hex')}`;

/** Render the model's explicit capability reference from the very note it received.
 * No intent classifier: ordinary prose, empty answers and absent/invalid notes stay
 * unchanged. The two old pronoun forms are exact protocol compatibility for the
 * superseded instruction to keep "the person"/"the agent" (live update 715675677).
 * They match the WHOLE rendered record, never just a keyword or sentence prefix.
 * Rules 10, 36, 78, 84, 116: byte substitution belongs to code; meaning stays with
 * the writer and the existing review, which sees the rendered candidate. */
export function renderCapabilityReply(text: string, packet: { sources?: readonly unknown[] }): string {
  const note = packet.sources?.find(source => source !== null && typeof source === 'object'
    && (source as { id?: unknown }).id === 'capability-note') as
    { text?: unknown; provenance?: { path?: unknown; excerptSha256?: unknown; renderedCapabilitySha256?: unknown } } | undefined;
  if (typeof note?.text !== 'string' || note.provenance?.path !== CAPABILITY_BRIEFING_PATH
    || note.provenance.excerptSha256 !== sha256(note.text)) return text;
  const lines = note.text.split('\n').filter(line => line.startsWith(CAPABILITY_SENTENCE_LABEL));
  if (lines.length !== 1) return text;
  const sentence = lines[0]!.slice(CAPABILITY_SENTENCE_LABEL.length);
  if (!sentence || note.provenance.renderedCapabilitySha256 !== sha256(sentence)) return text;
  const legacy = sentence.startsWith('I can use ')
    ? ['The person', 'The agent'].map(subject => subject + sentence.slice(1)) : [];
  const tokens = [CAPABILITY_SENTENCE_MARKER, sentence, ...legacy];
  const escape = (token: string) => token.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
  const pattern = new RegExp(tokens.map(escape).join('|'), 'gu');
  const matches = [...text.matchAll(pattern)];
  if (!matches.length || matches.length === 1 && matches[0]![0] === sentence) return text;
  // Prefer a copy already present: a marker beside it cannot add a second copy.
  const keep = matches.find(match => match[0] === sentence) ?? matches[0]!;
  return text.replace(pattern, (token, offset: number) => offset !== keep.index ? ''
    : token === CAPABILITY_SENTENCE_MARKER ? `\n\n${sentence}\n\n` : sentence)
    .replace(/\n[ \t]*\n(?:[ \t]*\n)+/gu, '\n\n').trim();
}

/** Revisions use the persisted answer envelope, not a fresh capability read that
 * could describe a different route/configuration after a restart. */
export function renderCapabilityRevision(text: string, originalPrompt: string): string {
  try {
    const envelope = JSON.parse(originalPrompt) as { messages?: { role: string; content: string }[] };
    const context = envelope.messages?.find(message => message.role === 'context');
    const value = context ? JSON.parse(context.content) : undefined;
    return value?.packet ? renderCapabilityReply(text, value.packet) : text;
  } catch { return text; }
}
