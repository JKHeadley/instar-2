/** A rolling summary replaces earlier prose. Exact preservation is cheap to prove;
 * paraphrases need the existing Jev judgment with the whole summary transition. */
export const SUMMARY_FAITHFULNESS_QUESTION = {
  lost_memory: { type: 'noul', instructions: 'Does the candidate summary lose any still-active fact, preference, or person detail from the prior summary or the new conversation turns, or drop a direct operator correction or forgetting decision? A corrected or forgotten old fact is no longer active. Active memory records and open commitments are carried separately, so their absence from candidate prose alone is not loss. Judge the whole supplied transition and recorded decisions. Ordinary greetings and repeated wording need not be kept.' }
} as const;

export function summaryFaithfulnessEvidence(packet: string, candidate: string, memory: unknown): string {
  const source = JSON.parse(packet) as { summary?: { text?: string }; history?: unknown[];
    memory?: unknown; memoryRequest?: unknown; openCommitments?: unknown };
  return JSON.stringify({ priorSummary: source.summary?.text ?? '', history: source.history ?? [],
    activeMemory: source.memory ?? [], openCommitments: source.openCommitments ?? [],
    memoryRequest: source.memoryRequest ?? null, recordedDecision: memory ?? [], candidateSummary: candidate });
}

/** A definite pass requires every nonempty original line to survive verbatim.
 * Missing prose is undecided, since a faithful paraphrase is possible. */
export function exactSummaryFaithfulness(packet: string, candidate: string, memory: unknown[]): 'pass' | 'undecided' {
  const source = JSON.parse(packet) as { summary?: { text?: string }; history?: Array<{ user?: string; answer?: string | null }>;
    memoryRequest?: unknown };
  if (source.memoryRequest && memory.length === 0) return 'undecided';
  const originals = [source.summary?.text ?? '', ...(source.history ?? []).flatMap(item => [item.user ?? '', item.answer ?? ''])]
    .map(text => text.trim()).filter(Boolean);
  return originals.every(text => candidate.includes(text)) ? 'pass' : 'undecided';
}

/** Only a confident full-context Jev answer approves an ambiguous transition. */
export function interpretSummaryJev(value: unknown): 'pass' | 'lost' | 'undecided' {
  const response = value as { model?: unknown; answers?: { lost_memory?: { type?: unknown; noul?: unknown } } } | null;
  const answer = response?.answers?.lost_memory;
  if (response?.model !== 'jev-1.13.0' || answer?.type !== 'noul'
    || typeof answer.noul !== 'number' || !Number.isFinite(answer.noul)
    || answer.noul < 0 || answer.noul > 1) return 'undecided';
  return answer.noul <= 0.15 ? 'pass' : answer.noul >= 0.85 ? 'lost' : 'undecided';
}

export function summaryJevScore(value: unknown): number | null {
  const response = value as { model?: unknown; answers?: { lost_memory?: { type?: unknown; noul?: unknown } } } | null;
  const answer = response?.answers?.lost_memory;
  return response?.model === 'jev-1.13.0' && answer?.type === 'noul'
    && typeof answer.noul === 'number' && Number.isFinite(answer.noul)
    && answer.noul >= 0 && answer.noul <= 1 ? answer.noul : null;
}

export function summaryJevUsage(value: unknown): { inputTokens: number | null; outputTokens: number | null; charge: null } {
  const usage = (value as { usage?: { input_tokens?: unknown; output_tokens?: unknown } } | null)?.usage;
  return { inputTokens: typeof usage?.input_tokens === 'number' ? usage.input_tokens : null,
    outputTokens: typeof usage?.output_tokens === 'number' ? usage.output_tokens : null, charge: null };
}
