# Channel memory CLI import timing flake (Rule 37 quarantine)

**Status:** OPEN. **Owner:** memory health landing desk. **Opened:** 2026-09-26.

The case `CLI reads an agent-owned JSONL fixture without changing it or advancing Telegram intake` in `tests/preview/journal-channel-memory.test.ts` exceeded Vitest's 10,000 ms test deadline during Astra's six-file targeted run at `ac148083`: reported duration 10,380 ms, with 96 passed, 1 failed, and 1 existing skip. On unchanged code, the same case passed in isolation in 7,583 ms. The passing rerun does not exonerate the timeout.

The case launches four synchronous CLI subprocesses. Each has its own 10,000 ms timeout, while the entire case has the same 10,000 ms Vitest deadline. This budget mismatch makes timing sensitivity credible; the exact source of the observed delay is unconfirmed. The timeout does not establish an intake failure.

**Disposition:** Only this case is visibly quarantined with `it.skip` and a link to this defect. Its full body remains, including wrong-owner and live-mail refusals, successful import, deduplication, unchanged fixture bytes, and unchanged Telegram cursor. The other channel-memory cases remain active. A green gate must report this Rule 37 quarantine and the missing CLI import coverage explicitly.

**Repair and closure:** Diagnose the delay, give the complete workload a justified bounded deadline or remove redundant work, then remove the skip. Run the retained assertions under the original parallel targeted conditions with meaningful headroom. An unchanged isolated passing rerun cannot close this defect. If the repair regresses, restore the quarantine and reopen this record.

**Multi-machine posture:** The CLI fixture is deliberately machine-local. The defect and quarantine travel with the repository; runtime multi-machine behavior is unchanged.
