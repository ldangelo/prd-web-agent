# Agent Instructions

This project uses **bd** (beads) for issue tracking. Run `bd onboard` to get started.

## Quick Reference

```bash
bd ready              # Find available work
bd show <id>          # View issue details
bd update <id> --status in_progress  # Claim work
bd close <id>         # Complete work
bd dolt pull          # Pull latest issues from Dolt remote (replaces `bd sync`)
bd dolt push          # Push issue changes to Dolt remote
```

## Source Code Control

**ALWAYS use jj (Jujutsu)** — NEVER use `git` directly.

```bash
jj status             # working copy status
jj log                # commit history
jj describe -m "msg"  # set commit message on working copy
jj new main@origin    # start new change on top of latest main
jj bookmark create <name> -r @  # create a branch bookmark
jj git push --bookmark <name>   # push branch to GitHub
jj git fetch          # fetch from origin (replaces git pull)
```

## Landing the Plane (Session Completion)

**When ending a work session**, you MUST complete ALL steps below.

**MANDATORY WORKFLOW:**

1. **File issues for remaining work** - Create issues for anything that needs follow-up
2. **Run quality gates** (if code changed) - `devbox run test`
3. **Update issue status** - Close finished work, update in-progress items
4. **PUSH CODE TO REMOTE** - This is MANDATORY:

   ```bash
   jj git fetch                          # fetch latest from origin
   jj rebase -r @ -d main@origin         # rebase onto latest main if needed
   jj bookmark set <branch-name> -r @    # point bookmark at current change
   jj git push --bookmark <branch-name>  # push to GitHub
   ```

5. **PUSH ISSUES TO REMOTE**:

   ```bash
   bd dolt push          # push beads issue database to Dolt remote
   ```

6. **Verify** - All changes committed AND pushed, issues updated
7. **Hand off** - Provide context for next session

**CRITICAL RULES:**

- NEVER use `git push` directly — jj is in detached HEAD mode, it will fail
- NEVER use `git pull` directly — use `jj git fetch` instead
- `bd sync` does not exist — use `bd dolt pull` / `bd dolt push`
- Work is NOT complete until `jj git push` succeeds
- NEVER stop before pushing — that leaves work stranded locally
