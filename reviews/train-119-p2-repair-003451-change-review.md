# Change review — train-119-p2 repair decision report references

Subject base: 19c79c7404b8e4275e59ca2b5069fb04d2f80b26
Review state: open
Reviewed content: none
Outcome: Restore the report handoff for eight historical train-119 decisions using the exact repair report destination specified by the desk.
Affected rules: 1, 26, 48, 49, 74, 101, 102, 107, 111, 112, 113, 116
Affected floors: secrets — no credential changes or new disclosure; spend cap — no model calls; stop — unchanged; no duplicate sends — no dispatch changes or sends; durable intake — unchanged.
Operator questions: none
Suggested tier: ordinary
Declared tier: ordinary
Tier rationale: Only review report references and their handoff artifact change; no product, prompt, fixture, test, or register behavior changes.
Side effects: The checker now requires the repair report at the designated Studio path. The desk must copy the local report before its gate can resolve that path; WSL honestly retains the missing-file finding.
Undo and recovery: Revert this repair commit and retain both reports as evidence; do not remove historical decisions or weaken the consumer.
Multi-machine posture: Review records travel through git. The local state report is copied by the desk to its specified Studio lane path; no remote writes or fabricated Studio filesystem paths are used here.
Layer below: Full purpose and rules; all eight existing decision rows; scripts/change-review.mjs Rule 102 readEvidence and exact-ID checks; supplied Studio failure excerpt and remote-builder report contract.
Bug class: none
Bug evidence: none
Hook bypass: none; core.hooksPath unset and common hooks directory inspected, sample hooks only.
Convergence: none
Prompt review: No model-facing text or output parser changes.
Decision: train-119-p2-report-repair | Preserve all eight historical decisions and update their report locators to the designated repair report, supplying their summaries in the local handoff rather than weakening the missing-evidence check. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-119-p2-repair-003451-PROGRESS.md
Verification: Exact decision/report coverage checked locally; architecture, typecheck, lint, register and pinned gate checks recorded in the handoff report. Studio-path resolution is explicitly left to the desk copy.
simplestRobustRoute: This is the simplest robust route: correct the eight locators and provide the missing report through the existing desk handoff. Existing decision preservation is the start guard, exact report-ID coverage is the end guard, and all safety floors remain unchanged. No added machinery or autonomous capability claim.
80/20: Documentation-only repair with required cheap checks and pinned gate tests; no full suite or new runtime proof.
VERDICT: author submission for desk gate; no independent convergence or Studio verification claimed
