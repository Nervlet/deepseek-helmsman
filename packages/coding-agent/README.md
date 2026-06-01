# @deepseek-helmsman/coding-agent

DeepSeek Helmsman is a DeepSeek-only terminal coding agent. It provides interactive, print, JSON, RPC, and SDK entry points while keeping the built-in provider list limited to DeepSeek.

## Install

```bash
npm install -g --ignore-scripts @deepseek-helmsman/coding-agent
```

## Configure

```bash
export DEEPSEEK_API_KEY=...
deepseek-helmsman
```

Default configuration paths:

| Path | Purpose |
| --- | --- |
| `~/.deepseek-helmsman/agent/settings.json` | Global settings |
| `~/.deepseek-helmsman/agent/models.json` | Optional custom model config |
| `~/.deepseek-helmsman/agent/sessions/` | Saved sessions |
| `.deepseek-helmsman/settings.json` | Project settings |

## Usage

```bash
deepseek-helmsman
deepseek-helmsman -p "Summarize this repository"
deepseek-helmsman --model deepseek/deepseek-v4-pro "Review this change"
deepseek-helmsman --model deepseek-v4-pro:high "Solve this issue"
deepseek-helmsman --list-models
```

Built-in DeepSeek models:

- `deepseek-v4-pro`
- `deepseek-v4-flash`

## Environment

| Variable | Purpose |
| --- | --- |
| `DEEPSEEK_API_KEY` | DeepSeek API key |
| `DEEPSEEK_HELMSMAN_CODING_AGENT_DIR` | Override global agent directory |
| `DEEPSEEK_HELMSMAN_CODING_AGENT_SESSION_DIR` | Override session directory |
| `DEEPSEEK_HELMSMAN_OFFLINE` | Disable startup network operations |
| `DEEPSEEK_HELMSMAN_PACKAGE_DIR` | Override package asset directory |

## Development

```bash
npm install --ignore-scripts
npm run check
```
