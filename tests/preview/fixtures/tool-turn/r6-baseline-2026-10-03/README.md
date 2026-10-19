# Residual 6 baseline (2026-10-03 09:39Z), before the fix

One configuration-check harness turn (pinned claude-cli 2.1.280, claude-sonnet-5, the preview login profile
read-only) under the spike's required configuration: tight read sandbox, spike hook (`admit.mjs` at
w4-toolsreuse cab6b51d), full disallow list. The model ran `sh check.sh` once (`admission.jsonl`); the result
frame is the last line of `out.jsonl`. Recorded: the shell received both `CLAUDE_CODE_MESSAGING_*` variables
(count 2) and the socket path; `/tmp/cc-socks` was listable; a unix-socket connect to the harness's own inbox
and to this test's dummy listener (`listener.mjs`, 0 connections in `listener.txt`) was refused with
"Operation not permitted". The fixed run under the shipped route is `../live-2026-10-03/r6-fixed.json`.
