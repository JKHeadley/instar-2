import type {
  CompletedRunExit, ContinuityAccounting, ExhaustionRecord,
  RunExit, RunExitAny, RunExitReadPort, RunClosureGraphPort, RunOwnedRecordReference, UnreachableRunExit,
} from '../../src/rungraph/index.js';
import type { OwnedReference, Result } from '../../src/index.js';

declare const completed: CompletedRunExit;
declare const unreachable: UnreachableRunExit;
declare const exhaustion: ExhaustionRecord;
declare const continuity: ContinuityAccounting;
declare const exits: readonly RunExit[];
declare const readPort: RunExitReadPort;
declare const closurePort: RunClosureGraphPort;
declare const runReference: OwnedReference<'part-five', 'Run'>;

const closedUnion: readonly RunExitAny[] = [completed, unreachable, ...exits];
void closedUnion; void exhaustion; void continuity;

const legacyCompletedRead: Result<Readonly<{ fact: import('../../src/index.js').FactEnvelopeReference; exit: CompletedRunExit }>> = readPort.readExit(runReference);
const explicitCompletedRead: Result<Readonly<{ fact: import('../../src/index.js').FactEnvelopeReference; exit: CompletedRunExit }>> = readPort.readExit(runReference);
const explicitUnreachableRead: Result<Readonly<{ fact: import('../../src/index.js').FactEnvelopeReference; exit: RunExitAny }>> = closurePort.readExitAny(runReference);
void legacyCompletedRead; void explicitCompletedRead; void explicitUnreachableRead;

// Every arm excludes every other arm's required payload at compile time.
// @ts-expect-error completed cannot carry an exhaustion reference
const mixedCompleted: CompletedRunExit = { ...completed, exhaustion: unreachable.exhaustion };
// @ts-expect-error unreachable requires its unsatisfied clauses
const missingClauses: UnreachableRunExit = (({ unsatisfiedClauses: _, ...rest }) => rest)(unreachable);

// Part Five's owner references cannot be widened to an unregistered owner/name pair.
// @ts-expect-error ExhaustionRecord is owned only by part-five
const foreignOwner: RunOwnedRecordReference<'ExhaustionRecord'> = { ...unreachable.exhaustion, owner: 'part-fifteen' };
// @ts-expect-error only registered Part Five record names inhabit this reference
const foreignName: RunOwnedRecordReference<'ExhaustionRecord'> = { ...unreachable.exhaustion, name: 'RunExit' };

// Continuity pending work remains explicitly owned and cannot masquerade as addressed work.
if (continuity.disposition.kind === 'pending') {
  // @ts-expect-error pending continuity has no addressed-work reference
  continuity.disposition.directive;
}
void mixedCompleted; void missingClauses; void foreignOwner; void foreignName;
