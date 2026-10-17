# Failed activity from the train-53 proof

Source: read-only desk evidence at
`/Users/dabombstudio/.instar/agents/echo/.instar/lanes/srerun2-1016-evidence/`.
The full proof report is the adjacent `srerun2-1016-PROGRESS.md`.

Update **715676627**, input 739, took 708 seconds of actual tool work. Progress
messages 744/745/746 named already-ended failed Bash calls. Final answer parts
747/748 were delivered; the proof observed zero progress after them.

`first-progress-admission-prefix.jsonl` is copied byte for byte from that evidence.
SHA-256: `259e71a4c73df06aa0dcce2c9678417ec31b92b30ecf1e5e93a23ce7bbcb5fd9`.
The old projection returns exactly `Status: List workspace contents`, step hash
`bd1def8ea6ccdde4bbb04fbe6186621d5252625deb70b687025681528f9ff934`.

`failed-completions.json` retains the three failed tool-use/result pairs from
`main-tool-transcript-extract.json`, including their original times, ids, inputs,
error flags and result text. Its source field and source SHA-256 identify the
original Claude Code 2.1.280 transcript. Only failed pairs were selected; their
values were not rewritten.

No failure hook was registered during that run, so there are no captured failure
hook payloads. The replay test reconstructs the documented `PostToolUseFailure`
envelope from those recorded values and invokes the actual executable admission
hook. It separately checks that the actual session launch registers this event.
This is recorded-completion replay, not a claim of a new live harness run.
Event schema: <https://code.claude.com/docs/en/hooks#posttoolusefailure>.
