# Change review — physical admission headroom repair

Subject base: c48251e8935674d0645559181ba70e8f01d140bd
Review state: open
Reviewed content: none
Outcome: A physical lease wait or retry cannot launch a topic worker on stale headroom; denied work retains its durable intake and liability and drains when capacity returns.
Affected rules: 1, 4, 5, 26, 34, 37, 42, 46, 49, 60, 63, 70, 74, 75, 101, 102, 111, 113, 114, 115, 116.
Affected floors: secrets — custody/filtering unchanged; spend cap — shared liability and per-call charging unchanged; stop — consumer guards still surround admission and dispatch; no duplicate sends — denial dispatches nothing and restoration drains once; durable intake — exact request and digest remain queued.
Operator questions: none
Suggested tier: significant
Declared tier: critical
Tier rationale: Repair the demonstrated physical resource admission race using the existing queue and resource lease.
Side effects: Capacity sampling now follows physical lease acquisition and its single retry, so a denied worker briefly holds a lease then verifies release. The finally block also releases on a failed measurement or reclamation, preventing an unowned lease after moving sampling. Healthy resident turns retain context. No prompts, parsers, tools, grants, ceilings or native declarations change. Generated publication is replayed against the source commit.
Undo and recovery: Revert this repair and replay generated publication; keep existing queues and liability. Reversion reopens the demonstrated stale-headroom race. No data migration or new state is introduced.
Multi-machine posture: Deliberately machine-local physical headroom and lease under the existing conversation ownership fence. Cross-machine authority, cancellation, liability and result routing remain unchanged.
Layer below: Inspected production-conversation-session null-lease handling, durable reservation and queued input, guards after admission, claim preparation and worker launch; physical resource owner waiting and release; existing topic idle reclamation and active worker tracking.
Bug class: unit
Bug evidence: reproducer=tests/assembly/conversation-topics.test.ts
Hook bypass: none; core.hooksPath unset and common hooks directory contains sample hooks only.
Convergence: none
Prompt review: No prompt, parser or semantic verdict changes. Seven existing real recorded shapes replay denial then restored-capacity dispatch with their exact bytes retained; the unchanged reviewer physical-wait pair fails before repair and passes afterward.
Decision: topic-workers-1015-physical-wait | Move decisive headroom sampling after physical lease acquisition/retry and verify release on refusal or failed measurement, reusing existing durable queue and reclamation. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/topic-workers-1015-repair-124723-PROGRESS.md

Publication: Replayed generated register and source wiring against 895203358006d3844e090a256512fd8d96de4e57 using build-register; delegated owner-manifest rehash and grounding repin found zero stale pins.

simplestRobustRoute: This is the simplest robust route: move the existing measurement past the demonstrated wait, release unused leases through their existing port, and retain the existing queued outcome. No scheduler or protocol is added. Start guards remain authority, stop, capacity and shared reservation; end evidence remains correlated closed turns; lifetime, calls and physical ceilings remain. Evidence is targeted offline regression, not a live-readiness or unattended installation claim.
80/20: Repair the one must-fix with its healthy and restored-capacity neighbors, first-admission and retry paths, and unreadable-sample cleanup. Studio owns combined full-suite and live acceptance; this record claims no independent convergence.
VERDICT: author submission; no independent convergence asserted
