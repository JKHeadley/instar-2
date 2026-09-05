import type { DecodeContext } from '../src/index.js';
import type { GeneratedRegister, RegisterGeneration, SpineReadPort, ShapeApprovalPort, WorkflowChecks, StandingContext, RuleGraph } from '../src/register/index.js';
export function build(root: string, commit: string, options: {
  mode: 'bootstrap' | 'normal' | 'completion'; workflow?: Record<string, unknown>; now?: number;
  provider?: SpineReadPort & ShapeApprovalPort & { types?: DecodeContext; separations?: WorkflowChecks['separations']; landingStanding?: StandingContext; hasEnteredForce?: boolean };
}): { register: GeneratedRegister; generation: RegisterGeneration; graph: RuleGraph; conversion: { documents: Record<string, string>; sources: { path: string; symbol: string; declaration: { requiredFacts: Record<string, unknown> } }[] }; metrics: { prerequisites: number } };
