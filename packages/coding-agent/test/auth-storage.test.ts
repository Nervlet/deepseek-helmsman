import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { registerOAuthProvider } from "@deepseek-helmsman/ai/oauth";
import lockfile from "proper-lockfile";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { AuthStorage } from "../src/core/auth-storage.ts";
import { clearConfigValueCache } from "../src/core/resolve-config-value.ts";

describe("AuthStorage", () => {
	let tempDir: string;
	let authJsonPath: string;
	let authStorage: AuthStorage;

	beforeEach(() => {
		tempDir = join(
			tmpdir(),
			`deepseek-helmsman-test-auth-storage-${Date.now()}-${Math.random().toString(36).slice(2)}`,
		);
		mkdirSync(tempDir, { recursive: true });
		authJsonPath = join(tempDir, "auth.json");
	});

	afterEach(() => {
		if (tempDir && existsSync(tempDir)) {
			rmSync(tempDir, { recursive: true });
		}
		clearConfigValueCache();
		vi.restoreAllMocks();
	});

	function writeAuthJson(data: Record<string, unknown>) {
		writeFileSync(authJsonPath, JSON.stringify(data));
	}

	function toShPath(value: string): string {
		return value.replace(/\\/g, "/").replace(/"/g, '\\"');
	}

	describe("API key resolution", () => {
		test("literal API key is returned directly", async () => {
			writeAuthJson({
				deepseek: { type: "api_key", key: "sk-ant-literal-key" },
			});

			authStorage = AuthStorage.create(authJsonPath);
			const apiKey = await authStorage.getApiKey("deepseek");

			expect(apiKey).toBe("sk-ant-literal-key");
		});

		test("apiKey with ! prefix executes command and uses stdout", async () => {
			writeAuthJson({
				deepseek: { type: "api_key", key: "!echo test-api-key-from-command" },
			});

			authStorage = AuthStorage.create(authJsonPath);
			const apiKey = await authStorage.getApiKey("deepseek");

			expect(apiKey).toBe("test-api-key-from-command");
		});

		test("apiKey with ! prefix trims whitespace from command output", async () => {
			writeAuthJson({
				deepseek: { type: "api_key", key: "!echo '  spaced-key  '" },
			});

			authStorage = AuthStorage.create(authJsonPath);
			const apiKey = await authStorage.getApiKey("deepseek");

			expect(apiKey).toBe("spaced-key");
		});

		test("apiKey with ! prefix handles multiline output (uses trimmed result)", async () => {
			writeAuthJson({
				deepseek: { type: "api_key", key: "!printf 'line1\\nline2'" },
			});

			authStorage = AuthStorage.create(authJsonPath);
			const apiKey = await authStorage.getApiKey("deepseek");

			expect(apiKey).toBe("line1\nline2");
		});

		test("apiKey with ! prefix returns undefined on command failure", async () => {
			writeAuthJson({
				deepseek: { type: "api_key", key: "!exit 1" },
			});

			authStorage = AuthStorage.create(authJsonPath);
			const apiKey = await authStorage.getApiKey("deepseek");

			expect(apiKey).toBeUndefined();
		});

		test("apiKey with ! prefix returns undefined on nonexistent command", async () => {
			writeAuthJson({
				deepseek: { type: "api_key", key: "!nonexistent-command-12345" },
			});

			authStorage = AuthStorage.create(authJsonPath);
			const apiKey = await authStorage.getApiKey("deepseek");

			expect(apiKey).toBeUndefined();
		});

		test("apiKey with ! prefix returns undefined on empty output", async () => {
			writeAuthJson({
				deepseek: { type: "api_key", key: "!printf ''" },
			});

			authStorage = AuthStorage.create(authJsonPath);
			const apiKey = await authStorage.getApiKey("deepseek");

			expect(apiKey).toBeUndefined();
		});

		test("apiKey with $ prefix resolves to env value", async () => {
			const originalEnv = process.env.TEST_AUTH_API_KEY_12345;
			process.env.TEST_AUTH_API_KEY_12345 = "env-api-key-value";

			try {
				writeAuthJson({
					deepseek: { type: "api_key", key: "$TEST_AUTH_API_KEY_12345" },
				});

				authStorage = AuthStorage.create(authJsonPath);
				const apiKey = await authStorage.getApiKey("deepseek");

				expect(apiKey).toBe("env-api-key-value");
			} finally {
				if (originalEnv === undefined) {
					delete process.env.TEST_AUTH_API_KEY_12345;
				} else {
					process.env.TEST_AUTH_API_KEY_12345 = originalEnv;
				}
			}
		});

		test("apiKey with braced env syntax resolves to env value", async () => {
			const originalEnv = process.env.TEST_AUTH_BRACED_API_KEY_12345;
			process.env.TEST_AUTH_BRACED_API_KEY_12345 = "braced-env-api-key-value";
			const bracedKey = "$" + "{TEST_AUTH_BRACED_API_KEY_12345}";

			try {
				writeAuthJson({
					deepseek: { type: "api_key", key: bracedKey },
				});

				authStorage = AuthStorage.create(authJsonPath);
				const apiKey = await authStorage.getApiKey("deepseek");

				expect(apiKey).toBe("braced-env-api-key-value");
			} finally {
				if (originalEnv === undefined) {
					delete process.env.TEST_AUTH_BRACED_API_KEY_12345;
				} else {
					process.env.TEST_AUTH_BRACED_API_KEY_12345 = originalEnv;
				}
			}
		});

		test("apiKey interpolates braced env references inside literals", async () => {
			const originalPartA = process.env.TEST_AUTH_INTERPOLATED_PART_A_12345;
			const originalPartB = process.env.TEST_AUTH_INTERPOLATED_PART_B_12345;
			process.env.TEST_AUTH_INTERPOLATED_PART_A_12345 = "left";
			process.env.TEST_AUTH_INTERPOLATED_PART_B_12345 = "right";
			const interpolatedKey = [
				"$",
				"{TEST_AUTH_INTERPOLATED_PART_A_12345}_$",
				"{TEST_AUTH_INTERPOLATED_PART_B_12345}",
			].join("");

			try {
				writeAuthJson({
					deepseek: { type: "api_key", key: interpolatedKey },
				});

				authStorage = AuthStorage.create(authJsonPath);
				const apiKey = await authStorage.getApiKey("deepseek");

				expect(apiKey).toBe("left_right");
			} finally {
				if (originalPartA === undefined) {
					delete process.env.TEST_AUTH_INTERPOLATED_PART_A_12345;
				} else {
					process.env.TEST_AUTH_INTERPOLATED_PART_A_12345 = originalPartA;
				}
				if (originalPartB === undefined) {
					delete process.env.TEST_AUTH_INTERPOLATED_PART_B_12345;
				} else {
					process.env.TEST_AUTH_INTERPOLATED_PART_B_12345 = originalPartB;
				}
			}
		});

		test("apiKey with $$ prefix escapes a leading dollar", async () => {
			writeAuthJson({
				deepseek: { type: "api_key", key: "$$TEST_AUTH_API_KEY_12345" },
			});

			authStorage = AuthStorage.create(authJsonPath);
			const apiKey = await authStorage.getApiKey("deepseek");

			expect(apiKey).toBe("$TEST_AUTH_API_KEY_12345");
		});

		test("apiKey with $! escapes a literal bang and still interpolates later env refs", async () => {
			const originalEnv = process.env.TEST_AUTH_API_KEY_12345;
			process.env.TEST_AUTH_API_KEY_12345 = "env-api-key-value";

			try {
				writeAuthJson({
					deepseek: { type: "api_key", key: "$!literal-$TEST_AUTH_API_KEY_12345" },
				});

				authStorage = AuthStorage.create(authJsonPath);
				const apiKey = await authStorage.getApiKey("deepseek");

				expect(apiKey).toBe("!literal-env-api-key-value");
			} finally {
				if (originalEnv === undefined) {
					delete process.env.TEST_AUTH_API_KEY_12345;
				} else {
					process.env.TEST_AUTH_API_KEY_12345 = originalEnv;
				}
			}
		});

		test("plain API key is used directly even when it matches an env var", async () => {
			const originalEnv = process.env.TEST_AUTH_API_KEY_12345;
			process.env.TEST_AUTH_API_KEY_12345 = "env-api-key-value";

			try {
				writeAuthJson({
					deepseek: { type: "api_key", key: "TEST_AUTH_API_KEY_12345" },
				});

				authStorage = AuthStorage.create(authJsonPath);
				const apiKey = await authStorage.getApiKey("deepseek");

				expect(apiKey).toBe("TEST_AUTH_API_KEY_12345");
			} finally {
				if (originalEnv === undefined) {
					delete process.env.TEST_AUTH_API_KEY_12345;
				} else {
					process.env.TEST_AUTH_API_KEY_12345 = originalEnv;
				}
			}
		});

		test("literal public API key is not corrupted by the Windows PUBLIC env var", async () => {
			const originalPublic = process.env.PUBLIC;
			process.env.PUBLIC = "C:\\Users\\Public";

			try {
				writeAuthJson({
					"external-entry": { type: "api_key", key: "public" },
				});

				authStorage = AuthStorage.create(authJsonPath);
				const apiKey = await authStorage.getApiKey("external-entry");

				expect(apiKey).toBe("public");
			} finally {
				if (originalPublic === undefined) {
					delete process.env.PUBLIC;
				} else {
					process.env.PUBLIC = originalPublic;
				}
			}
		});

		test("apiKey as literal value is used directly when not an env var", async () => {
			// Make sure this isn't an env var
			delete process.env.literal_api_key_value;

			writeAuthJson({
				deepseek: { type: "api_key", key: "literal_api_key_value" },
			});

			authStorage = AuthStorage.create(authJsonPath);
			const apiKey = await authStorage.getApiKey("deepseek");

			expect(apiKey).toBe("literal_api_key_value");
		});

		test("apiKey command can use shell features like pipes", async () => {
			writeAuthJson({
				deepseek: { type: "api_key", key: "!echo 'hello world' | tr ' ' '-'" },
			});

			authStorage = AuthStorage.create(authJsonPath);
			const apiKey = await authStorage.getApiKey("deepseek");

			expect(apiKey).toBe("hello-world");
		});

		describe("caching", () => {
			test("command is only executed once per process", async () => {
				// Use a command that writes to a file to count invocations
				const counterFile = join(tempDir, "counter");
				writeFileSync(counterFile, "0");

				const counterPath = toShPath(counterFile);
				const command = `!sh -c 'count=$(cat "${counterPath}"); echo $((count + 1)) > "${counterPath}"; echo "key-value"'`;
				writeAuthJson({
					deepseek: { type: "api_key", key: command },
				});

				authStorage = AuthStorage.create(authJsonPath);

				// Call multiple times
				await authStorage.getApiKey("deepseek");
				await authStorage.getApiKey("deepseek");
				await authStorage.getApiKey("deepseek");

				// Command should have only run once
				const count = parseInt(readFileSync(counterFile, "utf-8").trim(), 10);
				expect(count).toBe(1);
			});

			test("cache persists across AuthStorage instances", async () => {
				const counterFile = join(tempDir, "counter");
				writeFileSync(counterFile, "0");

				const counterPath = toShPath(counterFile);
				const command = `!sh -c 'count=$(cat "${counterPath}"); echo $((count + 1)) > "${counterPath}"; echo "key-value"'`;
				writeAuthJson({
					deepseek: { type: "api_key", key: command },
				});

				// Create multiple AuthStorage instances
				const storage1 = AuthStorage.create(authJsonPath);
				await storage1.getApiKey("deepseek");

				const storage2 = AuthStorage.create(authJsonPath);
				await storage2.getApiKey("deepseek");

				// Command should still have only run once
				const count = parseInt(readFileSync(counterFile, "utf-8").trim(), 10);
				expect(count).toBe(1);
			});

			test("clearConfigValueCache allows command to run again", async () => {
				const counterFile = join(tempDir, "counter");
				writeFileSync(counterFile, "0");

				const counterPath = toShPath(counterFile);
				const command = `!sh -c 'count=$(cat "${counterPath}"); echo $((count + 1)) > "${counterPath}"; echo "key-value"'`;
				writeAuthJson({
					deepseek: { type: "api_key", key: command },
				});

				authStorage = AuthStorage.create(authJsonPath);
				await authStorage.getApiKey("deepseek");

				// Clear cache and call again
				clearConfigValueCache();
				await authStorage.getApiKey("deepseek");

				// Command should have run twice
				const count = parseInt(readFileSync(counterFile, "utf-8").trim(), 10);
				expect(count).toBe(2);
			});

			test("different commands are cached separately", async () => {
				writeAuthJson({
					deepseek: { type: "api_key", key: "!echo key-deepseek" },
					"external-entry": { type: "api_key", key: "!echo key-external-entry" },
				});

				authStorage = AuthStorage.create(authJsonPath);

				const keyA = await authStorage.getApiKey("deepseek");
				const keyB = await authStorage.getApiKey("external-entry");

				expect(keyA).toBe("key-deepseek");
				expect(keyB).toBe("key-external-entry");
			});

			test("failed commands are cached (not retried)", async () => {
				const counterFile = join(tempDir, "counter");
				writeFileSync(counterFile, "0");

				const counterPath = toShPath(counterFile);
				const command = `!sh -c 'count=$(cat "${counterPath}"); echo $((count + 1)) > "${counterPath}"; exit 1'`;
				writeAuthJson({
					deepseek: { type: "api_key", key: command },
				});

				authStorage = AuthStorage.create(authJsonPath);

				// Call multiple times - all should return undefined
				const key1 = await authStorage.getApiKey("deepseek");
				const key2 = await authStorage.getApiKey("deepseek");

				expect(key1).toBeUndefined();
				expect(key2).toBeUndefined();

				// Command should have only run once despite failures
				const count = parseInt(readFileSync(counterFile, "utf-8").trim(), 10);
				expect(count).toBe(1);
			});

			test("environment variables are not cached (changes are picked up)", async () => {
				const envVarName = "TEST_AUTH_KEY_CACHE_TEST_98765";
				const originalEnv = process.env[envVarName];

				try {
					process.env[envVarName] = "first-value";

					writeAuthJson({
						deepseek: { type: "api_key", key: `$${envVarName}` },
					});

					authStorage = AuthStorage.create(authJsonPath);

					const key1 = await authStorage.getApiKey("deepseek");
					expect(key1).toBe("first-value");

					// Change env var
					process.env[envVarName] = "second-value";

					const key2 = await authStorage.getApiKey("deepseek");
					expect(key2).toBe("second-value");
				} finally {
					if (originalEnv === undefined) {
						delete process.env[envVarName];
					} else {
						process.env[envVarName] = originalEnv;
					}
				}
			});
		});
	});

	describe("oauth lock compromise handling", () => {
		test("returns undefined on compromised lock and allows a later retry", async () => {
			const providerId = `test-oauth-provider-${Date.now()}-${Math.random().toString(36).slice(2)}`;
			registerOAuthProvider({
				id: providerId,
				name: "Test OAuth Provider",
				async login() {
					throw new Error("Not used in this test");
				},
				async refreshToken(credentials) {
					return {
						...credentials,
						access: "refreshed-access-token",
						expires: Date.now() + 60_000,
					};
				},
				getApiKey(credentials) {
					return `Bearer ${credentials.access}`;
				},
			});

			writeAuthJson({
				[providerId]: {
					type: "oauth",
					refresh: "refresh-token",
					access: "expired-access-token",
					expires: Date.now() - 10_000,
				},
			});

			authStorage = AuthStorage.create(authJsonPath);

			const realLock = lockfile.lock.bind(lockfile);
			const lockSpy = vi.spyOn(lockfile, "lock");
			lockSpy.mockImplementationOnce(async (file, options) => {
				options?.onCompromised?.(new Error("Unable to update lock within the stale threshold"));
				return realLock(file, options);
			});

			const firstTry = await authStorage.getApiKey(providerId);
			expect(firstTry).toBeUndefined();

			lockSpy.mockRestore();

			const secondTry = await authStorage.getApiKey(providerId);
			expect(secondTry).toBe("Bearer refreshed-access-token");
		});
	});

	describe("persistence semantics", () => {
		test("set preserves unrelated external edits", () => {
			writeAuthJson({
				deepseek: { type: "api_key", key: "old-deepseek" },
				"external-entry": { type: "api_key", key: "external-entry-key" },
			});

			authStorage = AuthStorage.create(authJsonPath);

			// Simulate external edit while process is running
			writeAuthJson({
				deepseek: { type: "api_key", key: "old-deepseek" },
				"external-entry": { type: "api_key", key: "external-entry-key" },
				"other-entry": { type: "api_key", key: "other-entry-key" },
			});

			authStorage.set("deepseek", { type: "api_key", key: "new-deepseek" });

			const updated = JSON.parse(readFileSync(authJsonPath, "utf-8")) as Record<string, { key: string }>;
			expect(updated.deepseek.key).toBe("new-deepseek");
			expect(updated["external-entry"].key).toBe("external-entry-key");
			expect(updated["other-entry"].key).toBe("other-entry-key");
		});

		test("remove preserves unrelated external edits", () => {
			writeAuthJson({
				deepseek: { type: "api_key", key: "deepseek-key" },
				"external-entry": { type: "api_key", key: "external-entry-key" },
			});

			authStorage = AuthStorage.create(authJsonPath);

			// Simulate external edit while process is running
			writeAuthJson({
				deepseek: { type: "api_key", key: "deepseek-key" },
				"external-entry": { type: "api_key", key: "external-entry-key" },
				"other-entry": { type: "api_key", key: "other-entry-key" },
			});

			authStorage.remove("deepseek");

			const updated = JSON.parse(readFileSync(authJsonPath, "utf-8")) as Record<string, { key: string }>;
			expect(updated.deepseek).toBeUndefined();
			expect(updated["external-entry"].key).toBe("external-entry-key");
			expect(updated["other-entry"].key).toBe("other-entry-key");
		});

		test("does not overwrite malformed auth file after load error", () => {
			writeAuthJson({
				deepseek: { type: "api_key", key: "deepseek-key" },
			});

			authStorage = AuthStorage.create(authJsonPath);
			writeFileSync(authJsonPath, "{invalid-json", "utf-8");

			authStorage.reload();
			authStorage.set("external-entry", { type: "api_key", key: "external-entry-key" });

			const raw = readFileSync(authJsonPath, "utf-8");
			expect(raw).toBe("{invalid-json");
		});

		test("reload records parse errors and drainErrors clears buffer", () => {
			writeAuthJson({
				deepseek: { type: "api_key", key: "deepseek-key" },
			});

			authStorage = AuthStorage.create(authJsonPath);
			writeFileSync(authJsonPath, "{invalid-json", "utf-8");

			authStorage.reload();

			// Keeps previous in-memory data on reload failure
			expect(authStorage.get("deepseek")).toEqual({ type: "api_key", key: "deepseek-key" });

			const firstDrain = authStorage.drainErrors();
			expect(firstDrain.length).toBeGreaterThan(0);
			expect(firstDrain[0]).toBeInstanceOf(Error);

			const secondDrain = authStorage.drainErrors();
			expect(secondDrain).toHaveLength(0);
		});
	});

	describe("auth status", () => {
		test("does not expose stored API keys or OAuth tokens", () => {
			authStorage = AuthStorage.inMemory({
				deepseek: { type: "api_key", key: "secret-api-key" },
				"external-entry": {
					type: "oauth",
					access: "secret-access-token",
					refresh: "secret-refresh-token",
					expires: Date.now() + 1000,
				},
			});

			expect(authStorage.getAuthStatus("deepseek")).toEqual({ configured: true, source: "stored" });
			expect(authStorage.getAuthStatus("external-entry")).toEqual({ configured: true, source: "stored" });
			expect(JSON.stringify(authStorage.getAuthStatus("deepseek"))).not.toContain("secret-api-key");
			expect(JSON.stringify(authStorage.getAuthStatus("external-entry"))).not.toContain("secret-access-token");
			expect(JSON.stringify(authStorage.getAuthStatus("external-entry"))).not.toContain("secret-refresh-token");
		});
	});

	describe("runtime overrides", () => {
		test("runtime override takes priority over auth.json", async () => {
			writeAuthJson({
				deepseek: { type: "api_key", key: "!echo stored-key" },
			});

			authStorage = AuthStorage.create(authJsonPath);
			authStorage.setRuntimeApiKey("deepseek", "runtime-key");

			const apiKey = await authStorage.getApiKey("deepseek");

			expect(apiKey).toBe("runtime-key");
		});

		test("removing runtime override falls back to auth.json", async () => {
			writeAuthJson({
				deepseek: { type: "api_key", key: "!echo stored-key" },
			});

			authStorage = AuthStorage.create(authJsonPath);
			authStorage.setRuntimeApiKey("deepseek", "runtime-key");
			authStorage.removeRuntimeApiKey("deepseek");

			const apiKey = await authStorage.getApiKey("deepseek");

			expect(apiKey).toBe("stored-key");
		});
	});
});
