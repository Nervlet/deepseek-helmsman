# Quickstart

This page gets you from install to a useful first DeepSeek Helmsman session.

## Install

DeepSeek Helmsman is distributed as an npm package:

```bash
npm install -g --ignore-scripts @deepseek-helmsman/coding-agent
```

`--ignore-scripts` disables dependency lifecycle scripts during install. DeepSeek Helmsman does not require install scripts for normal npm installs.

### Uninstall

Use the package manager that installed DeepSeek Helmsman:

```bash
# npm install -g
npm uninstall -g @deepseek-helmsman/coding-agent

# pnpm
pnpm remove -g @deepseek-helmsman/coding-agent

# Yarn
yarn global remove @deepseek-helmsman/coding-agent

# Bun
bun uninstall -g @deepseek-helmsman/coding-agent
```

Uninstalling the CLI leaves settings, credentials, sessions, and installed packages in `~/.deepseek-helmsman/agent/`.

Then start DeepSeek Helmsman in the project directory you want it to work on:

```bash
cd /path/to/project
deepseek-helmsman
```

## Authenticate

DeepSeek Helmsman uses DeepSeek API-key authentication.

Set an API key before launching:

```bash
export DEEPSEEK_API_KEY=sk-...
deepseek-helmsman
```

You can also run `/login` and select DeepSeek to store the key in `~/.deepseek-helmsman/agent/auth.json`.

See [Providers](providers.md) for authentication details.

## First session

Once DeepSeek Helmsman starts, type a request and press Enter:

```text
Summarize this repository and tell me how to run its checks.
```

By default, DeepSeek Helmsman gives the model four tools:

- `read` - read files
- `write` - create or overwrite files
- `edit` - patch files
- `bash` - run shell commands

Additional built-in read-only tools (`grep`, `find`, `ls`) are available through tool options. DeepSeek Helmsman runs in your current working directory and can modify files there. Use git or another checkpointing workflow if you want easy rollback.

## Give DeepSeek Helmsman project instructions

DeepSeek Helmsman loads context files at startup. Add an `AGENTS.md` file to tell it how to work in a project:

```markdown
# Project Instructions

- Run `npm run check` after code changes.
- Do not run production migrations locally.
- Keep responses concise.
```

DeepSeek Helmsman loads:

- `~/.deepseek-helmsman/agent/AGENTS.md` for global instructions
- `AGENTS.md` or `CLAUDE.md` from parent directories and the current directory

Restart the agent, or run `/reload`, after changing context files.

## Common things to try

### Reference files

Type `@` in the editor to fuzzy-search files, or pass files on the command line:

```bash
deepseek-helmsman @README.md "Summarize this"
deepseek-helmsman @src/app.ts @src/app.test.ts "Review these together"
```

Images can be pasted with Ctrl+V (Alt+V on Windows) or dragged into supported terminals.

### Run shell commands

In interactive mode:

```text
!npm run lint
```

The command output is sent to the model. Use `!!command` to run a command without adding its output to the model context.

### Switch models

Use `/model` or Ctrl+L to choose a model. Use Shift+Tab to cycle thinking level. Use Ctrl+P / Shift+Ctrl+P to cycle through scoped models.

### Continue later

Sessions are saved automatically:

```bash
deepseek-helmsman -c                  # Continue most recent session
deepseek-helmsman -r                  # Browse previous sessions
deepseek-helmsman --name "my task"    # Set session display name at startup
deepseek-helmsman --session <path|id> # Open a specific session
```

Inside DeepSeek Helmsman, use `/resume`, `/new`, `/tree`, `/fork`, and `/clone` to manage sessions.

### Non-interactive mode

For one-shot prompts:

```bash
deepseek-helmsman -p "Summarize this codebase"
cat README.md | deepseek-helmsman -p "Summarize this text"
deepseek-helmsman -p @screenshot.png "What's in this image?"
```

Use `--mode json` for JSON event output or `--mode rpc` for process integration.

## Next steps

- [Using DeepSeek Helmsman](usage.md) - interactive mode, slash commands, sessions, context files, and CLI reference.
- [Providers](providers.md) - DeepSeek authentication and model setup.
- [Settings](settings.md) - global and project configuration.
- [Keybindings](keybindings.md) - shortcuts and customization.
- [Packages](packages.md) - install shared extensions, skills, prompts, and themes.

Platform notes: [Windows](windows.md), [Termux](termux.md), [tmux](tmux.md), [Terminal setup](terminal-setup.md), [Shell aliases](shell-aliases.md).
