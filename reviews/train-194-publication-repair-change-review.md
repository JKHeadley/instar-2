# Change review — reconcile duplicate native renewal publication

Subject base: e02cabed087793a452c0c5690a9230f684d77ddd
Review state: open
Reviewed content: none
Outcome: Preserve the already published native renewal and record why the rejected duplicate needs no source or certificate change.
Affected rules: 26, 37, 49, 70, 74, 95, 101, 111, 112, 113, 116.
Affected floors: secrets, spend cap, stop, no duplicate sends and durable intake retain their existing enforcement; executable code and agent capabilities are unchanged.
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: Covers the inherited native declaration and generated publication from their original base, plus this evidence-only reconciliation; the repair itself changes no runtime or governance behavior.
Side effects: Adds this review record; native declaration and generated publication retain the successful renewal's bytes and provenance.
Undo and recovery: Revert this review-only commit if its account needs correction; preserve the native renewal and published ancestry.
Multi-machine posture: The fetched remote branch is the shared publication state. Local scratch attempts remain evidence, not competing authority to overwrite that branch.
Layer below: Compared both renewal tips, their shared base, exact native declaration, generated provenance and the two renewal logs; checked the actual remote ref rather than the stale failure label.
Bug class: none
Bug evidence: The original rejection is in /Users/dabombstudio/.instar/agents/echo/.instar/lanes/par-qual/native-train-194-eaolazsp/renewal.log. The successful attempt is in /Users/dabombstudio/.instar/agents/echo/.instar/lanes/par-qual/native-train-194-8e6r8yhp/renewal.log.
Hook bypass: none
Convergence: none
Decision: train-194-publication-reconcile | Keep the successful published renewal; the losing attempt has identical source and certificate bytes and adds no unique implementation to merge. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-194-repair-PROGRESS.md

## Observed publication race

Both native renewals started at e02cabed087793a452c0c5690a9230f684d77ddd.
The successful run published e784fc69286211dc8562eb9069914551479bcaae;
the second run's cf599fdef7b097841cb2b499c5f0b9a6a3a641d2 was rejected
as non-fast-forward. At repair entry, this worktree and the freshly fetched
origin/train-194 already matched the successful tip. The successful log records
the native contract moving from 9/10 (stale certificate only) to 10/10, followed
by its successful push and matching ls-remote observation. This is inherited
desk evidence, not a fresh contract run by this repair.

The complete diff between the two tips contains only seven generated files'
commit/generation references and the native review's evidence directory. The
native declaration and all executable sources are byte-identical. Publication
retains a54d9c27dcc59231151ab1a62821047f4cc5ac1b and its generated descendants;
no rejected scratch commit is force-pushed or represented as published.

## Instar 1.x comparison

Researched actual JKHeadley/instar main at
4287704c4585c7d27e691c147fd93f0da3f55779 after fetching main: searched src/
and docs/specs/ for rejected pushes and inspected path history, including
999fcab962b2f51668a693feda8e0ddfd689e29a and
ab26b7ca36c1375d855f08c9a6a66e84e2b656e2. In src/core/GitLeaseStore.ts,
casWrite re-reads observed state after a rejected push; src/core/GitSync.ts
provides pullRebase and commitAndPush. The contention discussion in
docs/specs/MULTI-MACHINE-BOOTSTRAP-ROBUSTNESS-SPEC.md and
docs/specs/MULTI-MACHINE-SESSION-POOL-SPEC.md explains the fast-forward
boundary and re-evaluation. The desk ONEX-LESSONS.md section 1 connects this
to registry races and verifying actual published state.

Reuse: fetch, inspect the winner and re-evaluate before publishing. Mismatch:
lease epochs, registry semantic merging and GitSync autostash do not belong
in this reviewed build branch. No 1.x code is transplanted. The existing Git
fast-forward boundary already preserves concurrent published work.

## Closing block

simplestRobustRoute: This is the simplest robust route: verify that the required renewal already landed, preserve its reviewed ancestry, then publish this evidence with a normal push. Start guard: clean worktree and freshly fetched remote. End guard: cheap checks pass and the pushed tip matches the remote. Limit guards: no force push, history rewrite, hook bypass, stash, credential disclosure or certificate alteration. No new autonomous capability is claimed.
80/20: Run TypeScript, architecture/lint, register, change-review and diff checks on the final commit. No test file or model-facing behavior changes; the Studio pipeline owns the full suite under this repair's explicit test scope.
VERDICT: author submission; no independent verdict asserted
