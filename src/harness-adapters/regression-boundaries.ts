export interface PreventiveCompactionSignals {
  readonly panePercentage: number | null;
  readonly work: 'idle' | 'working' | 'indeterminate' | 'unreadable';
  readonly elapsed: number;
  readonly spaced: boolean;
  readonly dryRun: boolean;
}

export function preventiveCompactionDisposition(_signals: PreventiveCompactionSignals): Readonly<{
  capability: 'unsupported'; action: 'none'; reason: string;
}> {
  return Object.freeze({ capability: 'unsupported', action: 'none',
    reason: 'pre-limit preventive compaction has no granted exact-incarnation pressure observation' });
}

export interface CorrelatedGrowthObservation {
  readonly worker: string;
  readonly before: number;
  readonly after: number;
}

export interface CorrelatedRecoveryProof {
  readonly holder: import('./holder.js').HarnessEvidenceHolder;
  readonly handle: import('./contracts.js').HarnessRuntimeHandle;
  readonly now: number;
}

export function correlatedRecoveryProgress(worker: string, observations: readonly CorrelatedGrowthObservation[], proof?: CorrelatedRecoveryProof): Readonly<{
  state: 'progressed' | 'pending'; evidence: readonly CorrelatedGrowthObservation[];
}> {
  const evidence = Object.freeze(observations.filter(row => row.worker === worker
    && Number.isSafeInteger(row.before) && row.before >= 0
    && Number.isSafeInteger(row.after) && row.after > row.before));
  // Caller numbers are not Part Two capture evidence. A prior Five transition
  // can prove work state, but cannot authenticate arbitrary later byte growth.
  // Keep the observations for diagnosis while the capture-read owner seam is
  // unlanded; never promote them to recovered progress.
  void proof;
  return Object.freeze({ state: 'pending' as const, evidence });
}
