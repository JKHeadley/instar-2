# Change review — Claude Code task memory parity

Subject base: 15234a73c39c0ae35cdd1b92ed6321754315df3e
Review state: frozen
Reviewed content: sha256:75682b5faaa304d9b46ea72b4fc441e758c73efefcbbc4f0c4c51c47368ea9a6
Outcome: Let a 2.0 Claude Code task use the existing 18 GiB host-owned memory budget instead of killing its process tree at 2 GiB, so the live 1.x maintenance task can run its tests. Retain the aggregate 18 GiB ceiling and the process, handle, CPU, and launch limits.
Affected rules: 60, 105
Affected floors: secrets — no secret or credential path changes; spend cap — no model reservation or spending change; stop — the host aggregate and kernel limits remain, with a larger task memory allowance; no duplicate sends — no send or replay path changes; durable intake — no intake or journal change.
Operator questions: none; the observer explicitly requested this 1.x parity change for #2190 at 14:33 PST.
Suggested tier: critical
Declared tier: critical
Tier rationale: The live runner's resource owner kills workers, so changing its threshold affects execution and host safety.
Side effects: One worker may use more than 2 GiB and up to the 18 GiB host-owned aggregate. If concurrent work crosses the aggregate, the existing owner reclaims a maintenance launch first. Six retains equal-share admission debits; those debits do not cap a running worker.
Undo and recovery: Switch the live runner back to frozen build 15234a73c if the canary fails or the host ceiling causes a new stop; its journal and working copy are retained.
Multi-machine posture: This only changes the Studio's 2.0 source and its frozen candidate. No Mama PC build or installed 1.x session is changed.
Layer below: The macOS process inventory and resource owner still sample the worker tree and enforce the aggregate ceiling. The launch shim retains its CPU, process, and handle limits.
Bug class: live-path
Bug evidence: reproducer=Live message 709 launched worker PID 30347 at 14:29:09 PST and started the 1.x vitest lint test; resource owner recorded limit-kill at 14:30:51 PST for memoryBytes 2422652928, above its former 2147483648-byte launch ceiling. live=The 64 GiB Studio had 79% free memory and the group journal settled message 709 uncertain with a lost worker, leaving #2190 unfinished.
Hook bypass: none
Convergence: none
Decision: memory-parity-1102 | Set task memory to the existing 18 GiB host-owned aggregate, retaining the host ceiling and other limits, per the observer's direct 1.x parity request. | reported=reviews/memory-parity-1102-change-review.md
Deferral: generated/register.json:1 | not-a-deferral=generated register content is regenerated for the committed source and is not deferred work.

## Closing block

simplestRobustRoute: Change the launch memory constant to the already-enforced host aggregate value, keep the aggregate check and equal-share admission, and recertify the native composition. No new configuration or policy layer is needed.
80/20: One resource constant and one pinned policy test changed. Targeted owner tests 44/44 and native contract 10/10 pass; full suite is a follow-up exact-head gate. The live path is not claimed converged until the real group task finishes.
VERDICT: author submission; this record asserts no independent verdict
