import type { KnownProvider } from "./types.ts";

let _procEnvCache: Map<string, string> | null = null;

interface BuiltinFs {
	readFileSync(path: string, encoding: "utf-8"): string;
}

type ProcessWithBuiltinModule = NodeJS.Process & {
	getBuiltinModule?: (moduleName: "fs") => BuiltinFs | undefined;
};

function readProcEnviron(): string | undefined {
	if (typeof process === "undefined") return undefined;
	const fs = (process as ProcessWithBuiltinModule).getBuiltinModule?.("fs");
	if (!fs) return undefined;
	try {
		return fs.readFileSync("/proc/self/environ", "utf-8");
	} catch {
		return undefined;
	}
}

/**
 * Fallback for https://github.com/oven-sh/bun/issues/27802
 * Bun compiled binaries have an empty `process.env` inside sandbox
 * environments on Linux. We can recover the env from `/proc/self/environ`.
 */
function getProcEnv(key: string): string | undefined {
	if (typeof process === "undefined") return undefined;
	if (!process.versions?.bun) return undefined;

	// If process.env already has entries, the bug is not triggered.
	if (Object.keys(process.env).length > 0) return undefined;

	if (_procEnvCache === null) {
		_procEnvCache = new Map();
		const data = readProcEnviron();
		if (data) {
			for (const entry of data.split("\0")) {
				const idx = entry.indexOf("=");
				if (idx > 0) {
					_procEnvCache.set(entry.slice(0, idx), entry.slice(idx + 1));
				}
			}
		}
	}

	return _procEnvCache.get(key);
}

function getApiKeyEnvVars(provider: string): readonly string[] | undefined {
	return provider === "deepseek" ? ["DEEPSEEK_API_KEY"] : undefined;
}

/**
 * Find configured environment variables that can provide an API key for a provider.
 *
 * This only reports actual API key variables. It intentionally excludes ambient
 * provider credentials from shells or runtime environments.
 */
export function findEnvKeys(provider: KnownProvider): string[] | undefined;
export function findEnvKeys(provider: string): string[] | undefined;
export function findEnvKeys(provider: string): string[] | undefined {
	const envVars = getApiKeyEnvVars(provider);
	if (!envVars) return undefined;

	const found = envVars.filter((envVar) => !!process.env[envVar] || !!getProcEnv(envVar));
	return found.length > 0 ? found : undefined;
}

/**
 * Get API key for DeepSeek from DEEPSEEK_API_KEY.
 */
export function getEnvApiKey(provider: KnownProvider): string | undefined;
export function getEnvApiKey(provider: string): string | undefined;
export function getEnvApiKey(provider: string): string | undefined {
	const envKeys = findEnvKeys(provider);
	if (envKeys?.[0]) {
		return process.env[envKeys[0]] || getProcEnv(envKeys[0]);
	}
	return undefined;
}
