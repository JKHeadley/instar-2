# Change review — Rule 60 group U ceiling proof

Subject base: 17dfeb44673820f6196086e9f62f7b12ccc56a14
Review state: open
Reviewed content: none
Outcome: Restore group U's saturation proof against the shipped nine-launch ceiling and add an in-tree boundary regression.
Affected rules: 1, 26, 34, 49, 60, 70, 74, 101, 102, 111, 113, 116.
Affected floors: Secrets, spend cap, stop, no duplicate sends and durable intake remain unchanged; only offline evidence and tests change.
Operator questions: none
Suggested tier: ordinary
Declared tier: ordinary
Tier rationale: No production behavior, model instruction or governing policy changes; this corrects stale offline workload sizes and expected values.
Side effects: The desk probe starts at most nine short sleeping children instead of four. No CPU load generator, model call, live-root write or external send. The lower-ceiling neighbor remains four answers against two slots. U60d also checks successful admission counts and observed peak, preventing errors from looking like a held reserve.
Undo and recovery: Revert the test and restore the desk's original U.sh and U-probe.mjs snapshots. This restores stale proof failures but does not change product behavior or durable state.
Multi-machine posture: Deliberately machine-local physical-owner proof. No peer state or transport changes. WSL cannot prove the macOS shell limit shim; U60g stays UNTESTED here and must run on the Studio.
Layer below: Rule 60 fixes the hard-bound requirement, not a numeric value. Read docs/10-the-transport-and-leases.md resource reservation and ordinary-work reserve requirements; scripts/resource-owner.mjs eligible/admit/hold, RESOURCE_CEILINGS, and tests/preview/six-host-resources.ts; the topic-worker review records why eight topics require nine physical slots. f692c56aa07c750fee80863a375292b782263a65 changed 3/6 GiB/96 to 9/18 GiB/288, integrated through b328eb34; the desk probe still submitted four answers and two answers plus maintenance.
Bug class: unit
Bug evidence: reproducer=tests/preview/topic-worker-capacity.test.ts
Hook bypass: none; core.hooksPath is unset and the common hooks directory contains only sample hooks, inspected before commit.
Convergence: none
Prompt review: No model-facing source or acceptance decision changed. This is a physical-resource proof correction, not a prompt or semantic parser change.
Decision: rule60-u-1016-proof-bound | Preserve the shipped fixed nine-launch bound and one answer reserve; repair the stale group U workload and expectations, with deterministic held-lease neighbors in the existing topic-worker suite. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/rule60-u-1016-PROGRESS.md

## Desk application payload

The Studio is read-only to this builder. Apply this patch to the desk's lanes directory after checking the originals against the report's hashes. It is included here so the pushed commit contains the complete repair. No .instar file is committed. The local handoff also contains original and proposed complete scripts and red/green probe snapshots.

