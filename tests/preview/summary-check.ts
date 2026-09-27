/** One bounded Jev signal for a proposed rolling summary. The complete packet
 * and proposed notes are data for the check; no model output grants authority. */
export const SUMMARY_QUESTION = {
  summary_integrity: { type: 'noul', instructions: 'Does the proposed rolling summary fail to faithfully cover the supplied conversation turns and earlier summary? Count dropped commitments, people, corrections or dated items, and invented facts as failures. Judge the summary and its structured notes together. Answer unsure when the coverage cannot be determined.' }
};
export type SummaryVerdict = 'pass' | 'violation' | 'unsure' | 'unavailable';
export interface SummaryCheckResult { verdict: SummaryVerdict; path: 'jev' | 'subscription'; latencyMs: number;
  score?: number; reason?: string; retryable?: true;
  usage?: { inputTokens: number | null; outputTokens: number | null; charge: null } }

export function interpretSummaryJev(value: unknown, latencyMs: number): SummaryCheckResult {
  const response = value as { model?: unknown; answers?: { summary_integrity?: { type?: unknown; noul?: unknown } };
    usage?: { input_tokens?: unknown; output_tokens?: unknown } } | null;
  const score = response?.answers?.summary_integrity?.noul;
  if (response?.model !== 'jev-1.13.0' || response.answers?.summary_integrity?.type !== 'noul'
    || typeof score !== 'number' || !Number.isFinite(score) || score < 0 || score > 1)
    throw Error('preview: summary Jev answer malformed');
  return { verdict: score <= 0.15 ? 'pass' : score >= 0.85 ? 'violation' : 'unsure', path: 'jev', latencyMs, score,
    usage: { inputTokens: typeof response.usage?.input_tokens === 'number' ? response.usage.input_tokens : null,
      outputTokens: typeof response.usage?.output_tokens === 'number' ? response.usage.output_tokens : null, charge: null } };
}

/** Preserve a completed review's metering even when its outcome cannot authorize a summary. */
export function interpretSummaryReview(result: { state: string; value?: string; failureClass?: string;
  usage?: { inputTokens: number | null; outputTokens: number | null } }, latencyMs: number): SummaryCheckResult {
  const usage = result.usage && { ...result.usage, charge: null as null };
  if (result.state === 'uncertain')
    return { verdict: 'unavailable', path: 'subscription', latencyMs, ...(usage ? { usage } : {}) };
  if (result.state !== 'complete' || result.failureClass)
    return { verdict: 'unavailable', path: 'subscription', retryable: true, latencyMs, ...(usage ? { usage } : {}) };
  let parsed: { verdict?: unknown; reason?: unknown } | null;
  try { parsed = JSON.parse(result.value ?? ''); } catch { parsed = null; }
  if ((parsed?.verdict !== 'pass' && parsed?.verdict !== 'violation')
    || typeof parsed.reason !== 'string' || !parsed.reason.trim() || parsed.reason.length > 2000)
    return { verdict: 'unavailable', path: 'subscription', retryable: true, latencyMs, ...(usage ? { usage } : {}) };
  return { verdict: parsed.verdict, path: 'subscription', reason: parsed.reason, latencyMs, ...(usage ? { usage } : {}) };
}
