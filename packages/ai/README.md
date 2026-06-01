# @deepseek-helmsman/ai

DeepSeek-only LLM API used by DeepSeek Helmsman.

## Configure

```bash
export DEEPSEEK_API_KEY=...
```

## Usage

```ts
import { complete, getModel } from "@deepseek-helmsman/ai";

const model = getModel("deepseek", "deepseek-v4-pro");
const message = await complete(model, {
	messages: [{ role: "user", content: [{ type: "text", text: "Say ok" }] }],
});
```

Built-in models:

- `deepseek-v4-pro`
- `deepseek-v4-flash`

DeepSeek models use the OpenAI-compatible completions adapter internally.
