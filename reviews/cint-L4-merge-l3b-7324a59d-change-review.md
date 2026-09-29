# Change review — cint-L4 merges cint-L3b 7324a59d, then desk repin and register regeneration

Subject base: f52015581b316cb0f1822c4e6834595dc770b8c6
Review state: open
Reviewed content: none
Outcome: cint-L4 merges the current cint-L3b head (7324a59d), as its build plan directs whenever cint-L3b moves. That brings the reviewed cint-L3b repairs into this batch: restored quarantined proof cases, closed defect records, and the register contract map requiring CI proof only for non-runtime held evidence (P3-NF-25), which clears cint-L4's blocker on the held preview runtime probes. Conflicts were only in derived content (generated register outputs, owner-reference hashes, the grounding inventory digest, defect records and one test whose two sides asserted the same passing plans); cint-L3b's side was taken and the desk steps then recomputed every pin for this tree (2 part-ten pins) and regenerated the register by replay.
Affected rules: 37, 74, 107, 116
Affected floors: secrets — unchanged; spend cap — unchanged; stop — unchanged; no duplicate sends — unchanged; durable intake — unchanged
Operator questions: none
Suggested tier: ordinary
Declared tier: ordinary
Tier rationale: a merge of already-reviewed changes plus derived-binding regeneration; no new source logic
Side effects: none beyond what the merged cint-L3b changes already carry
Undo and recovery: reset cint-L4 to f5201558
Multi-machine posture: not applicable, repository merge
Layer below: the cint-L3b review records merged here (reviews/cint-L3b-*); docs/07-the-declarations.md P3-NF-25; the desk repin steps
Bug class: none
Bug evidence: none
Hook bypass: none
Deferral: scripts/check-register-contract-map.mjs:16 | not-a-deferral=merged from cint-L3b; the design assigns runtime-stage evidence to the runtime holder and live proof (P3-NF-25)
Deferral: docs/defects/preview-runtime-probes-without-ci-proof.md:7 | not-a-deferral=merged from cint-L3b; the record is closed by that same P3-NF-25 ruling, and the probes are exercised by the live-proof step after deploy
Convergence: none

## Closing block

simplestRobustRoute: merge the branch that already carries the reviewed fix instead of re-deriving it here; regenerate derived pins with the standard tooling, never by hand (Rule 116).
80/20: tsc, lint and register:check pass on this machine; the full gate reruns next.
VERDICT: author submission; the independent verdict is pending
