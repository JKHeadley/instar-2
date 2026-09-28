# Preview packet-priority timeout flake (Rule 37 quarantine)

**Status:** OPEN. **Owner:** auto-awareness landing desk. **Opened:** 2026-09-27.

The case `retains higher-priority memory at the byte boundary and records every lower-priority drop` in `tests/preview/journal-packet-priority.test.ts` timed out at 30,021 ms against its 30-second deadline. This happened while ten preview files ran together during Astra's review of `bl-opted-in-reminders` at `e5badc60`. The code under test was unchanged; the same run otherwise finished 161 passed and 1 existing skip. An unchanged isolated rerun passed in 18,156 ms. That pass does not explain or repair the earlier failure. The case builds about 260 packets, stepping the byte limit down from 7,500 to 950, so its wall time is close to the deadline even when it runs alone. Host contention is a hypothesis, not an exoneration.

**Disposition:** The exact case is visibly quarantined with `it.skip` and this link. Its full body, assertions and deadline are retained. The other packet-priority cases remain active. The skipped case leaves the byte-boundary drop order unproven by the current gate. Report a green gate as green with this Rule 37 quarantine.

**Repair and closure:** The owner must diagnose why the case needs about 18 seconds or more, repair the cause (for example the per-probe packet cost, or a coarser step that still crosses every priority boundary), remove the skip, and show the retained assertions pass with meaningful headroom under the original concurrent gate conditions. An isolated passing rerun alone cannot close this defect. If a repair regresses, restore the quarantine and reopen this record.

**Multi-machine posture:** The test fixture is machine-local. This tracked defect and quarantine travel with the repository.
