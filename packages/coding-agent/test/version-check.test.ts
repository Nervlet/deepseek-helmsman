import { afterEach, describe, expect, it, vi } from "vitest";
import {
	checkForNewDeepSeekHelmsmanVersion,
	comparePackageVersions,
	getLatestDeepSeekHelmsmanRelease,
	getLatestDeepSeekHelmsmanVersion,
	isNewerPackageVersion,
} from "../src/utils/version-check.ts";

const originalSkipVersionCheck = process.env.DEEPSEEK_HELMSMAN_SKIP_VERSION_CHECK;
const originalOffline = process.env.DEEPSEEK_HELMSMAN_OFFLINE;

afterEach(() => {
	vi.unstubAllGlobals();
	if (originalSkipVersionCheck === undefined) {
		delete process.env.DEEPSEEK_HELMSMAN_SKIP_VERSION_CHECK;
	} else {
		process.env.DEEPSEEK_HELMSMAN_SKIP_VERSION_CHECK = originalSkipVersionCheck;
	}
	if (originalOffline === undefined) {
		delete process.env.DEEPSEEK_HELMSMAN_OFFLINE;
	} else {
		process.env.DEEPSEEK_HELMSMAN_OFFLINE = originalOffline;
	}
});

describe("version checks", () => {
	it("compares package versions", () => {
		expect(comparePackageVersions("0.70.6", "0.70.5")).toBeGreaterThan(0);
		expect(comparePackageVersions("0.70.5", "0.70.5")).toBe(0);
		expect(comparePackageVersions("0.70.4", "0.70.5")).toBeLessThan(0);
		expect(isNewerPackageVersion("0.70.5", "0.70.5")).toBe(false);
		expect(isNewerPackageVersion("0.70.6", "0.70.5")).toBe(true);
	});

	it("returns only newer versions", async () => {
		const fetchMock = vi.fn(async () => Response.json({ version: "1.2.3" }));
		vi.stubGlobal("fetch", fetchMock);

		await expect(checkForNewDeepSeekHelmsmanVersion("1.2.3")).resolves.toBeUndefined();
		await expect(checkForNewDeepSeekHelmsmanVersion("1.2.2")).resolves.toEqual({ version: "1.2.3" });
	});

	it("uses the GitHub version check api with a DeepSeek Helmsman user agent", async () => {
		const fetchMock = vi.fn(async () => Response.json({ version: "1.2.4" }));
		vi.stubGlobal("fetch", fetchMock);

		await expect(getLatestDeepSeekHelmsmanVersion("1.2.3")).resolves.toBe("1.2.4");
		expect(fetchMock).toHaveBeenCalledWith(
			"https://api.github.com/repos/Nervlet/deepseek-helmsman/releases/latest",
			expect.objectContaining({
				headers: expect.objectContaining({
					"User-Agent": expect.stringMatching(/^deepseek-helmsman\/1\.2\.3 /),
					accept: "application/json",
				}),
			}),
		);
	});

	it("returns the active package metadata from the version check api", async () => {
		const fetchMock = vi.fn(async () =>
			Response.json({
				packageName: "@new-scope/deepseek-helmsman",
				version: "1.2.4",
			}),
		);
		vi.stubGlobal("fetch", fetchMock);

		await expect(getLatestDeepSeekHelmsmanRelease("1.2.3")).resolves.toEqual({
			packageName: "@new-scope/deepseek-helmsman",
			version: "1.2.4",
		});
	});

	it("returns update notes from the version check api", async () => {
		const fetchMock = vi.fn(async () => Response.json({ note: " **Read this** ", version: "1.2.4" }));
		vi.stubGlobal("fetch", fetchMock);

		await expect(getLatestDeepSeekHelmsmanRelease("1.2.3")).resolves.toEqual({
			note: "**Read this**",
			version: "1.2.4",
		});
	});

	it("skips api calls when version checks are disabled", async () => {
		process.env.DEEPSEEK_HELMSMAN_SKIP_VERSION_CHECK = "1";
		const fetchMock = vi.fn();
		vi.stubGlobal("fetch", fetchMock);

		await expect(getLatestDeepSeekHelmsmanVersion("1.2.3")).resolves.toBeUndefined();
		expect(fetchMock).not.toHaveBeenCalled();
	});
});
