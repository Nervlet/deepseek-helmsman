import type { AssistantMessage } from "../types.ts";

/**
 * Regex patterns to detect context overflow errors from DeepSeek-compatible APIs and local servers.
 *
 * These patterns match error messages returned when the input exceeds
 * the model's context window.
 *
 * Common example messages include:
 * - "prompt is too long: 213462 tokens > 200000 maximum"
 * - "Your input exceeds the context window of this model"
 * - "Requested token count exceeds the model's maximum context length of 131072 tokens"
 * - "Input length X exceeds the maximum allowed input length of Y tokens."
 * - "the request exceeds the available context size, try increasing it"
 * - "prompt too long; exceeded max context length by X tokens"
 */
const OVERFLOW_PATTERNS = [
	/prompt is too long/i,
	/request_too_large/i,
	/input is too long for requested model/i,
	/exceeds the context window/i,
	/exceeds (?:the )?(?:model'?s )?maximum context length of [\d,]+ tokens?/i,
	/input token count.*exceeds the maximum/i,
	/maximum prompt length is \d+/i,
	/reduce the length of the messages/i,
	/maximum context length is \d+ tokens/i,
	/exceeds (?:the )?maximum allowed input length of [\d,]+ tokens?/i,
	/input \(\d+ tokens\) is longer than the model'?s context length \(\d+ tokens\)/i,
	/exceeds the limit of \d+/i,
	/exceeds the available context size/i,
	/greater than the context length/i,
	/context window exceeds limit/i,
	/exceeded model token limit/i,
	/too large for model with \d+ maximum context length/i,
	/model_context_window_exceeded/i,
	/prompt too long; exceeded (?:max )?context length/i,
	/context[_ ]length[_ ]exceeded/i, // Generic fallback
	/too many tokens/i, // Generic fallback
	/token limit exceeded/i, // Generic fallback
	/^4(?:00|13)\s*(?:status code)?\s*\(no body\)/i, // Some gateways return 400/413 with no body.
];

/**
 * Patterns that indicate non-overflow errors (e.g. rate limiting, server errors).
 * Error messages matching any of these are excluded from overflow detection
 * even if they also match an OVERFLOW_PATTERN.
 *
 * Example: a throttling error that says "too many tokens, please wait" should
 * not be treated as context overflow.
 */
const NON_OVERFLOW_PATTERNS = [
	/^(Throttling error|Service unavailable):/i,
	/rate limit/i, // Generic rate limiting
	/too many requests/i, // Generic HTTP 429 style
];

/**
 * Check if an assistant message represents a context overflow error.
 *
 * This handles two cases:
 * 1. Error-based overflow: Most DeepSeek-compatible endpoints return stopReason "error" with a
 *    specific error message pattern.
 * 2. Silent overflow: Some endpoints accept overflow requests and return
 *    successfully. For these, we check if usage.input exceeds the context window.
 *
 * ## DeepSeek-Compatible Models
 *
 * If you've added DeepSeek-compatible models via models.json, this function may not detect
 * overflow errors from those endpoints. To add support:
 *
 * 1. Send a request that exceeds the model's context window
 * 2. Check the errorMessage in the response
 * 3. Create a regex pattern that matches the error
 * 4. The pattern should be added to OVERFLOW_PATTERNS in this file, or
 *    check the errorMessage yourself before calling this function
 *
 * @param message - The assistant message to check
 * @param contextWindow - Optional context window size for detecting silent overflow
 * @returns true if the message indicates a context overflow
 */
export function isContextOverflow(message: AssistantMessage, contextWindow?: number): boolean {
	// Case 1: Check error message patterns
	if (message.stopReason === "error" && message.errorMessage) {
		// Skip messages matching known non-overflow patterns (e.g. throttling / rate-limit)
		const isNonOverflow = NON_OVERFLOW_PATTERNS.some((p) => p.test(message.errorMessage!));
		if (!isNonOverflow && OVERFLOW_PATTERNS.some((p) => p.test(message.errorMessage!))) {
			return true;
		}
	}

	// Case 2: Silent overflow - successful response but usage exceeds context.
	if (contextWindow && message.stopReason === "stop") {
		const inputTokens = message.usage.input + message.usage.cacheRead;
		if (inputTokens > contextWindow) {
			return true;
		}
	}

	// Case 3: Length-stop overflow - server truncates oversized input to fit
	// the context window, leaving no room for output. Returns stopReason
	// "length" with output=0 and input+cacheRead filling the context window.
	if (contextWindow && message.stopReason === "length" && message.usage.output === 0) {
		const inputTokens = message.usage.input + message.usage.cacheRead;
		if (inputTokens >= contextWindow * 0.99) {
			return true;
		}
	}

	return false;
}

/**
 * Get the overflow patterns for testing purposes.
 */
export function getOverflowPatterns(): RegExp[] {
	return [...OVERFLOW_PATTERNS];
}
