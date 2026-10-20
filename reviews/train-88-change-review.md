# Change review — train-88 integration (Laptop p2)

Subject base: ec8ed1d8f759f760d93e5b0a1509c92b774f30c8
Review state: open
Reviewed content: none
Outcome: Integrate the reviewed deadset recovery repair onto the exact live train-84 base while preserving its accepted behavior.
Affected rules: 1, 26, 32, 33, 37, 49, 60, 69, 70, 74, 90, 101, 102, 111, 112, 113, 116
Affected floors: Secrets unchanged; spend cap and physical capacity retain verified-gone guards; stop, no duplicate sends and durable intake unchanged.
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: Integration carries reviewed host-resource recovery and a byte-bound native conformance declaration, with generated publication.
Side effects: First reservation after rotation uses the new generation's heads. Missing or malformed owner evidence retains the allocation. No new close mechanism or recovery signalling; the existing verified-gone close and partial settlement resume remain.
Undo and recovery: Revert the merge through review and regenerate publication. Retain durable closed sets and generations; uncertain owner/member state stays charged. No uncertain effect replay or data deletion.
Multi-machine posture: Intentionally machine-local process evidence and resource allocation under the existing host lease; no cross-machine disposal authority. Laptop checks do not assert Studio live recovery.
Layer below: Read the full constitution, member and repair reports and the cint-L37 desk chain. Inspected resource-owner recovery, Six reserve ordering, incident-shape regression and native certificate renewal evidence. Existing close and generation rotation are reused.
Bug class: integration
Bug evidence: reproducer=tests/preview/deadset-recovery.test.ts
Hook bypass: none; core.hooksPath unset and common hooks directory inspected, containing only samples.
Convergence: none
Prompt review: No model-facing prompt, output parser or semantic accept/escalate/refuse change.
Decision: train-88-merge | Merge exact reviewed 178500e9ff05ec3a350cd53c2198b4c505a1cd3e; member and repair reports read through the Studio API: /Users/dabombstudio/.instar/agents/echo/.instar/lanes/deadset-close-1019-PROGRESS.md and deadset-close-1019-repair-PROGRESS.md. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-88-p2-PROGRESS.md
Decision: train-88-A | Preserve the reviewed source behavior and live-base behavior; only generated publication conflicted. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-88-p2-PROGRESS.md
Decision: train-88-B | Start train-88-p2 directly at ec8ed1d8f759f760d93e5b0a1509c92b774f30c8. Use the Laptop assignment branch because remote train-88 already exists; do not move or overwrite another train. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-88-p2-PROGRESS.md
Decision: train-88-C | No product conflict and no omitted head. Retain base generated files only to complete the source merge, then regenerate all publication from the merged commit. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-88-p2-PROGRESS.md
Decision: train-88-D | Run required targeted checks on the Laptop; report unchanged host-dependent failures separately. Studio owns live acceptance and missing absolute evidence. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-88-p2-PROGRESS.md
Decision: train-88-desk | Use existing downloaded repin, build, owner rehash and register replay. Both repin tools changed zero pins. Preserve the prompt guard and native certificate. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-88-p2-PROGRESS.md

Deferral: generated/register.json:1 | not-a-deferral=Existing declaration descriptions are mechanically republished; no new deferred repair.
Verification: Targeted new and direct-importer tests plus register, subscription provider, journal tests, default-context-floor and pinned READY tests. Typecheck, architecture, lint, register and change-review checks recorded in the train report.
simplestRobustRoute: This is the simplest robust route: one ordinary merge of the reviewed head and the existing publication chain. Reuse verified-gone close/resume and rotation; only correct demand ordering and preserve unknown-owner capacity. Start guard is complete owner/member absence evidence and census; end guard is durable close before removal and current-generation admission; limit guard is Six capacity under the host lease. No new machinery or unattended live-completion claim.
80/20: Targeted files and required train checks only; no full suite, load test or second comparison worktree.
VERDICT: author submission for desk gate; no independent convergence or live acceptance claim
