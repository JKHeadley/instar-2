# Change review — Preserve disclosure quotations in raw model revisions

Subject base: ecec84a8e9b84e4ce708f18e9191df08e862ac09
Review state: open
Reviewed content: none
Outcome: a model revision quoting the continuity notice retains its entire answer in the durable intent and actual send; infrastructure appends the owed disclosure after that answer.
Affected rules: 26, 36, 70, 74, 77, 80, 101, 102, 110, 113, 116, 123
Affected floors: secrets — outbound checks unchanged; spend cap — existing revision budget unchanged; stop — existing checkpoints unchanged; no duplicate sends — durable intent, receipt and unknown-send handling unchanged; durable intake — capture and intake unchanged
Operator questions: none
Suggested tier: critical
Declared tier: ordinary
Tier rationale: local presentation caller correction with a focused send regression, no prompt, acceptance rule, authority or store changes.
Side effects: raw model revisions preserve disclosure-like quotations, including a quotation at the end of their prose. Assembly and replyBody still strip their own infrastructure disclosure; historical journal prefix normalization remains at those boundaries. Revision drafts are already stripped before being passed to the model. No recorded intent or digest is rewritten.
Undo and recovery: revert the repair and mechanically replay the register; this restores M1. No schema or migration change. The inherited deployment constraint remains: suffix intents require suffix-capable readers.
Multi-machine posture: deterministic shared journal assembly; no local state or ownership change; existing intents replay verbatim.
Team posture: replies retain their existing verified conversation audience and private defaults; no new recipient, sharing or visibility.
Layer below: the draft passed to revise already has its infrastructure disclosure removed; turn.revision.text contains raw model prose; disclosed(body) applies infrastructure afterward. Final assembly and replyBody operate on assembled text. Existing outbound floors stay in place.
Bug class: unit
Bug evidence: reproducer=tests/preview/journal-boundaries.test.ts; Astra supplied preservation probe fails on ecec84a8 and passes with the caller correction; permanent regression asserts actual send, durable intent, revision, digest and replay
Hook bypass: none
Convergence: none
Decision: summary-notice-revision-quotation | do not strip infrastructure disclosure from raw revision prose; preserve stripping and legacy-prefix normalization at actual assembly/replay boundaries | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/summary-notice-quiet-1112-repair-PROGRESS.md
Prompt review: no model instruction or judgment change. The existing recorded-shape test replays summary writer, uncertain summary, undecided/unsure Jev verdicts, reply review, delivered and empty reply bytes. The explanatory quotation is explicitly synthetic. Unchanged prompt findings retain their established dispositions.
Prompt finding: 105c1569b6bb | protocol-literal | existing exact stop/renewal outcome; unchanged, not a model meaning gate
Prompt finding: 4106b49fff07 | quoted-evidence | existing truthful tool-evidence instruction; unchanged, not a test phrase requirement
Prompt finding: 7ef11b68103f | protocol-literal | existing exact activation-loss notice; unchanged
Prompt finding: 849db3a6296a | protocol-literal | existing empty saved-memory inventory outcome; unchanged
Prompt finding: 85544c20941f | protocol-literal | existing durable-intake outage notice; unchanged
Prompt finding: 9f0106c66027 | protocol-literal | existing incomplete-attempt outcome; unchanged
Prompt finding: bac6ce7485d9 | protocol-literal | existing stopped-work outcome; unchanged
Prompt finding: e8708c7fea24 | quoted-evidence | existing source-citation instruction, not an exact phrase that decides meaning

1.x FIRST: inherits the reviewed JKHeadley/instar 648800021a7e584375b5458eefdc0ad72f922640 comparison (history 211f3d77a, 1dd533f44, 45f1a1ed2). Before implementation, searched actual local origin/main b5d3eba1bc808e5569af49ebe0db34dc7698f997 src/ and docs/specs/, read src/messaging/shared/compactionResumePayload.ts and docs/specs/compaction-preamble-tone-and-intent.md, and inspected available path history (ab26b7ca3). Reuses disclosure, latest-message intent and commitments through 2.0 continuity accounting. Deliberate difference: 1.x first sentence versus this unit's final paragraph. Read ONEX-LESSONS.md Telegram delivery section: infrastructure notices are not agent replies; restore the actual latest context. No recovery system rebuilt.

Verification: Astra's supplied probe selected with -t 'preserves disclosure quotations' failed on the original head, deleting exactly the quoted paragraph; the same probe passed after the caller correction. The permanent boundary suite passes 25/25 and summary-notice-quiet passes 9/9, including captured shapes from retrospective-duty-followup-train-1-2026-10-08.json (715672480, 715672483, 715672482, 969389570, 969389923, 715672479, 715672550). No full suite or live release claimed. Final typecheck and cheap gate results are recorded in the linked progress report.

## Closing block

simplestRobustRoute: remove the inappropriate stripping call from raw model revisions and use existing disclosure assembly and outbound checkpoints. This is the simplest robust route; no classifier, gate or store is added.
80/20: one must-fix, four changed product lines and one 27-line regression; retain existing captured-shape and legacy-prefix checks.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
