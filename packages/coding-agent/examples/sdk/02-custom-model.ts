/**
 * DeepSeek Model Selection
 *
 * Shows how to select a specific model and thinking level.
 */

import { getModel } from "@deepseek-helmsman/ai";
import { AuthStorage, createAgentSession, ModelRegistry } from "@deepseek-helmsman/coding-agent";

// Set up auth storage and model registry
const authStorage = AuthStorage.create();
const modelRegistry = ModelRegistry.create(authStorage);

// Option 1: Find a specific built-in model by provider/id
const pro = getModel("deepseek", "deepseek-v4-pro");
if (pro) {
	console.log(`Found model: ${pro.provider}/${pro.id}`);
}

// Option 2: Find model via registry (includes DeepSeek models from models.json)
const customModel = modelRegistry.find("deepseek", "deepseek-custom");
if (customModel) {
	console.log(`Found DeepSeek model: ${customModel.provider}/${customModel.id}`);
}

// Option 3: Pick from available models (have valid API keys)
const available = await modelRegistry.getAvailable();
console.log(
	"Available models:",
	available.map((m) => `${m.provider}/${m.id}`),
);

if (available.length > 0) {
	const { session } = await createAgentSession({
		model: available[0],
		thinkingLevel: "medium", // off, low, medium, high
		authStorage,
		modelRegistry,
	});

	try {
		session.subscribe((event) => {
			if (event.type === "message_update" && event.assistantMessageEvent.type === "text_delta") {
				process.stdout.write(event.assistantMessageEvent.delta);
			}
		});

		await session.prompt("Say hello in one sentence.");
		console.log();
	} finally {
		session.dispose();
	}
}
