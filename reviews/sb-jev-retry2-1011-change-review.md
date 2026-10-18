# Change review — integrate the bounded Jev retry

Subject base: 7002feeb7cd44c8ea2ec2500aa005999962ff3b1
Review state: open
Reviewed content: none
Outcome: Ordinary merge of reviewed unit 179d896869ac7d27c3a290cdcf14210ac1afd492 onto the exact live base, followed by the existing desk publication replay. The merge fast-forwarded without conflicts. Reply checks receive at most two separately reserved Jev attempts, including disclosure admission within each attempt deadline, before the existing contextual fallback.
Affected rules: Purpose least revelation and durable cause; Rules 1, 26, 34, 36, 37, 39, 41, 49, 55, 58, 60, 63, 67, 69, 70, 74, 75, 77, 90, 95, 101, 102, 111, 112, 113, 116.
Affected floors: secrets — unchanged disclosure authority and fixed diagnostic categories; spend cap — separate reservations retain UNKNOWN charges; stop — existing worker and reservation checks; no duplicate sends — existing durable intent and recovery custody; durable intake — existing journal preserves accepted turns and retry history.
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: Integrates changes to the shipped review cascade and durable call accounting; local proof is gate submission evidence, not live acceptance.
Side effects: One unavailable attempt may consume a second call from the existing Jev allowance. Its first unknown charge remains even if the retry succeeds. Each attempt has 850 ms including outer admission and the total Jev elapsed budget is 1800 ms. Synchronous event-loop stalls are not a hard real-time guarantee. Valid unsure or violation verdicts are not retried. Register replay establishes shape only, not live authority.
Undo and recovery: Prefer a forward fix or disable new retries while retaining the compatible reader for journals containing retry reservations. Do not roll back to a reader that cannot account for existing retry rows. Regenerate publication through the same desk tools after a source change; no history is deleted.
Multi-machine posture: No new store, peer protocol or authority. Existing conversation ownership, disclosure, peer-held reservations and stop checks govern each host. Attempt timers are machine-local and uncertain calls are not replayed after restart.
Layer below: Inspected the actual client admission/AbortSignal/fetch path, worker disclosure race and remaining-time handoff, durable retry projection, UNKNOWN token accounting and contextual fallback. Read both unit reviews and the desk's cint-L37 chain. Tests replay recorded content through the worker and extracted shipped client, with real loopback HTTP and injected timing.
Bug class: integration
Bug evidence: reproducer=tests/preview/jev-retry.test.ts
Hook bypass: none; core.hooksPath unset and shared hooks directory contains sample hooks only.
Convergence: none
Decision: sb-jev-unit | Merge exact unit 179d8968 unchanged; unit evidence is /Users/dabombstudio/.instar/agents/echo/.instar/lanes/jev-retry2-1011-PROGRESS.md, including its admission repair. Fast-forward preserved every commit; no conflicts or changelog resolutions. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/sb-jev-retry2-1011-PROGRESS.md
Decision: sb-jev-publication | Execute the cint-L37 repin/build/rehash/replay chain against merged head 179d896869ac7d27c3a290cdcf14210ac1afd492; only the downloaded sed invocation is adapted to Linux, with no manual generated edits. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/sb-jev-retry2-1011-PROGRESS.md
Decision: sb-jev-verification | Use targeted changed-file and floor/accounting/recorded-shape tests plus the specific register e2e requirement and Linux pinned-text list; the desk owns full-suite and macOS evidence. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/sb-jev-retry2-1011-PROGRESS.md
Prompt review: No new model wording added by this integration. Replayed recorded update 969390330, unavailable rows 969390355, 969390371, 969390389 and 969390397, plus existing summary-uncertain, Jev unsure/undecided, reply-review and empty-reply shapes in group-carry tests. Failure causes and latency are injected, not historical diagnoses. No live journal read or production latency claim.
Prompt finding: 849db3a6296a | protocol-literal | Existing fixed reply literal in journal.ts, unchanged by the unit.
Prompt finding: bd01de21286a | protocol-literal | Existing source-citation guidance in journal.ts, unchanged by the unit.
Prompt finding: fb5fa7e706c8 | protocol-literal | Existing recall guidance in journal.ts, unchanged by the unit.
Verification: Commands and exact outcomes are recorded in the build report. All 178 tests in the first ten targeted files passed. Default-context-floor passed with guard 22959 unchanged; measured always-sent answer is 22709 bytes, 250 bytes below the guard. Register and final-head checks are reported separately without treating missing Studio evidence as local success.

## Closing block

simplestRobustRoute: This is the simplest robust route: ordinary merge of the reviewed unit, existing desk regeneration and targeted checks. The existing cascade gains one bounded reserved retry; the admission timer prevents demonstrated late dispatch without a new service. Start guards remain disclosure, ownership, stop and durable reservations; limits remain two attempts within the existing cap and budget; end guards remain verdict interpretation and contextual fallback. Offline recorded-shape and loopback proof is not unattended live acceptance.
80/20: Preserve reviewed source bytes and test their composition, publication and context floor. No new runtime machinery, policy, authority or constitutional wording is added by the integration.
VERDICT: author submission; independent convergence and deployment are not claimed
