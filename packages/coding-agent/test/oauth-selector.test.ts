import { setKeybindings } from "@deepseek-helmsman/tui";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { AuthStorage } from "../src/core/auth-storage.ts";
import { KeybindingsManager } from "../src/core/keybindings.ts";
import { BUILT_IN_PROVIDER_DISPLAY_NAMES } from "../src/core/provider-display-names.ts";
import { OAuthSelectorComponent } from "../src/modes/interactive/components/oauth-selector.ts";
import { isApiKeyLoginProvider } from "../src/modes/interactive/interactive-mode.ts";
import { initTheme } from "../src/modes/interactive/theme/theme.ts";
import { stripAnsi } from "../src/utils/ansi.ts";

describe("OAuthSelectorComponent", () => {
	beforeAll(() => {
		initTheme("dark");
	});

	beforeEach(() => {
		setKeybindings(new KeybindingsManager());
	});

	it("keeps built-in API key providers separate from OAuth-only providers", () => {
		const oauthProviderIds = new Set(["custom-oauth"]);
		const builtInProviderIds = new Set(["deepseek"]);

		expect(isApiKeyLoginProvider("deepseek", oauthProviderIds, builtInProviderIds)).toBe(true);
		expect(BUILT_IN_PROVIDER_DISPLAY_NAMES.deepseek).toBe("DeepSeek");
		expect(isApiKeyLoginProvider("custom-oauth", oauthProviderIds, builtInProviderIds)).toBe(false);
		expect(isApiKeyLoginProvider("custom-api", oauthProviderIds, builtInProviderIds)).toBe(true);
	});

	it("shows stored OAuth auth distinctly in the API key selector", () => {
		const authStorage = AuthStorage.inMemory({
			deepseek: {
				type: "oauth",
				access: "access-token",
				refresh: "refresh-token",
				expires: Date.now() + 60_000,
			},
		});
		const selector = new OAuthSelectorComponent(
			"login",
			authStorage,
			[{ id: "deepseek", name: "DeepSeek", authType: "api_key" }],
			() => {},
			() => {},
		);

		const output = stripAnsi(selector.render(120).join("\n"));

		expect(output).toContain("DeepSeek");
		expect(output).toContain("OAuth configured");
	});

	it("ignores environment API key auth", () => {
		const originalDeepSeekApiKey = process.env.DEEPSEEK_API_KEY;
		process.env.DEEPSEEK_API_KEY = "test-deepseek-key";

		try {
			const authStorage = AuthStorage.inMemory();
			const selector = new OAuthSelectorComponent(
				"login",
				authStorage,
				[{ id: "deepseek", name: "DeepSeek", authType: "api_key" }],
				() => {},
				() => {},
			);

			const output = stripAnsi(selector.render(120).join("\n"));

			expect(output).toContain("DeepSeek");
			expect(output).toContain("unconfigured");
			expect(output).not.toContain("env:");
		} finally {
			if (originalDeepSeekApiKey === undefined) {
				delete process.env.DEEPSEEK_API_KEY;
			} else {
				process.env.DEEPSEEK_API_KEY = originalDeepSeekApiKey;
			}
		}
	});
});
