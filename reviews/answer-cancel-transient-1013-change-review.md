# Change review — transient authority reads and cancelled answer recovery

Subject base: 0de16e3cdaea380ac746793123a51382aeb9830b
Review state: open
Reviewed content: none
Outcome: An in-flight answer tolerates at most eight additional record reads over 200ms, while a present withdrawal or stop cancels on the next poll with its specific cause recorded. A locally killed empty answer with verified cleanup and no uncertain tool writes uses the existing once-per-turn replacement reservation. An unresolved cancellation retains an owned, scheduled obligation.
Affected rules: 1, 4, 8, 26, 41, 49, 55, 60, 70, 74, 75, 83, 95, 101, 102, 111, 113, 116; purpose constraints 2 and 3.
Affected floors: secrets — fixed cause labels, existing scrubbed journal capture; spend cap — original UNKNOWN charge retained and every replacement/work step separately reserved; stop — stop file, worker stop and journal stop checked before any read allowance, admission remains strict; no duplicate sends — existing intent fence unchanged and uncertain writes excluded from cancellation replacement; durable intake — original intake retained, fallback obligation derived from an explicit durable model-uncertain row.
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: alters cancellation and answer recovery at the physical provider boundary.
Side effects: an already admitted process may run up to 200ms through unavailable authority evidence. A present changed record is immediate withdrawal. Persistent unreadability still cancels. Recovery consumes separately accounted capacity. Existing timeout replacement behavior is unchanged. Unknown tool writes receive scheduled follow-up, never speculative replay. Follow-up reports use the existing next-reply delivery policy; this does not introduce unsolicited send authority.
Undo and recovery: revert this change as a unit, including generated pins. New model-uncertain followUp and turn projection fields are additive; preserve the encrypted journal and UNKNOWN accounting. Do not replay an old reservation during rollback.
Additional files: src/assembly/harness.declarations.json and generated outputs refresh the existing composition/source pins; no new supported platform is declared. macOS conformance execution remains a Studio check.
Multi-machine posture: cancellation polling is machine-local because it owns a local child. Recovery state lives in the existing journal; the existing writer ownership, stop, cap and intent fences continue to govern replacement and delivery across reopen or handoff. No new store or peer dependency.
Layer below: resource-owner stopped polling and cleanup evidence; sealed activation authority and owner-record cache; call-diagnostics whitelist and durable validation; answer-replace reservation projection and tokenCurrent retention; complete tool trace before clipped review excerpts; obligation scheduling and delivery inhibition.
Bug class: user-facing
Bug evidence: reproducer=tests/preview/answer-cancel-recovery.test.ts; live=tests/preview/answer-cancel-recovery.test.ts; restart=tests/preview/answer-cancel-recovery.test.ts
Hook bypass: none; core.hooksPath unset and the common hooks directory contains sample hooks only.
Convergence: none
Decision: cancel-read-grace | distinguish unreadability from withdrawal only for in-flight cancellation, bounded by nine observations and 200ms, keeping admission strict both before and after resource queue admission | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/answer-cancel-transient-1013-PROGRESS.md
Decision: cancel-owned-recovery | reuse the once-per-turn answer replacement with separate UNKNOWN accounting only after verified cleanup and read-only tool evidence; otherwise keep an owned scheduled obligation | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/answer-cancel-transient-1013-PROGRESS.md
Decision: cancel-report-location | retain the host-prescribed absolute reported path and commit the report mirror as reviews/answer-cancel-transient-1013-report.txt (markdown files there are parsed as review records); the desk copies the local state report to that absolute path | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/answer-cancel-transient-1013-PROGRESS.md
Prompt review: New obligation context describes the actual interrupted-answer state, preserves UNKNOWN effects, and asks for evidence-based recovery or an honest account. No classifier, fixed semantic trigger or provider call bypass is introduced. Recorded physical cancellation from update 715675816 drives recovery; the fixture explicitly distinguishes report-transcribed fields from its older resource envelope. Existing captured summary/Jev/review/delivered and empty shapes are negative physical-cancellation controls; existing unknown-answer-notice tests replay them through their worker paths.
Prompt finding: 849db3a6296a | protocol-literal | existing memory-list reply literal is unchanged
Prompt finding: e8708c7fea24 | protocol-literal | existing source-label guidance is unchanged
Deferral: generated/register.json:1 | not-a-deferral=generated projection of implemented declarations
Deferral: tests/preview/journal.ts:745 | not-a-deferral=names the scheduled recovery path implemented in this change
Deferral: tests/preview/journal.ts:733 | not-a-deferral=describes the durable scheduled obligation implemented in this change
Deferral: tests/preview/journal.ts:4608 | not-a-deferral=validation error for the implemented recovery record
Deferral: tests/preview/journal.ts:10850 | not-a-deferral=delivered instructions for the implemented scheduled recovery consumer

## Closing block

simplestRobustRoute: reuse the resource owner's 25ms poll, existing diagnostic, once-per-turn replacement reservation, complete tool trace and obligation scheduler. The small tri-state probe prevents one failed read from masquerading as withdrawal; its count and elapsed bounds prevent indefinite reliance on unreadable evidence. A whole-trace read-only proof prevents empty stdout from licensing repeated writes. No new retry service, store, timer or send path. Start: already admitted call; end: observed termination or valid answer; limits: 200ms read allowance, one replacement, existing spend/reply caps and stop. Replay evidence is offline; no new live unattended completion is claimed.
80/20: focused verification passed 50 tests across four files; pinned-text verification passed 89 tests across six files; author submission; independent review belongs to the desk. Explicit residue: a fallback obligation's report follows the existing next-reply policy and cannot exceed the recorded caps.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
