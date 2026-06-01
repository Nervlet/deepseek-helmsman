# Models

DeepSeek Helmsman ships with DeepSeek model metadata only. Use `~/.deepseek-helmsman/agent/models.json` when you need to override DeepSeek defaults or route DeepSeek through a compatible proxy.

`models.json` only accepts the `deepseek` provider id. Additional provider ids are rejected.

## Built-In Models

List the available built-in DeepSeek models:

```bash
deepseek-helmsman --list-models
```

Select a model explicitly:

```bash
deepseek-helmsman --provider deepseek --model deepseek-v4-pro
```

## DeepSeek Proxy

Route the built-in DeepSeek provider through a proxy without redefining every model:

```json
{
  "providers": {
    "deepseek": {
      "baseUrl": "https://proxy.example.com/v1",
      "apiKey": "$DEEPSEEK_API_KEY"
    }
  }
}
```

The provider still uses the OpenAI-compatible chat completions API shape and DeepSeek compatibility defaults.

## Model Overrides

Use `modelOverrides` to adjust generated DeepSeek metadata:

```json
{
  "providers": {
    "deepseek": {
      "modelOverrides": {
        "deepseek-v4-pro": {
          "name": "DeepSeek V4 Pro (Proxy)",
          "contextWindow": 128000,
          "maxTokens": 32000
        }
      }
    }
  }
}
```

Supported override fields include `name`, `reasoning`, `input`, `cost`, `contextWindow`, `maxTokens`, `headers`, `compat`, and `thinkingLevelMap`.

## Custom DeepSeek-Compatible Models

Add a DeepSeek-compatible model under the `deepseek` provider:

```json
{
  "providers": {
    "deepseek": {
      "baseUrl": "https://api.deepseek.com",
      "apiKey": "$DEEPSEEK_API_KEY",
      "api": "openai-completions",
      "models": [
        {
          "id": "deepseek-custom",
          "name": "DeepSeek Custom",
          "reasoning": true,
          "input": ["text"],
          "contextWindow": 128000,
          "maxTokens": 32000,
          "cost": { "input": 0, "output": 0, "cacheRead": 0, "cacheWrite": 0 }
        }
      ]
    }
  }
}
```

DeepSeek-compatible model entries are merged by `id`. If a model uses the same `id` as a built-in DeepSeek model, it replaces that built-in entry.

## Value Resolution

`apiKey` and `headers` support command execution, environment interpolation, and literals:

- `"!command"` executes a shell command and uses stdout.
- `"$ENV_VAR"` and `"${ENV_VAR}"` read environment variables.
- `"$$"` emits a literal `$`.
- `"$!"` emits a literal `!`.

For `models.json`, shell commands are resolved at request time. If a command is slow, rate-limited, or should reuse stale values on transient failures, wrap it in a script that implements that behavior.

## Thinking Levels

Use `thinkingLevelMap` when a model supports only some DeepSeek reasoning levels:

```json
{
  "providers": {
    "deepseek": {
      "modelOverrides": {
        "deepseek-v4-pro": {
          "reasoning": true,
          "thinkingLevelMap": {
            "minimal": null,
            "low": null,
            "medium": null,
            "high": "high",
            "xhigh": "max"
          }
        }
      }
    }
  }
}
```

Use `null` for unsupported levels. Omitted levels use the default DeepSeek mapping.
