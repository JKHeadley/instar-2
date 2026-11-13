# Change review — Preserve quoted continuity disclosure in answers

Subject base: 53b7348ad639f544166845cdfb77538bb9efea75
Review state: open
Reviewed content: none
Outcome: an answer explaining and quoting the exact pending disclosure keeps its quotation in the durable intent, sent reply and extracted reply body. Only the appended infrastructure occurrence is removed before final assembly adds it back.
Affected rules: 26, 36, 70, 74, 77, 80, 101, 102, 110, 113, 116, 123
Affected floors: secrets — final outbound checks unchanged; spend cap — no new calls; stop — existing checkpoints unchanged; no duplicate sends — intents, receipts and unknown-send handling unchanged; durable intake — raw capture and intake unchanged
Operator questions: none
Suggested tier: critical
Declared tier: ordinary
Tier rationale: narrow presentation-only source repair of M1 with one worker/send regression. No prompt, parser, classifier, gate, store or authority change.
Side effects: disclosure stripping also serves revision drafts and reply-body measurement; it now removes one last appended paragraph occurrence, preserving earlier answer quotations, and falls back only to an anchored historical prefix. Existing attached result lines can follow the removed paragraph. Recorded intents and digests are not rewritten.
Undo and recovery: revert this repair and replay the register; this would restore M1. No journal schema or migration. The inherited unit still requires suffix-capable readers for new suffix intents; old binaries must not replay those journals.
Multi-machine posture: deterministic assembly on every machine, no local state or ownership changes; recorded intents still replay verbatim.
Team posture: existing verified conversation audience and private-by-default sharing unchanged; no new recipient or visibility.
Layer below: withDisclosure appends after the answer; final assembly moves disclosure past approval lines; replyBody extracts for measurement; continuityFor and intent digest validation remain unchanged.
Bug class: unit
Bug evidence: reproducer=tests/preview/summary-notice-quiet.test.ts; actual worker/durable intent/send and replyBody asserted; original helper fails the exact answer comparison and repaired helper passes
Hook bypass: none
Convergence: none
Decision: summary-notice-quoted-disclosure | remove one last appended disclosure paragraph and use anchored legacy-prefix fallback; preserve identical text earlier in the answer without additional machinery | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/summary-notice-quiet-1112-repair-build-report.md
Prompt review: no model instructions, parser or acceptance semantics change. Existing captured summary, uncertain/undecided verdict, review, delivered and empty-byte shapes replay through presentation in the focused file. Existing prompt findings below retain their prior dispositions.
Prompt finding: 105c1569b6bb | protocol-literal | existing exact stop/renewal outcome; unchanged, not a model meaning gate
Prompt finding: 4106b49fff07 | quoted-evidence | existing truthful tool-evidence instruction; unchanged, not a test phrase requirement
Prompt finding: 7ef11b68103f | protocol-literal | existing exact activation-loss notice; unchanged
Prompt finding: 849db3a6296a | protocol-literal | existing empty saved-memory inventory outcome; unchanged
Prompt finding: 85544c20941f | protocol-literal | existing durable-intake outage notice; unchanged
Prompt finding: 9f0106c66027 | protocol-literal | existing incomplete-attempt outcome; unchanged
Prompt finding: bac6ce7485d9 | protocol-literal | existing stopped-work outcome; unchanged
Prompt finding: e8708c7fea24 | quoted-evidence | existing source-citation instruction, not an exact phrase that decides meaning

1.x FIRST: inspected actual JKHeadley/instar origin/main 648800021a7e584375b5458eefdc0ad72f922640 in /Users/adriana/echo-compute/instar-1: searched src/ and docs/specs/ for compaction, disclosure, recovery, folds and layered summaries. Read src/messaging/shared/compactionResumePayload.ts and docs/specs/compaction-preamble-tone-and-intent.md; history includes 211f3d77a, 1dd533f44 (calm acknowledgment and last-message intent), 45f1a1ed2 (rich recovery payload). 1.x explicitly instructs the FIRST sentence to disclose compaction, then answer the most recent message and retain commitments; it also logs file-based recovery in prepareInjectionText. The 2.0 existing continuity account implements the disclosure and request accounting with durable exact capture and reply digest; reuse it, adapting position to the desk's round-two decision. The first-sentence ordering is the deliberate mismatch. ONEX-LESSONS.md not available in either searched checkout or the named lanes location; no Studio fetch per desk instruction.

Repair comparison: re-read both 1.x files and their history at the same exact revision before editing; verified src/ and docs/specs/ matches. This repair inherits the reviewed comparison above. Local ONEX-LESSONS.md search found none; Studio existing-role guidance request returned 401 with no ambient INSTAR_AUTH_TOKEN, so access was not bypassed. Reconstructed the single regression from M1's exact supplied answer and the existing focused writer fixture because the Studio probe was unavailable.

Verification: targeted focused test file passes 9/9 including M1 and historical prefix; original helper produces exactly the missing-quotation/double-notice failure. Build and typecheck pass. The register was mechanically replayed from source commit 1b65c935dfa53a7ed226e974de5c602a877e409f; generated files carry no authored behavior. Final cheap gate results and captured update ids are recorded in the report. No full suite or live release claimed.

## Closing block

simplestRobustRoute: repair the existing string removal to select the last appended paragraph once and anchor the historical-prefix fallback; keep continuity accounting and outbound checkpoints. This is the simplest route for M1, with no added classifier, gate or store.
80/20: one must-fix, one regression through the durable intent and actual send port; retain the existing legacy and captured-shape checks.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
