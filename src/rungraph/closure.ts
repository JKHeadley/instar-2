import { constructGoverned, readRegisterEntry } from '../register/index.js';
import type { Result } from '../index.js';
import { boundary, need, take } from './boundary.js';
import { decodeExhaustionRecord, decodeUnreachableRunExit } from './closure-records.js';
import type { ExhaustionRecord } from './closure-types.js';
import type { UnreachableRunExit } from './types.js';
import type { RunDecodeContext, RunGovernance } from './types.js';

function ownerRecordGate(g: RunGovernance, id: string): void {
  const contract = take(readRegisterEntry('rungraph.contract', g.register, g.context));
  need(!('state' in contract.approvedIn) && contract.declaration.status === 'live'
    && contract.declaration.kind === 'governed documents'
    && contract.declaration.requiredFacts.location === 'docs/09-the-run-graph.md',
  'approved run contract unavailable');
  const declaration = take(readRegisterEntry(id, g.register, g.context)).declaration;
  const facts = declaration.requiredFacts;
  need(declaration.kind === 'blocking sites' && declaration.status === 'live'
    && facts.authority === 'block' && facts.decidesAlone === 'ruled-three'
    && facts.failDirection === 'closed' && facts.preservesInput === 'part-two:run-input'
    && facts.inspectedBy === 'P5-SEAM-RC-R10-F3-ADDITIVE-REGISTRATION'
    && facts.enforces === undefined,
  'additive owner-record gate registration differs');
}

/** Exhaustion is recorded through Part Five, but does not alone decide closure. */
export function exhaustionAdmission(input: unknown, c: RunDecodeContext, g: RunGovernance): Result<ExhaustionRecord> {
  return boundary('GovernedExhaustionAdmission', null, c, () => {
    take(constructGoverned('blocking sites', 'rungraph.exhaustion', g.register, g.context));
    ownerRecordGate(g, 'rungraph.exhaustion');
    return take(decodeExhaustionRecord(input, c));
  });
}

/** Unreachable closure has its own kind and never enters the legacy RunExit decoder. */
export function unreachableExitAdmission(input: unknown, c: RunDecodeContext, g: RunGovernance): Result<UnreachableRunExit> {
  return boundary('GovernedUnreachableRunExitAdmission', null, c, () => {
    take(constructGoverned('blocking sites', 'rungraph.unreachable', g.register, g.context));
    ownerRecordGate(g, 'rungraph.unreachable');
    return take(decodeUnreachableRunExit(input, c));
  });
}
