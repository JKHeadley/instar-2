Status: GRANTED CONDITIONAL (row 80, seam-response-assembly-followup.md addendum)

# Part Fifteen seam request — typed package activity

Request id: `P15-P10-package-resource-and-activity-v1`

Owner: Part Ten (`src/assembly`). Consumer: Part Fifteen scheduled package admission.

## Landed resource contract and missing activity contract

Part Ten's landed public `stageLocalCapability` already validates a caller-supplied complete
archive inventory, each safe path, every byte/digest binding, and package dependencies, then
returns the verified entries. Part Fifteen consumes that operation and applies its own closed
manifest decoder to the returned bytes. No resource-view grant remains requested.

Part Ten's landed `resolveActivePackage` returns a package only for one unambiguous active head.
Every inactive, absent, incomplete, conflicted, tainted, or ambiguous history is otherwise a
`Refused`; the result has no owner-issued typed distinction that permits Part Fifteen to ignore a
proved-inactive competitor while failing closed for unresolved activity.

## Requested additive owner behavior

Please grant and land an additive public Part Ten contract that:

- returns an owner-issued package-activity result with distinct `active`, `inactive`, and
  `unresolved` outcomes at a pinned current history frontier, where conflicted, tainted, incomplete,
  absent, or multi-head history is never reported inactive; and
- keep the existing `LocalCapabilityPackage`, `PackageTransition`, `AssemblyHistoryReadPort`, and
  `resolveActivePackage` contracts and all existing fixtures byte-identical.

## Required acceptance evidence

- Unit: active, inactive and unresolved are closed, distinct results; malformed values refuse.
- Full-port integration: record packages and transitions through the real Part Ten runtime and Part
  Two fact store; active resolves active; recorded-only, staged, inhibited, and retired resolve
  inactive only when the owner can prove that result; ambiguous/conflicted/tainted/missing history
  resolves unresolved.
- Lifecycle: fsync/SIGKILL before and after each transition reconstructs the same activity result;
  a missing prefix or changed signed byte remains unresolved/refused.

## Guard and Part Fifteen disposition

Part Fifteen validates caller-supplied archive bytes through `stageLocalCapability`; it does not
infer resource kind from an entrypoint id/path/digest. It will not reconstruct Part Ten's transition
heads or interpret a generic owner refusal as inactivity. Inactive-competitor exclusion remains
`UNGRANTED-REQUEST-design-19-scheduled-work-seam-request-package-resource-and-activity.md` until the
typed activity contract lands with the evidence above.
