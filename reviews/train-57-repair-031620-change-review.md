# Change review — compose train-57 with live recovery

Subject base: 357ea350a118983b961ad6cf0fc6f0567b045b3e
Review state: open
Reviewed content: none
Outcome: Merge live c6a4d718 into train-57, preserving idle cleanup, proactive compaction, completion accounting and live bounded context recovery, safety halts and progress reporting.
Affected rules: 1, 26, 34, 36, 37, 49, 59, 60, 68, 70, 74, 90, 91, 101, 102, 111, 112, 113, 116.
Affected floors: secrets — outbound inspection remains unchanged; spend cap — original reservations and halt causes remain; stop — existing stop takes precedence; no duplicate sends — retained delivery identity and uncertain outcomes cannot authorize replay; durable intake — original accepted requests and completion checklists remain retained.
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: Composition touches continuing conversation control, worker retirement and bounded recovery.
Side effects: The conversation adapter now exposes both affirmative idle observation and context recovery. Compact forwards the original accepted delivery and deadline through the existing bounded recovery path. Close retains the fresh idle fingerprint check, the lock-protected driver recheck and refusal propagation. Both sets of test cases and README descriptions survive. Journal imports combine completion accounting, proactive compaction and live progress constants. Generated artifacts will be replayed from committed composition bytes.
Undo and recovery: Revert the merge against its first parent; never erase either history. Uncertain closures and accepted deliveries remain subject to reconciliation, with no automatic replay permission.
Multi-machine posture: Worker liveness and physical control remain local to the admitted owner; this merge creates no cross-machine authority or store. The native Darwin certificate must be renewed on Studio for the new composition.
Layer below: Inspected driver exclusive-lock stop checks, turn-close receipts and pending continuation state; inspected conversation owner idle eligibility, grace, inhibition and durable halt precedence. Adapter recovery preserves the exact delivery digest and deadline; closure uses the existing exact worker identity.
Bug class: integration
Bug evidence: reproducer=tests/assembly/production-conversation-session.test.ts
Hook bypass: none; core.hooksPath unset and common hooks directory contains samples only.
Convergence: none
Decision: train57-repair-031620-compose | Combine idle-evidence controls with pending-delivery context recovery instead of choosing one side of the merge. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-57-repair-031620-PROGRESS.md
Decision: train57-repair-031620-derived | Regenerate derived inventory and register pins using the delegated desk tools; retain the existing native certificate for honest Studio renewal. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-57-repair-031620-PROGRESS.md
Prompt review: No new model instruction, output parser or semantic decision is introduced by conflict resolution. Retained live changes keep their original reviews. Real recorded summary, uncertain summary, Jev undecided/unsure, reply review, delivered reply and empty reply shapes pass the combined lifecycle tests.
Prompt finding: 4106b49fff07 | quoted-evidence | Existing limitation wording in topic-awareness fixture, no new phrase-triggered branch.
Prompt finding: 849db3a6296a | quoted-evidence | Existing empty-memory fixture response, no new output instruction.
Prompt finding: e8708c7fea24 | protocol-literal | Existing sourceLabel attribution protocol retained.
Deferral: tests/preview/fixtures/ownword-time-1016.json.gz:122 | not-a-deferral=Inherited compressed recorded evidence, not a promise to defer this repair.

Verification: Typecheck and build pass; 450 tests in nine conflict-focused portable files pass. Architecture reports only the explicitly permitted native Darwin composition certificate mismatch. Register replay binds generated artifacts to source commit e81a424172d5c6484540a966e0d92322ebd2a3e9; this record also covers that publication. Final register and pinned-text verification are recorded in the repair report.

simplestRobustRoute: This is the simplest robust route: compose existing controls and retain both behavior histories and tests, then regenerate derived pins. No new mechanism. Start guards are exact owned worker and accepted delivery; limits remain original deadline, cap, stop and uncertainty; end guards remain correlated reply and turn close. No unattended live acceptance claim is made.
80/20: Target the actual conflict boundaries and captured shapes; Studio owns full-suite execution and native Darwin conformance renewal.
VERDICT: author submission; no independent verdict claimed
