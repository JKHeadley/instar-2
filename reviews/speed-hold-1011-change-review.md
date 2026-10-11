# Change review — shorten fresh group-audience probes

Subject base: ba91e2bd0f959f401c71b0bbfcad37f3cd6c5068
Review state: open
Reviewed content: none
Outcome: Each fresh operator-only forum audience probe uses three network rounds instead of six. Four independent read-only chat and identity observations run concurrently between the two member-count reads; all exact evidence predicates and every dispatch recheck remain.
Affected rules: 1, 4, 13, 26, 28, 29, 34, 35, 36, 41, 49, 55, 57, 58, 60, 63, 70, 74, 77, 87, 95, 101, 111, 113, 116; purpose least revelation
Affected floors: secrets, spend cap, stop, no duplicate sends and durable intake remain enforced by their existing doorways; unknown or changed audience still refuses private disclosure.
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: Changes scheduling inside the existing disclosure authority check, without changing the evidence required for acceptance.
Side effects: Up to four read-only transport children can run together instead of one. Existing per-child resource/time bounds remain; all siblings settle before the probe returns, including synchronous throw, rejection and unknown evidence. The first count now precedes every identity/chat observation and the final count still follows them. A known wider audience ends after the first count. Telegram still provides no atomic membership-and-send snapshot; the existing fresh dispatch checks remain. No review, prompt, model-output parser, semantic acceptance, holding sender, cache or retry is added or removed.
Undo and recovery: Revert the scheduling and test changes and regenerate the register from the reverted source. No journal migration or recovery action is needed. Preserve durable intake and UNKNOWN effects; never retry an uncertain send.
Multi-machine posture: Concurrent reads are deliberately machine-local transient work under the current conversation owner. No new store, shared cache, owner, authority, replication policy or peer dependency.
Layer below: Inspected journal worker disclosure boundaries, journal-agent membership reader and authority rechecks, production Telegram poll transport and its limit shim, sealed identity capture and current grant resolution. Read authenticated live journal frames and diagnostics without writes. Real HTTP bridge tests and shipped-runner relocation/session-work tests exercise the consumer path.
Bug class: integration
Bug evidence: reproducer=tests/preview/group-disclosure.test.ts
Hook bypass: none; core.hooksPath is unset and the shared hooks directory contains sample files only.
Convergence: none
Prompt review: No prompt, output parser or semantic verdict is changed. The existing recorded-shape carry test now calls the actual audience verifier for every shape: summary writer 715672480, uncertain summary 715672483, undecided Jev 715672482, unsure Jev 969389570, reply-review 969389923, delivered reply 715672479 and empty reply in context 715672550, from retrospective-duty-followup-train-1-2026-10-08.json. The captured empty context is not claimed as a Telegram delivery. Both refused and restored audience paths fire before these recorded bytes reach the worker.
Decision: parallel-audience-reads | Keep all six observations and every fresh probe, with four independent reads sharing one bounded round. Both counts bracket the observations; await all siblings before accepting or refusing. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/speed-hold-1011-PROGRESS.md
Decision: preserve-review-routing | Live arithmetic's two review stages total 19.757 s versus 15.329 s for the answer. Harness startup is not separately recorded; do not claim it dominates. Review routing remains the desk's on-hold item. No review is skipped or narrowed. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/speed-hold-1011-PROGRESS.md
Decision: no-holding-change | Update 969390382 never attempted an early holding line; Rule 87 and the task exclude building one. Its absence and memory update 969390379's invalid citation are separate from repeated audience reads. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/speed-hold-1011-PROGRESS.md

## Closing block

simplestRobustRoute: This is the simplest robust route within the measured scope: overlap independent existing reads without skipping any evidence or review. A fixed four-read batch prevents cumulative serial network delay; allSettled prevents orphan reads after a failed sibling. Start guard is valid scope and initial member count; end guards are exact chat/bot/member evidence and final count; existing resource, grant, stop and dispatch checks remain. No new machinery is needed beyond the bounded batch. Copied-root replay uses recorded answers and verdicts, never paid calls or Telegram sends; no deployed or under-15-second claim is made.
80/20: Controlled copied-root replay preserves private carry, 47/48-turn histories, 36 membership reads and both reviews. At one injected second per read, arithmetic falls from 46.888 to 28.888 s and lookup from 80.703 to 62.703 s. Unit tests prove three rounds, bounded fan-out, all failure exits, changing counts and unchanged exact predicates. Direct consumer tests cover real captured reviews/uncertain summaries, live HTTP and shipped runner behavior. Independent landing judgment belongs to the pipeline.
VERDICT: author submission; independent landing review remains required
