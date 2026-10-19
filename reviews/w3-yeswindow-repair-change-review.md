# Change review — w3-yeswindow repair: carry the approved yes-batch packet-selection fix so the answer reports the request this turn answered and keeps the other open action

Subject base: 9e3265e6ab1fe0b4c1e19d948669c726dbf70bd8
Review state: open
Reviewed content: none
Outcome: Unit review (Astra, round 1) MUST-FIX: this head inherited from ba63cbbc the packet selection by creation order (operatorRequests.at(-1)), so with an older raise and a newer renewal open together a yes to the raise reported the renewal, and after the renewal was approved the still-open raise vanished from "what is still waiting?". The fix is the already-accepted yes-batch repair deb03713 (approved in f44036ac), applied unchanged: the request this message answered is chosen first, otherwise the latest still-current reportable request, and the other action's open request is chosen independently. Its two assertions in yes-batch-live.test.ts are carried with it and pass here, alongside the yes-window tests.
Affected rules: 84 (the packet carries the answered approval and the remaining open action), 79 (both phone actions stay visible while both are open), 82 and 98 (unchanged: the packet only reports; approval and application paths are untouched), 3, 106 (recorded turns 969390038 and 969390039 replayed through the live port), 116, 74
Affected floors: secrets — unchanged, no secret read; spend cap — unchanged, the packet only reports request state; stop — unchanged; no duplicate sends — unchanged, no send path touched; durable intake — unchanged
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: model-facing packet content on the path that reports spend-allowance and trial-end approvals.
Side effects: an approved, applied request with a shared-access disclosure stays shown while it is the latest of its action even when a later request of the other action exists but is not reportable.
Undo and recovery: revert the two commits; no journal row or projection changed.
Multi-machine posture: machine-local preview runner, unchanged.
Layer below: operatorRequests projection, addOperatorRequest supersession, requestBase/approvalBase and disclosedApproval, all unchanged; the 18-hour window and its expiry checks are untouched.
Bug class: none
Bug evidence: none
Hook bypass: none
Convergence: none
Decision: yeswindow-carry-yesbatch-repair | apply the accepted deb03713 patch verbatim rather than a new design, because the reviewer named it as the smallest remedy and it applied cleanly on this head | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/w3-yeswindow-PROGRESS.md
Prompt review: no model-facing wording changed; only which request fills the existing operatorRequest and otherOperatorRequest fields.
Prompt finding: 849db3a6296a | protocol-literal | an existing fixed reply literal in journal.ts, unchanged by this change
Prompt finding: bd01de21286a | protocol-literal | existing capability-guidance wording in journal.ts, unchanged by this change
Prompt finding: fb5fa7e706c8 | protocol-literal | existing capability-guidance wording in journal.ts, unchanged by this change
Deferral: generated/register.json:1 | not-a-deferral=generated register replay at the repair commit

Subject (10 paths): generated/capabilities.json, generated/capabilities.md, generated/coverage.md, generated/glossary.md, generated/register.json, generated/rules.md, generated/source.json, reviews/w3-yeswindow-repair-change-review.md, tests/preview/journal.ts, tests/preview/yes-batch-live.test.ts

## Closing block

simplestRobustRoute: the required outcome is that the packet reports the request this message answered and every other open action. The simplest robust route reuses the already-approved reselection within the existing two fields; no store, gate, classifier or model call is added.
80/20: 0 must-fix; note: OTHER_OPERATOR_REQUEST_GUIDANCE remains unsampled on a real model.
VERDICT: author submission; the independent verdict is recorded as a pass
