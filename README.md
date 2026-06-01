# DeepSeek Helmsman

DeepSeek Helmsman is a DeepSeek-only terminal coding agent. It keeps the interactive coding workflow and narrows the built-in model/provider surface to DeepSeek.

## Packages

| Package | Purpose |
| --- | --- |
| [`@deepseek-helmsman/coding-agent`](packages/coding-agent) | Interactive coding-agent CLI |
| [`@deepseek-helmsman/agent-core`](packages/agent) | Agent runtime with tool calling and state management |
| [`@deepseek-helmsman/ai`](packages/ai) | DeepSeek-only LLM API |
| [`@deepseek-helmsman/tui`](packages/tui) | Terminal UI library |

## Development

```bash
npm install --ignore-scripts
./deepseek-helmsman-test.sh
```

The CLI binary name is `deepseek-helmsman`. Configure DeepSeek access with:

```bash
export DEEPSEEK_API_KEY=...
deepseek-helmsman
```

Local configuration is stored under `~/.deepseek-helmsman/agent` by default.

## Checks

After code changes, run:

```bash
npm run check
```
