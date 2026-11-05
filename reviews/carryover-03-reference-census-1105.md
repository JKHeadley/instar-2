# Change review — Row03 current kernel reference observations

Subject base: 914f43291d936c5f4514296390ca86ce38f48607
Review state: open
Reviewed content: none
Outcome: Extend the existing trusted inventory with redacted, incarnation-bound current checkout references; retain unknown rather than infer non-ownership from a sequential no-match scan. A real descriptor-transfer race disproves sequential no-match exclusion; row03 native completion remains blocked.
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

Decision: c03-reference-race | Real SCM_RIGHTS transfers repeatedly hide checkout possession from sequential per-process reads with unchanged microsecond identities. The strengthened fixture retains the sender FD until the receiver confirms reading its duplicate, ensuring continuous direct process-held possession as well as in-flight kernel possession. Both no-match rows must stay unknown. The missing evidence is a consistent reference cut or a kernel change witness covering FD/mapping transitions throughout the observation, not permanent nonaccess. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/carryover-03-reference-census-1105-PROGRESS.md

Evidence: Native reference suite at af05b00e4 passed 11/11; process pair 72719/72721 reproduced the race on two successive scans while the receiving process read the synthetic 28-byte capture. A subsequent ordinary scan detected the holder. Closed-FD mmap and renamed hardlink/transferred-FD neighbors passed. Exact logs and PIDs are in the absolute lanes evidence directory. The existing native positive/unknown-holder pair is a separate acceptance condition, never replaced by these 11 tests.

Publication: Existing build-register --replay publishes only shape evidence from an exact source commit. The existing merge-live-conformance --renew tool ran on Darwin with the declared runtime: before 9/10 (only stale certificate), after 10/10. It generated the one conformance update after actual contract execution; no certificate was hand-edited. Native renewal evidence is in the absolute lanes evidence directory under native-renewal.

Native acceptance at 352e601ac4a5c2cc19e9261a3fce309ae1903741: unknown outside-cwd UID-498 holder PID 95954 was positively observed with an incarnation-bound FD and refused; the retired worker positive still admitted zero requests while PIDs 7136/47903/47905 persisted. The paired acceptance is 1/2, not completion. Direct host/process consumers and new native reference controls passed (43 passed / 1 positive-acceptance failure across four files). The scan race repeated with PIDs 9069/9071. No negative exclusion is enabled.

Decision: c03-reference-publication | Renew the composition certificate only through the existing before/after native contract tool, then publish through the existing register replay. This clears byte-bound enforcement without changing the unresolved ownership result. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/carryover-03-reference-census-1105-PROGRESS.md

## Closing block

simplestRobustRoute: Extend the existing inventory and use its positive reference facts at the current classifier boundary. FD-only and cwd/ancestry-only reads miss mappings and transferred/aliased descriptors. Incarnation brackets prevent misattribution on observed reuse; they do not prevent a transfer between reference reads. No-match therefore remains unknown unless evidence establishing a consistent current reference cut becomes available. No new confinement or authority is presumed necessary.
80/20: Targeted native reference/transfer/race tests, inherited actual native positive/unknown-holder pair, direct consumers and static checks; independent review, batched full gate and installed live proof are desk gates. This record claims no native completion without the paired proof.
VERDICT: author submission; no independent verdict or row03 completion
