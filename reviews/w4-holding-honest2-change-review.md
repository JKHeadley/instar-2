# Change review — recover transient group review failures

Subject base: afa6be392876eb17c2789651090fa90b83a81f92
Review state: open
Reviewed content: none
Outcome: Live update 969390331 produced the CEDAR answer but its review failed before provider dispatch. The existing unavailable-review branch sent a terminal promise. This change retries a proven transient pre-provider failure once and releases the answer through the existing send path after a completed review. Exhaustion sends an honest final notice asking for a resend. The cause is recorded with the review.
Affected rules: purpose Rule 2; Rules 2, 4, 35, 36, 41, 42, 49, 55, 57, 60, 70, 74, 75, 77, 86, 88, 95, 101, 111, 113, 116
Affected floors: secrets — fixed content-free notices and classified exception causes; spend cap — reuse the unused reserved slot only before dispatch; stop — check after backoff and before send; no duplicate sends — retain signed intent and receipt plus UNKNOWN non-repetition; durable intake — keep original input, candidate and every check
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: affects a shared-audience review and send boundary
Side effects: forum replies anchor to the original durable message. Membership reads can wait 250 ms and retry once on timeout/429/5xx. A review can back off 500 ms and retry once before dispatch. Definite audience changes and grant refusals remain terminal. Failed getMe retains only transient status, with provider error text discarded.
Undo and recovery: revert this commit. Existing intents and reservations retain their UNKNOWN treatment; already delivered notices remain terminal.
Multi-machine posture: local to the active journal owner, with existing peer acknowledgement, ownership fence and dispatch claim. The original unused reservation covers the live retry.
Layer below: inspected group-membership-io.mjs, verifyGroupAudience, the confined getMe bridge, callSubscription before and after route.invoke, and journal.ts intent admission. The same failed audience read must admit the exact content-free final notice while continuing to withhold draft content.
Bug class: integration
Bug evidence: reproducer=tests/preview/group-review-retry.test.ts
Hook bypass: none
Convergence: none
Decision: honest2-reuse-release | use the existing unavailable-review release and notice branch | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/w4-holding-honest2-PROGRESS.md
Decision: honest2-uncharged-retry | retry typed transient pre-provider failure once with backoff; record it through the existing holding path to preserve format-retry sequencing and UNKNOWN restart handling | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/w4-holding-honest2-PROGRESS.md
Decision: honest2-membership-read | retry timeout/429/5xx once, preserving definite membership and grant refusals | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/w4-holding-honest2-PROGRESS.md
Decision: honest2-final-notice | admit exact content-free failure notices under existing dispatch floors and bind forum replies to intake | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/w4-holding-honest2-PROGRESS.md
Prompt review: acceptance and retry behavior changes. The new regression uses the exact CEDAR answer quoted by the read-only diagnosis of update 969390331; its reconstructed input and injected failures are explicitly controls, not raw journal capture. Existing archived summary, Jev, review and delivered-reply fixtures supply additional recorded-shape replay. Findings remain open: R105 requires renewed macOS harness conformance, and the targeted run has WSL-dependent failures listed in the report.
Prompt finding: 849db3a6296a | protocol-literal | existing fixed memory-inventory reply
Prompt finding: bd01de21286a | protocol-literal | existing memory-grounding instruction
Prompt finding: fb5fa7e706c8 | protocol-literal | existing memory-grounding instruction
Deferral: tests/preview/reply-check.declarations.json:13 | not-a-deferral=describes runtime behavior and bounded retry

## Closing block

simplestRobustRoute: reuse the existing review invocation and durable release path. The added typed distinction prevents a transient read failure from being mistaken for a charged UNKNOWN. One read retry and one review retry are bounded by existing deadlines and admission. An exact content-free notice prevents the failed audience read from also suppressing the result. Start guards are disclosure and reservation; end-state is one reviewed answer or a final notice; stop, ownership, spend and send-deduplication still apply. Offline consumer replay is demonstrated; live delivery and renewed macOS conformance remain for the gate host.
80/20: targeted tests cover the observed failure and adjacent floors. R105 is an outstanding finding, requiring the declared platform's contract evidence; the report preserves that red result.
VERDICT: author submission; independent review remains outstanding
