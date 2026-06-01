/**
 * Project Rules Extension
 *
 * Scans the project's .deepseek-helmsman/rules/ folder for rule files and lists them
 * in the system prompt. The agent can then use the read tool to load specific
 * rules when needed.
 *
 * Usage:
 * 1. Copy this file to ~/.deepseek-helmsman/agent/extensions/ or your project's .deepseek-helmsman/extensions/
 * 2. Create .deepseek-helmsman/rules/ in your project root
 * 3. Add .md files with your rules
 */

import * as fs from "node:fs";
import * as path from "node:path";
import type { ExtensionAPI } from "@deepseek-helmsman/coding-agent";

function findMarkdownFiles(dir: string, basePath = ""): string[] {
	const results: string[] = [];

	if (!fs.existsSync(dir)) {
		return results;
	}

	const entries = fs.readdirSync(dir, { withFileTypes: true });

	for (const entry of entries) {
		const relativePath = basePath ? `${basePath}/${entry.name}` : entry.name;

		if (entry.isDirectory()) {
			results.push(...findMarkdownFiles(path.join(dir, entry.name), relativePath));
		} else if (entry.isFile() && entry.name.endsWith(".md")) {
			results.push(relativePath);
		}
	}

	return results;
}

export default function projectRulesExtension(api: ExtensionAPI) {
	let ruleFiles: string[] = [];

	api.on("session_start", async (_event, ctx) => {
		const rulesDir = path.join(ctx.cwd, ".deepseek-helmsman", "rules");
		ruleFiles = findMarkdownFiles(rulesDir);

		if (ruleFiles.length > 0) {
			ctx.ui.notify(`Found ${ruleFiles.length} rule(s) in .deepseek-helmsman/rules/`, "info");
		}
	});

	api.on("before_agent_start", async (event) => {
		if (ruleFiles.length === 0) {
			return;
		}

		const rulesList = ruleFiles.map((file) => `- .deepseek-helmsman/rules/${file}`).join("\n");

		return {
			systemPrompt:
				event.systemPrompt +
				`

## Project Rules

The following project rules are available in .deepseek-helmsman/rules/:

${rulesList}

When working on tasks related to these rules, use the read tool to load the relevant rule files for guidance.
`,
		};
	});
}
