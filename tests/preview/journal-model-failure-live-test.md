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

Do not use this loader with a real runner root or for ordinary service. This probe
is prepared for the desk; this branch does not run it against Telegram.
