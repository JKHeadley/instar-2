# Change review — reserve answers independently of speculative memory work

Subject base: 0de16e3cdaea380ac746793123a51382aeb9830b
Review state: open
Reviewed content: none
Outcome: A lexical memory cue or unresolved memory judgment no longer delays an independent answer reservation or the following turn. Edits and rejected mutation proposals retain their correction path; admitted corrections apply before later answer reservations.
Affected rules: Purpose 2/3; Rules 4/8/10/14/26/34/36/42/46/57/63/70/74/77/83/86/87/95/101/102/111/113/116.
Affected floors: secrets — unchanged exact outbound check; spend cap — existing paid-call reservations and summary retry limits; stop — existing gate at reservation and dispatch; no duplicate sends — unchanged durable intents and receipts, exercised through restart; durable intake — accepted input, pending judgment and summary outcomes remain in the encrypted journal.
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: Changes operator-visible reservation timing in the live journal worker; real captured model outputs and both sides of the correction dependency need replay.
Side effects: Summary calls no longer precede ordinary answers solely because a cue matched. Tests of the summary-specific correction path explicitly schedule that path, as the production runner already does independently. Existing speculative holds release on replay; rejected mutations and edits retain their holds. No cue, prompt wording, model route, call budget, send guard or data schema changes. Summary packet selection excludes a request whose mutation is already admitted; an in-flight result is refused if its request was applied meanwhile. Background summary failures continue to settle from durable outcomes before a drain.
Undo and recovery: Revert the worker change and regenerate register publications. No new journal row or migration; old readers can replay all state. Existing send intents and receipts stay authoritative and are never repeated.
Multi-machine posture: Uses the existing replicated journal and owner-gated worker; no new machine-local authority or state. Candidate classification derives from replayed fields. Test clocks and isolated fixture roots are deliberately local.
Layer below: pendingMemory previously conflated a lexical request for judgment with an answer dependency. drainTurnsOnce awaited summarizeIfNeeded before reserve, and a remaining candidate set blockedEarlier. The answer-row application already applies validated memory changes before the following reservation. The production runner already schedules summary work independently. Captured outputs are complete where taken from committed fixtures; the desk's frame exports truncate long prompts and do not constitute a full-root replay.
Bug class: user-facing
Bug evidence: reproducer=tests/preview/deferral-confirm-delay.test.ts; live=tests/preview/fixtures/deferral-not-memory-2026-10-12.json
Hook bypass: none; checked core.hooksPath (unset) and common hooks directory (sample files only). Plain commits.
Convergence: none
Decision: speculative-memory-admission | Separate an unsettled candidate from an edit or rejected mutation dependency, preserving background work while reserving independent answers immediately. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/deferral-confirm-delay-1013-repair-090451-PROGRESS.md
Decision: existing-summary-scheduler | Keep the existing independent summary scheduler and durable exhaustion settlement; add no queue, timer, retry policy or lexical exception. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/deferral-confirm-delay-1013-repair-090451-PROGRESS.md
Decision: settled-memory-authority | A recorded mutation settles that request; do not offer it to a later summary, and reject an in-flight summary result if the answer admitted it while reviewers ran. Prevents a duplicate preference when the answer wins the new scheduling order. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/deferral-confirm-delay-1013-repair-090451-PROGRESS.md
Decision: charter-report-path | Follow the charter's explicit Studio reported= path and WSL state report destination over the downloaded brief's conflicting reviews-only citation requirement. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/deferral-confirm-delay-1013-repair-090451-PROGRESS.md
Prompt review: No prompt wording or parser changes. Already-applied requests are omitted from later summary packets. Existing captured writer, uncertain, Jev unsure/undecided, review, delivered and empty-reply shapes are replayed through the changed admission path. No fresh provider judgment is claimed.
Prompt finding: 849db3a6296a | protocol-literal | Unchanged fixed memory inventory response, not an intent classifier.
Prompt finding: e8708c7fea24 | protocol-literal | Unchanged source-label provenance guidance, not a fixture-specific decision.

Publication evidence: The desk rehash and repin tools changed zero pins. The existing register replay generator used source 07320aad8b64ac0ea49e89f0efedc9a3bc351207 and produced generation sha256:104820949f27ab762a3d172c1e039793330e64e224cf198c2f0d6c721cf9bf7a. Seven generated publications refresh source/generation metadata only; they are included in this review and grant no new authority.

## Pipeline repair

The durable answer frame now reconstructs a rejected mutation's existing correction hold during application and replay. An interruption before the separate hold append cannot turn a refused save into a generic acknowledgement. No schema, classifier, timer or store is added; unresolved answer decisions and summary-only pending work do not acquire this hold. Existing snapshot state retains the reconstructed hold.

The memory-correction consumer explicitly schedules background summaries where the fixture tests their results, preserves correction/forget projections and crash/restart assertions, and expects the independently delivered answer where the summary now follows it. The already-sent settlement replay test records the explicit memory-undecided frame it tests after a real uncertain summary, instead of relying on the removed speculative blocking preflight to author it. The decidable-summary fixture now supplies the valid replacement field and a clause present in the request, then checks the resulting mutation. Fake timer advancement iterates a snapshot so self-rescheduling callbacks cannot spin within one advance.

Repair verification: memory-correction 28/28, timing 5/5, recorded deferral shapes 10/10, edits 8/8; typecheck, build and architecture pass. Finite timing control with worker 0de16e3c fails at reservedAt (undefined instead of 1791849474255) in 2.75 seconds wall time; pre-repair worker 21ff2f65 fails the unchanged crash test (sent=1 instead of absent) in 2.68 seconds. The repaired worker was restored byte-for-byte. Desk rehash refreshed one memory-correction artifact pin; repin-chain changed zero inventory pins.

Decision: durable-rejection-replay | Reconstruct the existing hold from the persisted rejected answer decision; a subsequent hold append is no longer required for recovery. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/deferral-confirm-delay-1013-repair-090451-PROGRESS.md
Decision: explicit-background-fixtures | Schedule summaries explicitly and retain mutation, exhaustion and replay checks; independently sent answers keep their original text. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/deferral-confirm-delay-1013-repair-090451-PROGRESS.md
Decision: finite-timing-control | Advance a snapshot of fake timers so the old blocking path fails promptly at its reservation assertion. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/deferral-confirm-delay-1013-repair-090451-PROGRESS.md

Repair publication: Source 6627226bc25b97788ddf12a0f24bb05970786337 regenerated the existing register in replay mode as sha256:e4250b8980988e491d3b6f16760d40b2e2403c954852a3a354b2fd9c48689601. The generated publications update source and generation references; no authority is added.

## Closing block

simplestRobustRoute: This is the simplest route: narrow the existing pre-answer dependency test and retain the existing independent-answer distinction at the post-answer hold. All mutation validation, journal application and send settlement remain in place. Existing summary scheduling owns unsettled memory work. No new runtime component or timer. Start guards are authenticated durable intake; end guards are validated memory application and durable reply receipts; secrets, caps and stop retain their existing checks. Captured-output worker replay is evidence for this submission; live deployment and unattended fresh-model acceptance remain with the desk.
80/20: Changed tests and direct journal consumers, typecheck, architecture, lint, register checks and pinned gate tests. No full suite, alternate-base worktree, Studio write, live-root access, serving login or Telegram send.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
