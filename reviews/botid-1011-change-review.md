# Change review — isolate offline journal bot identity

Subject base: cbc9247859dd05ed5e6fd28eed621deadf225e42
Review state: open
Reviewed content: none
Outcome: Offline journal-agent test launches use fixture bot 12345678 instead of the configured live bot, so tests cannot masquerade as Justin's poller during relaunch checks.
Affected rules: Rules 1/15/26/35/36/37/49/70/74/77/101/111/112/113/116.
Affected floors: secrets — synthetic credentials and substituted physical ports only; spend cap — no provider or accounting changes; stop — existing stop and lease checks retained; no duplicate sends — real competing pollers remain detected; durable intake — no journal format or retention changes.
Operator questions: none
Suggested tier: significant
Declared tier: significant
Tier rationale: Shared process fixtures feed multiple journal launchers. Exercise their direct consumers and the desk process filter while leaving recorded evidence intact.
Side effects: The successive offline world's configuration digest and conversation identity change together. Its fake getMe endpoints and startup proof expectation must agree. Refresh the canonical-text owner reference digest and generated register publications to bind the changed startup test. Archived live captures and stage-2 deployment bindings stay intact. Separate desk changes share the existing exact process parser and exclude only parsed roots below /Volumes/instar-test-ram/.
Undo and recovery: Revert this repository change and regenerate source pins. Desk scripts have .bak-285b backups and were replaced using .new plus rename. No live store or runner was altered and no data migration is required.
Multi-machine posture: Offline identity is repository-owned and identical on each test machine. Desk process scanning is deliberately local to the host whose runner is being switched; no ownership, transport or replicated state changes.
Layer below: Inspected successiveWorld configuration, synthetic token, fake getMe ports, journal cutover launch argv, host-watch journal argv, startup proof identity and stage-2 fixed deployment binding. The live-runner config selects runner-group-run.sh with bot 8820318295; test journal launchers take their bot from successiveWorld. Other real-ID matches are historical evidence or non-journal fixtures. The switch filter requires a node process, journal-agent run and exact bot argument, retaining real competing roots.
Bug class: integration
Bug evidence: reproducer=tests/preview/proofs-launcher.test.ts
Hook bypass: none; core.hooksPath unset and common hooks directory contains sample files only.
Convergence: none
Decision: offline-bot | Reuse 12345678, the existing synthetic cutover token identity, in the shared world and fake endpoints. Preserve recorded live IDs. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/botid-1011-PROGRESS.md
Prompt review: No model-facing behavior changes: no prompt, output parser, model verdict or reply text changes. Existing recorded replays remain byte-identical.
Verification: Typecheck and architecture pass. Desk bash syntax and DRY_RUN=1 switch pass. The actual shared process filter and switch wrapper exclude the four reported RAM fixture shapes while retaining both production pollers and a neighboring non-test root; other bots, status commands and non-node prompt mentions are excluded. Canonical owner-reference refresh and register generation passed for source b7d81a46. Targeted direct-consumer tests and final source-pin checks are recorded in the desk progress report.

## Closing block

simplestRobustRoute: This is the simplest robust route: replace the shared offline identity and matching fake endpoints, then use the existing exact switch parser with the observer's RAM-root exclusion. This prevents the observed false competitor outage without adding a product gate, durable state, retries or authority. Existing secret, spend, stop, send and intake guards remain unchanged. Start guards are substituted physical ports and isolated test roots; end evidence is real child-launcher tests and a side-effect-free switch dry run. No live deployment or autonomous product completion is claimed.
80/20: Correct the common fixture source and its consumers, verify both sides of the process filter, and run the required targeted and publication checks. Independent acceptance and the full suite belong to the pipeline.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
