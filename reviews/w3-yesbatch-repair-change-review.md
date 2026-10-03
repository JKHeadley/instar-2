# Change review — w3-yesbatch repair: the answer packet reports the request this turn answered and keeps the other open action

Subject base: ba63cbbc4be4a897ecd1cd43882e2907ca558172
Review state: open
Reviewed content: none
Outcome: Unit review (Astra, round 1) MUST-FIX: the answer packet still chose its request by creation order (operatorRequests.at(-1)), and the sibling field ran only when that latest request was displayable. Two deterministic packet failures followed on a chat-yes root: with a raise open and the newer renewal applied, "what still needs approval?" showed neither request; a yes to the older raise was reported as the still-open renewal, omitting the approval it answered. Fix in the packet only: the request this message answered (approved or refused on this turn) is chosen first; otherwise the latest still-current request to report, where a request stays current until a later request for its action (or a legacy row without requestScope, which replaced every one) replaces it; the other action's open request is chosen from the current requests independently. The shared-access disclosure and approved-but-unapplied visibility keep their conditions. Both reviewer probes are now assertions in yes-batch-live.test.ts and were shown to fail on ba63cbbc and pass here.
Affected rules: 84 (the packet carries the agent's own request state: the answered approval and the remaining open action), 79 (both phone actions stay visible while both are open), 82 and 98 (unchanged: the packet only reports; approval and application paths are untouched), 3 (status answers do not omit an open request), 106 (recorded turns 969390038 and 969390039 replayed through the live port), 116, 74
Affected floors: secrets — unchanged, no secret read; spend cap — unchanged, the packet only reports request state; stop — unchanged; no duplicate sends — unchanged, no send path touched; durable intake — unchanged
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: model-facing packet content on the path that reports spend-allowance and trial-end approvals.
Side effects: an approved, applied request with a shared-access disclosure stays shown while it is the latest of its action even when a later request of the other action exists but is not reportable; earlier only the very latest request could carry it.
Undo and recovery: revert the two commits; no journal row or projection changed.
Multi-machine posture: machine-local preview runner, unchanged.
Layer below: operatorRequests projection, addOperatorRequest supersession, requestBase/approvalBase and disclosedApproval, all unchanged.
Bug class: none
Bug evidence: none
Hook bypass: none
Convergence: none
Decision: yesbatch-packet-selection | the packet picks the request answered on this turn, else the latest current reportable one, with currency decided by later requests of the same action (or a legacy row), because creation order alone hid an open action and misreported the answered one | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/w3-yesbatch-PROGRESS.md
Prompt review: no model-facing wording changed; only which request fills the existing operatorRequest and otherOperatorRequest fields.
Prompt finding: 849db3a6296a | protocol-literal | an existing fixed reply literal in journal.ts, unchanged by this change
Prompt finding: bd01de21286a | protocol-literal | existing capability-guidance wording in journal.ts, unchanged by this change
Prompt finding: fb5fa7e706c8 | protocol-literal | existing capability-guidance wording in journal.ts, unchanged by this change
Deferral: generated/register.json:1 | not-a-deferral=generated register replay at the repair commit

Subject (10 paths): generated/capabilities.json, generated/capabilities.md, generated/coverage.md, generated/glossary.md, generated/register.json, generated/rules.md, generated/source.json, reviews/w3-yesbatch-repair-change-review.md, tests/preview/journal.ts, tests/preview/yes-batch-live.test.ts

## Closing block

simplestRobustRoute: the required outcome is that the packet reports the request this message answered and every other open action. The simplest robust route reselects within the existing two fields from the existing projection; no store, gate, classifier or model call is added.
80/20: 0 must-fix; note: OTHER_OPERATOR_REQUEST_GUIDANCE remains unsampled on a real model.
VERDICT: author submission; the independent verdict is recorded as a pass
