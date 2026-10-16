# Change review — train-47 live merge conflict repair

Subject base: c8e2636a6c683244d69f9d1c051f9fb1a78d8ac8
Review state: open
Reviewed content: none
Outcome: Merge the named live build d8df2186 into train-47 while preserving topic-local grounding and measured capacity admission.
Affected rules: 1, 26, 34, 36, 37, 46, 49, 60, 69, 74, 75, 90, 96, 101, 102, 105, 111, 112, 113, 116
Affected floors: secrets — unchanged custody and scrub owners; spend cap — unchanged shared reservation; stop — unchanged stop admission and retirement; no duplicate sends — unchanged dispatch identity and custody; durable intake — capacity refusal retains queued requests.
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: Merge composition includes native grounding, capacity admission and production wiring; no new policy or authority is introduced by the resolution.
Side effects: The topic config type retains grounding alongside the injected capacity callback. Both existing runtime paths survive. Generated register publications are rebuilt from combined source commit 311297d6576a4e9e803782b9d0325859a5be7e29. The native macOS certificate is not evidence for this new composition.
Undo and recovery: Revert the merge through the desk release procedure, retaining durable journals and never replaying uncertain sends. No new store or schema.
Multi-machine posture: Capacity measurement remains machine-local beneath existing ownership. Grounding is topic/worker-local and rebuilt from durable custody; no replicated authority or transport changes.
Layer below: Inspected topic host configuration spread, serialized physical resource admission and lease release, grounding snapshot-before-dispatch and the native adapter recovery declaration. Verified named live/source ancestry and generated-source provenance.
Bug class: none
Bug evidence: none
Hook bypass: none; core.hooksPath unset and common hooks directory contains samples only, checked before commit.
Convergence: none
Prompt review: No new prompt, parser or acceptance policy authored in this repair. Preserve the live grounding implementation. Replay committed real summary/uncertain, Jev uncertain/undecided, reply-review and delivered/empty reply shapes through capacity denial/recovery and topic-local snapshot delivery; existing session tests also replay exact grounding reuse and compaction boundaries. No live model quality or deployment acceptance claimed.
Skip: tests/assembly/production-conversation-session.test.ts:674 | scope=Full rewalk6 replay needs the Studio-local DELTA_TURNS_WALK_ROOT capture. The committed recorded-shape replay remains runnable here; no fresh full-walk evidence claimed.
Decision: train47-repair-merge-grounding | Retain the live grounding key and train capacity callback together; both runtime implementations remain, with a recorded-shape composition regression. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-47-repair-202329-PROGRESS.md
Decision: train47-repair-register | Regenerate conflicting publications using the existing register replay; run downloaded owner rehash and repin chain, never synthesize hashes manually. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-47-repair-202329-PROGRESS.md
Decision: train47-repair-certificate | Retain the exact named live build certificate unchanged; report its permitted R105 composition mismatch for the Studio-owned native contract. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-47-repair-202329-PROGRESS.md

simplestRobustRoute: This is the simplest robust route: ordinary merge of the exact named live head, retain both configuration keys, regenerate existing publications and test their composition. No new runtime mechanism. Existing admission, resource, stop, grant, durable intake and uniqueness guards remain. Start at c8e2636a; end at a pushed tested merge with native certification and live acceptance owned by the Studio desk.
80/20: Only targeted tests, recorded shapes, typecheck and cheap gates; no full suite or base worktree comparison. Native certificate mismatch and Studio-only evidence are reported honestly.
VERDICT: author submission; no independent convergence or live acceptance claim
