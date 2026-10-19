# Change review — Group P supervisor proof correction

Subject base: bbc554cb1ebb6d50850ea78b6db2237c9fa5a816
Review state: open
Reviewed content: none
Outcome: Correct the Group P offline proof's outdated crash threshold and refusal wording assumptions, with executable regression coverage of the unchanged supervisor.
Affected rules: Rules 26, 49, 55, 68, 70, 74, 101, 102, 111, 113, 116.
Affected floors: secrets — no credentials or provider calls; spend cap — no model dispatch; stop — regression proves clean queued work stops at the stop latch; no duplicate sends — no sender change; durable intake — no production state changed.
Operator questions: none
Suggested tier: ordinary
Declared tier: ordinary
Tier rationale: Proof correction and isolated scratch-root tests only; production implementation remains unchanged.
Side effects: The desk must apply the supplied patch to its proof files together. The cap probe uses threshold four so the third delay still exercises the 250ms ceiling. Missing zero-cap launch evidence now fails instead of accepting a matching error string alone.
Undo and recovery: Revert this commit and the desk patch together. All probe state is disposable isolated scratch data; no live installation is modified.
Multi-machine posture: Machine-local offline verification of the existing per-root supervisor; no ownership, peer transport or replicated state changes.
Layer below: Read Rules 55/68, superviseJournal, recordScheduledCrash and the existing durable-pause tests. The shared crash policy pauses at threshold, before the legacy local threshold-plus-one fallback; the zero threshold is refused by policy validation before launching. The recorded proof and reproduction agree.
Bug class: none
Bug evidence: none
Hook bypass: none; core.hooksPath unset, hooks directory contains sample files only.
Convergence: none
Decision: groupp-1018-base | Reuse owning repair ebd9199d on the requested stepcheck-live-1018 base; reproduce the three checks again rather than invent a second repair. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/groupp-1018b-PROGRESS.md
Decision: groupp-1018-proof | Repair the proof, not the stricter durable crash brake: Rule 55 requires bounded recovery, not an extra failed launch. Count zero-cap launches instead of matching obsolete diagnostic text. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/groupp-1018b-PROGRESS.md
Decision: groupp-1018-desk | Supply the exact proof patch in this review artifact and local handoff for desk application; Studio access is read-only on this builder. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/groupp-1018b-PROGRESS.md

The adjacent groupp-1018-proof.patch targets the desk's pipeline/live-proof/P.sh and P-probe.mjs, relative to its lanes directory. It is a reviewable delivery artifact, not an applied Studio edit. Regression tests exercise the same real supervisor with injected time and local scratch files. No model-facing change or autonomous live completion is claimed.

simplestRobustRoute: Keep the working durable threshold and update the two obsolete proof assumptions. No product machinery is added. Valid positive bounds admit work, invalid zero bounds refuse before launch, crashes latch the durable brake and queued clean work runs until stop.
80/20: Replay the exact downloaded offline probe on the named base, evaluate the original and patched predicates, falsify each changed predicate, and run focused supervisor tests plus the required static and pinned-text checks.
VERDICT: author submission; no independent convergence or deployed proof claim
