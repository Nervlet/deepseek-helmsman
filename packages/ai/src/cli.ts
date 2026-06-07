#!/usr/bin/env bun

import { createInterface } from "node:readline";
import { existsSync, readFileSync, writeFileSync } from "fs";
import { getOAuthProvider, getOAuthProviders } from "./utils/oauth/index.ts";
import type { OAuthCredentials, OAuthProviderId } from "./utils/oauth/types.ts";

const AUTH_FILE = "auth.json";
const PROVIDERS = getOAuthProviders();

function prompt(rl: ReturnType<typeof createInterface>, question: string): Promise<string> {
	return new Promise((resolve) => rl.question(question, resolve));
}

function loadAuth(): Record<string, { type: "oauth" } & OAuthCredentials> {
	if (!existsSync(AUTH_FILE)) return {};
	try {
		return JSON.parse(readFileSync(AUTH_FILE, "utf-8"));
	} catch {
		return {};
	}
}

function saveAuth(auth: Record<string, { type: "oauth" } & OAuthCredentials>): void {
	writeFileSync(AUTH_FILE, JSON.stringify(auth, null, 2), "utf-8");
}

async function login(providerId: OAuthProviderId): Promise<void> {
	const provider = getOAuthProvider(providerId);
	if (!provider) {
		console.error(`Unknown OAuth credential source: ${providerId}`);
		process.exit(1);
	}

	const rl = createInterface({ input: process.stdin, output: process.stdout });
	const promptFn = (msg: string) => prompt(rl, `${msg} `);

	try {
		const credentials = await provider.login({
			onAuth: (info) => {
				console.log(`\nOpen this URL in your browser:\n${info.url}`);
				if (info.instructions) console.log(info.instructions);
				console.log();
			},
			onDeviceCode: (info) => {
				console.log(`\nOpen this URL in your browser:\n${info.verificationUri}`);
				console.log(`Enter code: ${info.userCode}`);
				console.log();
			},
			onPrompt: async (p) => {
				return await promptFn(`${p.message}${p.placeholder ? ` (${p.placeholder})` : ""}:`);
			},
			onSelect: async (p) => {
				console.log(`\n${p.message}`);
				for (let i = 0; i < p.options.length; i++) {
					console.log(`  ${i + 1}. ${p.options[i].label}`);
				}
				const choice = await promptFn(`Enter number (1-${p.options.length}):`);
				const index = parseInt(choice, 10) - 1;
				return p.options[index]?.id;
			},
			onProgress: (msg) => console.log(msg),
		});

		const auth = loadAuth();
		auth[providerId] = { type: "oauth", ...credentials };
		saveAuth(auth);

		console.log(`\nCredentials saved to ${AUTH_FILE}`);
	} finally {
		rl.close();
	}
}

async function main(): Promise<void> {
	const args = process.argv.slice(2);
	const command = args[0];

	if (!command || command === "help" || command === "--help" || command === "-h") {
		const providerList = PROVIDERS.map((p) => `  ${p.id.padEnd(20)} ${p.name}`).join("\n") || "  (none)";
		console.log(`Usage: bun packages/ai/src/cli.ts <command> [oauth-id]

Commands:
  login [oauth-id]  Login to an extension-registered OAuth credential source
  list              List available OAuth credential sources

OAuth credential sources:
${providerList}

Examples:
  bun packages/ai/src/cli.ts list              # list OAuth credential sources
`);
		return;
	}

	if (command === "list") {
		console.log("Available OAuth credential sources:\n");
		if (PROVIDERS.length === 0) {
			console.log("  (none)");
			return;
		}
		for (const p of PROVIDERS) {
			console.log(`  ${p.id.padEnd(20)} ${p.name}`);
		}
		return;
	}

	if (command === "login") {
		let provider = args[1] as OAuthProviderId | undefined;
		if (PROVIDERS.length === 0) {
			console.error("No OAuth credential sources are registered. Use /login in DeepSeek Helmsman for DeepSeek.");
			process.exit(1);
		}

		if (!provider) {
			const rl = createInterface({ input: process.stdin, output: process.stdout });
			console.log("Select an OAuth credential source:\n");
			for (let i = 0; i < PROVIDERS.length; i++) {
				console.log(`  ${i + 1}. ${PROVIDERS[i].name}`);
			}
			console.log();

			const choice = await prompt(rl, `Enter number (1-${PROVIDERS.length}): `);
			rl.close();

			const index = parseInt(choice, 10) - 1;
			if (index < 0 || index >= PROVIDERS.length) {
				console.error("Invalid selection");
				process.exit(1);
			}
			provider = PROVIDERS[index].id;
		}

		if (!PROVIDERS.some((p) => p.id === provider)) {
			console.error(`Unknown OAuth credential source: ${provider}`);
			console.error(`Use 'bun packages/ai/src/cli.ts list' to see available OAuth credential sources`);
			process.exit(1);
		}

		console.log(`Logging in to ${provider}...`);
		await login(provider);
		return;
	}

	console.error(`Unknown command: ${command}`);
	console.error(`Use 'bun packages/ai/src/cli.ts --help' for usage`);
	process.exit(1);
}

main().catch((err) => {
	console.error("Error:", err.message);
	process.exit(1);
});
