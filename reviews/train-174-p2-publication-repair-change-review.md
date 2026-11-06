# Change review — native renewal publication authentication

Subject base: 77fe546a2301efe11c2381e169f50be9368e2823
Review state: open
Reviewed content: none
Outcome: Publish the already-completed native Darwin renewal and repair its installed desk publication caller to use the existing same-role child credential helper.
Affected rules: 18, 23, 26, 34, 37, 42, 49, 70, 74, 95, 101, 111, 112, 113, 116.
Affected floors: secrets stay in the existing vault and child environment; spend cap, stop, no duplicate sends and durable intake retain their existing enforcement.
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: this recovery includes the exact native conformance certificate and its generated publication, as well as the desk infrastructure repair. Executable product behavior and authority are unchanged.
Side effects: the installed pipeline driver invokes builder-child-env.py --require-git-auth for its renewal push and remote-SHA read. Other build and contract subprocesses keep their existing environment. No credential store, global Git configuration, hook or account changes.
Undo and recovery: restore driver.py.bak-train-174-p2-auth-1105 under the absolute desk pipeline directory to undo the caller edit. Failed publication retains the scratch commits and evidence. Do not restore an older native certificate against the new composition.
Multi-machine posture: credential resolution is local to Studio's existing Echo role; published Git objects are shared, credentials are never transferred. This does not change the distinct remote-host Git403 recovery policy.
Layer below: inspected the real renew_native_conformance function, installed builder-child-env.py, normal Git helper behavior tests, exact renewal log, scratch commit ancestry and existing-role guidance. The driver executes one step per invocation, so the installed edit is loaded on subsequent invocations without a runner restart.
Bug class: none
Bug evidence: desk publication repair, with four focused caller regressions, eight existing helper tests and a negative control against the backed-up caller. The recorded native renewal passed 10/10 before its Git push failed. Exact evidence and final publication verification are recorded in /Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-174-p2-repair-PROGRESS.md.
Hook bypass: none
Convergence: none
Deferral: generated/register.json:1 | not-a-deferral=mechanically replayed register descriptions introduce no deferred work

## 1.x comparison and recovery

Searched actual JKHeadley/instar origin/main at cc11e45f92e2590dd1bbd3c3facb5b849532f0fc in src/ and docs/specs/ for GH_TOKEN, github_token and credential.helper, and inspected git history of src/core/githubRuntime.ts and src/core/ghToken.ts (ab26b7ca3). Read both sources and docs/specs/throughput-github-runtime-repair.md. The behavior reused is explicit agent identity in a child environment, which the installed builder-child-env.py already implements. ONEX-LESSONS.md line 115, session-boot-self-knowledge, supplies the matching lesson: retrieve existing vault credentials without exposing values or asking the user again. The TypeScript runtime and cache do not fit this Python desk caller; its old optional machine-global fallback is also inappropriate for publication. The existing helper instead refuses required publication when the same-role vault is unavailable.

The named renewal evidence at /Users/dabombstudio/.instar/agents/echo/.instar/lanes/par-qual/native-train-174-p2-5gv31_h2/renewal.log records native before 9/10 (only a stale certificate), after 10/10, and completed commits fad1d48ef16303650b2c9dcb2ff3ba84321b6be6 through 5b64f2e74105f944f9db93f34163263efbc549d3. Fast-forwarding those commits preserves the real certificate and register replay; no declaration was hand-edited and no saved full-run report was used. This repair changes no prompt, model-output parser or acceptance judgment.

Desk source: /Users/dabombstudio/.instar/agents/echo/.instar/lanes/pipeline/driver.py. Focused regression: /Users/dabombstudio/.instar/agents/echo/.instar/lanes/pipeline/test-native-publication-auth-1105.py. These stay outside Git by the builder charter. Their hashes and backup names belong to the final desk progress record.

## Closing block

simplestRobustRoute: reuse the existing same-role vault helper at the two remote Git calls and preserve the completed renewal commits. This is the simplest robust route: no new credential mechanism, grant, global configuration or retry loop. Unavailable credentials or a refused push cannot advance the candidate; a mismatched remote head also refuses. Actual publication and exact remote-SHA verification are the completion evidence, not repository permission metadata alone.
80/20: four focused caller cases and eight helper tests cover success, unavailable vault, Git refusal and remote movement; the backed-up driver fails the positive regression. TypeScript and cheap gates run on the final commit. The pipeline owns the full suite and independent review.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
