# Change review — restore 1.x task affordances to the operator worker

Subject base: 9eb45d51c82114916701ad8d0f30c7961fa6a834
Review state: open
Reviewed content: none
Review reopening: The register-link-holders-carryover-1103 publication changes this review's generated-register subject. The old frozen digest no longer covers the current bytes; its round is void and the desk must independently review the current publication. No worker-permission or credential behavior is changed by this reopening.
Review note: reopened by connected-browser-owner-impl-1103 because its descendant changes the shared admission, connector and worker support files; the earlier code-review evidence below applies to its original source, not this owner-browser change. the 18:53 independent review found that the handed GitHub token was not in the runner's held-secret set. Successor 6f8bc9bd3 caches and registers the exact token before launch and binds the bridge handoff to its SHA-256. Astra re-reviewed 80442a615 and returned GO for code; full gate and live publication are still pending. The worker-owned TMPDIR remains the supported temporary path; hardcoded /tmp paths inherit a restrictive ACL.
Outcome: Give a separately identified operator work session ordinary local port, system temporary directory, file, network, and GitHub push/PR access. Hand the existing Echo GitHub vault token to the worker at launch through the owner-side bridge. Correct seven obsolete limit assertions and the slow renewal test timeout.
Affected rules: 1, 12, 27, 37, 48, 49, 60, 65, 70, 71, 74, 75, 101, 102, 105, 109, 111, 113, 114, 115, 116
Affected floors: secrets — only the existing github_token vault entry is handed to the separate worker by stdin and is absent from process arguments; spend cap — the journal call charge and spending gate remain; stop — the four-hour deadline and host-wide resource owner remain; no duplicate sends — the Telegram delivery journal remains; durable intake — queued input and the saved working copy remain.
Operator questions: none; Echo's 18:05 PST instruction explicitly authorizes the 1.x GitHub credential and the port, temp, and publication parity repair.
Suggested tier: critical
Declared tier: critical
Tier rationale: the worker receives the GitHub credential and ordinary outbound network and file access for operator work. A live installation affects Justin's agent.
Side effects: an admitted operator work session runs shell commands without the narrower task sandbox, can bind local ports and use OS-accessible paths, and receives GH_TOKEN in its own process environment. The OS user boundary, model spending charge, deadline, and host-wide resource controls remain. Non-operator work retains the existing sandbox. Generated register and owner fixture pins are refreshed.
Undo and recovery: retain the prior frozen build and switch back through the controlled switch if the real group check fails. The worker's saved #2190 checkout and the journal survive a switch.
Multi-machine posture: this candidate changes the Studio's installed operator worker after release gates; Mama build slots and other hosts do not inherit it until they install the source.
Layer below: separate OS identity, stdin secret handoff, session admission, tool hook, model spending gate, host resource owner, GitHub CLI, and Telegram conversation journal.
Bug class: unit
Bug evidence: reproducer=tests/preview/session-admission.test.ts; other=tests/preview/harness-user.test.ts
Hook bypass: none
Convergence: none
Prompt review: no task instruction was added; the code changes are host-side launch and admission policy, and fixture text is protocol data.
Deferral: generated/register.json:1 | not-a-deferral=the generated register describes the exact committed source and does not defer an implementation task

Verification: six focused files passed 198/198; successor secret and harness tests passed 55/55 and native contract passed 10/10. Typecheck, build, lint and register check passed. Independent Astra code review of 80442a615 returned GO after the held-secret repair. The full exact-head suite, controlled installation, and worker-opened #2190 PR remain to be observed.
Residue: full-gate | high | exact-head full suite must pass before live installation.
Residue: live-publication | high | the real agent must resume its saved #2190 checkout, commit only its #2190 fix, and open its own PR.

## Closing block

simplestRobustRoute: retain the separate worker identity and host limits, and provide the ordinary operator task abilities at the tool and credential handoff.
80/20: focused tests prove the specific permissions and secret delivery; the decisive outcome is a live worker publication from its saved checkout.
VERDICT: author submission; this record asserts no independent verdict.
