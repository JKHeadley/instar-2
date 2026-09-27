# Justin live check: ordinary structured replies do not stall memory

Use the existing private preview chat after the desk lands this change and resumes
the frozen runner under its reviewed activation. Do not create another runner or
change the activation, provider policy, model, token limit, or live journal.

1. Read `status` and record the current `calls`, `replies`, `turns`, `holds`,
   `replyChecks` and `replyCheckPaths`. Confirm stop is not latched, expiry is
   ahead, and there is room for six answer calls, six replies and six turns,
   plus four review or summary calls. If there is not enough room, use only the
   existing recorded cap-raise procedure with its authority before the test.
2. As Justin in the bound private chat, send these one at a time and wait for
   each answer: `Good morning.`, `What does git status show?`, `My garden has two
   lemon trees.`, `What do you remember about my garden?`, `Why would a program
   mention /tmp/example.txt in an error?`, `Thanks, that helps.` Do not include
   a real secret in any message.
3. After each turn, read `status` and record whether a reply was accepted by the
   Telegram API or held, the exact hold reason, the Jev/review path, and any
   UNKNOWN call or send. Compare the answer with the actual chat. A memory
   answer may express uncertainty; it must not invent a saved fact.
4. Pass the reliability check if all six ordinary answers arrive without a
   `memory correction pending` hold and any code-like Jev signal receives a
   completed full-context review before a veto. If a cap, outage, or UNKNOWN
   outcome occurs, record its exact status and stop the exercise; do not retry
   the message or repeat an uncertain send. Check that a direct forget request
   with an unresolved target, if one occurs naturally later, remains visibly
   pending rather than falsely acknowledged.

Report the six-message held share and reason counts beside the offline 0/18
result. Telegram API acceptance is not proof of human receipt. This check
requires Justin's observation and has not been run by the builder.
