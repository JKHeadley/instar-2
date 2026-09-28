/** Earlier journal fixtures substitute both the subscription model and Jev.
 * Faithfulness-specific tests use the real worker with explicit Jev outcomes. The fixture also stands
 * in for the host's installed join: every minimal-path dependency is observed as admitted unless a
 * test supplies its own observation (the real runner observes each one). */
import { createJournalWorker as createWorker } from './journal.js';
import type { BoundaryContext } from '../../src/index.js';
import type { IndependentSurfaceVerifierPort, MinimalDependency, SurfaceChallenge } from '../../src/operator/contracts.js';
import type { VerifiedActSubmission } from './journal.js';
import { createHmac, randomBytes } from 'node:crypto';
import { refusal, success } from '../../src/types/internal.js';
export * from './journal.js';

const faithful = { model: 'jev-1.13.0', answers: { lost_memory: { type: 'noul', noul: 0.01 } } };
export const previewTestContext = { site: 'preview.journal', preserved: 'preview:host', register: {
  generation: { owner: 'part-three', name: 'RegisterGeneration', id: 'preview:register' },
  entries: ['preview.journal', 'preview', 'host'], producers: ['host'], methods: [], actions: {}, subjects: {},
  sites: { 'preview.journal': 'closed', 'types.decode': 'closed' }, keys: {}, allowRedelegation: false,
  conflictStanding: { ordinary: 'delegate', authority: 'operator' } }, captures: {} } as unknown as BoundaryContext;
export const admittedDependencies = (): Record<MinimalDependency, boolean> => ({ 'local-facts': true, register: true,
  'identity-keys': true, clock: true, lease: true, fence: true, 'replication-peer': true, 'conversation-binding': true,
  route: true, 'delivery-evidence': true });
export const createJournalWorker = (...[journal, ports]: Parameters<typeof createWorker>) =>
  createWorker(journal, { summaryCheck: async () => faithful, minimal: { context: previewTestContext, dependencies: admittedDependencies },
    ...ports });

/** A stand-in for Part Nine's independently administered surface: its signing key never reaches the
 * worker, its challenges are one-use and expire, and only the operator's act on it yields a proof. */
export function independentSurface(clock: () => number) {
  const secret = randomBytes(32), issued = new Map<string, SurfaceChallenge>(), used = new Set<string>();
  const acts: VerifiedActSubmission[] = [];
  let ordinal = 0;
  const sign = (challenge: string, decision: string) => createHmac('sha256', secret).update(`${challenge}:${decision}`).digest('hex');
  const verifier: IndependentSurfaceVerifierPort = { owner: 'part-nine', administration: 'independent',
    issue(subject) { ordinal++; const challenge = { id: `challenge:${ordinal}`, ...subject } as SurfaceChallenge;
      issued.set(challenge.id, challenge); return success(challenge); },
    verify(challenge, proof, decision) {
      const known = issued.get(challenge.id);
      if (!known || JSON.stringify(known) !== JSON.stringify(challenge) || used.has(challenge.id)
        || clock() > challenge.expiresAt || proof !== sign(challenge.id, decision)) return refusal('surface: proof refused', 'surface');
      used.add(challenge.id);
      return success({ challenge: challenge.id, principal: { id: challenge.operator },
        provenance: { class: 'verified', record: { reference: `surface:${challenge.id}`, hash: `sha256:${sign(challenge.id, 'receipt')}` } },
        // Like the fixed-installation host: an emergency stop never carries an authority act.
        act: decision === 'approve' && challenge.audience !== 'independent-emergency-stop' ? { type: 'Authorization' } : null,
        capture: {} } as never);
    } };
  return { issued, acts, sign,
    /** The operator acting on the independent page (never through the agent's chat). */
    operatorActs: (challenge: string, decision: 'approve' | 'decline') => acts.push({ challenge, proof: sign(challenge, decision), decision }),
    port: { verifier, link: (challenge: SurfaceChallenge) => `https://approve.example.org/c/${challenge.id.replace(':', '-')}`,
      acts: () => [...acts] } };
}
