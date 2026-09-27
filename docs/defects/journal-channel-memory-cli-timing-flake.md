# Channel memory CLI import timing flake (Rule 37 quarantine)

**Status:** OPEN. **Owner:** memory health landing desk. **Opened:** 2026-09-26.

The case `CLI reads an agent-owned JSONL fixture without changing it or advancing Telegram intake` in `tests/preview/journal-channel-memory.test.ts` exceeded Vitest's 10,000 ms test deadline during Astra's six-file targeted run at `ac148083`: reported duration 10,380 ms, with 96 passed, 1 failed, and 1 existing skip. On unchanged code, the same case passed in isolation in 7,583 ms. The passing rerun does not exonerate the timeout.

The case launches four synchronous CLI subprocesses. At the time of the red result, each had its own 10,000 ms timeout and the entire case had the same 10,000 ms Vitest deadline. This budget mismatch made timing sensitivity credible; the exact source of the observed delay is unconfirmed. The timeout does not establish an intake failure.

**Disposition:** The case is active with a 45,000 ms Vitest deadline; each of its four CLI subprocesses retains its 10,000 ms bound. Its assertions cover wrong-owner and live-mail refusals, successful import, deduplication, unchanged fixture bytes, and unchanged Telegram cursor. Astra ran it successfully in 3,944 ms on the reviewed tree. The original parallel-load timeout remains a recorded flake; passing once does not prove sustained headroom under that load.

**Repair and closure:** The bounded deadline and active coverage are in place. Confirm meaningful headroom under the original parallel targeted conditions before closing the timing defect. If the timeout recurs, quarantine the case and reopen this record.

**Multi-machine posture:** The CLI fixture is deliberately machine-local. The defect and quarantine travel with the repository; runtime multi-machine behavior is unchanged.
