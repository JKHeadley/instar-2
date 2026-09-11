import type { DecodeContext } from '../src/index.js';
import type { Result } from '../src/index.js';
import type { GeneratedRegister, RegisterGeneration, SpineReadPort, ShapeApprovalPort, WorkflowChecks, StandingContext, RuleGraph, FactReference } from '../src/register/index.js';
export interface BootstrapBinding { readonly anchor: string; readonly commit: string; readonly checkedAt: number }
export interface BootstrapVerification { readonly phase: 'converted-unanchored' | 'anchored'; readonly binding: BootstrapBinding; readonly fact: FactReference }
export function build(root: string, commit: string, options: {
  mode: 'bootstrap' | 'replay' | 'normal' | 'completion'; workflow?: Record<string, unknown>; now?: number; requireWorkflowSchema?: boolean;
  provider?: SpineReadPort & ShapeApprovalPort & { types?: DecodeContext; separations?: WorkflowChecks['separations']; landingStanding?: StandingContext;
    verifyBootstrap?: (binding: BootstrapBinding) => Result<BootstrapVerification> };
}): { register: GeneratedRegister; generation: RegisterGeneration; graph: RuleGraph;
  outputs: { register: string; ruleBook: string; glossary: string; capabilities: string; coverage: string };
  authorityPrerequisites: { site: string; record: string; required: string }[];
  conversion: { documents: Record<string, string>; sources: { path: string; symbol: string; declaration: { requiredFacts: Record<string, unknown> } }[] }; metrics: { prerequisites: number } };
