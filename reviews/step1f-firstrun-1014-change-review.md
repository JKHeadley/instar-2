# Change review — unattended first run of a native worker

Subject base: 99b8a3272b853049aa6d9c4b395d61d949f79ed1
Review state: open
Reviewed content: none
Outcome: A freshly installed descriptor-login profile starts interactively without native theme, login, workspace trust or permission-mode menus; a visible startup menu refuses input with its specific startup-menu diagnosis.
Affected rules: Rules 1, 4, 5, 26, 28, 29, 30, 34, 35, 36, 37, 42, 44, 46, 49, 57, 62, 74, 95, 100, 101, 111, 113, 115, 116.
Affected floors: Secrets stay in runner custody and descriptor hand-off; bootstrap writes no login. Existing spend, stop, admission, no duplicate sends and durable-intake paths remain in force.
Operator questions: none
Suggested tier: significant
Declared tier: significant
Tier rationale: Changes native worker startup and exact terminal-menu recognition, with real proof-room acceptance required.
Side effects: Installation seeds nonsecret native first-run preferences. Interactive launch upgrades older profiles after custody validation and marks only its exact admitted real workspace trusted. The current permission-mode acknowledgement is merged into settings.json. Existing theme, account metadata, hooks and other projects are preserved. The clean PATH includes /usr/local/bin so the installed lifecycle-hook interpreter resolves. Malformed native state or a symlink refuses without overwriting it. Atomic publication prevents a partial config; repeated preparation performs no write. No arbitrary menu key is sent.
Undo and recovery: Revert the code to restore prior startup behavior. Retain native config and durable conversation evidence. The desk retains the proof profile's original config backup; restoring it is an offline profile operation, never a live credential or conversation rollback.
Multi-machine posture: Deliberately machine-local native preferences and workspace paths, seeded for each local profile. No new store or credential transfer. Existing ownership fences still determine which machine may launch a worker.
Layer below: Inspected 1.x ensureInteractiveReady and its migration; descriptor custody and harness-session terminal hand-off; setupHarnessArea ACL inheritance; the native 2.1.280 theme preview, workspace trust and permission-mode panes plus its bundled migration source; the driver's readiness-before-delivery ordering and its synchronous IO contract.
Bug class: live-path
Bug evidence: reproducer=tests/assembly/production-session-driver.test.ts; live=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/step1f-firstrun-1014-records/proof4/proof-verdict.json
Hook bypass: none; core.hooksPath is unset and the common hooks directory contains sample hooks only.
Convergence: none
Prompt review: No model prompt, answer parser, summary/Jev/reply-review contract or acceptance policy changes. Real native terminal bytes are replayed instead of inventing a screen; live proof records include the unchanged model/review/reply path.
Decision: step1f-profile | Port the small 1.x bootstrap into the existing Claude adapter and use it at installation and existing-profile interactive launch. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/step1f-firstrun-1014-PROGRESS.md
Decision: step1f-trust | Native workspace trust names only the real working directory already admitted by Instar. Global onboarding alone failed on the actual mounted workspace. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/step1f-firstrun-1014-PROGRESS.md
Decision: step1f-node | Include the standard /usr/local/bin in the clean launch PATH: the actual Studio worker completed tools but its Stop hook could not resolve node without it. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/step1f-firstrun-1014-PROGRESS.md
Decision: step1f-ack | Leave the existing acknowledgement delay tracked in brief item 4: synchronous NativeHarnessDriverPort.launch and SessionIO.sleep require an async lifecycle change beyond this startup repair. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/step1f-firstrun-1014-PROGRESS.md

simplestRobustRoute: This is the simplest robust route: seed native local preferences using the proven 1.x approach, reuse descriptor login, and repair the existing bounded pane classifier. Native per-workspace trust is necessary because a real proof cleared onboarding but then stopped at the mounted workspace's trust screen. The start guards remain custody, activation, ownership and existing admission; the end-state proof requires two tool-bearing inputs and correlated outcomes on one physical identity. Menu detection never establishes authority or completion. Stop, spend and uncertain-effect retention remain mandatory. Unattended shipped-path evidence is recorded in the absolute lanes progress record.
80/20: Targeted bootstrap, custody, startup, lifecycle and harness-contract checks; recorded native panes; two-input proof-room acceptance; final lint, register and pinned-text gates. No full suite or deliberate load.
VERDICT: author submission for desk review; no independent convergence or full walk acceptance claimed
