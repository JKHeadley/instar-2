# Change review — Row03 current kernel reference observations

Subject base: 914f43291d936c5f4514296390ca86ce38f48607
Review state: open
Reviewed content: none
Outcome: Extend the existing trusted inventory with redacted, incarnation-bound current checkout references; retain unknown rather than infer non-ownership from a sequential no-match scan. Row03 native completion remains an open acceptance condition.
Affected rules: 2, 8, 26, 29, 32, 34, 36, 37, 42, 49, 60, 63, 70, 74, 83, 95, 101, 102, 107, 111, 112, 113, 116; NF-52.
Affected floors: secrets — no unrelated FD names or contents, existing encrypted intake; spend cap — existing budgets; stop — existing observation/intake/execution guards; no duplicate sends — existing source dedupe and uncertain-effect fences; durable intake — existing original-topic signed request journal.
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: Evidence used at the abandoned-checkout owner boundary must not mistake sequential absence for complete current absence.
Side effects: Adds bounded read-only metadata observation to known checkouts with live processes. Positive matches veto regardless of cwd/ancestry. No-match is explicitly non-atomic and never becomes non-owner. No cleanup, recovery commit, effect replay, new UID/grant/profile/registry/service/timer or installed live change.
Undo and recovery: Revert this bounded extension and tests; the inherited unknown-owner refusal and all previous evidence remain. No stored schema or installation changes.
Multi-machine posture: Kernel observations are machine-local and sample-bound. No remote owner is inferred absent; topic leases and effect guards are unchanged.
Layer below: Original 1.x OrphanedWorkSentinel, orphanedWorkGit, spec and tests; 2.x process census/launch joins/resource owner and host recovery; Darwin SDK proc_bsdinfo, PROC_PIDLISTFDS, PROC_PIDFDVNODEPATHINFO and PROC_PIDREGIONPATHINFO; lsof Darwin descriptor/mapping traversal; actual native SCM_RIGHTS, mmap and inode-alias fixtures.
Bug class: integration
Bug evidence: reproducer=tests/preview/process-reference-census-native.test.ts
Hook bypass: none
Convergence: none
Prompt review: No production prompt, output parser or model accept/escalate/refuse decision changes. Existing signed recovery replay remains unchanged; no provider or Telegram call.
Decision: c03-reference-probe | Use existing lsof metadata authority and a fixed libproc identity reader, not a new observer or permission system. Match only known checkout device/inode identities; names and contents are never requested from lsof. Before/after process identities detect reuse but cannot certify atomic references. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/carryover-03-reference-census-1105-PROGRESS.md

## Closing block

simplestRobustRoute: Extend the existing inventory and use its positive reference facts at the current classifier boundary. FD-only and cwd/ancestry-only reads miss mappings and transferred/aliased descriptors. Incarnation brackets prevent misattribution on observed reuse; they do not prevent a transfer between reference reads. No-match therefore remains unknown unless evidence establishing a consistent current reference cut becomes available. No new confinement or authority is presumed necessary.
80/20: Targeted native reference/transfer/race tests, inherited actual native positive/unknown-holder pair, direct consumers and static checks; independent review, batched full gate and installed live proof are desk gates. This record claims no native completion without the paired proof.
VERDICT: author submission; no independent verdict or row03 completion
