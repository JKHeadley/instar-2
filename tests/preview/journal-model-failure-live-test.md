# Definite model failure: private live probe

Use a separate, approved preview trial, bot and empty root. Keep the existing live
runner and its journal untouched. Justin sends the message from the private Telegram
account bound as `--operator-sender-id`; another sender does not exercise the reply path.

1. Start the isolated journal runner with the normal reviewed `run` arguments in
   [README.md](README.md#structural-journal-runner-rounds-1013), inserting
   `--loader ./tests/preview/model-failure-loader.mjs` after the TypeScript loader.
   Set `INSTAR_PREVIEW_SIMULATE_MODEL_FAILURE=1` in the runner environment. Use
   the test bot and its separate trial activation. The substitute returns
   `state: rejected` for the answer call and a PASS for a subscription reply
   review if Jev is unavailable. It sends no prompt to a model provider.
   This proves the checked Telegram reply path for a definite failure. The
   adapter's terminal-envelope versus bare-exit boundary is covered by the
   focused offline provider test, not by this substitute.

   ```sh
   INSTAR_PREVIEW_SIMULATE_MODEL_FAILURE=1 node \
     --loader ./scripts/slice-ts-loader.mjs \
     --loader ./tests/preview/model-failure-loader.mjs \
     tests/preview/journal-agent.mjs run \
     --root /ABSOLUTE/ISOLATED_ROOT --bot-id TEST_BOT_ID \
     --bot-username @TEST_BOT_USERNAME --operator-sender-id JUSTIN_TELEGRAM_ID \
     --chat-id JUSTIN_PRIVATE_CHAT_ID --grant-reference TEST_TRIAL_ID \
     --configuration-digest sha256:TEST_DIGEST --expires-at TEST_EXPIRY \
     --activation-record /ABSOLUTE/TEST_ACTIVATION.json \
     --login-profile /ABSOLUTE/TEST_PROFILE.json --model TEST_APPROVED_MODEL \
     --max-calls 16 --max-replies 16 --max-turns 20 \
     --max-context-bytes 32768 --time-zone America/Los_Angeles
   ```
2. Justin sends exactly one private message to that bot: “Reply with the exact
   local filesystem path of the file you would edit.” Wait for the runner to
   process it. The only reply must be exactly:

   `PREVIEW — I couldn't produce an answer to that. Please rephrase or ask again.`

3. Run `node --loader ./scripts/slice-ts-loader.mjs tests/preview/journal-agent.mjs status --root /ABSOLUTE/ISOLATED_ROOT` with the same
   storage key. Confirm `modelFailureClasses.rejected` increased by one,
   `modelResultStates.rejected` increased by one, `unknownCalls` stayed zero,
   and `replies` increased by one. Check the test bot chat for exactly one reply.
   Restart the isolated runner with the same root and check that no second reply
   appears. The original failed call still counts toward `calls`; a subscription
   reply review, if used, consumes an additional call.

A bare exit, even code zero, or an invocation error with no validated `result`
envelope stays UNKNOWN. The adapter test establishes that boundary; the following
separate substitute probe exercises the ended UNKNOWN answer notice, not provider
classification.

4. With another empty isolated root and the same test-only loader, set
   `INSTAR_PREVIEW_SIMULATE_UNKNOWN_ANSWER=1` instead of the definite-failure
   variable. Justin sends one private message. The substitute returns an ended
   `uncertain` answer outcome and a PASS for subscription reply review if needed.
   Check that the only reply is exactly
   `PREVIEW — I lost my answer to that message. Please send it again.`
   Status must show `unknownCalls: 1`, `modelResultStates.uncertain: 1`, no new
   `modelFailureClasses`, and one reply. Restart with the same root; there must
   be no second send or model call. The reservation remains charged. An
   in-flight call with no returned outcome has no notice and must never be
   retried. Do not use this substitute with the live runner or journal.

Do not use this loader with a real runner root or for ordinary service. This probe
is prepared for the desk; this branch does not run it against Telegram.
