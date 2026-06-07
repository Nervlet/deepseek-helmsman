# Providers

DeepSeek Helmsman is a DeepSeek-only fork. The only supported provider is `deepseek`, and the built-in credential source is the `deepseek` entry in `auth.json`.

## API Key

Store the key interactively with `/login`. Credentials are written to `~/.deepseek-helmsman/agent/auth.json` with user-only permissions.

```bash
deepseek-helmsman
```

Then enter:

```text
/login
```

```json
{
  "deepseek": { "type": "api_key", "key": "sk-..." }
}
```

## Key Resolution

Credential lookup order:

1. `auth.json` API key entry for `deepseek`
2. `auth.json` OAuth entry for `deepseek`, if an extension registers OAuth support

The `auth.json` key field supports:

- `"!command"` executes a shell command and uses stdout.
- `"$$"` emits a literal `$`.
- `"$!"` emits a literal `!`.

## Models

Built-in model metadata is generated only for DeepSeek. Use:

```bash
deepseek-helmsman --list-models
deepseek-helmsman --provider deepseek --model deepseek-v4-pro
```

`models.json` and extension provider registration can override the `deepseek` provider, but additional provider ids are rejected.
