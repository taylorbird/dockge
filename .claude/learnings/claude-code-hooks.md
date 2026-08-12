# Claude Code Hooks — Gate Agent Hooks with the `if` Field

Reference note for configuring Bash hooks in `~/.claude/settings.json` so they
don't block or spam ordinary commands.

## The Problem

`~/.claude/settings.json` had two Bash hooks that fired on **every** Bash command:

1. **PreToolUse / Bash — a git-push reviewer of type `agent`.** Its prompt told
   the agent to emit an `allow` permission decision for non-push commands. In
   practice the agent kept returning "condition not met" for ordinary commands
   (`git add`, `git commit`, `find`, `docker`, `npm`, ...). The harness treats a
   non-`allow` result from a PreToolUse agent/prompt hook as a **BLOCK**, so most
   Bash commands were intermittently blocked and had to be retried.

2. **PostToolUse / Bash — a "pattern detector" `agent` hook.** It fired a model
   call and printed noise after **every** Bash command.

Root cause: relying on the hook body (the agent's own prompt) to self-exclude
non-matching commands. A self-excluding agent hook can mis-decide and block.

## The Fix

Add the built-in `if` field to each hook. The `if` field uses permission-rule
syntax and makes the hook run **only** when the command matches — before the
agent/model is ever invoked.

- Push-review **PreToolUse** hook:

  ```json
  "if": "Bash(git push:*)"
  ```

  Runs only on `git push`.

- Pattern-detector **PostToolUse** hook:

  ```json
  "if": "Bash(git *)"
  ```

  Runs only after `git` commands.

This eliminated the blocking and noise while preserving both hooks' intended
behavior. Verified live: non-git commands no longer trigger either hook.

## Key Takeaways

1. **Prefer the hook `if` field** to gate agent/prompt/command hooks by command
   pattern, rather than relying on the hook body to self-exclude. A self-excluding
   agent hook can mis-decide and block the tool.

2. **A PreToolUse `agent`/`prompt` hook that returns anything other than an
   explicit `allow` can block the tool.** Don't leave the allow/deny decision to
   an agent for commands the hook shouldn't even inspect — filter with `if` first.

3. **The auto-mode self-modification classifier** blocks the agent from editing
   its own `~/.claude/settings.json` until the user explicitly confirms the
   specific change.
