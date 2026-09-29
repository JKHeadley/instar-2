# Part Fifteen seam request — pinned calendar expansion adapter

Status: GRANTED CONDITIONAL (SEAM-LEDGER row 84; seam-response-assembly-followup.md addendum) — requested by the Part Fifteen Slice A builder on 2026-09-11.

## Owner boundary

Requested owner: Part Ten (`src/assembly`). Part Fifteen's approved design says the clock parser and
calendar library are replaceable adapters bound through governed ports, while calendar decisions bind
the exact IANA zone, time-zone-data version, calendar-policy version, bounded page inputs, and captured
output. The landed Part Ten public contracts expose no calendar-expansion adapter or package binding for
one, and `resolveActivePackage` does not admit such a port name.

## Needed behavior

Please grant an additive, public, governed adapter contract that:

- accepts a decoded `cron-v1` normalized field set, IANA zone, exact time-zone-data version, exact
  calendar-policy version, activation/predecessor/boundary instants, and explicit finite item, byte,
  memory, work, and monotonic-duration limits;
- returns a bounded continuation page of ordered wall selections and absolute RFC-3339-Z instants,
  including explicit nonexistent-time mapping, repeated-time choice, mapped-missed testimony, and
  collision disposition;
- reports the actual adapter artifact and captured source/output evidence used, without reading ambient
  time or treating a configured version as proof that the requested data was used;
- is admitted and resolved by Part Ten's existing package/assembly authority, with three-tier positive,
  negative, replacement-adapter, pinned-2027-New-York, collision, and durable-restart evidence.

## Guard

Part Fifteen will not define a substitute Part Ten port, branch on a provider/library name, hardcode one
zone's transitions, or count a fixture-only mapper as the positive. Until a grant lands, recurring
calendar expansion and the calendar arms of P15-NF-07/09/13/14/19/20/24/25/26/27/28/52 remain
`NON-EXECUTABLE-UNTIL-design-19-scheduled-work-seam-request-calendar-adapter.md` in the contract map.
The closed cron grammar, absolute RFC-3339 parsing, manifest decoding, and one-shot planning may execute
independently and make no live-holder claim.
