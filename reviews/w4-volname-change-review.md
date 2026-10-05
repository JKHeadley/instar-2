# Change review — w4-volname: the scratch-volume boundary test mounts under a per-run name

Subject base: 57e12273a84e0141cb4da68ca0561ff815b32cf2
Review state: open
Reviewed content: none
Outcome: tests/preview/tool-turn.test.ts ("bounds a workspace's whole storage ...") mounted its scratch volume at the fixed host-wide mount point /private/tmp/itw-0123456789ab. With two full suites running on the Studio at once (observer #180/#181, 10-05 05:11), each suite attached its own image at the same mount point and one suite's unmount detached the other's volume, so expect(unmountScratch(turn)).toBe(true) failed. The test now draws one name per run (itw- plus 12 random hex digits, the form attachScratch admits) and reuses that name for every attach within the test, so the per-test meaning is unchanged: the same 8 MiB bound, the same persistence check re-mounting at the same fixed name, the same crash-left-mounted re-attach, the same refused '../escape' name. A sweep of every other scratch or disk-image attach in tests (attachScratch, attachSessionVolume, hdiutil, sparseimage, /Volumes) found no other fixed host-wide name: the default attachScratch name is random, conversationWorkspace keys itw-<key> on the root's real path, harnessSessionLayout keys its-<digest> on the root's real path, and attachSessionVolume mounts inside its own mkdtemp root. Proven: the fixed file run twice concurrently passes both (13/13 each, volume test included); the base file run twice concurrently fails both at the same assertion.
Affected rules: 34 (the unit test still exercises the real volume), 36 (both sides shown: the fixed name collides when run concurrently, the per-run name does not), 37 (fixed at source, not quarantined or retried), 60 (the volume's size bound is tested unchanged), 74 (this record), 101 (plain commits, no hook bypass), 116 (one random name, no lock or serialisation machinery)
Affected floors: secrets — unchanged; spend cap — unchanged; stop — unchanged; no duplicate sends — unchanged; durable intake — unchanged
Operator questions: none
Suggested tier: minor
Declared tier: minor
Tier rationale: a test-only change of one mount name; no product source changes.
Side effects: none; the product's attachScratch and its naming are unchanged.
Undo and recovery: revert the commit; no record or format changes.
Multi-machine posture: machine-local, unchanged.
Layer below: tests/preview/tool-turn.mjs attachScratch, unchanged.
Bug class: none
Bug evidence: none
Hook bypass: none
Convergence: none
Decision: w4-volname-per-run-mount | the test draws one random itw- name per run and keeps it fixed within the test, rather than serialising suites with a host lock or changing attachScratch; the collision came only from the test's fixed host-wide name | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/w4-volname-PROGRESS.md
Prompt review: no system prompt, provider policy or invocationPolicyDigest changed
Deferral: generated/register.json:1 | not-a-deferral=generated register output quoting the rule book, not a commitment by this change

Subject (1 path): tests/preview/tool-turn.test.ts

## Closing block

simplestRobustRoute: one per-run random mount name in the one test that used a fixed host-wide name (Rule 116).
80/20: the concurrent double run passes; the base file's concurrent double run fails at the reported assertion; architecture, register and wiring checks pass.
VERDICT: author submission; the independent verdict is recorded as a pass
