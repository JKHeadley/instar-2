// Rules 28, 82, 89, 98; Part Eleven §2; plan #91. The smallest production explicit-yes source.
// Two paths, both the approval-gesture amendment's `account-assented` yes (P-02), admitted only
// under the one declaration `accountAuthenticatedAssent` (src/decode/explicit-yes.ts):
//   1. default: the operator account replies `yes` to the request's own message in the bound chat;
//   2. where a recorded P-05 grant lets the agent speak through that chat account: the operator's
//      GitHub account APPROVES a review of the request's exact head, on a pull request whose body
//      names the request, reached by a direct link.
// The checks and the sealed one-use admission live in Part One (`admitExplicitYes`), the single
// route that issues account assent; this is Part Eleven's boundary around it, so a refusal is a
// `standing` refusal. Part One's decoder is still the authority that turns the record into an
// `Authorization`, and only with the admission in `DecodeContext.accountAssent`.
import { admitExplicitYes } from '../index.js';
import type { BoundaryContext, ExplicitYesInstallation, ExplicitYesObservation, ExplicitYesRecord, ExplicitYesRequest, Result } from '../index.js';
import { OperatorFailure, operatorBoundary } from './boundary.js';

export { chatYesReference, reviewYesReference, githubAccountAccess, SHARED_ACCESS_NOTE } from '../index.js';
export type { ExplicitYesInstallation, ExplicitYesObservation, ExplicitYesRecord, ExplicitYesRequest, OperatorAcceptance, SharedAccessDisclosure, ApprovalAccountAccess } from '../index.js';

export function produceExplicitYes(request: ExplicitYesRequest, installation: ExplicitYesInstallation,
  observation: ExplicitYesObservation, consumed: readonly string[], context: BoundaryContext): Result<ExplicitYesRecord> {
  return operatorBoundary('ExplicitYesRecord', context, () => {
    try { return admitExplicitYes(request, installation, observation, consumed); }
    catch (error) { throw new OperatorFailure(error instanceof Error ? error.message : 'explicit yes: refused', 'standing'); }
  });
}
