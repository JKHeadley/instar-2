# Change review — train-195 stopped-task notice composition

Subject base: 79be7e88e9e6445a675d1c7117d68da4c9ae84a4
Review state: open
Reviewed content: none
Outcome: Compose the exact live train-193 base with reviewed plain-task-stop-1106 head 958ae331f195ec80a0dfb613e043c72fe9f8a4f3. Preserve plain, evidence-bound stopped-task notices and exact pending-request continuity accounting, including quiet unchanged-account neighbors.
Affected rules: 1, 4, 7, 26, 34, 36, 42, 49, 69, 70, 74, 77, 80, 89, 90, 101, 102, 110, 111, 112, 113, 116, 121
Affected floors: secrets — existing redaction and custody; spend cap — no added calls or reservations; stop — unchanged admission; no duplicate sends — existing intent/receipt and uncertain-effect handling; durable intake — unchanged encrypted journal and captures
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: Inherits the reviewed user-facing notice and continuity-account changes and their critical classification.
Side effects: Plain stopped-task disclosure and bounded redacted request quotation enter unchanged. Historical notices remain recognized. Different pending requests speak despite identical prose; unchanged accounts and answered episodes remain quiet. No additional production changes are made by composition.
Undo and recovery: Revert candidate composition before deployment and regenerate publications. After deployment retain additive reader compatibility for already-written plain continuity rows; do not rewrite delivered bytes or resend uncertain effects.
Multi-machine posture: Existing shared encrypted journal and ownership unchanged. Publish matching worker and additive reader on every host. No new host-local durable state.
Layer below: Exact member ancestry and both member review records; verified report snapshots; unknownAnswerNotice, continuityFor, continuitySpoken, persisted account validation and lostNotice history recognition; recorded request/outcome fixture and worker regressions; existing desk generation and register lifecycle.
Bug class: none
Bug evidence: none
Hook bypass: none; core.hooksPath unset and common hooks directory has sample files only.
Convergence: none
Prompt review: No additional prompt, parser or acceptance policy changes. Preserve member recorded-shape evidence and its limits: task 2184 is a reconstructed worker case using recorded intake/outcome, not an exact delivered-byte replay or fresh provider judgment. Notice tests replay update 969390396 and proof-room summary/delivered/empty-context shapes; longchat replays recorded continuity samples. Empty context is not proof of an empty Telegram delivery.
Prompt finding: 4106b49fff07 | protocol-literal | Inherited unchanged grounding instruction, no composition policy change.
Prompt finding: 849db3a6296a | protocol-literal | Inherited unchanged memory inventory response.
Prompt finding: 85544c20941f | protocol-literal | Inherited unchanged waiting message.
Prompt finding: e8708c7fea24 | protocol-literal | Inherited unchanged source-label instruction.
Deferral: tests/preview/plain-task-stop.test.ts:29 | not-a-deferral=Inherited negative assertion forbids an unsupported follow-up promise.
Deferral: generated/register.json:1 | not-a-deferral=Historical prerequisite text republished without adding a commitment.

1.x comparison: Actual JKHeadley/instar main b718807caa98480faa173850787b3a6f57c0affb searched in src/, docs/specs/ and history; read ONEX-LESSONS section 3. src/scaffold/templates.ts Agent-as-Interface guidance, src/messaging/plainNoticeCheck.ts (f0d03ccc8), src/monitoring/watchdog-notifications.ts (6e2872663, e0dfce86f, 2aaac4288) and docs/specs/wedge-recovery-message-loss.md support cause/consequence/next-step wording and notice-versus-answer distinction. Inherit member comparisons at 30b3046c and 3d9e102a. Watchdog retry promises do not fit this uncertain non-retry path; preserve the reviewed 2.0 account implementation without importing another store or watchdog.

Decision: train-195-merge | Ordinary exact-head merge of 958ae331f195ec80a0dfb613e043c72fe9f8a4f3 fast-forwarded from the exact base with no conflict. Member report /Users/dabombstudio/.instar/agents/echo/.instar/lanes/plain-task-stop-1106-r2-PROGRESS.md (verified snapshot includes repair report) defines behavior and evidence limits; both committed member reviews remain intact. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-195-PROGRESS.md
Decision: train-195-A | Preserve all member and accepted live behavior byte-for-byte; no conflicting edits or hand-merged generated files. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-195-PROGRESS.md
Decision: train-195-B | Keep exact 79be7e88e9e6445a675d1c7117d68da4c9ae84a4 ancestry; no main merge or other train tip. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-195-PROGRESS.md
Decision: train-195-C | No genuine product conflict; left out none and no merge abort needed. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-195-PROGRESS.md
Decision: train-195-D | Report unchanged host-dependent failures and native exclusions to the Studio gate without weakening assertions, guards or timeouts. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-195-PROGRESS.md
Decision: train-195-desk | Run the supplied cint-L37 repin, build, owner rehash and register replay chain against the reviewed committed source; no authority declarations or conformance certificates changed. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-195-PROGRESS.md

## Closing block

simplestRobustRoute: This is the simplest robust route: one ordinary exact-head merge plus existing desk generators. No new runtime mechanism. Exact ancestry is the start guard; targeted checks and independent combined/native/live qualification are end guards; all five safety floors remain. No unattended shipped-path completion is claimed.
80/20: Exercise changed tests and directly affected notice/continuity consumers, required lifecycle and pinned-text checks, then typecheck, lint, architecture, register and review checks. The Studio runs the combined full gate; no full-suite repetition on WSL.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
