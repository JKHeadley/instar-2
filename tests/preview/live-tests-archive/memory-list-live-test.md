# Memory list: supervised private-chat test for Justin

Use the existing approved journal runner, private operator chat, root, expiry and limits.
The desk supplies the normal storage, Telegram, subscription and reply-check host bindings.
Do not start another writer or alter the live journal by hand. This script is for the desk
after this branch lands; it has not been run by the builder.

1. Run `status` and confirm room for the following turns, calls and replies under the
   existing caps. If needed, use the recorded `raise-caps` authority before the trial.
2. As Justin, send `Remember that my test color is amber.` Wait for its reply. Send
   `Remember that my test shape is square.` Wait for its reply.
3. Send `Actually, my test color is teal.` Wait for its reply. Send
   `Forget my test shape.` Wait for its reply. Confirm neither request remains on a
   `memory correction pending` hold in `status`.
4. Send `What do you remember about me?` Wait for one PREVIEW reply. Confirm the list
   shows the corrected teal item, excludes amber and square, is newest first,
   contains no more than 20 numbered items, and tells Justin how to correct or
   forget each displayed item. Other active journal items may also appear.
5. Run `status` and `inspect` and record the reply-check verdict and the exact send
   outcome. Restart the runner on the same root, ask the list question again, and
   confirm the same correction and forgetting behavior with one reply per turn.

If a model decision, cap, or reply check holds a turn, record the visible hold and
the preserved intake. Do not treat a held or UNKNOWN send as a successful live result.
