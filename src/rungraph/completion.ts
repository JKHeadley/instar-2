/** Completion accounting inside the existing work record (Rules 4, 68, 83, 97).
 * These are the worker's evidence claims, not independently verified effects or
 * authority. The owner persists them and retains its existing review and floors. */
export interface RunCompletionItem {
  readonly id: string;
  readonly work: string;
  readonly state: 'open' | 'complete';
  readonly evidence?: string;
}
export const RUN_COMPLETION_LIMIT = 32;
const text = (value: unknown, max: number): value is string => typeof value === 'string'
  && value.trim().length > 0 && value.length <= max;

/** Updates may add work or account for it, never silently remove or rename it.
 * Missing updates retain all prior work. Invalid updates leave custody to the
 * caller; no partial list is returned as a complete inventory. */
export function reconcileRunCompletion(previous: readonly RunCompletionItem[], updates: unknown): readonly RunCompletionItem[] | null {
  if (updates === undefined) return previous;
  if (!Array.isArray(updates) || updates.length > RUN_COMPLETION_LIMIT) return null;
  const result = new Map(previous.map(item => [item.id, item]));
  const seen = new Set<string>();
  for (const value of updates as unknown[]) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    const item = value as Record<string, unknown>;
    if (Object.keys(item).some(key => !['id', 'work', 'state', 'evidence'].includes(key))
      || !text(item.id, 100) || !text(item.work, 500) || seen.has(item.id)
      || item.state !== 'open' && item.state !== 'complete'
      || item.evidence !== undefined && !text(item.evidence, 1000)
      || item.state === 'complete' && !text(item.evidence, 1000)) return null;
    const old = result.get(item.id);
    if (old && old.work !== item.work) return null;
    seen.add(item.id);
    result.set(item.id, { id: item.id, work: item.work, state: item.state,
      ...(typeof item.evidence === 'string' ? { evidence: item.evidence } : {}) });
  }
  return result.size > RUN_COMPLETION_LIMIT ? null : [...result.values()];
}
