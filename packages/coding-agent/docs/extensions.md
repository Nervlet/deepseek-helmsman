# Extensions

Extensions are TypeScript modules that extend DeepSeek Helmsman. They can subscribe to lifecycle events, register tools, add slash commands, customize UI, and persist session state.

> **Security:** Extensions run with your full system permissions and can execute arbitrary code. Only load extensions from sources you trust.

## Quick Start

Create `~/.deepseek-helmsman/agent/extensions/my-extension.ts`:

```typescript
import type { ExtensionAPI } from "@deepseek-helmsman/coding-agent";
import { Type } from "typebox";

export default function (api: ExtensionAPI) {
  api.on("session_start", async (_event, ctx) => {
    ctx.ui.notify("Extension loaded", "info");
  });

  api.on("tool_call", async (event, ctx) => {
    if (event.toolName === "bash" && event.input.command?.includes("rm -rf")) {
      const ok = await ctx.ui.confirm("Dangerous command", "Allow this command?");
      if (!ok) return { block: true, reason: "Blocked by user" };
    }
  });

  api.registerTool({
    name: "greet",
    label: "Greet",
    description: "Greet someone by name",
    parameters: Type.Object({
      name: Type.String({ description: "Name to greet" }),
    }),
    async execute(_toolCallId, params) {
      return {
        content: [{ type: "text", text: `Hello, ${params.name}` }],
        details: {},
      };
    },
  });

  api.registerCommand("hello", {
    description: "Say hello",
    handler: async (args, ctx) => {
      ctx.ui.notify(`Hello ${args || "world"}`, "info");
    },
  });
}
```

Run it for one session:

```bash
deepseek-helmsman -e ./my-extension.ts
```

## Locations

Extensions are auto-discovered from:

| Location | Scope |
|----------|-------|
| `~/.deepseek-helmsman/agent/extensions/*.ts` | Global |
| `~/.deepseek-helmsman/agent/extensions/*/index.ts` | Global directory extension |
| `.deepseek-helmsman/extensions/*.ts` | Project |
| `.deepseek-helmsman/extensions/*/index.ts` | Project directory extension |

You can also load extensions through:

- `--extension <path>` / `-e <path>`
- `extensions` entries in `settings.json`
- packages installed with `deepseek-helmsman install`

Use `/reload` to reload extensions in auto-discovered locations.

## Imports

| Package | Purpose |
|---------|---------|
| `@deepseek-helmsman/coding-agent` | Extension types, helpers, built-in UI helpers |
| `@deepseek-helmsman/ai` | Model, message, and provider types |
| `@deepseek-helmsman/tui` | TUI components for custom renderers |
| `typebox` | Tool parameter schemas |

Node.js built-ins such as `node:fs` and `node:path` are available. Third-party packages work when installed next to the extension or bundled in an installed package.

## Factory

An extension exports a default function that receives `ExtensionAPI`. The function may be synchronous or async.

```typescript
import type { ExtensionAPI } from "@deepseek-helmsman/coding-agent";

export default async function (api: ExtensionAPI) {
  await loadConfig();

  api.on("session_start", async (_event, ctx) => {
    ctx.ui.setStatus("my-extension", "ready");
  });
}
```

Async factories finish before startup continues, so registrations are available before `session_start` and before model selection.

## Common APIs

| API | Purpose |
|-----|---------|
| `api.on(event, handler)` | Subscribe to lifecycle, agent, model, tool, and session events |
| `api.registerTool(definition)` | Register a tool callable by the model |
| `api.registerCommand(name, options)` | Register a slash command |
| `api.registerShortcut(key, options)` | Register an app shortcut |
| `api.registerFlag(name, options)` | Register a CLI flag |
| `api.sendMessage(message, options?)` | Add an extension message to the conversation |
| `api.sendUserMessage(content, options?)` | Queue or send a user message |
| `api.appendEntry(customType, data?)` | Persist extension state in the session file |
| `api.setSessionName(name)` | Set the session display name |
| `api.setLabel(entryId, label)` | Set or clear a tree label |
| `api.setModel(model)` | Switch model |
| `api.setThinkingLevel(level)` | Switch thinking level |
| `api.setActiveTools(names)` | Enable a specific tool set |
| `api.exec(command, args, options?)` | Run a subprocess with cancellation support |
| `api.shutdown()` | Request graceful shutdown |

The extension object can be named anything; examples use `api` to avoid tying the API to the old project name.

## Events

Key event groups:

| Group | Examples |
|-------|----------|
| Session | `session_start`, `session_shutdown`, `session_before_switch`, `session_before_fork`, `session_before_compact`, `session_before_tree` |
| Agent | `before_agent_start`, `agent_start`, `turn_start`, `message_update`, `turn_end`, `agent_end` |
| Model | `model_select`, `thinking_level_select` |
| Tools | `tool_call`, `tool_result`, `tool_execution_start`, `tool_execution_update`, `tool_execution_end`, `user_bash` |
| Resources | `resources_discover` |
| Input | `input` |

