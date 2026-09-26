# Memory sentinel timing flake (Rule 37 quarantine)

**Status:** OPEN. **Owner:** auto-awareness landing desk. **Opened:** 2026-09-26.

The case `grounds a later pronoun question in an early summarized turn across a restart, with bounded overhead` in `tests/preview/memory-sentinel.test.ts` failed a timing bound while nine files ran in parallel on the unchanged memory-sentinel path. An isolated rerun passed 6/6 with a reported p95 of 28 ms. That pass does not explain or repair the earlier failure. The exact failing bound and host contention remain unconfirmed; load contention is a hypothesis, not an exoneration.

**Disposition:** The exact case is visibly quarantined with `it.skip` and this link. Its full body, semantic assertions, timing assertions, and thresholds are retained. The other five memory-sentinel cases remain active. The skipped case leaves cross-restart recall and its timing bounds unproven by the current gate. Report a green gate as green with this Rule 37 quarantine.

**Repair and closure:** The owner must diagnose the timing failure, repair the cause, remove the skip, and show the retained semantic and timing assertions pass with meaningful headroom under the original parallel gate conditions. An isolated passing rerun alone cannot close this defect. If a repair regresses, restore the quarantine and reopen this record.

**Multi-machine posture:** The test fixture is machine-local. This tracked defect and quarantine travel with the repository.
