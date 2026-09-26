import { createHash } from 'node:crypto';

export const SUCCESSIVE_CONTEXT_VERSION = 'successive-context-v1';
const sha256 = (bytes: string) => `sha256:${createHash('sha256').update(bytes, 'utf8').digest('hex')}`;

/** Exact selected purpose excerpts. Each is pinned by its SHA-256; a changed
 * source document refuses composition instead of silently shipping drift. */
export const SOURCE_EXCERPTS = Object.freeze([
  Object.freeze({ id: 'purpose:name', path: 'docs/00-the-purpose.md', start: '**Value — the project is called Instar.**',
    end: 'name.', title: 'The name' }),
  Object.freeze({ id: 'purpose:purpose', path: 'docs/00-the-purpose.md', start: 'The organizational purpose is unchanged',
    end: '> **Make coherence something an AI cannot lose.**', title: 'The purpose' }),
  Object.freeze({ id: 'purpose:coherency', path: 'docs/00-the-purpose.md', start: '**Value — coherency is the root,',
    end: 'Alignment held by memory is not alignment.', title: 'Coherency is the root' }),
]);
export const CAPABILITY_NOTE_DATE = '2026-09-26';
export function capabilityNote(limits: { providerAttempts: number; expiresAt: number }) {
  return `As of ${CAPABILITY_NOTE_DATE}: this is a private Instar 2.0 PREVIEW trial in the operator's direct Telegram chat. `
    + 'It keeps this trial\'s complete original message history and attempts at most one plain-text reply per admitted message '
    + 'through a subscription model. It has no tools: it cannot browse, run code, schedule work, send extra messages or act outside this chat. '
    + `This trial allows at most ${limits.providerAttempts} model attempts, including any summaries, and ends at epoch millisecond ${limits.expiresAt}. `
    + 'Every reply is prefixed PREVIEW. Outcomes the system could not confirm (a model call or a delivery) are marked unknown, '
    + 'and model charges are recorded as unknown, never settled. Production safeguards are incomplete.';
}
/** Reads each excerpt exactly from the repository, verifying the pinned digest. */
export function sourcePacket(readSource: (path: string) => string, pins: Readonly<Record<string, string>>,
  limits: { providerAttempts: number; expiresAt: number }) {
  const sources: { id: string; title: string; text: string; provenance: Record<string, string | number> }[]
    = SOURCE_EXCERPTS.map(excerpt => {
    const document = readSource(excerpt.path);
    const from = document.indexOf(excerpt.start);
    const to = from < 0 ? -1 : document.indexOf(excerpt.end, from);
    if (from < 0 || to < 0) throw Error(`preview: source excerpt ${excerpt.id} absent`);
    const text = document.slice(from, to + excerpt.end.length);
    const digest = sha256(text);
    if (pins[excerpt.id] !== digest) throw Error(`preview: source excerpt ${excerpt.id} changed`);
    const line = document.slice(0, from).split('\n').length;
    return { id: excerpt.id, title: excerpt.title, text, provenance: { path: excerpt.path, fileSha256: sha256(document),
      firstLine: line, lastLine: line + text.split('\n').length - 1, excerptSha256: digest } };
  });
  const note = capabilityNote(limits);
  sources.push({ id: 'capability-note', title: 'Preview capability and status note', text: note,
    provenance: { path: 'tests/preview/briefing.ts#capabilityNote', asOf: CAPABILITY_NOTE_DATE, excerptSha256: sha256(note) } });
  return Object.freeze({ version: SUCCESSIVE_CONTEXT_VERSION, sources });
}
/** The reviewed digests of the exact excerpts above (2.0 main `docs/00-the-purpose.md`). */
export const SOURCE_PINS = Object.freeze({
  'purpose:name': 'sha256:936d4bdf6dc13976f7af73e0d48f9d11b78b9b844fa16beac9e950dbe7bf495e',
  'purpose:purpose': 'sha256:5d4b2142593c5a9569cb90cbffe20242c5ab2cf8d13f6929c888ec4166f87e51',
  'purpose:coherency': 'sha256:9a9e2145435171267cf760bfc34f999f40cbc63afc2fb8ac66caec16ef122ad1',
});
