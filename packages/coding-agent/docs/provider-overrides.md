# DeepSeek Provider Overrides

DeepSeek Helmsman is distributed as a DeepSeek-only agent. Built-in model metadata, credential discovery, `models.json`, and extension provider registration are limited to provider id `deepseek`.

Prefer `models.json` provider overrides when you only need to route DeepSeek through a proxy. Use the extension API only when the proxy endpoint or model list must be configured dynamically. See [models.md](models.md).

## DeepSeek Proxy Extension

If an extension must configure the DeepSeek provider dynamically, keep the provider id as `deepseek`:

```typescript
import type { ExtensionAPI } from "@deepseek-helmsman/coding-agent";

export default function (helmsman: ExtensionAPI) {
  helmsman.registerProvider("deepseek", {
    baseUrl: "https://proxy.example.com/v1",
    apiKey: "$DEEPSEEK_API_KEY",
    api: "openai-completions"
  });
}
```

## Custom DeepSeek Models

Extensions may replace the DeepSeek model list, but the provider id must remain `deepseek`:

```typescript
import type { ExtensionAPI } from "@deepseek-helmsman/coding-agent";

export default function (helmsman: ExtensionAPI) {
  helmsman.registerProvider("deepseek", {
    name: "DeepSeek Proxy",
    baseUrl: "https://private.example.com/v1",
    apiKey: "$DEEPSEEK_API_KEY",
    api: "openai-completions",
    models: [
      {
        id: "deepseek-private-chat",
        name: "DeepSeek Private Chat",
        reasoning: true,
        input: ["text"],
        cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
        contextWindow: 128000,
        maxTokens: 32000
      }
    ]
  });
}
```

Trying to register any provider id other than `deepseek` fails.

## Value Resolution

`apiKey` and custom headers use the same syntax as `models.json`:

- `"!command"` executes a shell command and uses stdout.
- `"$ENV_VAR"` and `"${ENV_VAR}"` read environment variables.
- `"$$"` emits a literal `$`.
- `"$!"` emits a literal `!`.

## Supported Streaming API

The DeepSeek-only distribution registers `openai-completions` as the built-in streaming API. Extensions may attach a custom stream handler to the `deepseek` provider for private deployments, but they cannot add additional provider ids.
