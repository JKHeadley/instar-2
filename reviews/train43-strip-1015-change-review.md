# Change review — Restore train-43 approved tool policy

Subject base: d21857519e4f18ba67c5da72ce771b477b4c074d
Review state: open
Reviewed content: none
Outcome: Remove inherited completion guidance so train-43 uses live train-42's approved tools policy while retaining packet-once, summary cut, honest reaction records and async reply review.
Affected rules: 1, 12, 26, 34, 36, 37, 49, 70, 74, 90, 101, 105, 111, 112, 113, 115, 116
Affected floors: Secrets, spend cap, stop, no duplicate sends and durable intake retain their existing doorway enforcement. Both invocation policies match live bytes; native contract and recorded replay test the existing boundaries.
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: Model-facing prompt rollback to the already-approved live policy; byte-bound native certificate and generated publication must follow the resulting composition.
Side effects: Tool routes lose the explicit requested-step verification paragraph, which is delivered separately by completion-guidance-1015. Read-before-answer guidance remains. Historical replay tests again compare captured tool prompts directly; captures are immutable. Completion-specific integration cases are removed, while their unrelated isolated-custody fix remains. Speed and async-review source is unchanged.
Undo and recovery: Revert this scoped removal and renew the composition certificate through the existing native contract helper; replay generated publication. Restoring completion guidance also requires its separately approved invocation policy before live activation. No journal schema or migration changes; never repeat uncertain effects.
Multi-machine posture: Shared prompt bytes apply identically on every host. No new state, ownership or transport change. Renewed native evidence is specific to Darwin and the declared Node runtime.
Layer below: Inspected subscriptionToolsPolicy, subscriptionConversationPolicy and encoded canonical hashing; compared source and replay diffs to live 51d31871. Inspected native compositionClosure/compositionDigest and the desk --renew path, which enforces exact runtime and before/after contract assertions. Inspected async-review recorded-shape consumers and preserved their send/review scheduling.
Bug class: none
Bug evidence: Scoped rollback to approved live policy, not a new behavior claim. The project's own policy functions produce tools sha256:5fed4bcfd823d950c1444a008a9c11d40824671dd8e68aa2f5908ed8534a2926 and conversation sha256:3598cc7514f4be6ffec52f1d321e1596cd2db420a67fd7958281f3862dd9ce8c.
Hook bypass: none; core.hooksPath unset and inspected common hooks directory contains sample files only. Plain commits and push.
Convergence: none
Prompt review: Restores live wording exactly, introduces no fixture-specific trigger or dispatch wording. Real recorded replays exercise read-before-answer, self-description, literal copy, tool outputs and async review. Summary writer summary:715672480, summary uncertain 715672483, Jev undecided 715672482 and unsure 969389570, reply review 969389923, delivered reply 715672479 and empty candidate 715672550 come from retrospective-duty-followup-train-1-2026-10-08.json with its original read-only journal provenance. Both positive and unavailable review outcomes fire through the shipped consumer; injected delay proves later sends complete before review without machine load.
Decision: train43-strip-guidance | Restore the seven guidance and prompt-bound/replay files from live 51d31871 after checking their exact diffs, preserve captures and unrelated custody/speed/async changes. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train43-strip-1015-PROGRESS.md
Decision: train43-strip-darwin | Renew stale Darwin conformance using the existing --renew helper with real before/after contract proof, then publish through the existing register generator. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train43-strip-1015-PROGRESS.md

Evidence: Targeted prompt/provider/session/replay tests passed 180/180; four pre-existing live opt-in cases skipped. Typecheck passed. Native renewal: 9/10 before with only stale certificate failing; 10/10 after, 264-file complete closure, sha256:adbb972d5f2c2484a3240e63626caced55ea463efec1ad2a819924d13807abb6. Full logs and JSON are in the absolute lanes train43-strip-1015 evidence files. Desk rehash/repin found zero stale owner or inventory pins.

simplestRobustRoute: This is the simplest robust route: subtract the inherited paragraph and its dependent test adjustments, reuse the existing canonical policy functions, native certification helper and register publication. No added machinery. Start at the named train-43 head, require exact live digests and passing targeted/required checks, end with committed and pushed evidence. Existing access, secret, spend, stop, durability and effect uniqueness guards remain. No new live unattended capability claim; the desk owns activation.
80/20: Verify affected prompt consumers, recorded shapes and preserved speed/async paths, then required native and pinned gates. No full suite, live provider calls or load tests.
VERDICT: author submission; no independent convergence or live acceptance claim
