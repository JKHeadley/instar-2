# Change review — Launch the installed agent from root records

Subject base: 52ead9423d978a2061f7fc32e8d53e0befc32960
Review state: open
Reviewed content: none
Outcome: instar2 run starts the existing runner using root configuration, the user's root model setting and the installed login inventory, without a desk-generated command line.
Affected rules: 2, 4, 5, 26, 34, 42, 44, 49, 74, 95, 100, 102, 113, 116; purpose constraints 2, 3, 6.
Affected floors: secrets — record contents and caught errors are not printed; existing custody stays authoritative; spend cap — finite limits plus unchanged runner admission; stop — same-process runner receives signals and retains durable stop checks; no duplicate sends — same runner ownership and effect doorway; durable intake — same journal/intake path, with no launcher writes.
Operator questions: none
Suggested tier: significant
Declared tier: significant
Tier rationale: New product launch surface reuses the existing runtime; it does not implement a new runtime or admission policy.
Side effects: Product launch now requires run-config.json, model-setting.json and an installed login inventory; old direct launches remain supported. Invalid configuration refuses before dispatch. Working directory changes to the installed package, as the current launcher requires.
Undo and recovery: Return to the existing journal-agent launch command or revert this additive CLI change. No installation state is written or migrated by this command. Preserve records on refusal.
Multi-machine posture: Machine-local launch configuration and custody paths; existing runner owns replication, leases and single-send claims. No added peer dependency.
Layer below: Read journal-agent main, installedHarnessLaunch and its preparation path, original runner-group-run.sh, model-setting.py and assembly milestone 4. The same entry retains custody, authority, stop, caps and journal enforcement. An offline subprocess reaches its real custody refusal; a loader observation proves argv, package cwd and exit propagation.
Bug class: none
Bug evidence: none
Hook bypass: none
Convergence: none
Decision: update-b-records | Use a versioned root run-config for non-secret launch configuration and the existing login inventory for activation references; missing records refuse rather than invent authority. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/update-b-1021-PROGRESS.md
Decision: update-b-entry | Import the existing runner in the CLI process, preserving signal and exit handling without a second process or restart loop. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/update-b-1021-PROGRESS.md
Decision: update-b-model | Read only the root model-setting.json using the existing reader's schema; keep preparation and model/authority compatibility with the current runtime. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/update-b-1021-PROGRESS.md
Decision: update-b-migration | Do not mutate installed files or live launchers; configuration population and live cutover remain the explicitly sequenced update-path units C and E owned by the desk. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/update-b-1021-PROGRESS.md

Subject (4 paths): bin/instar2.mjs, docs/product-run.md, scripts/product-run.mjs, tests/preview/product-run.test.ts

## Closing block

simplestRobustRoute: Translate a bounded versioned root configuration and existing inventory into the current runner argv, then call that same entry. This is the simplest robust route: the only added machinery is record validation to prevent an absent or malformed installation silently running on legacy defaults. No new supervisor, provider, restart mechanism or authority is introduced. Start guard is complete records followed by existing runtime admission; end is the existing bounded runner exit; limits remain its durable caps, stop and ownership. No unattended live-exchange completion is claimed; the desk's copy proof and cutover are separate plan units.
80/20: Exact launcher-argv parity, malformed/missing records, model source, pool inventory, optional tools/sessions, CLI dispatch/exit, and real custody refusal cover this unit. Tests first failed because the implementation did not exist; targeted tests then passed. No prompt, parser or accept/escalate/refuse model-judgment path changes, so recorded model-output replays are not applicable.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
