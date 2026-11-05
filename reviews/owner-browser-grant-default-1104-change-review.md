# Change review — operator-granted agent GitHub connection writes the reviewed page scope

Subject base: b5806d1e015dc650cdc1dee2e0accab05a849d4b
Review state: open
Reviewed content: none
Outcome: When the operator's recorded setup request grants the agent-owned EchoOfDawn GitHub connection, the existing standing-trust writer records the exact owner_github.observe registration and one scope-only grant covering account-profile and account-repositories. Without that grant nothing is recorded, and withdrawal refuses the next read. This removes the dependence on a hand-amended installed policy.
Affected rules: 1, 18, 49, 57, 63, 74, 100, 101, 103, 104, 111, 113, 116
Affected floors: secrets — the request has a closed field set, so it cannot carry a credential or browser path, and the writer records neither; spend cap — the registration is zero cost and the grant does not approve resources; stop — unchanged, each read still rechecks the stop and the current policy; no duplicate sends — read-only, no send path, prepared identities unchanged; durable intake — unchanged, the writer's existing durable publication is reused.
Operator questions: none
Suggested tier: significant
Declared tier: critical
Tier rationale: The writer creates authority for a privileged owner browser read, and the tighten comparison decides what counts as widening standing trust.
Side effects: The setup request gains one optional field. A request without it writes byte-identical policy. Tighten now refuses adding a page and accepts a grant that approves no resources, which it previously could not compare. Nothing changes on an installed agent until its operator records a new request; this unit does not migrate any policy.
Undo and recovery: Revert this unit. Installed grants keep working because the contract already reads ownerBrowserPages. To withdraw one grant, the operator runs tighten or revise without the field, or revoke. No live configuration, credential, profile, launcher or policy was changed by this unit.
Multi-machine posture: The policy stays installation-local, written by each machine's custodian. Under Rule 63, the read stays with the claim's owning machine and its local browser binding. No replication or remote fallback is added.
Layer below: Read the owner-browser contract and gate, effect decoder, classification, tool admission, onboarding and the writer. The writer forced reach world on every registration, while the contract requires reach agent, so no request could produce a usable grant before this change. Its tighten comparison returned false for a grant without a resource level and ignored pages; both are now handled.
1.x reuse: The inherited adapter reuses the PID-addressed Apple Event implementation from JKHeadley/instar, src/core/PlainChromeReloginBrowser.ts (origin/main at 112f6c0aa4a3d27a97757c547a2e331c26e3d923, as checked by the independent reviewer); this unit extends the existing 2.0 standing-trust writer because the 1.x browser transport does not write 2.0 effect-policy grants.
Rule 104: The recorded connection becomes a reusable standing grant, so repeated authorized reads need no repeat approval; tighten and revoke withdraw effective permission.
Bug class: integration
Bug evidence: reproducer=tests/preview/owner-browser-gate.test.ts
Hook bypass: none
Convergence: none
Decision: owner-grant-1104-scope-only | approve scope only with zero cost, matching the reviewed contract and documentation, rather than the writer's usual scope-and-resources grant | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/owner-browser-grant-default-1104-repair-211857-PROGRESS.md
Decision: owner-grant-1104-no-setup-question | leave the four fixed terminal questions alone and take the grant through the existing revise or setup request, because free-text role answers must not become account authority | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/owner-browser-grant-default-1104-repair-211857-PROGRESS.md
Decision: owner-grant-1104-older-grants | never rewrite an existing grant; setup refuses different choices and tighten refuses added pages, so only a new operator revise changes it | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/owner-browser-grant-default-1104-repair-211857-PROGRESS.md
Prompt review: no prompt, parser or model dispatch change.

## Closing block

simplestRobustRoute: this is the simplest robust route: one optional field on the existing request, written by the existing writer and decoded by the existing consumers. No new store, command, grant type or contract change, so the installed client's hash is untouched. Start guards: exact connection fields and the recorded operator source. End guards: the unchanged per-read contract, policy reread and prepared-cause checks. Limits remain the contract's fixed pages and existing read bounds. Unattended live completion is not claimed; it needs the desk's installed exact-head proof.
80/20: Focused owner-browser, trust-setup and onboarding tests: 46 passed. Before the writer change, the new install-to-read test failed at its observed assertion with status refused, after its ungranted refusal had passed. Four mutants were each caught: removed page guard, unchecked ownership, one page written, world reach. The real commands are spawned for install, revise, tighten and revoke; the runner's policy reader, connector admission, gate and fixed DOM run, with Chrome's Apple Event replaced by a DOM stand-in on Linux. Build, lint, typecheck and register:check passed. The full suite was not run, by instruction.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
