# Change review — sb-w4-media2 gate repair

Subject base: 7aaa374b98b7a4a048626308d437008e69f68385
Review state: open
Reviewed content: none
Outcome: Repair the two Studio full-test failures the media intake change itself caused. (1) The rule 4 live ruled-three roster test now names preview.media-admission.createMediaAdmission deliberately, with its rule 4 basis (recorded-governed-state: dispatch only on an exact match of a recorded policy admission and a consumed Six reservation; fail closed, intake preserved). (2) The launcher proof expects the five declared store agreements the change introduced (media-custody added), still requiring passed, 0 disagree, 0 unchecked. No source change.
Affected rules: 4 (the roster stays an exact enumeration; the new site is added by name with its rule 4 admission, not by loosening the check); 33 (store agreements: the declared comparison count follows the declared inventory, every one still checked and agreeing); 66 (the blocking site stays registered where the checks see it); 74 (this record); 101 (no hook bypass); 116 (simplest route: update the two exact expectations, no new machinery).
Affected floors: secrets — unchanged, test expectations only; spend cap — unchanged; stop — unchanged; no duplicate sends — unchanged; durable intake — unchanged, the media admission still preserves the journal intake on refusal.
Operator questions: none
Suggested tier: ordinary
Declared tier: ordinary
Tier rationale: Two test expectations updated to match an already-reviewed, deliberate declaration change; no runtime behavior changes.
Side effects: The ruled-three roster now includes the media admission site; any future ruled-three site still fails this test until named. The launcher proof now requires five declared agreements; a sixth or a removal fails it.
Undo and recovery: Revert this commit; the two tests then fail again against the media change, as on the gate.
Multi-machine posture: Not affected; test-only change.
Layer below: Read tests/preview/media-admission.declarations.json (the live ruled-three rung with basis recorded-governed-state) and tests/preview/store-agreements.ts (media-custody added to STORE_AGREEMENTS). Reproduced the proof failure locally (declared 5 vs 4) before the change; afterwards tests/register and tests/preview pass in full (293 files, 2692 tests) and the architecture check exits 0.
Bug class: none
Bug evidence: none
Hook bypass: none (plain commit; no bypass flag).
Convergence: none
Decision: sb-w4-media2-gate-roster | Add the media admission site to the exact rule 4 roster with a rule 4 justification comment instead of relaxing the enumeration, because rule 4's check is the enumeration itself. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/sb-w4-media2-PROGRESS.md
Decision: sb-w4-media2-gate-proofs | The P9-PREVIEW proof failure was caused by this change (the new media-custody store agreement makes declared 5); update the expected count, keeping disposition passed with zero disagreements and zero unchecked. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/sb-w4-media2-PROGRESS.md

## Closing block

simplestRobustRoute: This is the simplest route: update the two exact expectations to the deliberate declaration change; the checks keep their exactness and no runtime code changes.
80/20: The two failing gate tests, the media, store-agreement and proof tests, and the full tests/register and tests/preview directories pass; architecture check passes.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
