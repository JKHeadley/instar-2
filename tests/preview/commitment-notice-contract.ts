/** Part 18 §6 producer contract, not a second commitment store. The owner supplies a
 * fresh admitted finding; the send grant alone never supplies its eligibility. */
export interface CommitmentNoticeContract {
  episode: string;
  originTopic: number;
  text: string;
  evidence: { reference: string; kind: 'concrete-result' | 'human-required-action'; observedAt: number; expiresAt: number };
  issue: { kind: 'external' } | { kind: 'internal'; selfHeal: { eligible: true; attempt: string; failedAt: number; outcome: 'failed' } };
}
export interface CommitmentNoticeProducer {
  /** Read the owner's current, approved finding, by causal episode. Missing/withdrawn refuses. */
  read(episode: string): CommitmentNoticeContract | undefined;
  /** Current declared alerts route; never derived from a promise's topic. */
  alerts(): { topic: number } | undefined;
}
/** Exact checks of owner-recorded state (Rules 4, 53, 87, 88). No interpretation of prose. */
export function validCommitmentNotice(c: CommitmentNoticeContract, episode: string, topic: number, text: string, now: number): boolean {
  const e = c.evidence;
  return c.episode === episode && !!episode && c.text === text && !!text.trim()
    && Number.isSafeInteger(c.originTopic) && c.originTopic > 0 && c.originTopic !== topic
    && !!e?.reference && ['concrete-result', 'human-required-action'].includes(e.kind)
    && Number.isSafeInteger(e.observedAt) && Number.isSafeInteger(e.expiresAt)
    && e.observedAt <= now && now < e.expiresAt && e.observedAt >= 0
    && (c.issue?.kind === 'external' || c.issue?.kind === 'internal' && c.issue.selfHeal?.eligible === true
      && !!c.issue.selfHeal.attempt && c.issue.selfHeal.outcome === 'failed'
      && Number.isSafeInteger(c.issue.selfHeal.failedAt) && c.issue.selfHeal.failedAt >= 0 && c.issue.selfHeal.failedAt <= e.observedAt);
}