```diff
--- a/pipeline/live-proof/U.sh
+++ b/pipeline/live-proof/U.sh
@@ -33 +33 @@
-#      afterwards). It starts short /bin/sleep children through the real resource owner (at most 4 at once, each
+#      afterwards). It starts short /bin/sleep children through the real resource owner (at most 9 at once, each
@@ -89,5 +89,5 @@
-chk U60a "60" "offline: the funnel's shipped ceilings are the ones under proof: at most 3 owned launches at once with 1 kept for an answer, and per launch 2 GiB, 32 processes, 1024 handles and 600 s of CPU" \
-  "$PR('u60.ceilings.aggregate.launches') == 3 and $PR('u60.ceilings.reserveLaunches') == 1 and $PR('u60.ceilings.aggregate.memoryBytes') == 6 * 1024**3 and $PR('u60.ceilings.aggregate.processCount') == 96 and $PR('u60.ceilings.launch.memoryBytes') == 2 * 1024**3 and $PR('u60.ceilings.launch.processCount') == 32 and $PR('u60.ceilings.launch.handleCount') == 1024 and $PR('u60.ceilings.launch.cpuMilliseconds') == 600000"
-chk U60b "60" "offline: the concurrent-launch ceiling is REACHED and HELD: 4 answers at once on the real owner peak at exactly the ceiling (3), one waits, and no moment ever shows more than the ceiling running" \
-  "$PR('u60.shipped.ok') is True and $PR('u60.shipped.value.admitted') == 4 and $PR('u60.shipped.value.peakLaunches') == $PR('u60.shipped.value.ceilingLaunches') == 3 and $PR('u60.shipped.value.waited') >= 1 and $PR('u60.shipped.value.maxActiveObserved') <= 3"
-chk U60c "60" "offline, the other side: the ceiling decides, not the workload. The same 4 answers against a ceiling of 2 peak at 2 and make 2 wait" \
+chk U60a "60" "offline: the funnel's shipped ceilings are the ones under proof: at most 9 owned launches at once with 1 kept for an answer, and per launch 2 GiB, 32 processes, 1024 handles and 600 s of CPU" \
+  "$PR('u60.ceilings.aggregate.launches') == 9 and $PR('u60.ceilings.reserveLaunches') == 1 and $PR('u60.ceilings.aggregate.memoryBytes') == 18 * 1024**3 and $PR('u60.ceilings.aggregate.processCount') == 288 and $PR('u60.ceilings.launch.memoryBytes') == 2 * 1024**3 and $PR('u60.ceilings.launch.processCount') == 32 and $PR('u60.ceilings.launch.handleCount') == 1024 and $PR('u60.ceilings.launch.cpuMilliseconds') == 600000"
+chk U60b "60" "offline: the concurrent-launch ceiling is REACHED and HELD: 10 answers at once on the real owner peak at exactly the ceiling (9), one waits, and no moment ever shows more than the ceiling running" \
+  "$PR('u60.shipped.ok') is True and $PR('u60.shipped.value.admitted') == 10 and $PR('u60.shipped.value.peakLaunches') == $PR('u60.shipped.value.ceilingLaunches') == 9 and $PR('u60.shipped.value.waited') == 1 and $PR('u60.shipped.value.maxActiveObserved') <= 9"
+chk U60c "60" "offline, the other side: the ceiling decides, not the workload. Four answers against a ceiling of 2 peak at 2 and make 2 wait" \
@@ -95,2 +95,2 @@
-chk U60d "60" "offline: the answer reserve holds both ways: with 2 answers running, maintenance waits for the kept launch; on an idle owner the same maintenance is admitted at once" \
-  "$PR('u60.reserve.value.peakLaunches') == 2 and $PR('u60.reserve.value.waited') == 1 and $PR('u60.reserveIdle.value.peakLaunches') == 1 and $PR('u60.reserveIdle.value.waited') == 0"
+chk U60d "60" "offline: the answer reserve holds both ways: with 8 answers running, maintenance waits for the kept launch; on an idle owner the same maintenance is admitted at once" \
+  "$PR('u60.reserve.ok') is True and $PR('u60.reserve.value.admitted') == 9 and $PR('u60.reserve.value.peakLaunches') == 8 and $PR('u60.reserve.value.maxActiveObserved') <= 8 and $PR('u60.reserve.value.waited') == 1 and $PR('u60.reserveIdle.ok') is True and $PR('u60.reserveIdle.value.admitted') == 1 and $PR('u60.reserveIdle.value.peakLaunches') == 1 and $PR('u60.reserveIdle.value.waited') == 0"
--- a/pipeline/live-proof/U-probe.mjs
+++ b/pipeline/live-proof/U-probe.mjs
@@ -48 +48 @@
-  out.u60.shipped = await attemptAsync(() => burst('shipped', RESOURCE_CEILINGS, answers(4)));
+  out.u60.shipped = await attemptAsync(() => burst('shipped', RESOURCE_CEILINGS, answers(10)));
@@ -53 +53 @@
-  out.u60.reserve = await attemptAsync(() => burst('reserve', RESOURCE_CEILINGS, ['answer', 'answer', 'maintenance']));
+  out.u60.reserve = await attemptAsync(() => burst('reserve', RESOURCE_CEILINGS, [...answers(8), 'maintenance']));
```

simplestRobustRoute: Correct the existing check's finite numeric expectation and saturating workload; reuse its real owner and the existing topic-worker test file. No new runtime machinery. Start guard: pinned shipped vector; end-state guard: all admissions accounted for; limit guards: exact reached peak, one excess wait, lower-ceiling neighbor, and maintenance reserve in both directions. No live completion is claimed.
80/20: Targeted tests and static checks on WSL; macOS-only physical-launch checks and the full host test lane belong to the desk. The full pipeline is not run on this host.
VERDICT: author submission for desk review, with installation payload; no independent convergence or deployed-proof claim
