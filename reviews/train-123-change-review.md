# Change review — train-123 reviewed quota pool port

Subject base: 588332d9d0839cd504bee2819e297cd6222a2ef9
Review state: open
Reviewed content: none
Outcome: Integrate exactly reviewed pool-port-1021 at 566b6cb126f6ea2ede5122f5f1b33ef58869e44c onto live train-113, preserving the live quota collector, cooler-account handoff, soft-pressure reachability repair and partial-window evidence.
Affected rules: 1, 4, 5, 13, 14, 15, 26, 28, 30, 34, 35, 36, 37, 39, 41, 44, 45, 49, 55, 60, 61, 63, 68, 69, 70, 74, 75, 90, 95, 96, 100, 101, 102, 111, 112, 113, 115, 116
Affected floors: secrets — no login use or credential change; spend cap — unchanged model reservations and no live calls here; stop — unchanged admission and latch; no duplicate sends — unchanged dispatch and no probes here; durable intake — unchanged journal and preservation of uncertain outcomes.
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: Carry the reviewed real-account placement and continuing-worker handoff unchanged; verify collector, selector, custody and continuation consumers with offline captured-shape tests.
Side effects: Bounded read-only quota telemetry feeds the existing pool. Soft 80% pressure stays ephemeral; hard provider/cutoff holds persist. Fresh partial windows retain precedence over older compatibility snapshots. Register replay changes source/generation witnesses only.
Undo and recovery: Revert the member through review and regenerate the register; preserve durable journals, pool history, spending and uncertain sends. Rolling back restores the known quota availability defects.
Multi-machine posture: Deliberately machine-local telemetry and credential custody under existing owner admission; no new writer, peer dependency or credential transfer. This build writes no Studio or serving state.
Layer below: Full purpose and rule book; exact member diff and original plus repair reports; existing installed custody, bounded collector, pool holds, serialized topic handoff and production-session transcript copying; standard generation chain.
Bug class: none
Bug evidence: none
Hook bypass: none; core.hooksPath unset and inspected common hooks directory contains only samples. Ordinary merge and commits only.
Convergence: none
Prompt review: No new prompt or semantic parser changes in this composition. Member tests replay real summary/uncertain, Jev undecided/unsure, reply-review, delivered and empty-context shapes through the collector-fed and repaired continuation path. Recorded provenance and update ids are in the member reports and this train report. No new live proof claimed.
Decision: train-123-merge | Ordinary merge of exact reviewed head 566b6cb126f6ea2ede5122f5f1b33ef58869e44c fast-forwarded without conflicts. Evidence: reviews/train-123-evidence-pool-port-1021-PROGRESS.txt and reviews/train-123-evidence-pool-port-1021-repair-PROGRESS.txt (byte-identical read-only Studio report copies). | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-123-PROGRESS.md
Decision: train-123-A | Preserve all member and accepted live-base behavior unchanged; no product repair or manual generated merge. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-123-PROGRESS.md
Decision: train-123-B | Create the separate branch directly at live base 588332d9d0839cd504bee2819e297cd6222a2ef9; no branch relocation or main merge. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-123-PROGRESS.md
Decision: train-123-D | Use targeted offline replay on WSL, with one foreground worker; leave native macOS and live-account checks to the Studio and explicitly report them. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-123-PROGRESS.md
Decision: train-123-desk | Run the standard downloaded repin/build/rehash/register-replay chain at exact reviewed member head. No inventory or owner-manifest updates; regenerate seven register outputs, preserving the context guard and conformance declaration. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-123-PROGRESS.md
Skip: tests/preview/pool-quota-live.test.ts:23 | scope=Opt-in two-account proof needs allocated credentials and an isolated Studio root; offline verification uses recorded shapes and does not open custody.
Deferral: generated/register.json:1 | not-a-deferral=Existing declarations regenerated through replay; no deferred implementation.
Verification: Member changed tests and direct source importers; requested journal tests and context floor; build, typecheck, lint, architecture, register and change-review audits; pinned READY tests on pushed head. Exact results and host-dependent omissions are in the progress report.
simplestRobustRoute: This is the simplest robust route: one ordinary reviewed merge plus the existing desk generation chain, no new machinery. Existing account/owner/stop admission guards the start; fresh cooler capacity and correlated handoff completion guard the result; attempt caps, spending, durable intake and send identity remain unchanged. The member report contains historical isolated live-copy evidence; this composition claims offline verification only.
80/20: Targeted changed files and direct importers plus explicitly requested journal and pinned checks, one worker in foreground chunks; no full suite or load burner.
VERDICT: author submission for desk gate; not independent convergence or live acceptance
