# Change review — native connection retry exhaustion

Subject base: 17dfeb44673820f6196086e9f62f7b12ccc56a14
Review state: open
Reviewed content: none
Outcome: preserve native same-turn backoff, then settle a captured exhausted connection failure through the existing conversation owner instead of leaving accepted work open until its four-hour deadline.
Affected rules: 4, 8, 26, 28, 29, 34, 36, 42, 46, 49, 55, 60, 61, 62, 63, 68, 70, 74, 75, 83, 101, 107, 111, 113, 116
Affected floors: secrets — no new credential access or outbound field; spend cap — all native retries still consume the existing durable pre-dispatch reservation; stop — existing identity, stop and deadline checks precede recognition; no duplicate sends — no additional owner input, recovery nudge or tool action; durable intake — original input and uncertain result remain in owner custody.
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: changes native terminal failure parsing and its delivery to the existing owner.
Side effects: the exact captured exhausted 529 now retires the owned worker sooner. Native countdowns, unknown footers, stale and quoted errors remain advisory; a current-turn native countdown is required. A genuine correlated Stop still wins. Unknown failure shapes retain the existing deadline and are not claimed fixed.
Undo and recovery: revert the driver change to restore prior observation behavior. Existing journal readers ignore the optional connectionRetry field. No authority, store format version or replay policy changes; no lost request and no automatic repeat of uncertain effects.
Multi-machine posture: only the current conversation owner observes and retires its exact worker. Retry evidence is machine-local physical state in the existing session journal; cumulative liability and unresolved intake remain in the owner store. No ownership transfer or remote actuation is added.
Layer below: checked admission-gate request dispatch, durable reserveCall, turn deadline watchdog, exact tmux identity verification, authenticated Stop receipts, adapter pause mapping and owner retirement/uncertain-result custody. The captured native client already owns bounded backoff; another nudge loop would duplicate recovery and risk uncertain actions.
Bug class: integration
Bug evidence: reproducer=tests/assembly/socket-drop-replay.test.ts
Hook bypass: none
Convergence: none
Decision: socket-native-retry | preserve the captured native retry loop and durable owner budget; recognize only its quiet exhausted terminal state with current-turn retry evidence | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/socketdrop-1016b-PROGRESS.md
Prompt review: parser-facing, no model prompt changed. Real native capture updates 1016101 and 1016102 are replayed through driver, public adapter and owner. Recorded summary-writer 715672480, uncertain summary 715672483, Jev undecided 715672482, Jev unsure 969389570, reply-review 969389923, delivered reply 715672479 and empty candidate 715672550 pass the same retry/close boundary without rewriting their contents. Empty candidates remain uncertain. Fixture provenance identifies the source journals; fixture metadata does not claim the empty candidate was delivered.

simplestRobustRoute: this is the simplest route: use the already bounded native backoff and existing durable admission budget, and repair only the missing terminal-exhaustion observation. Current-turn retry evidence prevents a quoted error from retiring a worker; exact identity, stop, original deadline and correlated completion remain the guards. No second retry engine, watcher, store, prompt or model call is introduced. Full unattended post-change evidence is recorded in the desk progress artifact.
80/20: repair the observed missing-close case and verify its nearest safety neighbours; preserve context-wall and throttle recovery for their separately assigned owners.
VERDICT: author submission; no independent convergence claim

Live proof correction: update 1016104 reached uncertain owner retirement, then exposed a second defect on this unit's required surface: memory acknowledgement displaced the unknown-answer notice and a real reply revision replaced it with “You prefer tea to coffee.” The fixture preserves the actual review, revision and send. The repair gives the existing typed notice precedence, routes its exact fixed text through the existing content-free report branch after the secret check, prevents an old review candidate from replacing it, and forbids revising it into an answer. Rules 42 and 89 require uncertainty and infrastructure provenance to survive this layer; Rule 4 permits the exact durable-state report. Decorated notices retain review and all send guards. Context recovery's disclosure work meets this change at the final reply assembly in journal.ts; no context evidence or disclosure predicate is edited. No other owning commit for this newly observed failure was named in the brief.

Final unattended evidence: isolated loopback update 1016105 exhausted 12 admitted requests with no Stop receipt, retained the input as uncertain, retired its exact worker and sent UNKNOWN_ANSWER_NOTICE exactly once. Update 1016106 recovered one injected 529 natively, used three admitted calls, wrote {reply:{answer:"51"}}, emitted its Stop receipt, and delivered “51” once (with the existing route-verification status note). The fixture's proofs section records both final paths. Every recorded proof worker was subsequently verified absent by exact tmux identity. All controllers exited 0 after their recorded exact runner PID received SIGTERM; no unrequested SIGKILL occurred.

Studio conformance renewal (Rules 26, 49, 69, 105, 115, 116): the READY gate rejected the inherited native certificate after the composition changed. Ran the desk merge-live-conformance.mjs --renew workflow on the declared Node 24.14.1 runtime. Before renewal, the native contract passed 9/10 cases with only the stale-certificate assertion failing; after renewal all 10 passed. The supported declaration now binds the complete 267-file composition to sha256:bbe86893acffcbf1e2c4e7db03dc5a40179c578ab36cd8fae67b0a77ee1f2573. Evidence: /Users/dabombstudio/.instar/agents/echo/.instar/lanes/socketdrop-1016b-evidence/gate-repair/native/{before,after}.json. No support downgrade or enforcement relaxation.
