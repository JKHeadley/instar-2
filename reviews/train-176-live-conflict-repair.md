# Change review — preserve both train-176 and live repairs

Subject base: c3f6cfdbfd49e6da8f5319d74c57cb332120e89f
Review state: open
Reviewed content: none
Outcome: Merge live add5d75879174874e15bf1552ae37c82e00c6358 into train-176 while preserving helper failure handling, both repair histories and all acceptance/refusal assertions. Regenerate publication from the combined source.
Affected rules: 26, 34, 36, 37, 49, 69, 74, 90, 91, 101, 102, 105, 111, 112, 113, 116
Affected floors: Secrets, spend cap, stop, no duplicate sends and durable intake remain enforced at the existing checkpoints; no authority or capability is reduced.
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: Integration of an already live repair with the reviewed helper train needs exact preservation of crash, refusal and publication evidence.
Side effects: The live dashboard/resource-owner changes arrive by ordinary merge, with their original reviews. Fixture timeout configuration uses the train's existing invocationTimeoutMs spelling; the live ordinary-reply caller retains its 2000ms provider allowance and separate 100ms reply bound. Test grouping and deadlines remain finite. No authored production decision or prompt change.
Undo and recovery: Revert the merge before landing if rejected and regenerate publication from the retained source; no installation or live journal is mutated.
Multi-machine posture: Git carries source and reviews across machines. Validation is machine-local deliberately; runtime ownership, forwarding and durable recovery are preserved.
Layer below: Searched actual JKHeadley/instar main 083e79a9c55944fc8fba95cea55d3b6ce41b5647 src/ and docs/specs/ for worker timeout/crash and signed-cache/policy signature. Read src/messaging/telegram-origin/OriginStore.ts startup/error/exit handling and CARTOGRAPHER-SWEEP-EVENTLOOP-SAFETY.md matches, with history aceb6aedc/932e1c851/544f31d90. Bounded startup and explicit failure support keeping the train's fail-fast worker/HTTP fixtures; no direct transplant fits these test-only conflicts. Inherit helper comparison f5fe54444544f83a477dec909f990c848866ed3b and signed-cache comparison cc11e45f92e2590dd1bbd3c3facb5b849532f0fc from their existing reviews. Read ONEX-LESSONS sessions/recovery and testing/maintenance areas. Compared both parents' assertions and exact fixture bounds, async child handling, owner manifests and register replay.
Bug class: none
Bug evidence: none
Hook bypass: none
Convergence: none
Prompt review: No authored model prompt, parsing or accept/escalate/refuse change. Preserve both parents' existing model-facing behavior and captured-shape evidence. The canary's notice matcher remains test-only and its exact answer assertions remain.

Decision: train-176-live-merge | Merge the exact live head, preserving both parent histories, all defect entries and original review provenance. Keep the signed-cache review bound to this train and retain the live publication evidence paragraph. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-176-repair-065104-PROGRESS.md
Decision: train-176-live-fixtures | Keep train-176's isolated crash/torn/poison cases, fail-fast worker and injected timeout signal; retain live's three-observation assertion, async canary and both notice types. Adapt the one live reply caller to invocationTimeoutMs rather than introduce a second alias. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-176-repair-065104-PROGRESS.md
Decision: train-176-live-register | Reuse live's owning cumulative-budget repair 7b78ea242 and grouped intake matrix unchanged; regenerate derived owner pins and publication using existing desk tools. Preserve the existing native certificate for Studio verification, never mint one here. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-176-repair-065104-PROGRESS.md

Deferral: generated/register.json:1 | not-a-deferral=Regenerated register retains existing constitutional obligations; no repair work is deferred by that wording.

Publication: Existing desk owner rehash and grounding repin each changed zero pins. Register replay at merge 1fb942afb1004af721fcf79681fa4106e05585ab produced 299 entries and 122 rules, generation sha256:68bc3dfa7c748d2da732eb8f810689c7b44affcfe47af833667a6204e130f6d7. This record covers that derived publication as well as the source merge. Architecture reports only the charter-exempt native macOS conformance binding; no certificate declaration is authored here.

## Closing block

simplestRobustRoute: This is the simplest robust route: ordinary merge, explicit assertion-preserving conflict resolution and existing desk repin/register replay tools. No new runtime machinery. Start guard: clean assigned head and exact fetched live commit; end guard: targeted verification and cheap checks on committed bytes; limit guard: bounded foreground one-worker tests, no full suite or live mutation. No autonomous live completion claim.
80/20: Typecheck, targeted conflicted tests and cheap gate checks here; the Studio runs the full suite and host-bound verification under the supplied charter.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
