# Change review — release train train-203: session-turn-background-1107 on the live build

Subject base: aab071e1614edba7be99acafb5f0e7c57d61210e
Review state: open
Reviewed content: none
Outcome: Combine the live build aab071e1 with the reviewed head session-turn-background-1107 ad821489, so a turn that ends with background helpers still running and no result stays open and the result written later is delivered once. This train adds no behaviour of its own: one ordinary merge, the desk chain and this record.
Affected rules: 26, 30, 34, 37, 49, 66, 69, 74, 77, 90, 101, 102, 105, 111, 113, 114, 115, 116
Affected floors: secrets — no credential path changes and a time value and a count are all the member adds; spend cap — no model call or reservation changes; stop — stop authority is still checked first; no duplicate sends — the member's single-delivery cursor is unchanged by the merge; durable intake — no row kind or field changes.
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: Carried from the member, which changes when a conversation turn closes on the live reply path; the train's own hand choice is limited to which side of generated/ to discard before the replay.
Side effects: The merged build carries the member's disclosed behaviour: later messages queue behind a waiting turn, and a background shell that never ends with no result holds the turn to the existing deadline. No file outside generated/ was changed on both sides, so every source and test byte comes from exactly one parent.
Undo and recovery: Revert the merge by first parent and regenerate the register through the desk chain. No stored shape changes and no migration is needed in either direction.
Multi-machine posture: Unchanged from the member: machine-local, deliberately. The write time and Stop receipt are read on the worker's machine and nothing is replicated. Git distributes the source and records.
Layer below: Compared the files changed on each side of merge base 5a5fdc91: the seven generated/ files are the only overlap. Read the auto-merged digest pins: the harness.ts inventory pin, REVIEWED_GROUNDING_INVENTORY and the native conformance declaration equal the member's values. The repin and rehash changed nothing, and check-architecture reports no R105 finding, so the member's renewed certificate matches this merged composition.
Bug class: none
Bug evidence: Integration only; the member's record carries the reproducer and live evidence.
Hook bypass: none; core.hooksPath is unset and the hooks directory holds only samples.
Convergence: none
Prompt review: No model prompt, output parser or verdict boundary is authored here. The member's accept boundary replays its recorded Claude Code 2.1.280 Stop shapes from update 969390684 through the real stop.mjs in tests/integration/session-stop-hook.test.ts, which passed on this merged tree.

1.X FIRST: Merge-only change that inherits the comparison in reviews/session-turn-background-1107-r2-repair-change-review.md and adds no behaviour needing a new one. Rechecked on JKHeadley/instar main 876e930090814aaaa03d269a6e609435afc1dda6: src/ and docs/specs/ have no background_tasks or resultWrittenAt, with SubagentTracker as the positive control (src/commands/server.ts, src/core/SessionManager.ts and others), and neither src/monitoring/SubagentTracker.ts nor src/monitoring/HelperWatchdog.ts owns reply-turn closure. ONEX-LESSONS.md is not on this host; the member's reading of it is inherited, not repeated.

Decision: train203-merge-stb | Merged session-turn-background-1107 at exactly ad821489 with one ordinary merge (29276ccb); member report session-turn-background-1107-PROGRESS.md; the only conflicts were in generated/. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-203-PROGRESS.md
Decision: train203-desk | Took generated/ from the live side for the merge commit, then re-ran the desk chain (repin 0, build, rehash 0) and replayed the register at 29276ccb (b12856b3); nothing in generated/ was hand-merged. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-203-PROGRESS.md
Decision: train203-keep-both | Desk decision A: both parents' behaviour is kept whole, since no source or test file changed on both sides. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-203-PROGRESS.md
Decision: train203-live-base | Desk decision B: built directly on the live build aab071e1, whose ancestry holds origin/main, leaving its accepted behaviour and the native declaration chain as the member renewed them. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-203-PROGRESS.md

Deferral: generated/register.json:1 | not-a-deferral=Regenerated governing text, not a new commitment.

Residue: gate-edge-record | medium | carried from the member record: a default-background Agent call is recorded as complete at launch; unchanged here.

Verification: Register generation sha256:77617256560bf19f1a4ddb85ba56041cc8fd36a12a4ea9af4e1101e18b811386 (299 entries, 122 rules), build-register --check true, check-architecture passed. Targeted test results are in the reported progress record.

## Closing block

simplestRobustRoute: One ordinary merge and the existing desk chain are the simplest robust route. No new machinery; the entry guard is the exact reviewed head and the exit guards are the targeted checks. No unattended product-completion claim.
80/20: Targeted tests for the member's changed files and direct consumers plus the cheap gates; the full suite, native and live gates stay with the Studio pipeline.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
