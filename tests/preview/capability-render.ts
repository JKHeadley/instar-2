import { createHash } from 'node:crypto';
import { CAPABILITY_BRIEFING_PATH, CAPABILITY_SENTENCE_LABEL, CAPABILITY_SENTENCE_MARKER } from './briefing.js';

const sha256 = (text: string) => `sha256:${createHash('sha256').update(text, 'utf8').digest('hex')}`;

/** Resolve the writer's explicit capability reference from the note it received.
 * The whole capability answer is rendered: retaining arbitrary surrounding prose
 * retained the grant overclaim in recorded update 715675709. No intent classifier
 * or paraphrase matcher. Ordinary answers have no reference and stay untouched.
 * Rules 10, 36, 78, 84, 116: exact record rendering, before existing review. */
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
  if (!tokens.some(token => text.includes(token))) return text;
  const records = note.text.split('\n');
  const grantsStart = records.indexOf('Capabilities:');
  const sentenceAt = records.indexOf(CAPABILITY_SENTENCE_LABEL + sentence);
  const internalAt = records.indexOf('Internal:');
  // These are exact generated-note sections, not classification of model prose.
  // Ambiguous/absent sections remain visible to the existing review unchanged.
  if (grantsStart < 0 || sentenceAt <= grantsStart || internalAt !== sentenceAt + 1
    || records.lastIndexOf('Capabilities:') !== grantsStart
    || records.lastIndexOf('Internal:') !== internalAt) return text;
  const grants = records.slice(grantsStart + 1, sentenceAt);
  const internalEnd = records.findIndex((line, index) => index > internalAt && !line.startsWith('- '));
  if (grants.some(line => !line.startsWith('- ')) || internalEnd < 0) return text;
  const limits = records.slice(internalEnd);
  if (!limits.length || limits.some(line => !line)) return text;
  return ['Capabilities:', ...grants, '', sentence, '', ...limits].join('\n');
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
