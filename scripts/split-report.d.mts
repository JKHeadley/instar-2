/** One half of an INSTAR_TEST_PLATFORM_SPLIT run: which half it is, where it ran, and which report it belongs to. */
export interface HalfProvenance {
  readonly split: string; readonly root: string; readonly revision: string;
  readonly reportDigest: string; readonly reportStart: number;
}
export interface SplitHalf { readonly split: string; readonly root: string; readonly revision: string;
  readonly reportDigest: string; readonly reportStart: number; readonly files: string[] }
/** The whole-suite report a merge produces, plus which halves it was built from. */
export interface MergedReport {
  readonly instarSplit: { readonly local: string; readonly halves: SplitHalf[] };
  readonly success: boolean;
  readonly startTime: number;
  readonly numTotalTests: number;
  readonly numPassedTests: number;
  readonly numTotalTestSuites: number;
  readonly testResults: { name: string; assertionResults: { fullName: string; status: string }[] }[];
  readonly [field: string]: unknown;
}
export interface MergeContext { readonly root: string; readonly revision: string; readonly expectedFiles: readonly string[] }
export interface MergeResult { readonly report: MergedReport; readonly local: unknown; readonly localSplit: string }

export const SPLITS: readonly string[];
export const MERGED_REPORT: string;
export const LOCAL_HALF_REPORT: string;
export function halfSidecar(reportPath: string): string;
export function reportDigest(report: unknown): string;
export function mergeHalfReports(
  halves: readonly { readonly report: unknown; readonly provenance: HalfProvenance }[],
  context: MergeContext,
): MergeResult;
export function localHalfReport<T>(report: T, root: string, read?: (path: string) => string):
  { report: T; otherHalfFiles: string[] };
