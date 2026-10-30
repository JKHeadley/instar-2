# Change review — no-count-impl-1030 candidate

Subject base: f2798733d43ee4460aac33c40e2f9364a0e52d04
Review state: open
Reviewed content: none
Outcome: Prepare a separately authorized per-dispatch tool-answer policy for Claude and Codex. The candidate removes the per-answer model-request ceiling, retains the installation allowance, durably charges each subsequent request before dispatch, and requires a live finite deadline. Existing policies and grants retain their meaning. No approval, activation, deployment or live success is claimed.
Affected rules: 1, 4, 18, 26, 30, 34, 36, 42, 49, 55, 60, 74, 75, 82, 90, 98, 101, 102, 103, 104, 111, 113, 114, 116
Affected floors: secrets — existing identity, custody, hook and shell checks retained; spend cap — existing subscription-only activation and installation resource allowance retained with durable per-request charging; stop — checked at admission and again after reservation; no duplicate sends — unchanged effect owner; durable intake — unchanged, with additional durable dispatch records
Operator questions: the independent P-02 approval for this successor remains outstanding; this implementation creates no grant.
Suggested tier: critical
Declared tier: critical
Tier rationale: changes model dispatch admission and adds a successor authorization class.
Side effects: adds an explicit --tools-requests per-dispatch candidate selection, two successor provider framings, and a tool-turn call-reserved journal phase. Old code cannot replay the new phase from raw journal frames; do not roll an exercised candidate root back to an older reader. Unknown provider billing stays unknown, and the CLI dollar flag remains only its existing backstop.
Undo and recovery: omit the candidate selector to retain the historical policies. For an exercised candidate, retain its journal and use a compatible reader; do not erase dispatch records or re-run uncertain effects. Revert code only on roots that never exercised the candidate.
Multi-machine posture: machine-local dispatch claims and existing single-writer encrypted journal; existing conversation ownership and effect admission remain authoritative. No shared store or new coordination service.
Layer below: production-provider.ts and production-codex-provider.ts effective launch policies; modelGateLaunch endpoint wiring; admission-gate.mjs forwarding; journal.ts append/projection and root allowance; tool-turn.mjs reservation and effect lifecycle; activation-authority.ts class resolution.
Bug class: none
Bug evidence: none
Hook bypass: none
Convergence: none
Decision: no-count-successor | use a new class and framings selected explicitly; never reinterpret an old full-tools grant | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/no-count-impl-1030-PROGRESS.md
Decision: no-count-accounting | retain the installation-wide allowance and charge durably at the existing dispatch checkpoint instead of reserving eight requests per answer | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/no-count-impl-1030-PROGRESS.md
Decision: no-count-deadline | require a finite deadline and synchronous exact reservation receipt in count-free claims, refusing before forwarding when either is unavailable | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/no-count-impl-1030-PROGRESS.md
Prompt review: candidate prompts remove the obsolete model-request count wording; output envelopes and existing output/token resource limits remain unchanged. The Codex candidate replays recorded summary-writer, summary-uncertain, Jev undecided/unsure, reply-review, delivered and empty reply bytes from retrospective-duty-followup-train-1-2026-10-08.json through the new framing. Provenance ids: summary:715672480, 715672483, 715672482, 969389570, 969389923, telegram:8994258214:update:715672479, telegram:8994258214:update:715672550. Provider request methods/paths come from model-gate-requests-2026-10-03.json. These are offline replays, not a fresh live model result.

## Closing block

simplestRobustRoute: reuse the existing HTTP checkpoint, durable journal and authority resolver. Replace only the per-answer preallocation with per-dispatch reservations, keeping independent resource and time ceilings. A callback without a committed receipt would permit unaccounted requests, and removing Claude's max-turns flag without routing its model calls through this checkpoint would bypass resource admission. No new service or authority issuer is introduced. Independent approval and a 5/5 real-task copy score are activation prerequisites owned by the desk.
80/20: author submission; independent review pending.
VERDICT: author submission; not an independent approval
