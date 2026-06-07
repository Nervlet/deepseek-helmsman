# DeepSeek Helmsman

DeepSeek Helmsman is a DeepSeek-only terminal coding agent. It keeps the interactive coding workflow and narrows the built-in model/provider surface to DeepSeek.

## Install

```bash
brew install Nervlet/deepseek-helmsman/deepseek-helmsman
```

GitHub Releases also provide platform archives for manual installation.

## Workspace Packages

| Package | Purpose |
| --- | --- |
| [`@deepseek-helmsman/coding-agent`](packages/coding-agent) | Interactive coding-agent CLI |
| [`@deepseek-helmsman/agent-core`](packages/agent) | Agent runtime with tool calling and state management |
| [`@deepseek-helmsman/ai`](packages/ai) | DeepSeek-only LLM API |
| [`@deepseek-helmsman/tui`](packages/tui) | Terminal UI library |

## Development

```bash
bun install --ignore-scripts
./deepseek-helmsman-test.sh
```

The CLI binary name is `deepseek-helmsman`. Configure DeepSeek access with:

```bash
deepseek-helmsman
```

Then run `/login` and enter your DeepSeek API key. Credentials are stored in `~/.deepseek-helmsman/agent/auth.json`.

Local configuration is stored under `~/.deepseek-helmsman/agent` by default.

## Checks

After code changes, run:

```bash
bun run check
```
