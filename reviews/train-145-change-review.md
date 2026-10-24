# Change review — train-145 setup dependency and relocatable pool integration

Subject base: 17daf07876102b3cf68d8ecc4e9faa178784acbe
Review state: open
Reviewed content: none
Outcome: Integrate the two exact reviewed heads so setup has its runtime TypeScript dependency and prepared login records survive root moves, preserving live primary session grants, quota custody and missing-login observations.
Affected rules: 1, 4, 26, 28, 30, 34, 35, 37, 42, 44, 45, 49, 70, 74, 90, 95, 100, 101, 102, 111, 112, 113, 116
Affected floors: secrets retain existing custody and no credential copying; spend cap and stop retain dispatch admission; no duplicate sends retains pool notice identity and history; durable intake retains journal and writer lease.
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: Integrates installation admission and recovery with existing account-bound session grants.
Side effects: Local record references follow the moved root; external custody/profile facts remain unchanged. Missing derived records are rebuilt only through admitted-source validation, and tampered cached records remain refused. Launch-only session authority belongs only to the primary and never becomes an installed grant. The dependency scanner deduplicates paths registered by multiple CLI command branches while still checking the entire import closure.
Undo and recovery: Keep the live build until the desk gate. Retain all inventories, manifests and pool history; reverting relocation requires returning a moved root to its old path. Do not erase state or retry uncertain effects. No live runner is touched.
Multi-machine posture: Machine-local installation records and custody, deliberately; copies grant no new machine authority. Existing conversation ownership and effect fences remain authoritative.
Layer below: Read constitution and all three hash-verified evidence snapshots. Inspected installed preparation, primary session override, immutable cache checks, source withdrawal, legacy identity/predecessor loader and setup loader registration. Reuse the existing desk chain.
Bug class: integration
Bug evidence: reproducer=tests/preview/installed-harness-logins.test.ts
Hook bypass: none
Convergence: none
Decision: train-145-merge-install | Merge exact f3d1e15a82c409657736dde843309c0a914df1c0; evidence /Users/dabombstudio/.instar/agents/echo/.instar/lanes/clean-install-1020-PROGRESS.md read from hash-verified snapshot. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-145-PROGRESS.md
Decision: train-145-merge-pool | Merge exact 65b6970c9e91ccd0d38415b6bc1bca2cad182b1e; evidence /Users/dabombstudio/.instar/agents/echo/.instar/lanes/pool-records-relocatable-1013-PROGRESS.md read from hash-verified snapshot. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-145-PROGRESS.md
Decision: train-145-A | Preserve both test sets and live missing-login observation; apply primary launch-only session override before resolving local paths and fingerprinting, but persist the original installed inventory. Test the combined rename/primary-only/withdrawal boundary. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-145-PROGRESS.md
Decision: train-145-B | Create branch directly at exact live 17daf07876102b3cf68d8ecc4e9faa178784acbe; preserve ancestry, no main merge or branch move. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-145-PROGRESS.md
Decision: train-145-C | No irreconcilable product conflict; no member omitted. Keep live generated files only as a temporary seed while committing the merged source, then regenerate all publication outputs. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-145-PROGRESS.md
Decision: train-145-D | Run targeted and pinned checks on WSL and disclose host-dependent checks and unavailable Studio report paths under the remote-host exception; weaken no declaration. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-145-PROGRESS.md
Decision: train-145-desk | Use downloaded repin/build/rehash/register replay chain with temporary Linux sed adaptation and unchanged prompt guard. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-145-PROGRESS.md
Decision: train-145-loader | Deduplicate literal loader entry paths in the new dependency test because the live CLI registers the same loader in setup and another command; retain runtime dependency and dev-only refusal checks. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-145-PROGRESS.md
Prompt review: No new model prompt, output parser or model verdict. Existing recorded pool shapes and journal tests replay on the combined tree.
Deferral: generated/register.json:1 | not-a-deferral=generated quotation of governing rules, not a deferred commitment

Publication: Combined source 3847d89a28df34c293d99d19d316e6b49c310e38 regenerated as sha256:b60d4f1abe5dd1df060106d896bd2e976eb846550ae1d471cad8ebbafcbb9cf5 in 6921f6ea. Repin and owner rehash changed zero pins; build, typecheck, architecture, lint and register check passed. Default-context-floor passed 6 tests; measured plain always-sent answer is 23,172 bytes and tools 26,584 bytes, with guard unchanged at 23,459. Host physical launcher cases refuse bot identity before dispatch, matching the member evidence; these are submitted to the Studio gate, not claimed successful here.

## Closing block

simplestRobustRoute: This is the simplest robust route: ordinary exact-head merges, compose the existing primary override with the existing relocation reader, retain both test sets, and regenerate publication with existing desk tools. No new service, watcher, store or authority. Start guards remain admitted sources and sealed authority; end guards are valid local records with unchanged pool identity/history; existing limits remain intact. No fresh unattended deployment is claimed.
80/20: Resolve actual overlap, prove both sides, and hand the combined candidate to the Studio gate; no full suite here.
VERDICT: author submission; no independent convergence or live acceptance claimed
