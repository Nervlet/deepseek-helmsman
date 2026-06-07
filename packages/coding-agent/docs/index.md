# DeepSeek Helmsman Documentation

DeepSeek Helmsman is a terminal coding agent focused on DeepSeek models. It keeps the original lightweight extension, skill, prompt template, theme, and package system while removing non-DeepSeek built-in providers.

## Quick start

Install DeepSeek Helmsman with Homebrew:

```bash
brew install Nervlet/deepseek-helmsman/deepseek-helmsman
```

You can also download a platform archive from GitHub Releases and put the extracted executable on your `PATH`.

To uninstall the CLI:

```bash
brew uninstall deepseek-helmsman
```

Then run it in a project directory:

```bash
deepseek-helmsman
```

Run `/login` to store your DeepSeek API key in `~/.deepseek-helmsman/agent/auth.json`.

For the full first-run flow, see [Quickstart](quickstart.md).

## Start here

- [Quickstart](quickstart.md) - install, authenticate, and run a first session.
- [Using DeepSeek Helmsman](usage.md) - interactive mode, slash commands, context files, and CLI reference.
- [Providers](providers.md) - DeepSeek authentication setup.
- [Settings](settings.md) - global and project settings.
- [Keybindings](keybindings.md) - default shortcuts and custom keybindings.
- [Sessions](sessions.md) - session management, branching, and tree navigation.
- [Compaction](compaction.md) - context compaction and branch summarization.

## Customization

- [Extensions](extensions.md) - TypeScript modules for tools, commands, events, and custom UI.
- [Skills](skills.md) - Agent Skills for reusable on-demand capabilities.
- [Prompt templates](prompt-templates.md) - reusable prompts that expand from slash commands.
- [Themes](themes.md) - built-in and custom terminal themes.
- [Packages](packages.md) - bundle and share extensions, skills, prompts, and themes.
- [Models](models.md) - DeepSeek model configuration.
- [DeepSeek provider overrides](provider-overrides.md) - proxy and model override notes.

## Programmatic usage

- [SDK](sdk.md) - embed DeepSeek Helmsman in Bun/TypeScript applications.
- [RPC mode](rpc.md) - integrate over stdin/stdout JSONL.
- [JSON event stream mode](json.md) - print mode with structured events.
- [TUI components](tui.md) - build custom terminal UI for extensions.

## Reference

- [Session format](session-format.md) - JSONL session file format, entry types, and SessionManager API.

## Platform setup

- [Windows](windows.md)
- [Termux on Android](termux.md)
- [tmux](tmux.md)
- [Terminal setup](terminal-setup.md)
- [Shell aliases](shell-aliases.md)

## Development

- [Development](development.md) - local setup, project structure, and debugging.
