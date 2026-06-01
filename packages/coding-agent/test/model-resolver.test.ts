import type { Api, Model } from "@deepseek-helmsman/ai";
import { describe, expect, test } from "vitest";
import {
	defaultModelPerProvider,
	findInitialModel,
	parseModelPattern,
	resolveCliModel,
} from "../src/core/model-resolver.ts";

function createModel(
	id: string,
	options: Partial<Pick<Model<Api>, "name" | "reasoning" | "maxTokens">> = {},
): Model<Api> {
	return {
		id,
		name: options.name ?? id,
		api: "openai-completions",
		provider: "deepseek",
		baseUrl: "https://api.deepseek.com/v1",
		reasoning: options.reasoning ?? true,
		input: ["text"],
		cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
		contextWindow: 128000,
		maxTokens: options.maxTokens ?? 8192,
	};
}

const deepseekPro = createModel("deepseek-v4-pro", { name: "DeepSeek V4 Pro" });
const deepseekFlash = createModel("deepseek-v4-flash", { name: "DeepSeek V4 Flash", maxTokens: 4096 });
const deepseekPreview = createModel("deepseek-v4-pro:preview", { name: "DeepSeek V4 Pro Preview" });
const allModels = [deepseekPro, deepseekFlash, deepseekPreview];

describe("parseModelPattern", () => {
	test("exact match returns the model with no thinking override", () => {
		const result = parseModelPattern("deepseek-v4-pro", allModels);

		expect(result.model?.id).toBe("deepseek-v4-pro");
		expect(result.thinkingLevel).toBeUndefined();
		expect(result.warning).toBeUndefined();
	});

	test("partial match uses model id and display name", () => {
		const byId = parseModelPattern("v4-flash", allModels);
		const byName = parseModelPattern("Preview", allModels);

		expect(byId.model?.id).toBe("deepseek-v4-flash");
		expect(byName.model?.id).toBe("deepseek-v4-pro:preview");
	});

	test("valid thinking suffix is extracted from the model pattern", () => {
		const result = parseModelPattern("deepseek-v4-pro:high", allModels);

		expect(result.model?.id).toBe("deepseek-v4-pro");
		expect(result.thinkingLevel).toBe("high");
		expect(result.warning).toBeUndefined();
	});

	test("model IDs containing colons still match exactly", () => {
		const result = parseModelPattern("deepseek-v4-pro:preview", allModels);

		expect(result.model?.id).toBe("deepseek-v4-pro:preview");
		expect(result.thinkingLevel).toBeUndefined();
		expect(result.warning).toBeUndefined();
	});

	test("invalid thinking suffix falls back to the model in scope matching", () => {
		const result = parseModelPattern("deepseek-v4-pro:random", allModels);

		expect(result.model?.id).toBe("deepseek-v4-pro");
		expect(result.thinkingLevel).toBeUndefined();
		expect(result.warning).toContain("Invalid thinking level");
	});
});

describe("resolveCliModel", () => {
	const registry = {
		getAll: () => allModels,
	} as unknown as Parameters<typeof resolveCliModel>[0]["modelRegistry"];

	test("resolves --model deepseek/model without --provider", () => {
		const result = resolveCliModel({
			cliModel: "deepseek/deepseek-v4-pro",
			modelRegistry: registry,
		});

		expect(result.error).toBeUndefined();
		expect(result.model?.provider).toBe("deepseek");
		expect(result.model?.id).toBe("deepseek-v4-pro");
	});

	test("resolves fuzzy patterns within an explicit provider", () => {
		const result = resolveCliModel({
			cliProvider: "deepseek",
			cliModel: "flash",
			modelRegistry: registry,
		});

		expect(result.error).toBeUndefined();
		expect(result.model?.id).toBe("deepseek-v4-flash");
	});

	test("supports --model pattern:thinking", () => {
		const result = resolveCliModel({
			cliModel: "deepseek-v4-pro:high",
			modelRegistry: registry,
		});

		expect(result.error).toBeUndefined();
		expect(result.model?.id).toBe("deepseek-v4-pro");
		expect(result.thinkingLevel).toBe("high");
	});

	test("allows explicit DeepSeek custom model ids without rejecting the CLI request", () => {
		const result = resolveCliModel({
			cliProvider: "deepseek",
			cliModel: "deepseek-custom-model",
			modelRegistry: registry,
		});

		expect(result.error).toBeUndefined();
		expect(result.model?.provider).toBe("deepseek");
		expect(result.model?.id).toBe("deepseek-custom-model");
		expect(result.warning).toContain("Using custom model id");
	});

	test("returns a clear error for unknown providers", () => {
		const result = resolveCliModel({
			cliProvider: "unknown",
			cliModel: "deepseek-v4-pro",
			modelRegistry: registry,
		});

		expect(result.model).toBeUndefined();
		expect(result.error).toBe('Unknown provider "unknown". DeepSeek Helmsman only supports provider "deepseek".');
	});

	test("returns a clear error when there are no models", () => {
		const emptyRegistry = {
			getAll: () => [],
		} as unknown as Parameters<typeof resolveCliModel>[0]["modelRegistry"];

		const result = resolveCliModel({
			cliProvider: "deepseek",
			cliModel: "deepseek-v4-pro",
			modelRegistry: emptyRegistry,
		});

		expect(result.model).toBeUndefined();
		expect(result.error).toContain("No models available");
	});
});

describe("default model selection", () => {
	test("DeepSeek default tracks the built-in model catalog", () => {
		expect(defaultModelPerProvider.deepseek).toBe("deepseek-v4-pro");
	});

	test("findInitialModel selects the DeepSeek default when available", async () => {
		const registry = {
			getAvailable: async () => [deepseekFlash, deepseekPro],
		} as unknown as Parameters<typeof findInitialModel>[0]["modelRegistry"];

		const result = await findInitialModel({
			scopedModels: [],
			isContinuing: false,
			modelRegistry: registry,
		});

		expect(result.model?.provider).toBe("deepseek");
		expect(result.model?.id).toBe("deepseek-v4-pro");
	});

	test("findInitialModel uses the scoped model before availability fallback", async () => {
		const registry = {
			getAvailable: async () => [deepseekPro],
		} as unknown as Parameters<typeof findInitialModel>[0]["modelRegistry"];

		const result = await findInitialModel({
			scopedModels: [{ model: deepseekFlash, thinkingLevel: "low" }],
			isContinuing: false,
			modelRegistry: registry,
		});

		expect(result.model?.id).toBe("deepseek-v4-flash");
		expect(result.thinkingLevel).toBe("low");
	});
});
