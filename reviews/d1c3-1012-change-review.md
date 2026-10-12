# Change review — deliver finished results after prose excision fails

Subject base: 4b125fec868204430f25023b94d0cf071e0c867d
Review state: open
Reviewed content: none
Outcome: A due result bound to the current reply reaches the operator in that turn even when removing an unrelated untracked deferral leaves an incoherent list. Only surviving runner result lines are sent; rejected prose stays withheld.
Affected rules: Purpose 2/3 and least revelation; Rules 1/4/8/34/36/41/42/46/49/55/57/58/63/70/74/77/83/86/89/95/101/102/108/113/116.
Affected floors: secrets — original credential refusal and final outbound secret check remain; spend cap — no extra calls or changed allowances; stop — existing pre-intent gate; no duplicate sends — existing intent/receipt and UNKNOWN fence; durable intake — original encrypted journal and all review records retained.
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: Changes final reply selection on an obligation delivery failure while preserving effect admission and review evidence.
Side effects: Only an operator-only reply with a rejected excision remainder, solely incoherent_remainder, may deliver bound result lines that survived excision. Missing results, credentials, unverified shared audiences, unavailable review and other remainder violations retain existing behavior. An operator action proposed by withheld prose is not offered. Final secret, size, ownership, stop and dispatch checks remain. Existing release records retain the original violation and dispositions and explicitly name result-only delivery; the separate rejected remainder record remains unchanged.
Undo and recovery: Revert the journal selection and regression test, then regenerate publications. No journal schema changes or migrations; old readers can read every record. No live root was opened or modified.
Multi-machine posture: No new state. The existing journal replication, conversation ownership, durable send intent and unknown-outcome fences govern this path on every machine. Tests use isolated machine-local temporary journals.
Layer below: Inspected pendingReports/reportLine, exact answerReports binding, claim excision/remainder review, sentObligations, withheldReports, outbound checks, intent/receipt projection and reopen behavior. Consulted constitution in full and part 12 outbound review before choosing route (b).
Bug class: none
Bug evidence: none
Hook bypass: none; core.hooksPath unset and common hooks directory contains only sample files.
Convergence: none
Decision: d1c3-result-only | Choose route (b), reusing bound runner lines and existing send path; no second revision or new budget. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/d1c3-1012-PROGRESS.md
Decision: d1c3-narrow-floor | Limit fallback to operator-only, sole incoherent_remainder and lines preserved by excision; retain credentials, other refusals and rejected prose. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/d1c3-1012-PROGRESS.md
Decision: d1c3-evidence | Label the brief-derived 466-character reconstruction honestly; also replay captured claim/review 969389898 through the new branch and retain recorded neighboring shape tests. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/d1c3-1012-PROGRESS.md
Decision: d1c3-publication | Regenerate the existing shape-only register from committed source b18c4610; owner-manifest rehash and inventory repin made no changes. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/d1c3-1012-PROGRESS.md
Decision: d1c3-intent-wording | The durable intent records results selected for delivery, not sent; only a receipt establishes delivery, including UNKNOWN transport outcomes. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/d1c3-1012-PROGRESS.md
Decision: d1c3-verified-forum | Reuse current operatorOnlyVerified standing for forum parity; unverified groups and sensitivity violations remain excluded. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/d1c3-1012-PROGRESS.md
Prompt review: No prompt or parser changed. The final candidate selection changes; exercise accepted-but-unchanged revision, excision leaving an empty list, result-only delivery, refusal neighbors and durable reopen. Captured review and reply fixtures are replayed by claim-scoped-floor, journal-revision-keeps-results, guidance and summary-cascade-stall. No claim that the desk brief supplied original candidate bytes or an update id.
Prompt finding: 849db3a6296a | protocol-literal | Existing fixed memory inventory response; unchanged by this selection repair.
Prompt finding: bd01de21286a | protocol-literal | Existing source label grounding instruction; unchanged.
Prompt finding: fb5fa7e706c8 | protocol-literal | Existing memory retrieval instruction; unchanged.
Verification: Thirteen D1c cases and 32 audience cases, the required 21 floor tests, 88 pinned tests and recorded-shape neighbors passed; intent-wording and verified-forum corrections pass the complete D1c matrix; compiler, direct consumers and final publication gates recorded in the builder report. This is an author submission, not live deployment or independent convergence evidence.

## Closing block

simplestRobustRoute: This is the simplest robust route: choose the existing runner-owned result lines after the single bounded remainder review rejects only incoherence, keeping the rejected prose withheld. A second reviser attempt would add latency and spend without guaranteeing result delivery. Start guards require bound pending results, operator-only standing, no credential objection and unchanged result lines after excision. End guards are the existing exact outbound floors and durable intent/receipt. All budgets remain. The isolated worker replay completes unattended; live-channel acceptance belongs to the desk.
80/20: Targeted positive and negative cases plus recorded shapes, direct consumers, compiler, architecture and publication gates; no full suite or live machine load test.
VERDICT: author submission; no independent convergence claim
