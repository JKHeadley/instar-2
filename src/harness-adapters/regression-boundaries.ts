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

export function correlatedRecoveryProgress(worker: string, observations: readonly CorrelatedGrowthObservation[]): Readonly<{
  state: 'progressed' | 'pending'; evidence: readonly CorrelatedGrowthObservation[];
}> {
  const evidence = Object.freeze(observations.filter(row => row.worker === worker && row.after > row.before));
  return Object.freeze({ state: evidence.length ? 'progressed' : 'pending', evidence });
}
