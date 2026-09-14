## 4. Collective store and clustering

**Rule — history and its current views have different custody.** **Checks: P22-NF-06/07/08.**
The local outbox commits before transmission. It binds one canonical case, destination,
immutable payload and current export policy. A fenced worker claims bounded work, resolves
current consent immediately before send, and advances only from a valid receipt. Ambiguous
transmission queries custody under the same key; it does not create another case. Exponential
backoff honors both forms of Retry-After within the local finite budget; 429/503 pauses the
batch rather than hammering every row. Cancellation retains exposure and unresolved custody.

The collective store retains immutable admitted records, provenance, authorized attachments,
curated review decisions and causal assessment succession. Search indexes and similarity
clusters are rebuildable projections; curated rationale, dissent, approvals and repair links
are not. Signed case facts, provenance, curated decisions, approvals, withdrawal records and
replay identities remain permanent under every retention option. Withdrawal adds a fact and
removes current eligibility; it never deletes the case history. F27 checks cache disposal and
existing-contract attachment redaction against forbidden history expiry and restore resurrection.
A durable mutation goes through Two's fact admission and its declared storage policy.
Corrupt data returns unavailable/quarantined, never an empty success view.

Basis: Coherency and constraint 2; rules 7/33/45/55/60/61/95; R1/R4 custody lessons; section 14 ST/R seams.

**Rule — each branch has its own transition receipts and accountable owner.** **Checks: P22-NF-07/08/11/12.**

| Branch | State sequence and invariant |
|---|---|
| Export | `local-recorded → queued → front-stored → admitted/signal-only/rejected`; held, expired, revoked and unavailable stay visible |
| Review | `admitted → review-assigned → reviewed`; an explicit held/rejected disposition completes triage, not product improvement |
| Scenario | `reviewed → scenario-eligible → scenario-promoted`; only real graded, permitted evidence can support a production benchmark |
| Proposal | `reviewed → proposed → approved → released`; exact placement, evidence, human approval and release custody are separate acts |
| Receiving agent | `release-seen → locally-admitted → locally-installed → outcome-reviewed`; download is not installation or effectiveness |
| Correction | `correction-recorded → owner-validated → support-invalidated → re-evaluated`; downstream holds and withdrawal have their own receipts |

Scenario eligibility never implies proposal approval. One logical review task has an accountable
owner and reachable status. A handoff is complete only after reading back the exact owned task;
closing that task does not prove the product fixed. Every transition records predecessor,
cause, author, generation, clock, schema and required evidence. Conflicting causal successors
stay disputed instead of last-arrival-wins.

Basis: Purpose constraints 2/3; rules 33/41/58/85/108; big picture §8; R5 Proposal A.

**Rule — similarity nominates work; it does not decide a lesson.** **Checks: P22-NF-08/10.**
Clustering consumes permitted categories and comparable public identities, records algorithm
and version, exact members, merge/split reasons and uncertain matches. Different private
opaque ids cannot be treated as evidence of equality or difference in hidden content.
Duplicate retries, copied incidents and sibling agents remain one source lineage. Distinct
current model/grader lineages and independently verified operator groups remain visible.
A content-free cluster can remain too weak to replay or diagnose. Rich-text review runs only
within the corresponding grant. Model-assisted triage uses Seven's recorded doorway beneath
fixed floors and cannot issue a release approval.

Basis: Trust and constraint 3; rules 13/28/57/58/65/86/108; R4 collective custody and placement.

**Rule — no durable state is introduced without a loss detector.** **Checks: P22-NF-07/08/12/19.**

| State | Detector and response |
|---|---|
| Outbox and receipt mapping | Reconcile durable keys against remote custody; missing/expired receipt remains pending with a bounded owner alert |
| Store and authorized attachments | Integrity/custody scan plus restore test; missing body becomes unavailable and invalidates dependent proof |
| Curated review and owned work | Age/lease reconciliation; unowned or stalled case receives a held disposition and owner escalation |
| Current assessments and dependents | Reverse support index reconciled against causal corrections; invalidate stale scenarios/proposals/releases |
| Release and installation | Inventory joins published artifacts, withdrawal notices and actual local installs; missing outcome follow-up stays overdue |
| Budget and identity epochs | Durable accounting replay detects reset/reuse; refuse new spending/export while current state is unresolved |

Reconciliation targets are in the pilot; operational timers are bounded settings. Monitors
report their own last successful run. A silent dead detector cannot certify healthy state.

Basis: Purpose constraint 2; rules 43/45/62/69/95; P22 E2/E7/E12.
