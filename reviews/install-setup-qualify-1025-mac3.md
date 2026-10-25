# Change review — 3B setup reservation measurement

Subject base: af0e755e7f5bd740c227998f68a2cdbfb992570e
Review state: open
Reviewed content: none
Outcome: Measure the constrained 3B model on the same cases with the desk-authorized 3-GiB RSS ceiling. Preserve all prior evidence; no installation route is admitted.
Affected rules: 4, 13, 26, 34, 36, 38, 41, 49, 55, 57, 58, 60, 65, 67, 74, 75, 95, 100, 101, 107, 111, 112, 113, 116; purpose Rule 3.
Affected floors: secrets — no live custody or private bytes exported; spend — local CPU only, zero paid calls; stop — existing durable stop file checked before/during execution; no duplicate sends — no sends; durable intake — original cases and full captures retained.
Operator questions: none; this experiment's reservation was explicitly authorized by the desk. Any installation design update belongs to the desk.
Suggested tier: significant
Declared tier: significant
Tier rationale: A model reservation change requires real measurement and preserved evidence.
Side effects: Explicit opt-in launches one two-thread CPU child under a 3-GiB sampled RSS ceiling. Every other limit, including the 120-second deadline, is unchanged. Ordinary tests never load weights. Default 2-GiB profile and all product routes remain unchanged.
Undo and recovery: Revert the named qualification profile/test changes while retaining evidence. New private cache directory; no stop file or prior run overwritten. No automatic retry or live store mutation.
Multi-machine posture: Machine-local macOS arm64 measurement; no ordinary 8-GiB-host, Linux/x86_64 or cross-machine qualification claim.
Layer below: Constitution, unchanged docs/14 design and judgment bar, pinned b4000 runtime and 3B weights, same strict decoder and schema, Seven/Six capture/admission, Ten resource owner, exact prior owner cases. Distinct custodian/recovery identities and GE/A0 preparation remain uncovered and outside scope.
Hook bypass: none
Convergence: none; independent assessment PENDING ASTRA.

simplestRobustRoute: Reuse the existing qualification runner and change only its named experimental memory reservation. This is the simplest robust route to measure the startup memory failure without adding an engine, parser, retry or fallback. The profile selector prevents accidentally applying the experimental reservation to another configuration. Existing weight/runtime pin, durable stop, deadline, resource and cleanup guards remain active. No autonomous installation completion is claimed.

Verification: Three repetitions of the unchanged real cases, with full model streams, diagnostics and Seven captures. Targeted profile-boundary tests and replay of actual model output and repository-held journal shapes. Numerical outcomes and verification are recorded in tests/qualification/evidence and the absolute lane PROGRESS record.

Measured result: 36 responses; zero schema failures; 12/12 positives; 6/24 unsafe model accepts (conflicting-receipts and observation-instruction, each 3/3). Zero resource failures; peak sampled RSS 2,392,915,968 bytes. The model-judgment bar fails.

VERDICT: failed qualification evidence; independent assessment PENDING ASTRA
