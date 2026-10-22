# signin-port-1022d change review

Subject base: 887d7b5095d5daea134da146e0446e8a35c18ece
Review state: open
Reviewed content: none
Affected rules: 1, 4, 26, 28, 34, 35, 36, 42, 43, 49, 55, 60, 62, 70, 74, 76, 79, 95, 98, 100, 101, 111, 112, 113, 116.
Affected floors: secrets — private code handoff and scoped Keychain; spend cap — no unbounded calls; stop — owned CLI/browser cleanup; no duplicate sends — no message replay; durable intake — preparation and custody retained.
Operator questions: none
Suggested tier: critical
Declared tier: significant
Tier rationale: Native sign-in adapter integration; generated register refresh raises the computed tier but changes no authority. Real provider verification remains required for acceptance.
Bug class: user-facing
Outcome: complete the inherited focus fix through native credential custody and an authenticated call, preserving the original serving login.
Constitution: Rules 1/4/26/28/34/35/36/42/43/49/55/60/62/70/74/76/79/95/98/100/101/111/112/113/116; purpose's secrets, spend, stop, durable intake, effect uniqueness and truthful-completion floors.
Scope: native browser startup, callback paste-back and OS Keychain discovery. No model prompt, model-output parser, approval authority, train timing or pool selection change.


Layer below: Read 1.x origin/main PlainChromeReloginBrowser.ts (PID-addressed CrSu/ExJa/JvSc transport), SubscriptionReloginOrchestrator.ts (identity then authenticated use), ChromeCdpReloginBrowser.ts readPasteCode (offered-page code read), ClaudePasteBackController.ts (readiness before memory-only paste), and FrameworkLoginDriver.ts enrollmentIsolationEnv (isolate CLAUDE_CONFIG_DIR, retain the OS home). Ported only those small behaviors. The actual callback now uses p.select-all.text-code; the old 1.x code/pre selector did not cover the recorded page. The new reader checks callback origin/path, heading/instruction, one code element, bounded code syntax, exact OAuth state and stop.

Bug evidence: reproducer=tests/preview/signin-io.test.ts; live=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/signin-port-1022d-PROGRESS.md

Recorded bug: Real startup saw /bin/ps exit 1 while Chrome replaced a stale SingletonLock. A failing regression preceded its fix; read-only startup retries retain the existing 60-observation ceiling. The next live run reached ready → focused → clicked, then platform.claude.com/oauth/code/callback while native CLI still awaited the paste code. The recorded, redacted callback fixture precedes the new reader test. After code handoff, native login reported it could not save to Keychain. The security tool independently found the default Keychain under the OS HOME and no default Keychain under scratch HOME; failing native-environment assertions preceded the fix.

Side effects: Native auth now uses the OS user's Keychain discovery, but its credential service remains scoped to the fresh config-directory digest. Login stays in the private scratch directory. The only browser writes remain the single navigation, authorized focus event and one offered Authorize click. The callback read is passive. No code or credential enters argv, fixture, log or report. No production account mapping changes.
Start/end/limit guards: Existing executable hash and realpath, private staging, dedicated browser binding and live-lock refusal remain. Startup observes only until blank, stops on a changed process or occupied tab, and never retries uncertain navigation. Callback polling is capped at 30 reads inside the existing ten-minute abortable native lifetime. Paste requires the native prompt, writable stdin and no stop; failed stdin terminates the owned CLI. Native exit alone still cannot publish a credential: independent provider identity and use checks remain.
Undo and recovery: Revert this change to restore the inherited incomplete native path; no schema migration. Never delete or revoke an existing login. An interrupted repair retains the existing receipt/re-observation behavior. Cleanup removes only the proof's config homes and their exact hashed Keychain services, and signals only recorded owned PIDs.
Multi-machine posture: Deliberately machine-local Chrome and Keychain. No credentials or profile copies cross machines. A second login for the same account is isolated in a new config home; the pre-existing serving credential was independently verified afterward.

Validation: Targeted foreground tests replay inherited consent/native terminal captures plus the actual callback observed at 2026-10-22T21:44:33.777Z (native PID 44601, Chrome PID 44615; authentication code removed). Both sides cover startup readiness, occupied/wrong process, unknown navigation, bounded polling, callback origin/path/state/shape, missing prompt, pipe failure and stop. Fake waits replace load tests. No model-facing change, so summary/Jev/reply model replay is not applicable.
Live evidence: Fresh scratch PV26CE native PID 22361 completed auth login through shipped functions; the live provider confirmed justin@sagemindai.io and quota use. A tools-disabled Haiku call with $0.25 cap returned exact SCRATCH_SIGNIN_OK, exit 0, recorded cost $0.00089229. Scratch config and exact Keychain entry removed. Original serving credential still matched the provider identity. No operator phone approval is claimed: the available service points to the serving config, not scratch custody.
Hook bypass: none.
Convergence: none
Submission: author submission only; no independent convergence claim.
Decision: signin-native-completion | Preserve the inherited focus repair and port the three measured missing native steps instead of writing a second sign-in controller. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/signin-port-1022d-repair-150351-PROGRESS.md
Decision: signin-phone-proof | Do not repoint the live serving account, introduce a proof identity into its stores, or approve as the operator. Resolve a scratch-bound real surface and operator tap before claiming phone completion. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/signin-port-1022d-repair-150351-PROGRESS.md
simplestRobustRoute: Keep the existing native CLI and PID-addressed normal Chrome. Wait for a scriptable blank tab, execute the inherited account/state-bound main-world focus step, read the offered callback code for that state, and write it once to this CLI's waiting stdin. Retain the OS HOME while isolating CLAUDE_CONFIG_DIR so native Keychain storage works. Each addition repairs an observed live failure; no browser framework, new approval server, scheduler or credential store is introduced.
80/20: The original native proof is retained as recorded evidence; the phone acceptance finding remains open. The subsequent cleanup repair is described in signin-port-1022d-cleanup-change-review.md.
VERDICT: native proof recorded; phone acceptance remains open
