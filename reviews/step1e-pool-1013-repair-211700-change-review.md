# Change review — retain the continuing-session transcript handle

Subject base: f8b4d55caeb8bff5e63f210f0e48a10a5f3488b0
Review state: open
Reviewed content: none
Outcome: A completed no-hook Claude session exposes the exact transcript ID chosen at launch, so the existing login handoff copies it and resumes it on the next login without a second admission or replenished allowance.
Affected rules: Rules 26, 30, 32, 34, 44, 49, 60, 63, 70, 74, 75, 96, 101, 102, 111, 113, 116; purpose constraint 2, retained context.
Affected floors: secrets — no credential handling or sender is added; spend cap — the same claim, dispatch checkpoint and cumulative allowance survive the move; stop — existing stop and deadline checks still precede launch and delivery; no duplicate sends — durable delivery identity and uncertain-send handling are unchanged; durable intake — reuse the existing atomically persisted session journal, with no input replay.
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: This repairs the integration between native session identity and retained conversation history; real-login acceptance remains with the desk under the brief.
Side effects: A fresh Claude session now has a resumeId in its reservation and session record. Reconciliation publishes that handle with the session, including recovery after interrupted identity persistence. A failed spawn publishes no handle. A context-wall replacement records its new transcript rather than leaving the resume map empty. Codex still supplies its own native ID through the existing hook/save path. Old journals with null reservation handles remain readable. The transcript-existence check and copy-failure journal fallback remain authoritative; a recorded handle is not a claim that transcript bytes exist.
Undo and recovery: Revert the repair commits to restore the previous driver. Existing readers already accept resumeId and resumes, so retained IDs require no state migration or deletion. In-flight uncertain deliveries remain uncertain. Missing or divergent transcripts retain the existing journal continuation path.
Multi-machine posture: Machine-local deliberately: the owning host retains its local tmux identity and transcript handle; the existing admission owns the conversation. No new cross-machine state, credential transfer, or ownership path is added.
Layer below: Inspected production-session-driver reservation reconciliation, spawn, cache-hit launch, no-hook idle completion and context recovery; production-session-io atomic journal persistence, transcript lookup, exclusive copy and call accounting; continuing-login-pool handoff; journal-agent's actual no-lifecycle-hook driver construction; conversation port's one-claim turn-boundary replacement.
Bug class: integration
Bug evidence: reproducer=tests/preview/continuing-login-pool.test.ts
Hook bypass: none; core.hooksPath was unset and the shared hooks directory contained sample files only.
Convergence: none
Decision: step1e-pool-1013-retain-handle | Generate the fresh Claude transcript ID once, retain it in the existing reservation, and publish it only when reconciliation observes the live session; this closes both ordinary no-hook and interrupted-identity-save gaps without a new store. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/step1e-pool-1013-repair-211700-PROGRESS.md
Decision: step1e-pool-1013-real-driver-proof | Exercise the real admitted driver, durable physical journal, transcript copy, login pool and conversation port together; only tmux/model execution is synthetic, and no test code seeds resumes on this path. Keep failed-spawn and Codex neighbors, plus cache-miss and context-wall coverage. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/step1e-pool-1013-repair-211700-PROGRESS.md
Decision: step1e-pool-1013-repair-pins | Compute the composition pin from the existing closure/digest functions and regenerate register output after the source commit. Run the delegated owner-manifest and chain repin scripts; they report no changed pins. Report host-limited native conformance separately, without claiming live certification. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/step1e-pool-1013-repair-211700-PROGRESS.md
Prompt review: No prompt, model-output parsing, acceptance, escalation or refusal rule changes. The adapter retains its already chosen ID. Existing recorded summary/Jev/review/delivered/empty-context replays and recorded user-walk session-output replays pass. The new handoff test proves the previously unreachable transcript path using the real driver, not the fake driver's manually populated resume map.

Subject: src/assembly/production-session-driver.ts, tests/assembly/production-session-driver.test.ts, tests/preview/continuing-login-pool.test.ts, src/assembly/harness.declarations.json, generated/

Publication: Register replay binds source commit 79f35820e54aa76ddda2e1f7e0558b25114b1a93; generated metadata carries that source without changing grants or register membership.

Validation: The new real-driver handoff regression fails against the original source at the absent resume handle and passes with the repair. Driver and handoff tests pass, including interrupted identity persistence, failed spawn, Codex's no-invented-ID path, matching-topic resume, copy fallback, stop and cumulative allowance. Typecheck/build pass. Real tmux launch, exact target and restart-delivery tests pass. Recorded replay fixtures pass. The unchanged native contract encounters uv_uptime EPERM and confined exit 71 on this host; the unchanged scheduled-work tmux test cannot confirm a child process gone. Live-provider tests remain opt-in and are not enabled. These are host-dependent or unrun evidence, not passing live conformance; the desk retains real-copy and combined-build acceptance.

## Closing block

simplestRobustRoute: This is the simplest robust route: preserve the exact ID the adapter already chooses in the journal it already writes, and expose it through the existing resume/copy path. Reservation retention covers a crash between spawn and identity save; publication during reconciliation avoids a failed spawn fabricating a current session. Existing transcript-existence, copy-failure, admission, stop, deadline and cumulative accounting guards remain. The end-state proof is a completed no-hook turn copied to another login and launched with that ID; no unattended live-login completion is claimed.
80/20: One production defect, one small reservation/reconciliation repair, and targeted integration plus failure-neighbor evidence. No new service, policy, lifecycle owner, or general review round is introduced.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
