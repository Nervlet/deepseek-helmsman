import { APP_NAME } from "./config.ts";
import { configureHttpDispatcher } from "./core/http-dispatcher.ts";
import { main } from "./main.ts";

export function runCli(args: string[] = process.argv.slice(2)): void {
	process.title = APP_NAME;
	process.env.DEEPSEEK_HELMSMAN_CODING_AGENT = "true";
	process.emitWarning = (() => {}) as typeof process.emitWarning;

	// Configure undici's global dispatcher before provider SDKs issue requests.
	// Runtime settings are applied once SettingsManager has loaded global/project settings.
	configureHttpDispatcher();

	main(args);
}
