# Change review — compose d1c3 onto the pinned live build

Subject base: 4b125fec868204430f25023b94d0cf071e0c867d
Review state: open
Reviewed content: none
Outcome: Merge a0804204 onto live 4b125fec without changing the reviewed implementation, and replay the register against the merged head. A due result bound to the current reply reaches the operator in that turn even when removing an unrelated untracked deferral leaves an incoherent list. Only surviving runner result lines are sent; rejected prose stays withheld.
Affected rules: Purpose 2/3 and least revelation; Rules 1/4/8/34/36/41/42/46/49/55/57/58/63/70/74/77/83/86/89/95/101/102/108/113/116.
Affected floors: secrets — original credential refusal and final outbound secret check remain; spend cap — no extra calls or changed allowances; stop — existing pre-intent gate; no duplicate sends — existing intent/receipt and UNKNOWN fence; durable intake — original encrypted journal and all review records retained.
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: Changes final reply selection on an obligation delivery failure while preserving effect admission and review evidence.
Side effects: Only an operator-only reply with a rejected excision remainder, solely incoherent_remainder, may deliver bound result lines that survived excision. Missing results, credentials, shared audiences, unavailable review and other remainder violations retain existing behavior. An operator action proposed by withheld prose is not offered. Final secret, size, ownership, stop and dispatch checks remain. Existing release records retain the original violation and dispositions and explicitly name result-only delivery; the separate rejected remainder record remains unchanged.
Undo and recovery: Revert the journal selection and regression test, then regenerate publications. No journal schema changes or migrations; old readers can read every record. No live root was opened or modified.
Multi-machine posture: No new state. The existing journal replication, conversation ownership, durable send intent and unknown-outcome fences govern this path on every machine. Tests use isolated machine-local temporary journals.
Layer below: Read origin/main constitution in full, checked exact live base and fast-forward ancestry, inspected desk chain and unchanged guard 22,959 bytes. Inspected pendingReports/reportLine, exact answerReports binding, claim excision/remainder review, sentObligations, withheldReports, outbound checks, intent/receipt projection and reopen behavior. Consulted constitution in full and part 12 outbound review before choosing route (b).
Bug class: none
Bug evidence: none
Hook bypass: none; core.hooksPath unset and common hooks directory contains only sample files.
Convergence: none
Decision: sb-d1c3-merge | Ordinary merge of a0804204 onto pinned live 4b125fec fast-forwarded without conflicts; preserve the unit exactly. Unit evidence: /Users/dabombstudio/.instar/agents/echo/.instar/lanes/d1c3-1012-PROGRESS.md. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/sb-d1c3-1012-PROGRESS.md
Decision: sb-d1c3-publication | Run the recorded repin, build, rehash and register replay chain against a0804204; zero owner/inventory changes, seven generated publications refreshed. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/sb-d1c3-1012-PROGRESS.md
Prompt review: No prompt or parser changed. The final candidate selection changes; exercise accepted-but-unchanged revision, excision leaving an empty list, result-only delivery, refusal neighbors and durable reopen. Captured review and reply fixtures are replayed by claim-scoped-floor, journal-revision-keeps-results, guidance and summary-cascade-stall. No claim that the desk brief supplied original candidate bytes or an update id.
Prompt finding: 849db3a6296a | protocol-literal | Existing fixed memory inventory response; unchanged by this selection repair.
Prompt finding: bd01de21286a | protocol-literal | Existing source label grounding instruction; unchanged.
Prompt finding: fb5fa7e706c8 | protocol-literal | Existing memory retrieval instruction; unchanged.
Verification: Initial 26 targeted tests, typecheck, build, lint and architecture pass. Always-sent answer is 22,825 bytes against unchanged 22,959 guard; tool answer 25,697 bytes. Final gates and additional recorded-shape replays are recorded in the builder report. This is an author submission, not live deployment or independent convergence evidence.

## Closing block

simplestRobustRoute: An ordinary fast-forward merge plus the existing desk regeneration is the simplest robust composition route; no new runtime machinery. The unit uses the simplest robust route: choose the existing runner-owned result lines after the single bounded remainder review rejects only incoherence, keeping the rejected prose withheld. A second reviser attempt would add latency and spend without guaranteeing result delivery. Start guards require bound pending results, operator-only standing, no credential objection and unchanged result lines after excision. End guards are the existing exact outbound floors and durable intent/receipt. All budgets remain. The isolated worker replay completes unattended; live-channel acceptance belongs to the desk.
80/20: Targeted positive and negative cases plus recorded shapes, direct consumers, compiler, architecture and publication gates; no full suite or live machine load test.
VERDICT: author submission; no independent convergence claim
