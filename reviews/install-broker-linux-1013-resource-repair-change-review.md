# Change review — enforce foreground custody resource ceilings

Subject base: b582fa97fb306eb4d6b54070ddb4351555f9814f
Review state: open
Reviewed content: none
Outcome: the Linux foreground start sets hard and soft address-space, data, task and core-dump ceilings before executing the authenticated broker, and readiness/status verify those limits from the recorded PID's kernel record.
Affected rules: 1/60/116 enforce the resource floor at the existing launch checkpoint using prlimit; 26/36 observe actual kernel limits and test real bytes with negative neighbors; 4/42/66/95 refuse missing or over-ceiling observations; 5 document the limits and their scope; 30 keep Linux details outside the core; 44 existing installs gain the bound on their next adapter start; 49/70/74/101/102/111/113 record the repair, evidence, decisions, undo and local posture.
Affected floors: secrets — preserve independent identity, signed bytes and ownership checks, disable core dumps; spend cap — no provider or paid operation changed; stop — prlimit/setpriv exec in place and exact-PID termination is unchanged; no duplicate sends — no send path changed; durable intake — no intake path changed.
Operator questions: none
Suggested tier: significant
Declared tier: critical
Tier rationale: a small repair to a host resource boundary warrants actual kernel enforcement evidence; privileged installation evidence remains explicitly unrun on this host.
Side effects: requires root-owned util-linux prlimit alongside setpriv. A supplied broker exceeding these ceilings fails startup or allocation instead of exhausting unbounded resources. Limits are 1 GiB address space and 256 MiB data per process, 16 tasks per dedicated broker UID, zero core bytes. This is not the systemd aggregate memory cgroup; the conservative address-space envelope across separate processes is 16 GiB. A supplied broker and its administrator must provision and fit this finite envelope. No tools, network, harnesses or delegation capabilities of the agent are changed. Shared-UID test runners can consume the NPROC allowance, so unprivileged conformance uses single-threaded Python kernel probes separately from its existing socket test; the privileged path uses the real dedicated broker UID.
Undo and recovery: revert this repair to return to the earlier foreground behavior, which reopens MUST-FIX 1 and must not be claimed protected. No installed files are migrated or overwritten. Stop the exact managed process and restart through the repaired adapter to apply the bounds; missing or failed prlimit never falls back to an unbounded launch.
Multi-machine posture: deliberately machine-local; Linux kernel resource ceilings are applied independently on every broker host with no peer or systemd dependency.
Layer below: inspected Linux adapter start/status/stop and protectedPath checks, util-linux prlimit/setpriv exec behavior, real /proc limits, actual failed hard-limit raises, an ENOMEM mapping refusal and a single EAGAIN fork refusal. The standalone Node launch also reads back the same four limits. The existing signed fixture and mediated custody reader remain unchanged. Root identity switching, macOS conformance and systemd activation remain unrun, not inferred from these probes.
Bug class: integration
Bug evidence: reproducer=tests/platform/custody-platform.test.ts
Hook bypass: none; core.hooksPath is unset and the shared hooks directory contains sample files only, inspected before commit.
Convergence: none
Decision: install-broker-foreground-rlimits | use prlimit before setpriv with finite hard and soft ceilings and verify the live kernel limits; avoid a new supervisor or mandatory systemd dependency | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/install-broker-linux-1013-repair-120328-PROGRESS.md
Decision: install-broker-resource-proof-scope | retain the 16-task production ceiling; exercise actual kernel bounds with lightweight unprivileged probes and keep dedicated-UID installation proof explicitly unrun | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/install-broker-linux-1013-repair-120328-PROGRESS.md
Skip: tests/platform/custody-platform.test.ts:144 | scope=Linux prlimit and proc resource tests cannot run on macOS; the portable distribution and socket cases still run
Skip: tests/platform/custody-platform.test.ts:185 | scope=Linux exempts UID zero from RLIMIT_NPROC; the one-fork denial proof runs under the non-root WSL UID
Prompt review: no model-facing prompt, output interpretation, judgment or delivered reply is changed. Exact kernel protocol validation only; recorded model-output replay does not apply.

simplestRobustRoute: apply util-linux hard limits at the existing foreground exec checkpoint, then include actual kernel limits in the existing readiness/status observation. This is that route: no added service, supervisor, cgroup manager or systemd dependency. The named failure is a signed broker allocating unbounded memory or creating unbounded children. Start guard is existing installation verification plus bounded exec; end-state guard is the actual PID/UID/capability/limit observation and awaited exact-PID stop; limit guards are kernel rlimits. Real unattended evidence covers a Node process launched with those bounds, kernel denial probes and the existing same-user custody request separately. A protected usable installation is not claimed.
80/20: one resource-bound repair; no full suite or load test. The 15 privileged Linux and 15 macOS identity cases and systemd activation remain the review's explicitly accepted evidence residue. This repair reviews only the broker contribution, not the inherited integration train.
VERDICT: author submission; independent acceptance belongs to the desk
