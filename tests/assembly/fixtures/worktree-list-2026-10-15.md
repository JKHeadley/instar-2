# Worktree enumeration capture

`worktree-list-2026-10-15.bin` contains unmodified output of
`git worktree list --porcelain -z`, captured on 2026-10-15 in the Laptop's
`undated-promise-1015` worktree at train-44 a1b59d03. It records only paths,
heads and branch names. No repository file contents or credentials were captured.
The parser test replays the complete bytes including NUL record delimiters.
