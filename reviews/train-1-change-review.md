# Change review — train-1 release train: phoneroute and Rule 89 proof

Subject base: 1e323ff6ad0ff122a14e7044bb07eed70be99b8f
Review state: open
Reviewed content: none
Outcome: Combine approved sb-w4-phoneroute 431ea9198919ff598a8cd7241af2e21bc0e25f8a and sb-w4-rule89proof f16c1d86278651f6539ab145593811f8010ddfc5 onto the exact live base, in that order. The first ordinary merge fast-forwarded; the second produced e3933b61059c70a0801710dc9577ede494de63ea. Neither merge conflicted. Regenerate the register with the existing desk chain. No product source, governing document or model-facing behavior changes against the live base.
Affected rules: 26, 34, 37 (observed targeted consumer proofs); 49, 74, 111 (scope, review and foundation); 66, 69, 90 (generated register replay); 79, 82 (phone route proof without overstating renewal availability); 89 (signed speaker evidence); 101, 112 (ordinary merges, preserved prior history); 102 (reported decisions); 113 (machine posture); 116 (existing mechanisms only).
Affected floors: secrets — no credential path changed; spend cap — no paid call or limit change; stop — runtime unchanged; no duplicate sends — durable reopen assertion retained; durable intake — real isolated journal replay retained, no schema change
Operator questions: Remote train-1 already holds a different release train; replacing its history is not part of an ordinary push. Publish the candidate separately as train-1-622 within the authorized repository, preserving both histories. Adoption under the requested train-1 name remains unresolved.
Suggested tier: ordinary
Declared tier: ordinary
Tier rationale: Proof helper, recorded fixture and test assertions only, plus generated provenance. No product behavior or authority changes.
Side effects: Phone route proof distinguishes unavailable renewal from success; the Rule 89 test catches incorrect infrastructure/agent accounting and duplicate delivery after reopening. Register provenance now identifies the combined merge. No deployment or new live proof is claimed.
Undo and recovery: Retain the live base and both reviewed heads. Discard this candidate before deployment, or revert its proof changes and regenerate the register. Earlier train-1 history remains on its original branch; no force push or reset is used.
Multi-machine posture: Machine-local isolated test roots; repository artifacts are portable. Distributed ownership, authority, replication and forwarding remain unchanged. Studio report paths remain the desk's destination, not paths rewritten to WSL.
Layer below: Read both head reports and the pipeline merge-live record for 431ea919. Inspected phone-route-proof.mjs and its real room status fixture, plus the Rule 89 worker/journal assertions for accepted delivery and persistent speaker counters. Read cint-L37-PROGRESS.md and the downloaded repin/rehash scripts. Verify the unchanged context-floor guard and the real compiled register CLI on the combined tree.
Bug class: none
Bug evidence: none
Hook bypass: none
Convergence: none
Decision: train-1-merge-phoneroute | Merge exact 431ea919 first by ordinary fast-forward, carrying its live-base repair and citing /Users/dabombstudio/.instar/agents/echo/.instar/lanes/sb-w4-phoneroute-PROGRESS.md; no conflicts or documentation resolution | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-1-PROGRESS.md
Decision: train-1-merge-rule89proof | Merge exact f16c1d86 second by ordinary merge with zero conflicts, citing /Users/dabombstudio/.instar/agents/echo/.instar/lanes/sb-w4-rule89proof-PROGRESS.md; run its changed proof and mandatory register lifecycle test on the combined tree | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-1-PROGRESS.md
Decision: train-1-desk-replay | Run the existing repin, build, rehash and register replay at e3933b61059c70a0801710dc9577ede494de63ea; zero inventory or owner pins change, generated files are never hand-edited | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-1-PROGRESS.md
Decision: train-1-preserve-existing-branch | Existing local train-1 is an earlier release, and fetched remote train-1 additionally carries the pipeline's live merge; neither is an ancestor of this exact-base candidate. Preserve both and publish this candidate separately as train-1-622 within the authorized repository, avoiding an unauthorized history replacement; adoption under the requested branch name remains unresolved | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-1-PROGRESS.md
Prompt review: No prompt, model parser or accept/escalate/refuse behavior for model output changes. Observer 106 is not triggered. The recorded room status fixture replays updates 715674868 and 6232820; the Rule 89 test uses supplied model verdicts with the real worker, signing and durable journal, and is not represented as a new live model proof.
Deferral: generated/register.json:1 | not-a-deferral=generated register output reproduced by the standard replay, not authored prose

## Closing block

simplestRobustRoute: This is the simplest robust route: two ordinary merges in the specified order, existing desk regeneration and targeted consumer checks. No product machinery is added. Start guards are exact approved heads, the live base and isolated bounded test ports; end guards are passing checks and evidence of the published candidate. Secret, spend, stop, duplicate-send and durable-intake floors remain unchanged. No new unattended live exchange is claimed.
80/20: Check the two changed tests, unchanged context floor, register lifecycle, architecture, lint, types and review metadata. The pipeline owns the full suite and deployment.
VERDICT: author submission; no independent verdict or deployment claim
