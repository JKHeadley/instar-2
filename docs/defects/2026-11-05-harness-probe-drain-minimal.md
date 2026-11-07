# Harness probe stdout can be truncated at successful exit

Status: source repair candidate; full qualification, independent review and installed acceptance remain OPEN at the normal release gates.

The assigned desk evidence reports an installed sudo probe returning 712 of 2,500 rows with exit 0 when its pipe reader paused for 500 milliseconds. Its existing stdout flush retained all 2,500 rows; removing it failed the regression. This is evidence of a transport defect, not proof of the cause of a historical outage.

The minimal repair waits for the existing stdout write callback before the existing success exit. It reuses the flush and real slow-reader subprocess test from 25662cf32f49ffacd09861283e52b0bff6a62909. Local WSL reproduction without the flush returned 774 of 2,500 rows with exit 0; the repaired subprocess returned all rows under the same delayed reader. No diagnostic expansion is included.

The consumer still refuses missing or malformed rows and retains its 45-second timeout and 16MiB buffer ceiling. Identity, authority, custody, stop, intake and sending behavior are unchanged. This is machine-local transport, with no new stored state.

Installed delivery uses harnessReadiness's installLauncher call and the existing installFile content comparison, temporary copy and atomic rename in tests/preview/harness-user.mjs. Once the ordinary release path supplies the changed source, readiness installs the changed launcher rather than retaining old bytes. This builder has not updated or tested the installed macOS copy, sent live messages or run a real model task. Those acceptance checks and the independent verdict belong to the desk's existing release gates for this unit.
