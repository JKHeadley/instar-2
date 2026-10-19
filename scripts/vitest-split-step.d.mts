export interface StepPlan {
  readonly runs: boolean; readonly argv: string[]; readonly files: string[]; readonly otherHalf: string[];
}
export function planStep(args: readonly string[], split: string | undefined, macosOnly: readonly string[]): StepPlan;
