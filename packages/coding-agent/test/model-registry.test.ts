import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Api, Model, OpenAICompletionsCompat } from "@deepseek-helmsman/ai";
import { getApiProvider } from "@deepseek-helmsman/ai";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { AuthStorage } from "../src/core/auth-storage.ts";
import { clearApiKeyCache, ModelRegistry, type ProviderConfigInput } from "../src/core/model-registry.ts";
import { clearDeprecationWarningsForTests } from "../src/utils/deprecation.ts";

describe("ModelRegistry", () => {
	let tempDir: string;
	let modelsJsonPath: string;
	let authStorage: AuthStorage;

	beforeEach(() => {
		tempDir = join(tmpdir(), `deepseek-helmsman-model-registry-${Date.now()}-${Math.random().toString(36).slice(2)}`);
		mkdirSync(tempDir, { recursive: true });
		modelsJsonPath = join(tempDir, "models.json");
		authStorage = AuthStorage.create(join(tempDir, "auth.json"));
		clearDeprecationWarningsForTests();
	});

	afterEach(() => {
		if (tempDir && existsSync(tempDir)) {
			rmSync(tempDir, { recursive: true });
		}
		clearApiKeyCache();
		clearDeprecationWarningsForTests();
		vi.restoreAllMocks();
	});

	function providerConfig(
		baseUrl: string,
		models: Array<{ id: string; name?: string }>,
		api: Api = "openai-completions",
	): ProviderConfigInput {
		return {
			baseUrl,
			api,
			models: models.map((model) => ({
				id: model.id,
				name: model.name ?? model.id,
				reasoning: false,
				input: ["text"],
				cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
				contextWindow: 128000,
				maxTokens: 8192,
			})),
		};
	}

	function writeRawModelsJson(providers: Record<string, unknown>) {
		writeFileSync(modelsJsonPath, JSON.stringify({ providers }));
	}

	function writeModelsJson(providers: Record<string, ProviderConfigInput>) {
		writeRawModelsJson(providers);
	}

	function getModelsForProvider(registry: ModelRegistry, provider: string) {
		return registry.getAll().filter((model) => model.provider === provider);
	}

	const streamModel: Model<Api> = {
		id: "deepseek-v4-pro",
		name: "DeepSeek V4 Pro",
		api: "openai-completions",
		provider: "deepseek",
		baseUrl: "https://api.deepseek.com/v1",
		reasoning: true,
		input: ["text"],
		cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
		contextWindow: 128000,
		maxTokens: 8192,
	};

	describe("built-in DeepSeek models", () => {
		test("loads only the built-in DeepSeek provider", () => {
			const registry = ModelRegistry.create(authStorage, modelsJsonPath);
			const providers = new Set(registry.getAll().map((model) => model.provider));

			expect([...providers]).toEqual(["deepseek"]);
			expect(registry.find("deepseek", "deepseek-v4-pro")).toBeDefined();
			expect(registry.find("deepseek", "deepseek-v4-flash")).toBeDefined();
		});

		test("baseUrl and headers override all built-in DeepSeek models", async () => {
			writeRawModelsJson({
				deepseek: {
					baseUrl: "https://proxy.example.com/v1",
					headers: { "X-Custom-Header": "custom-value" },
				},
			});

			const registry = ModelRegistry.create(authStorage, modelsJsonPath);
			const deepseekModels = getModelsForProvider(registry, "deepseek");

			expect(deepseekModels.length).toBeGreaterThan(0);
			expect(deepseekModels.every((model) => model.baseUrl === "https://proxy.example.com/v1")).toBe(true);

			const auth = await registry.getApiKeyAndHeaders(deepseekModels[0]);
			expect(auth.ok).toBe(true);
			if (auth.ok) {
				expect(auth.headers?.["X-Custom-Header"]).toBe("custom-value");
			}
		});

		test("custom DeepSeek models inherit the built-in API and baseUrl", () => {
			writeRawModelsJson({
				deepseek: {
					models: [
						{
							id: "deepseek-custom",
							name: "DeepSeek Custom",
							reasoning: true,
							input: ["text"],
							contextWindow: 128000,
							maxTokens: 8192,
						},
					],
				},
			});

			const registry = ModelRegistry.create(authStorage, modelsJsonPath);
			const model = registry.find("deepseek", "deepseek-custom");

			expect(registry.getError()).toBeUndefined();
			expect(model?.api).toBe("openai-completions");
			expect(model?.baseUrl).toBe(registry.find("deepseek", "deepseek-v4-pro")?.baseUrl);
		});

		test("model overrides apply to built-in DeepSeek models", async () => {
			writeRawModelsJson({
				deepseek: {
					modelOverrides: {
						"deepseek-v4-pro": {
							name: "DeepSeek Proxy Pro",
							cost: { input: 99 },
							headers: { "X-Model-Header": "value" },
							compat: { supportsStrictMode: false },
						},
					},
				},
			});

			const registry = ModelRegistry.create(authStorage, modelsJsonPath);
			const model = registry.find("deepseek", "deepseek-v4-pro");
			const compat = model?.compat as OpenAICompletionsCompat | undefined;

			expect(model?.name).toBe("DeepSeek Proxy Pro");
			expect(model?.cost.input).toBe(99);
			expect(compat?.supportsStrictMode).toBe(false);

			const auth = await registry.getApiKeyAndHeaders(model!);
			expect(auth.ok).toBe(true);
			if (auth.ok) {
				expect(auth.headers?.["X-Model-Header"]).toBe("value");
			}
		});
	});

	describe("DeepSeek model config", () => {
		test("rejects non-DeepSeek providers", () => {
			writeRawModelsJson({
				"not-deepseek": {
					baseUrl: "https://example.com/v1",
					api: "openai-completions",
					models: [{ id: "custom-model", api: "openai-completions" }],
				},
			});

			const registry = ModelRegistry.create(authStorage, modelsJsonPath);

			expect(registry.getError()).toContain('only supports provider "deepseek"');
		});

		test("provider-level compat applies to custom DeepSeek models", () => {
			writeRawModelsJson({
				deepseek: {
					baseUrl: "https://example.com/v1",
					api: "openai-completions",
					compat: {
						supportsUsageInStreaming: false,
						maxTokensField: "max_tokens",
					},
					models: [
						{
							id: "demo-model",
							reasoning: false,
							input: ["text"],
							cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
							contextWindow: 1000,
							maxTokens: 100,
						},
					],
				},
			});

			const registry = ModelRegistry.create(authStorage, modelsJsonPath);
			const compat = registry.find("deepseek", "demo-model")?.compat as OpenAICompletionsCompat | undefined;

			expect(registry.getError()).toBeUndefined();
			expect(compat?.supportsUsageInStreaming).toBe(false);
			expect(compat?.maxTokensField).toBe("max_tokens");
		});

		test("model-level compat overrides provider-level compat for DeepSeek models", () => {
			writeRawModelsJson({
				deepseek: {
					baseUrl: "https://example.com/v1",
					api: "openai-completions",
					compat: { supportsUsageInStreaming: false },
					models: [
						{
							id: "demo-model",
							reasoning: true,
							input: ["text"],
							cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
							contextWindow: 1000,
							maxTokens: 100,
							thinkingLevelMap: { minimal: null, high: "max" },
							compat: {
								supportsUsageInStreaming: true,
								thinkingFormat: "deepseek",
								requiresReasoningContentOnAssistantMessages: true,
							},
						},
					],
				},
			});

			const registry = ModelRegistry.create(authStorage, modelsJsonPath);
			const model = registry.find("deepseek", "demo-model");
			const compat = model?.compat as OpenAICompletionsCompat | undefined;

			expect(registry.getError()).toBeUndefined();
			expect(model?.thinkingLevelMap).toEqual({ minimal: null, high: "max" });
			expect(compat?.supportsUsageInStreaming).toBe(true);
			expect(compat?.thinkingFormat).toBe("deepseek");
			expect(compat?.requiresReasoningContentOnAssistantMessages).toBe(true);
		});

		test("model-level baseUrl overrides provider-level baseUrl for DeepSeek models", () => {
			writeRawModelsJson({
				deepseek: {
					baseUrl: "https://provider.example.com/v1",
					api: "openai-completions",
					models: [
						{
							id: "demo-a",
							baseUrl: "https://model.example.com/v1",
							reasoning: false,
							input: ["text"],
							cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
							contextWindow: 1000,
							maxTokens: 100,
						},
						{
							id: "demo-b",
							reasoning: false,
							input: ["text"],
							cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
							contextWindow: 1000,
							maxTokens: 100,
						},
					],
				},
			});

			const registry = ModelRegistry.create(authStorage, modelsJsonPath);

			expect(registry.find("deepseek", "demo-a")?.baseUrl).toBe("https://model.example.com/v1");
			expect(registry.find("deepseek", "demo-b")?.baseUrl).toBe("https://provider.example.com/v1");
		});
	});

	describe("dynamic provider lifecycle", () => {
		test("getProviderDisplayName resolves built-in, registered DeepSeek override, OAuth, and fallback names", () => {
			const registry = ModelRegistry.create(authStorage, modelsJsonPath);

			expect(registry.getProviderDisplayName("deepseek")).toBe("DeepSeek");
			expect(registry.getProviderDisplayName("unknown-provider")).toBe("unknown-provider");

			registry.registerProvider("deepseek", {
				name: "DeepSeek Proxy",
				...providerConfig("https://provider.test/v1", [{ id: "deepseek-demo" }]),
			});
			expect(registry.getProviderDisplayName("deepseek")).toBe("DeepSeek Proxy");

			registry.unregisterProvider("deepseek");
			registry.registerProvider("deepseek", {
				baseUrl: "https://provider.test/v1",
				api: "openai-completions",
				oauth: {
					name: "DeepSeek OAuth",
					login: async () => ({ access: "access", refresh: "refresh", expires: Date.now() + 60_000 }),
					refreshToken: async (credentials) => credentials,
					getApiKey: (credentials) => credentials.access,
				},
				models: providerConfig("https://provider.test/v1", [{ id: "deepseek-oauth-model" }]).models,
			});
			expect(registry.getProviderDisplayName("deepseek")).toBe("DeepSeek OAuth");
		});

		test("registerProvider rejects non-DeepSeek providers", () => {
			const registry = ModelRegistry.create(authStorage, modelsJsonPath);
			const unsupportedProvider = "not-deepseek" as "deepseek";

			expect(() => {
				registry.registerProvider(unsupportedProvider, {
					...providerConfig("https://provider.test/v1", [{ id: "demo-model" }]),
				});
			}).toThrow('only supports provider "deepseek"');
		});

		test("unregisterProvider removes custom streamSimple override and restores built-in handler", () => {
			const registry = ModelRegistry.create(authStorage, modelsJsonPath);

			registry.registerProvider("deepseek", {
				api: "openai-completions",
				streamSimple: () => {
					throw new Error("custom streamSimple override");
				},
			});

			expect(() => getApiProvider("openai-completions")?.streamSimple(streamModel, { messages: [] })).toThrow(
				"custom streamSimple override",
			);

			registry.unregisterProvider("deepseek");

			expect(() => getApiProvider("openai-completions")?.streamSimple(streamModel, { messages: [] })).not.toThrow(
				"custom streamSimple override",
			);
		});

		test("baseUrl-only override keeps built-in DeepSeek models after refresh", () => {
			const registry = ModelRegistry.create(authStorage, modelsJsonPath);

			registry.registerProvider("deepseek", { baseUrl: "https://proxy.test/deepseek" });
			registry.refresh();

			const deepseekModels = getModelsForProvider(registry, "deepseek");
			expect(deepseekModels.length).toBeGreaterThan(0);
			expect(deepseekModels.every((model) => model.baseUrl === "https://proxy.test/deepseek")).toBe(true);
		});

		test("models-only override replaces built-in DeepSeek models after refresh", () => {
			const registry = ModelRegistry.create(authStorage, modelsJsonPath);

			registry.registerProvider("deepseek", {
				...providerConfig("https://custom.test/deepseek", [{ id: "custom-deepseek" }]),
				baseUrl: "https://custom.test/deepseek",
			});
			registry.refresh();

			expect(getModelsForProvider(registry, "deepseek").map((model) => model.id)).toEqual(["custom-deepseek"]);
			expect(registry.find("deepseek", "custom-deepseek")?.baseUrl).toBe("https://custom.test/deepseek");
		});
	});

	describe("API key resolution", () => {
		test("uses stored auth.json API key", async () => {
			authStorage.set("deepseek", { type: "api_key", key: "stored-key" });
			writeModelsJson({
				deepseek: providerConfig("https://example.com/v1", [{ id: "test-model" }], "openai-completions"),
			});

			const registry = ModelRegistry.create(authStorage, modelsJsonPath);

			expect(await registry.getApiKeyForProvider("deepseek")).toBe("stored-key");
		});

		test("models.json authHeader adds bearer authorization", async () => {
			authStorage.set("deepseek", { type: "api_key", key: "deepseek-key" });
			writeRawModelsJson({
				deepseek: {
					baseUrl: "https://example.com/v1",
					authHeader: true,
					api: "openai-completions",
					models: [
						{
							id: "demo-model",
							reasoning: false,
							input: ["text"],
							cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
							contextWindow: 1000,
							maxTokens: 100,
						},
					],
				},
			});

			const registry = ModelRegistry.create(authStorage, modelsJsonPath);
			const model = registry.find("deepseek", "demo-model");

			expect(model).toBeDefined();
			const auth = await registry.getApiKeyAndHeaders(model!);
			expect(auth).toMatchObject({
				ok: true,
				apiKey: "deepseek-key",
				headers: { Authorization: "Bearer deepseek-key" },
			});
		});
	});
});
