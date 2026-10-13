# Change review — refresh login pool source register

Subject base: 3fe610cfe09f14e9ada0450af70ff6bc8553ae5d
Review state: open
Reviewed content: none
Outcome: The generated register consumes the committed pooled-login secret-source repair, so the existing source-wiring checker can inspect the shipped launcher.
Affected rules: 1, 26, 37, 49, 69, 74, 90, 101, 102, 111, 113, 116
Affected floors: secrets — existing isolated custody readers unchanged; spend cap — unchanged; stop — unchanged; no duplicate sends — unchanged; durable intake — unchanged.
Operator questions: none
Suggested tier: critical
Declared tier: routine
Tier rationale: Generated evidence refresh only; no source, declaration, policy, entry population or runtime behavior changes.
Side effects: Seven generated views advance their source commit and generation digest together. The checker inspects the previously committed launcher repair instead of its predecessor.
Undo and recovery: Revert this generated refresh to reproduce the stale-source refusal. Regenerate with the existing build-register replay command to recover; no durable runtime state changes.
Multi-machine posture: Repository evidence shared through git. Each host checks the same pinned source commit; no machine credentials or runtime state cross hosts.
Layer below: Read the constitution, identical to origin/main, and inspected check-register-wiring's comparison between live source bytes and the register commit. Reproduced the exact journal-agent source-pin failure. Both delegated desk repin tools produced zero content changes; only the register source commit was stale.
Bug class: none
Bug evidence: none
Hook bypass: none; core.hooksPath unset and the common hooks directory contains sample files only. Plain git commit; no stash.
Convergence: none
Decision: LPD-003424-register-replay | Regenerate existing views against 3fe610cfe09f14e9ada0450af70ff6bc8553ae5d; retain the minimal per-source custody repair and add no runtime mechanism. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/sb-login-pool-default-1012-repair-003424-PROGRESS.md
Deferral: generated/register.json:1 | not-a-deferral=Unchanged historical register text serialized by the existing generator, not a new commitment or postponement.

simplestRobustRoute: Replay the existing register generator against the repaired source commit. This is the simplest route: no manual pins or new machinery. The source-wiring equality check is the start and end guard; runtime safety and resource guards remain unchanged. No autonomous runtime completion claim.
80/20: Repair only the demonstrated stale evidence, check the generated consumer and bounded portable tests, and hand the existing runtime implementation back to the Studio gate.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
