# Safe continuation of interrupted promised work

**Status:** OPEN
**Owner:** Echo Instar 2.0 desk

The notice-only scope of promise-recovery-notice-1111 leaves uncertain background
work held. The original promise stays open, and the existing collector can still
recover a proven saved result. The notice does not authorize repeating any effect.

Next unit: reconcile the interrupted attempt's effect and child evidence through
the existing admission checks, then resume only the remaining work. Carry the
stable obligation and send identities through a second restart. Compare the
1.x PromiseBeacon revival and ResumeQueue revalidation paths before implementation.

Estimate: 150–250 product lines plus integration and crash-cut tests; confirm the
estimate after identifying the missing evidence at the worker boundary. Acceptance:
both worker loss and runner restart deliver one final result without another user
message; uncertain effects never replay; stop, caps, ownership and durable intake
hold. Recheck at the next carryover rows 01/03 desk review. No autonomous-resume
completion is claimed by the notice unit.
