# Signed browser native code deadline

Status: OPEN — Rule 37 quarantine, 2026-11-12.

The long `browser-profile.test.ts` real-worker CLI case passed natively in 30.99 seconds, then failed on the same product bytes at the first granted code call with `browser-code-deadline`. On pushed head `c0c49adccdf401d65d5a9e1d4c06348c4719d9b8`, the combined exit/profile/network run failed at line 232; running the profile file alone afterward passed all five cases in 21.95 seconds. The latter pass does not exonerate the failure. No deliberate load was generated, and the cause of exceeding the production ten-second code bound is not isolated.

Evidence: `/Users/dabombstudio/.instar/agents/echo/.instar/lanes/signed-in-browsing-exit-1112-r2-final-native.log` and `signed-in-browsing-exit-1112-r2-final-profile-diagnostic.log`; the complete report is `signed-in-browsing-exit-1112-r2-PROGRESS.md` in that same Studio directory.

The exact long case is visibly skipped, retaining its body, assertions and timeouts. The separate native exit, HAR/source, arbitrary-code, protocol and kernel tests remain active. They cover signed-in navigation, both ungranted exits, archive stripping, custody and network confinement, but do not replace the skipped case's entire sequential lifecycle. Report a green gate with this quarantine, never as proof that every earlier lifecycle case ran in that gate.

Owner: signed-in browsing repair lane; the desk tracks this defect at its next native unit review. Closure requires isolating the deadline cause, repairing it without weakening stop/resource or destination protections, removing the skip and proving the retained lifecycle with meaningful margin under the original concurrent gate conditions. An isolated passing rerun is insufficient. Use an injected slow path for any load-independence proof; never generate load on the Studio.

Multi-machine posture: machine-local native test; the defect and visible quarantine travel with the repository. Team posture: disposable private fixture profiles only, no account or visibility change. Recovery: restore the case after its closure evidence; no product timeout is changed by quarantine.
