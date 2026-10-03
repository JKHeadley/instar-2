// Rules 42 and 89: every live send carries automatically signed sender provenance and
// settles as exactly one of accepted, refused or unknown. Signing reuses the fact
// envelope's canonical preimage and Ed25519 content-hash signature (src/facts/envelope.ts).
import { createHash, createHmac, createPrivateKey, createPublicKey, sign, verify, type KeyObject } from 'node:crypto';
import { preimage } from '../../src/facts/envelope.js';

/** Infrastructure speaks as infrastructure; the agent speaks as itself. */
export type Speaker = 'agent' | 'infrastructure';
export interface OutboundProvenance { speaker: Speaker; principal: string; signer: string; contentHash: string; signature: string }
/** The exact outbound act a signature covers: its journal target, destination and body bytes. */
export interface OutboundSubject { target: string; chat: string; thread?: number; body: string }
/** A definite refusal and an unknown outcome stay distinct from delivery and from each other. */
/** `not-sent` is the transport's proof that the network call was never made, so this exact intent may
 * be dispatched again. It never reaches the journal: the one outbound funnel settles it (Rule 42). */
export type SendOutcome = { kind: 'accepted'; message: number } | { kind: 'refused'; reason: string }
  | { kind: 'unknown'; reason: string } | { kind: 'not-sent'; reason: string };
/** What a dispatch settles to, and the only outcomes the journal records. */
export type SettledSendOutcome = Exclude<SendOutcome, { kind: 'not-sent' }>;

const ED25519_PKCS8_SEED_PREFIX = Buffer.from('302e020100300506032b657004220420', 'hex');

export function outboundSigner(storageKey: Uint8Array, bot: string) {
  if (storageKey.byteLength !== 32 || !bot) throw Error('outbound provenance: signing key or bot refused');
  const seed = createHmac('sha256', storageKey).update('instar-preview-outbound-provenance-v1').digest();
  const privateKey: KeyObject = createPrivateKey({ key: Buffer.concat([ED25519_PKCS8_SEED_PREFIX, seed]), format: 'der', type: 'pkcs8' });
  const publicKey = createPublicKey(privateKey);
  const signer = `sha256:${createHash('sha256').update(publicKey.export({ format: 'der', type: 'spki' })).digest('hex')}`;
  const principalOf = (speaker: Speaker) => speaker === 'agent' ? `agent:telegram-bot:${bot}` : `infrastructure:preview-runner:${bot}`;
  const content = (speaker: Speaker, subject: OutboundSubject) => preimage({ type: 'OutboundProvenance', schemaVersion: 1,
    speaker, principal: principalOf(speaker), signer, target: subject.target, chat: subject.chat,
    thread: subject.thread ?? null, body: subject.body }).hash;
  return Object.freeze({
    signer,
    sign(speaker: Speaker, subject: OutboundSubject): OutboundProvenance {
      if (speaker !== 'agent' && speaker !== 'infrastructure') throw Error('outbound provenance: unknown speaker');
      const contentHash = content(speaker, subject);
      return { speaker, principal: principalOf(speaker), signer, contentHash,
        signature: sign(null, Buffer.from(contentHash, 'utf8'), privateKey).toString('hex') };
    },
    /** True only for this installation's signature over exactly this subject. */
    verify(provenance: unknown, subject: OutboundSubject): boolean {
      const p = provenance as Partial<OutboundProvenance> | null | undefined;
      if (!p || (p.speaker !== 'agent' && p.speaker !== 'infrastructure') || p.signer !== signer
        || p.principal !== principalOf(p.speaker) || typeof p.signature !== 'string' || !/^[a-f0-9]{128}$/u.test(p.signature)) return false;
      const contentHash = content(p.speaker, subject);
      return p.contentHash === contentHash
        && verify(null, Buffer.from(contentHash, 'utf8'), publicKey, Buffer.from(p.signature, 'hex'));
    },
  });
}

/** Legacy ports returned a message id or null; null was always UNKNOWN, never refusal. */
export function settleSendOutcome(result: number | null | SendOutcome | undefined): SendOutcome {
  if (typeof result === 'number') return Number.isSafeInteger(result) && result > 0
    ? { kind: 'accepted', message: result } : { kind: 'unknown', reason: 'malformed receipt' };
  if (result === null || result === undefined) return { kind: 'unknown', reason: 'no receipt' };
  if (result.kind === 'accepted') return Number.isSafeInteger(result.message) && result.message > 0
    ? result : { kind: 'unknown', reason: 'malformed receipt' };
  if ((result.kind === 'refused' || result.kind === 'unknown' || result.kind === 'not-sent')
    && typeof result.reason === 'string' && result.reason.trim())
    return { kind: result.kind, reason: result.reason.slice(0, 200) };
  return { kind: 'unknown', reason: 'malformed send outcome' };
}
