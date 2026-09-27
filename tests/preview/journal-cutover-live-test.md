# Telegram cutover liveness: Justin's supervised live test

Use a separate approved trial bot, two empty isolated journal roots, and its
reviewed activation and profile. Keep the existing live runner and journal
untouched. Keep both roots, their `runs.jsonl` files and their encrypted journals
for review. Run the offline process regression first:

```sh
npx vitest run tests/preview/journal-cutover.test.ts --configLoader=runner --testTimeout=60000
```

1. Start the isolated canary with the normal `journal-agent.mjs run` command and
   its first root. Observe that it reaches `getUpdates`; do not send a message
   while this empty-root handoff is being exercised. Let its long poll begin.
2. Start the same bot with the second root and the same reviewed trial binding
   while the canary is polling. Send no messages during this overlap. Record
   both process states and the second runner's outcome. A persistent 409 conflict
   must exit nonzero after five attempts; a short one may recover in that launch.
   Stop the canary with `SIGTERM`, wait until it exits, and check its run-log end row.
3. If the second runner exited, restart it on the **same** second root. Justin
   then sends one new private
   message: “What is the marker? Cedar.” Confirm one answer to that message.
   `status` must show the accepted turn, cursor, one send allowance consumed for
   it and no held reply caused by cutover.
4. Stop and restart the second runner once more on the same root. Confirm no
   second reply to Cedar, no second model call for that turn, and no parallel
   canary poller. Check that each recorded run end has a truthful reason and that
   no failed launch was reported as success.

This is a supervised isolated-bot procedure. Record observed process counts,
Telegram message IDs, status output and run-log rows. A successful offline
regression alone is not a claim that the live frozen15 event's cause was proven.
