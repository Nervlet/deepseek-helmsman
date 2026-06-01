import { describe, expect, it } from "vitest";
import { getDeepSeekHelmsmanUserAgent } from "../src/utils/deepseek-helmsman-user-agent.ts";

describe("getDeepSeekHelmsmanUserAgent", () => {
	it("formats the DeepSeek Helmsman user agent", () => {
		const runtime = process.versions.bun ? `bun/${process.versions.bun}` : `node/${process.version}`;
		const userAgent = getDeepSeekHelmsmanUserAgent("1.2.3");

		expect(userAgent).toBe(`deepseek-helmsman/1.2.3 (${process.platform}; ${runtime}; ${process.arch})`);
		expect(userAgent).toMatch(/^deepseek-helmsman\/[^\s()]+ \([^;()]+;\s*[^;()]+;\s*[^()]+\)$/);
	});
});
