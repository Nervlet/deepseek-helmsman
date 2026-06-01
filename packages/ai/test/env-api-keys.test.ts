import { afterEach, describe, expect, it } from "vitest";
import { findEnvKeys, getEnvApiKey } from "../src/env-api-keys.ts";

const originalDeepSeekApiKey = process.env.DEEPSEEK_API_KEY;

afterEach(() => {
	if (originalDeepSeekApiKey === undefined) {
		delete process.env.DEEPSEEK_API_KEY;
	} else {
		process.env.DEEPSEEK_API_KEY = originalDeepSeekApiKey;
	}
});

describe("environment API keys", () => {
	it("resolves DeepSeek credentials from DEEPSEEK_API_KEY", () => {
		process.env.DEEPSEEK_API_KEY = "deepseek-token";

		expect(findEnvKeys("deepseek")).toEqual(["DEEPSEEK_API_KEY"]);
		expect(getEnvApiKey("deepseek")).toBe("deepseek-token");
	});

	it("does not define keys for non-DeepSeek providers", () => {
		expect(findEnvKeys("openai")).toBeUndefined();
		expect(getEnvApiKey("openai")).toBeUndefined();
	});
});
