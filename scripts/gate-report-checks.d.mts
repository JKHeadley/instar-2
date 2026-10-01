export interface ReportCheckPlan {
  readonly runs: boolean; readonly commands: string[][]; readonly handOff: string | null;
}
export const REPORT_CHECKS: readonly string[];
export function planReportChecks(split: string | undefined): ReportCheckPlan;
export function halfProvenance(split: string, root: string, revision: string, report: unknown): {
  split: string; root: string; revision: string; reportDigest: string; reportStart: number;
};
export function runCommands(
  commands: readonly (readonly string[])[],
  run?: (file: string, args: string[]) => { status: number | null },
): number;
