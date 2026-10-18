# Change review — cint-L38b repair: an approved-but-unapplied request stays in the packet beside the other action's request

Subject base: 9480053bcade3d8876aeb9349386fef88d6577fb
Review state: open
Reviewed content: none
Outcome: Integration review (Astra, cint-L38b round 1) MUST-FIX 1: the sibling field was chosen with openNow, which excludes every approved request, and its renderer described only waiting states. With a raise approved by review but left unapplied by a crash before its caps frame, and the renewal still open, the next operator question showed the renewal (as a refused chat answer) and no trace of the approved-but-unapplied raise. Fix in the packet only: the sibling may be the other action's current request that is open at the live base, or approved and not applied; both fields render through one describe() so the sibling reports its real approval/application state with the same shared-access disclosure. The request this turn answered keeps priority. The reviewer's interrupted-application case is an assertion in yes-batch-live.test.ts, shown to fail on 9480053b and pass here.
Affected rules: 84 (the packet keeps the agent's own unfinished outcome: an approval not yet applied), 79 (both phone actions stay visible), 82 and 98 (unchanged: the packet only reports; approval and application paths are untouched, nothing re-applies from journal rows), 3, 106 (recorded turns 969390038 and 969390039 replayed through the live port fixture), 116
Affected floors: secrets — unchanged, no secret read; spend cap — unchanged, the cap stays held and the packet only reports; stop — unchanged; no duplicate sends — unchanged, no send path touched; durable intake — unchanged
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: model-facing packet content on the path that reports spend-allowance and trial-end approvals.
Side effects: OTHER_OPERATOR_REQUEST_GUIDANCE now says the sibling may be open or approved but not applied yet, and to report its state as given.
Undo and recovery: revert the two commits; no journal row or projection changed.
Multi-machine posture: machine-local preview runner, unchanged.
Layer below: operatorRequests projection, liveRequests currency, requestBase/approvalBase, SHARED_ACCESS_NOTE disclosure, all unchanged.
Bug class: none
Bug evidence: none
Hook bypass: none
Convergence: none
Decision: l38b-sibling-unapplied | the sibling field also carries the other action's approved-but-unapplied request, rendered by the same function as the primary, because openNow excluded it and the waiting-only renderer could not state it | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/cint-L38b-PROGRESS.md
Prompt review: one guidance sentence (OTHER_OPERATOR_REQUEST_GUIDANCE) reworded to cover the approved-but-unapplied sibling state; field contents otherwise use existing state strings.
Prompt finding: 849db3a6296a | protocol-literal | an existing fixed reply literal in journal.ts, unchanged by this change
Prompt finding: bd01de21286a | protocol-literal | existing capability-guidance wording in journal.ts, unchanged by this change
Prompt finding: fb5fa7e706c8 | protocol-literal | existing capability-guidance wording in journal.ts, unchanged by this change
Deferral: generated/register.json:1 | not-a-deferral=generated register replay at the repair commit

Subject (10 paths): generated/capabilities.json, generated/capabilities.md, generated/coverage.md, generated/glossary.md, generated/register.json, generated/rules.md, generated/source.json, reviews/cint-L38b-astra-repair-change-review.md, tests/preview/journal.ts, tests/preview/yes-batch-live.test.ts

## Closing block

simplestRobustRoute: the required outcome is that an approval not yet applied stays visible while the other action's request is primary. The simplest robust route widens the existing sibling selection and shares the existing renderer; no store, retry, journal field, gate or model call is added.
80/20: 0 must-fix; note: the reworded OTHER_OPERATOR_REQUEST_GUIDANCE remains unsampled on a real model.
VERDICT: author submission; the independent verdict is recorded as a pass
