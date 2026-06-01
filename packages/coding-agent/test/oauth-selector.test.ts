import { setKeybindings } from "@deepseek-helmsman/tui";
import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { AuthStorage } from "../src/core/auth-storage.ts";
import { KeybindingsManager } from "../src/core/keybindings.ts";
import { BUILT_IN_PROVIDER_DISPLAY_NAMES } from "../src/core/provider-display-names.ts";
import { OAuthSelectorComponent } from "../src/modes/interactive/components/oauth-selector.ts";
import { isApiKeyLoginProvider } from "../src/modes/interactive/interactive-mode.ts";
import { initTheme } from "../src/modes/interactive/theme/theme.ts";
import { stripAnsi } from "../src/utils/ansi.ts";

const originalDeepSeekApiKey = process.env.DEEPSEEK_API_KEY;

describe("OAuthSelectorComponent", () => {
	beforeAll(() => {
		initTheme("dark");
	});

	beforeEach(() => {
		setKeybindings(new KeybindingsManager());
	});

	afterEach(() => {
		if (originalDeepSeekApiKey === undefined) {
			delete process.env.DEEPSEEK_API_KEY;
		} else {
			process.env.DEEPSEEK_API_KEY = originalDeepSeekApiKey;
		}
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

	it("shows environment API key auth as configured", () => {
		process.env.DEEPSEEK_API_KEY = "test-deepseek-key";
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
		expect(output).toContain("✓ env: DEEPSEEK_API_KEY");
		expect(output).not.toContain("unconfigured");
	});

	it("shows DeepSeek proxy environment API key auth from status resolver", () => {
		const authStorage = AuthStorage.inMemory();
		const selector = new OAuthSelectorComponent(
			"login",
			authStorage,
			[{ id: "deepseek", name: "DeepSeek Proxy", authType: "api_key" }],
			() => {},
			() => {},
			() => ({ configured: true, source: "environment", label: "DEEPSEEK_API_KEY" }),
		);

		const output = stripAnsi(selector.render(120).join("\n"));

		expect(output).toContain("DeepSeek Proxy");
		expect(output).toContain("✓ env: DEEPSEEK_API_KEY");
		expect(output).not.toContain("unconfigured");
	});

	it("shows models.json API key auth as configured", () => {
		const authStorage = AuthStorage.inMemory();
		const selector = new OAuthSelectorComponent(
			"login",
			authStorage,
			[{ id: "deepseek", name: "DeepSeek", authType: "api_key" }],
			() => {},
			() => {},
			() => ({ configured: true, source: "models_json_key" }),
		);

		const output = stripAnsi(selector.render(120).join("\n"));

		expect(output).toContain("DeepSeek");
		expect(output).toContain("✓ key in models.json");
		expect(output).not.toContain("unconfigured");
	});

	it("shows models.json command auth as configured", () => {
		const authStorage = AuthStorage.inMemory();
		const selector = new OAuthSelectorComponent(
			"login",
			authStorage,
			[{ id: "deepseek", name: "DeepSeek", authType: "api_key" }],
			() => {},
			() => {},
			() => ({ configured: true, source: "models_json_command" }),
		);

		const output = stripAnsi(selector.render(120).join("\n"));

		expect(output).toContain("DeepSeek");
		expect(output).toContain("✓ command in models.json");
		expect(output).not.toContain("unconfigured");
	});
});
