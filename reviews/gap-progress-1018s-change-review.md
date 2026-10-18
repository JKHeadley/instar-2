# Change review — final answers survive progress and rejected follow-ups

Subject base: c6aa5a3915d7e845f9bc5b6183b0d9302dcfedc0
Review state: open
Reviewed content: none
Outcome: A slow working-progress send no longer delays a ready final answer. A holding notice returns omitted attached reports to the existing owned repair path, so they cannot replace subsequent garden or tool answers with the same fallback.
Affected rules: 2, 4, 8, 26, 34, 36, 42, 46, 49, 52, 70, 74, 77, 87, 89, 95, 101, 107, 111, 113, 116
Affected floors: secrets — existing outbound and review walls unchanged; spend cap — no new model calls or allowances; stop — existing admission/current checks remain; no duplicate sends — each progress intent still consumes its occurrence, including UNKNOWN; durable intake — existing journal intents and report repair state retain all work.
Operator questions: none
Suggested tier: significant
Declared tier: significant
Tier rationale: changes final-answer scheduling and the durable disposition of omitted reports on a holding reply.
Side effects: An already dispatched progress message may reach transport after the final answer if its transport stalls; new progress dispatches are cancelled before final delivery. Its late receipt is recorded if the journal is still open; otherwise its durable intent remains UNKNOWN and is never resent. Omitted commitment reports are all retained for contextual repair, even if only one attached report caused the hold; no report is marked delivered or discarded. Existing historical intents retain their old projection so later historical answer frames remain readable; the next new holding intent records repair normally. The initial held candidate still obeys the existing review floors.
Undo and recovery: revert the journal changes and tests. Existing withheldReports rows remain readable by the previous build; there is no schema, grant, installation or deployment change. Unknown progress is never replayed on rollback.
Multi-machine posture: working timers remain disposable owner-local state; report repair and send identities remain in the existing durable owner journal. No new store, owner selection, replication or authority path.
Layer below: inspected actual train-71 encrypted journal read-only, its pending work reports, Jev and subscription reviews, revision outputs, split-reply send/receipt handling, applyIntentObligations, working-current cancellation and signed dispatch. Required train-62 and stepcheck-live-1018 ancestors are incorporated. The C/T holds occurred before the two-minute progress floor; both contain the same library-renewal report appended by the runner. The 715677067 no-model-start hold has no reservation or working progress and is separate from these causes.
Bug class: integration
Bug evidence: reproducer=tests/preview/gap-progress-final.test.ts
Hook bypass: none; core.hooksPath unset and the common hooks directory contains sample hooks only.
Convergence: none
Decision: gap-final-report-repair | Record withheldReports for holding notices using the existing review reason, instead of excluding those notices from the existing repair transition. Preserve historical projection: a read-only replay of the original journal caught that retroactive projection would invalidate later old report frames. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/gap-progress-1018s-PROGRESS.md
Decision: gap-final-progress-priority | Remove the working-progress promise join from final dispatch and drain; preserve durable intents and cancellation. A slow transport is injected with an unresolved promise and fake clock, never machine load. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/gap-progress-1018s-PROGRESS.md
Prompt review: no prompt or parser changes. Replay captures exact Studio updates 46040277, 46040278 and 46040279, their answers, Jev scores, subscription/revision verdicts, and the three attached reports. The tool proof carries actual admitted Write/Read/wc results (25 bytes). Setup of obligations and passing control reviews are synthetic and labelled; no fresh live model proof is claimed. Existing recorded uncertain summary, unsure/undecided Jev, reply-review and delivered/empty-output controls are exercised through the unchanged review paths.
Register refresh: merged generated artifacts and final source pins are regenerated using the existing shape-only replay command. No declaration or native conformance certificate is altered.
Deferral: generated/register.json:1 | not-a-deferral=Existing declaration wording reproduced by the generator, with no deferred repair introduced.

## Closing block

simplestRobustRoute: This is the simplest robust route: remove the progress wait and use the existing withheldReports intent field and repair transition. No new queue, timer, model judgment, retry allowance or migration. Start guards are unchanged admitted activity and reviewed final candidate; end guards cancel new progress at final dispatch; durable occurrence identity, cadence/cap, outbound secrets, spend and stop retain the named floors. The original recorded C/T cases drive offline replay; unattended live acceptance belongs to the desk proof and is not claimed here.
80/20: The garden and byte-count regressions failed with fallback notices before the repair, and delayed progress prevented both final sends. Passing controls retain delivered reports, UNKNOWN notices retain owned repair work, and accepted/UNKNOWN late progress consumes its identity across restart. Full landing and live proof remain the desk's gate.
VERDICT: author submission; independent review pending
