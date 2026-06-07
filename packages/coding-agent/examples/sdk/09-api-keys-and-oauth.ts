/**
 * API Keys and OAuth
 *
 * Configure API key resolution via AuthStorage and ModelRegistry.
 */

import { AuthStorage, createAgentSession, ModelRegistry, SessionManager } from "@deepseek-helmsman/coding-agent";

// Default: AuthStorage uses ~/.deepseek-helmsman/agent/auth.json
// ModelRegistry loads built-in + custom models from ~/.deepseek-helmsman/agent/models.json
const authStorage = AuthStorage.create();
const modelRegistry = ModelRegistry.create(authStorage);

const { session: defaultAuthSession } = await createAgentSession({
	sessionManager: SessionManager.inMemory(),
	authStorage,
	modelRegistry,
});
console.log("Session with default auth storage and model registry");
defaultAuthSession.dispose();

// Custom auth storage location
const customAuthStorage = AuthStorage.create("/tmp/my-app/auth.json");
const customModelRegistry = ModelRegistry.create(customAuthStorage, "/tmp/my-app/models.json");

const { session: customAuthSession } = await createAgentSession({
	sessionManager: SessionManager.inMemory(),
	authStorage: customAuthStorage,
	modelRegistry: customModelRegistry,
});
console.log("Session with custom auth storage location");
customAuthSession.dispose();

// Persisted API key, equivalent to /login
authStorage.set("deepseek", { type: "api_key", key: "sk-my-key" });
const { session: storedKeySession } = await createAgentSession({
	sessionManager: SessionManager.inMemory(),
	authStorage,
	modelRegistry,
});
console.log("Session with stored API key");
storedKeySession.dispose();

// No models.json - only built-in models
const simpleRegistry = ModelRegistry.inMemory(authStorage);
const { session: builtInModelsSession } = await createAgentSession({
	sessionManager: SessionManager.inMemory(),
	authStorage,
	modelRegistry: simpleRegistry,
});
console.log("Session with only built-in models");
builtInModelsSession.dispose();
