# Providers

DeepSeek Helmsman is a DeepSeek-only fork. The only supported provider is `deepseek`, and the only built-in credential source is `DEEPSEEK_API_KEY` or the `deepseek` entry in `auth.json`.

## API Key

Set the key in your shell:

```bash
export DEEPSEEK_API_KEY=sk-...
deepseek-helmsman
```

Or store it interactively with `/login`. Credentials are written to `~/.deepseek-helmsman/agent/auth.json` with user-only permissions.

```json
{
  "deepseek": { "type": "api_key", "key": "sk-..." }
}
```

## Key Resolution

Credential lookup order:

1. CLI `--api-key`
2. `auth.json` entry for `deepseek`
3. `DEEPSEEK_API_KEY`

The `auth.json` key field supports the same value syntax as settings:

- `"!command"` executes a shell command and uses stdout.
- `"$ENV_VAR"` and `"${ENV_VAR}"` read environment variables.
- `"$$"` emits a literal `$`.
- `"$!"` emits a literal `!`.

## Models

Built-in model metadata is generated only for DeepSeek. Use:

```bash
deepseek-helmsman --list-models
deepseek-helmsman --provider deepseek --model deepseek-v4-pro
```

`models.json` and extension provider registration can override the `deepseek` provider, but additional provider ids are rejected.
