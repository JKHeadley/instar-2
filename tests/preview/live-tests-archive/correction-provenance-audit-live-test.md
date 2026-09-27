# Active memory provenance live test (Justin)

Use the already authorized private preview chat and existing runner root after
the desk lands this build. This script grants no new model calls, sends, imports
or cap increases. Keep the storage-key host binding in the desk environment.
The audit output contains identifiers and import digests; keep it local.

1. Run `journal-agent.mjs audit --root ROOT` and record its exit code, item
   kinds and findings. Zero findings is the starting condition. Also record
   `status` counts, cap headroom and `summaryThrough`. Pause the sole runner
   before each audit if a concurrent append makes the strict reader report an
   incomplete frame; resume it afterward with the same configuration.
2. As Justin, send `Sam keeps the blue sketchbook in the studio.` Wait for its
   one PREVIEW reply. Send `Actually, Sam keeps the green sketchbook in the
   studio; please correct the old blue sketchbook fact.` Wait for the memory
   decision. If `status.holds` says `memory correction pending`, let the
   existing capped summary path resolve it before proceeding. The audit must
   exit 0 and include a `correction` chain with the original and correcting
   operator update IDs. Compare them with `status.withheld` and `inspect`.
3. Send two distinct facts about Sam, then use the existing person merge
   candidate in `inspect` to send its exact confirmation as Justin. If no
   candidate is offered, record this branch as untested. When a merge is
   recorded, audit again: its `person-merge` chain must contain the two note
   sources and the confirming operator update. No similarly named third note
   should be linked without its own confirmation.
4. Let the existing rolling summary cover those turns within the approved
   call cap. Run audit after summary and again after a normal later question.
   The active `summary` chain must name its covered operator updates; the
   correction and merge chains must remain intact. If the summary never runs,
   record that branch as incomplete rather than forcing a cap or model change.
5. With the runner paused, run the desk's already approved `import-fixture`
   procedure for one agent-owned source item, then audit. Its `channel-import`
   chain must have a stable digest and no body text. Resume and ask about the
   item; the packet may omit it under the existing bound, so confirm journal
   presence through the audit and `status.channelItems` separately.
6. On a protected, isolated copy of this preview journal, let the normal
   compaction path run and audit before and after reopen. Compare item kinds,
   IDs and findings. Do not force compaction or edit the live runner's journal.

Pass requires zero audit findings at each completed stage, matching source
IDs, no memory body in audit JSON, and no duplicate Telegram reply. A pending
decision, cap hold or unavailable summary is incomplete evidence, not a pass.