Example:

```typescript
api.on("before_agent_start", async (event) => {
  return {
    systemPrompt: event.systemPrompt + "\n\nUse project-specific deployment rules.",
  };
});

api.on("tool_call", async (event) => {
  if (event.toolName === "write" && event.input.path?.endsWith(".env")) {
    return { block: true, reason: "Refusing to write .env files" };
  }
});
```

## Tools

Tools use TypeBox schemas. The `execute` function returns tool-result content for the model.

```typescript
api.registerTool({
  name: "read_config",
  label: "Read Config",
  description: "Read the local app config",
  parameters: Type.Object({}),
  async execute(_toolCallId, _params, _signal, _onUpdate, ctx) {
    const result = await ctx.exec("cat", ["app.config.json"]);
    return {
      content: [{ type: "text", text: result.stdout }],
      details: { exitCode: result.exitCode },
    };
  },
});
```

Tools can define `renderCall` and `renderResult` for custom TUI output. Use `promptGuidelines` to add tool-specific instructions to the system prompt while the tool is active.

## Commands

Commands are invoked as slash commands.

```typescript
api.registerCommand("status", {
  description: "Show project status",
  handler: async (_args, ctx) => {
    const result = await ctx.exec("git", ["status", "--short"]);
    ctx.ui.editor("Git status", result.stdout || "clean");
  },
});
```

Extension commands execute immediately, including while the agent is streaming. They can send their own model messages with `api.sendUserMessage()` or `api.sendMessage()`.

## UI

Interactive mode exposes UI helpers through `ctx.ui`.

```typescript
const choice = await ctx.ui.select("Pick one", ["A", "B", "C"]);
const ok = await ctx.ui.confirm("Continue?", "Run the migration?");
const text = await ctx.ui.input("Name", "example");

ctx.ui.notify(`Choice: ${choice}`, "info");
ctx.ui.setStatus("my-extension", ok ? "enabled" : "disabled");
ctx.ui.setWidget("my-widget", text ? [`Name: ${text}`] : undefined);
```

For complex interfaces, use `ctx.ui.custom()` with components from `@deepseek-helmsman/tui`.

```typescript
import { Text } from "@deepseek-helmsman/tui";

const result = await ctx.ui.custom<boolean>((_tui, theme, _keybindings, done) => {
  const component = new Text(theme.fg("accent", "Press Enter to continue"), 1, 1);
  component.handleInput = (data) => {
    if (data === "\r") done(true);
    if (data === "\x1b") done(false);
  };
  return component;
});
```

In non-interactive modes, check `ctx.hasUI` before using UI methods. RPC mode forwards UI requests through the RPC UI protocol.

## Sessions

Use custom entries for persistent extension state:

```typescript
api.appendEntry("my-extension-state", { enabled: true });

api.on("session_start", async (_event, ctx) => {
  const entries = ctx.sessionManager.getEntries();
  const stateEntries = entries.filter((entry) => entry.type === "custom" && entry.customType === "my-extension-state");
  const latest = stateEntries.at(-1);
  ctx.ui.setStatus("my-extension", latest ? "state loaded" : "no state");
});
```

Session replacement flows (`/new`, `/resume`, `/fork`, `/clone`, reload) tear down and rebind extensions. Put cleanup in `session_shutdown` and rebuild in-memory state in `session_start`.

## Provider Scope

DeepSeek Helmsman ships with DeepSeek as the only provider. Extensions can use the provider registration API only to override the `deepseek` provider, for example to route it through a private DeepSeek-compatible endpoint.

For DeepSeek-compatible private endpoints, prefer the existing `openai-completions` API shape:

```typescript
api.registerProvider("deepseek", {
  baseUrl: "https://deepseek.internal/v1",
  apiKey: "$DEEPSEEK_API_KEY",
  api: "openai-completions",
  models: [
    {
      id: "deepseek-v4-pro",
      name: "Private DeepSeek V4 Pro",
      reasoning: true,
      input: ["text", "image"],
      cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
      contextWindow: 128000,
      maxTokens: 64000,
    },
  ],
});
```

## Examples

See [examples/extensions/](../examples/extensions/) for working code. The most useful starting points are:

| Example | Purpose |
|---------|---------|
| `hello.ts` | Minimal tool registration |
| `commands.ts` | Slash commands |
| `permission-gate.ts` | Blocking risky tool calls |
| `protected-paths.ts` | Guarding writes to specific paths |
| `custom-compaction.ts` | Custom compaction behavior |
| `status-line.ts` | Footer status indicator |
| `working-indicator.ts` | Streaming indicator customization |
| `modal-editor.ts` | Custom editor |
| `message-renderer.ts` | Custom message rendering |
| `github-issue-autocomplete.ts` | Custom autocomplete provider |
| `with-deps/` | Extension with npm dependencies |
