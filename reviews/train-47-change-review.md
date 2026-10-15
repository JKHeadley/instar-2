# Change review — train-47 reviewed release composition

Subject base: dcf3a5160cb92ede56f70f8b1048f27b2d6e5ef5
Review state: open
Reviewed content: none
Outcome: Combine reviewed topic-worker capacity admission and retained idle context with macOS protected-path startup refusal on the pinned live base.
Affected rules: 1, 4, 26, 34, 36, 44, 46, 49, 60, 61, 63, 69, 74, 75, 90, 95, 96, 101, 102, 105, 111, 112, 113, 114, 115, 116
Affected floors: Existing secrets, shared spend cap, stop, no duplicate sends and durable intake remain enforced by the reviewed owners. Capacity refusal keeps queued input; path refusal precedes mutation and preserves stop access.
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: Composition changes physical worker admission, bounded resources, journal acknowledgements and setup/boot boundaries.
Side effects: Up to eight topic workers plus reserved answer capacity, with four-hour retention within parent bounds. New workers wait for observed CPU/memory headroom after physical admission. Misplaced Darwin installations refuse startup while preserving status/stop. Neither member certificate proves this combined composition.
Undo and recovery: Return to the pinned live build through the desk release procedure; preserve durable journal state and never replay uncertain sends. No new schema or store.
Multi-machine posture: Host headroom and path checks are deliberately machine-local beneath existing ownership and durable intake fences. No transport or replicated authority changes.
Layer below: Read both member reports and their reviewed diffs; inspect serialized physical admission/release, journal pending acknowledgements, realpath-based pre-mutation guards and existing register replay chain.
Bug class: none
Bug evidence: none
Hook bypass: none; core.hooksPath unset and common hooks directory contains only samples.
Convergence: none
Prompt review: No new prompt, parser or semantic verdict authored by this train. Member capacity tests replay recorded summary, uncertain, Jev, review and delivered/empty reply bytes through queued denial and restored admission. No live acceptance claimed.
Decision: train-47-merge-topic | Ordinary merge of exact reviewed topic-workers-1015 7585e714c328ecf25b60b197cbe39bf99cb85877 fast-forwarded from the pinned live base. Evidence: /Users/dabombstudio/.instar/agents/echo/.instar/lanes/topic-workers-1015-PROGRESS.md. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-47-PROGRESS.md
Decision: train-47-merge-design | Ordinary merge of exact reviewed design-q-1015 8f37fb67205ec0a49351d8251c66f983ae42561f. Evidence: /Users/dabombstudio/.instar/agents/echo/.instar/lanes/design-q-1015-PROGRESS.md. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-47-PROGRESS.md
Decision: train-47-A | Keep both member source behaviors; journal-agent auto-merges both capacity sampling and physical path guards. Generated conflicts are resolved by regeneration, never manual content synthesis. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-47-PROGRESS.md
Decision: train-47-B | Preserve exact live-base ancestry dcf3a5160cb92ede56f70f8b1048f27b2d6e5ef5 and only the two named reviewed heads; no main or other train merge. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-47-PROGRESS.md
Decision: train-47-C | No genuine product conflict and no omitted head. The certificate conflict is evidence bound to different compositions, not a product behavior conflict. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-47-PROGRESS.md
Decision: train-47-D | Run portable direct-consumer and recorded-shape checks on WSL; retain host-dependent failures for the Studio gate under the explicit remote-host allowance. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-47-PROGRESS.md
Decision: train-47-certificate | Retain the exact live-base native certificate while composing both changes; neither branch certificate covers the union. Report the permitted R105 mismatch and require the desk-owned native macOS contract; never manufacture a new declaration. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-47-PROGRESS.md
Decision: train-47-desk | Use downloaded desk repin/build/rehash/register replay tools. Zero inventory or owner pins changed. Temporarily retained generated HEAD files to finish the ordinary merge, then regenerate every publication file from the committed combined source. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-47-PROGRESS.md

Skip: tests/preview/agent-paths.test.ts:54 | scope=Permission-denial proof requires a non-root identity; root can traverse mode-000 directories.
Skip: tests/preview/agent-paths.test.ts:71 | scope=Actual macOS command wiring; platform-independent helper and Linux no-op are tested without this skip.
Skip: tests/preview/agent-paths.test.ts:78 | scope=Actual macOS misplaced-root emergency-stop command; no TCC guard exists on Linux.
Skip: tests/preview/agent-paths.test.ts:85 | scope=Actual macOS install and boot refusal; Linux no-op has its own positive test.
Skip: tests/preview/agent-paths.test.ts:104 | scope=Actual macOS physical storage/session/volume boundaries; Linux has no TCC restriction.

simplestRobustRoute: This is the simplest robust route: two ordinary exact-head merges, existing desk generation and direct consumer verification. No new runtime machinery or policy. Existing admission, resource, stop, durable intake and uniqueness owners hold the floors. The start is the pinned live base, the end is a pushed checked composition; the desk owns native certification and live acceptance.
80/20: Check changed tests and direct consumers in bounded foreground chunks; no full suite or unrelated fixes.
VERDICT: author submission; no independent convergence or deployment claim
