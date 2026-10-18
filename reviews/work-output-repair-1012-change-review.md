# Change review — work-output-repair-1012

Subject base: 7cabecf1c7d33ecae3628b36923edbff61666d3e
Review state: open
Reviewed content: none
Outcome: malformed scheduled work receives one same-step formatting repair and at most two short retries; status shows unsuccessful attempts separately from progress.
Affected rules: 4, 8, 26, 36, 39, 41, 42, 55, 60, 64, 68, 74, 75, 83, 87, 88, 101, 102, 113, 116
Affected floors: secrets — rejected text is redacted before re-use; spend cap — durable counted repair reservation and reply capacity reserve; stop — checked before repair; no duplicate sends — repair has no tools or sessions and results use existing send intents; durable intake — existing intake unchanged, work remains journal-owned.
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: scheduled model calls, durable accounting and status; no grant or authority change.
Side effects: a format miss may consume one extra call and up to two accelerated work slots. Unknown/provider failures retain the existing cadence. Optional projected fields survive snapshots. Older readers refuse a repeated obligation-start reservation rather than lose its spend; rollback before repair frames or use this reader.
Undo and recovery: revert this change only on roots without repair reservations; otherwise retain the new reader to account for same-slot repairs. Interrupted repair is uncertain and is not repeated. No live root was modified.
Multi-machine posture: same machine-local preview journal ownership as the base; no new store, peer dependency, or cross-machine sender. Counts and reservations follow the existing journal replay and snapshot path.
Layer below: inspected launcher readAnswer failure return, toolTurnEligible, durable reserveTokens/settleTokens and capacityRefused, obligation scheduling and send-intent delivery fence. Retain raw output only on work calls; repair id is outside the tool/session namespace.
Bug class: unit
Bug evidence: reproducer=tests/preview/work-output-repair.test.ts
Hook bypass: none
Convergence: none
Decision: work-output-repair-one-call | one journal-reserved formatting-only call uses the model's own rejected bytes and original packet; no guessing among multiple objects and no repeat of external tool work | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/work-output-repair-1012-PROGRESS.md
Decision: work-output-repair-short-cadence | two-minute delay capped at two accelerated retries per obligation lifetime, bounded by the ordinary cadence; the durable count cannot reset on restart or success | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/work-output-repair-1012-PROGRESS.md
Decision: work-output-repair-attempt-status | add lastAttemptAt, lastAttemptOutcome and failedAttempts alongside unchanged lastProgressAt semantics on the existing pull surface | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/work-output-repair-1012-PROGRESS.md
Prompt review: model-facing. Recorded outputs from proofroom4-dshort15-20261012-165351 at train-15 7cabecf1, frames 131, 138 and 181, source updates 46039927 and 46039928, replay through the actual launcher invokeSubscription function, readAnswer and the actual journal worker. Each triggers a repair; second malformed output ends failed. Successful repair responses are additional synthetic cases, not claimed live-provider repairs. Existing obligation-task-answer-live and runner-task-protocol recorded-shape suites pass.
Prompt finding: 849db3a6296a | protocol-literal | existing saved-memory response in journal.ts, unchanged by this change.
Prompt finding: e8708c7fea24 | protocol-literal | existing memory source-label guidance in journal.ts, unchanged by this change.
Deferral: tests/preview/fixtures/work-output-live-2026-10-12.json:11 | not-a-deferral=verbatim recorded model output retained as a regression fixture, not a promise by this builder.

## Closing block

simplestRobustRoute: this proposal is the simplest robust route: one existing model call through existing journal accounting, with an optional repair flag on the existing start record, and a format-specific bounded schedule derived from that journal. The actual failure is prose and multiple avenue objects being refused by the launcher, silently delaying work for a whole revisit. Picking one object cannot repair that output honestly; a model formats its own account under the original field checks. Start guards are stop, expiry, packet size and reply-reserved call capacity; end guards are the existing obligation reader and delivery intent; limit guards are one same-slot reservation and two accelerated retries. Added status projection exposes failure without redefining progress. No autonomous live-provider completion or independent convergence is claimed.
80/20: first targeted run passes 63 tests across four files; refined repair plus recorded-shape tests pass 31/31, including 13 repair cases. Broader direct-importer and gate checks are recorded in the handoff report. Register replay binds source commit 108fcd4120d12dae2200b8eb9b654fb844f0e5e2: 289 entries, 116 rules, 34 terms and 108 prerequisites; the desk rehash and repin scripts changed no owner or inventory pins. Seven generated projections carry the refreshed source binding.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
