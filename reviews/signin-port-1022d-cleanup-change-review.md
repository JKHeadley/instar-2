# Change review — release the native repair's owned Chrome

Subject base: 2d6bbe8e88da31d1f369a15657526c55608c2458
Review state: open
Reviewed content: none
Outcome: Release the dedicated browser after native completion, stop or failure so a later repair can start; preserve refusal of another activity's live browser. Phone-service acceptance remains unproven and is not claimed.
Affected rules: 1, 26, 34, 36, 42, 49, 55, 60, 62, 70, 74, 79, 98, 101, 102, 111, 113, 116.
Affected floors: secrets — no new credential transport or logging; spend cap — no model or provider calls added; stop — cancels browser work and releases the owned process; no duplicate sends — no message path changed; durable intake — existing repair receipt and custody gates unchanged.
Operator questions: none
Suggested tier: significant
Declared tier: significant
Tier rationale: Native process lifecycle affects user-facing sign-in; portable lifecycle evidence is distinct from native and phone acceptance.
Side effects: Successful cleanup now closes this attempt's dedicated Chrome. TERM has a five-second grace and KILL a one-second observation bound. Both signals recheck the exact PID's Chrome main-process command and dedicated profile; unknown identity or permissions never broadens termination. Failed cleanup yields unfinished, preventing a false complete result. Supplying the existing native command test seam now permits Linux replay without running native programs.
Undo and recovery: Revert this repair to restore the earlier behavior; no schema or credential migration. An unresolved process remains visible through the existing profile lock and blocks adoption. No lock is deleted by product cleanup and no unrelated process is signalled.
Multi-machine posture: Machine-local browser PID and profile ownership, deliberately. No peer signaling, credential copying or serving-account remapping.
Layer below: Read local Instar 1.x src/core/PlainChromeReloginBrowser.ts close (TERM, five-second grace, KILL) and AnthropicReloginBrowserDriver.ts abort/finally close. Reuse that lifecycle in the small native adapter with the existing exact profile/process check before each signal. The service-bound harness branch still delegates to waitForSigninService, not this native helper.
Bug class: integration
Bug evidence: reproducer=tests/preview/signin-io.test.ts

Lifecycle evidence: Independent review reproduced first invocation complete, second invocation signin-browser-in-use with one browser launch. Added shipped-function regression performs two consecutive repairs against the same profile, with cleanup asserted after each. Recorded consent replay asserts cleanup on success, stop, native exit, browser failure, missing paste readiness and stdin failure. Startup failure also releases ownership before navigation succeeds. Negative neighbors cover another profile, helper process, PID changed before escalation, permission failure and stubborn process bounds.
Hook bypass: none
Convergence: none
Decision: signin-owned-browser-cleanup | Port the existing 1.x bounded exact-PID close into native finish, retaining ownership before startup readiness so failures also clean up; do not add a reaper. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/signin-port-1022d-repair-150351-PROGRESS.md
Decision: signin-phone-studio-evidence | Keep MUST-FIX 2 open for the desk's isolated scratch-bound service and real operator approval: this WSL builder has read-only Studio access and cannot manufacture that evidence. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/signin-port-1022d-repair-150351-PROGRESS.md

Review bookkeeping: Corrected inherited signin-port-1022c bug-class syntax and signin-port-1022d required fields/base so the earlier register and native commits are covered. Their recorded live evidence and open phone finding are preserved, never relabelled as fresh proof.

Register refresh: Replayed the register at the cleanup source commit using scripts/build-register.mjs; generated source pins now describe the changed adapter. The delegated owner-manifest and support-inventory repin tools found no changed pins.

## Closing block

simplestRobustRoute: This is the simplest route: retain the launched PID, recheck it, and run the existing bounded TERM/KILL lifecycle at native finish. The credible failure is leaked Chrome preventing the next repair. Start guards retain live-browser refusal; end guards require observed process exit; limits are bounded waits and exact-PID signals. No unattended real native or phone completion is asserted by these portable tests.
80/20: Repair the demonstrated resource leak and submit focused evidence. The separate real phone approval, service browser path, independent identity/use verification and custody promotion still require Studio acceptance; passing native simulations cannot stand in for them.
VERDICT: author submission; no independent verdict or phone-completion claim
