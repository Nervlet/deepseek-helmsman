import { getDeepSeekHelmsmanUserAgent } from "./deepseek-helmsman-user-agent.ts";

const LATEST_VERSION_URL = "https://api.github.com/repos/Nervlet/deepseek-helmsman/releases/latest";
const DEFAULT_VERSION_CHECK_TIMEOUT_MS = 10000;

export interface LatestDeepSeekHelmsmanRelease {
	version: string;
	packageName?: string;
	note?: string;
}

interface ParsedVersion {
	major: number;
	minor: number;
	patch: number;
	prerelease?: string;
}

function parsePackageVersion(version: string): ParsedVersion | undefined {
	const match = version.trim().match(/^v?(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?(?:\+.*)?$/);
	if (!match) {
		return undefined;
	}
	return {
		major: Number.parseInt(match[1], 10),
		minor: Number.parseInt(match[2], 10),
		patch: Number.parseInt(match[3], 10),
		prerelease: match[4],
	};
}

export function comparePackageVersions(leftVersion: string, rightVersion: string): number | undefined {
	const left = parsePackageVersion(leftVersion);
	const right = parsePackageVersion(rightVersion);
	if (!left || !right) {
		return undefined;
	}

	if (left.major !== right.major) return left.major - right.major;
	if (left.minor !== right.minor) return left.minor - right.minor;
	if (left.patch !== right.patch) return left.patch - right.patch;
	if (left.prerelease === right.prerelease) return 0;
	if (!left.prerelease) return 1;
	if (!right.prerelease) return -1;
	return left.prerelease.localeCompare(right.prerelease);
}

export function isNewerPackageVersion(candidateVersion: string, currentVersion: string): boolean {
	const comparison = comparePackageVersions(candidateVersion, currentVersion);
	if (comparison !== undefined) {
		return comparison > 0;
	}
	return candidateVersion.trim() !== currentVersion.trim();
}

export async function getLatestDeepSeekHelmsmanRelease(
	currentVersion: string,
	options: { timeoutMs?: number } = {},
): Promise<LatestDeepSeekHelmsmanRelease | undefined> {
	if (process.env.DEEPSEEK_HELMSMAN_SKIP_VERSION_CHECK || process.env.DEEPSEEK_HELMSMAN_OFFLINE) return undefined;

	const response = await fetch(LATEST_VERSION_URL, {
		headers: {
			"User-Agent": getDeepSeekHelmsmanUserAgent(currentVersion),
			accept: "application/json",
		},
		signal: AbortSignal.timeout(options.timeoutMs ?? DEFAULT_VERSION_CHECK_TIMEOUT_MS),
	});
	if (!response.ok) return undefined;

	const data = (await response.json()) as {
		packageName?: unknown;
		tag_name?: unknown;
		version?: unknown;
		note?: unknown;
	};
	const rawVersion =
		typeof data.version === "string" && data.version.trim()
			? data.version
			: typeof data.tag_name === "string" && data.tag_name.trim()
				? data.tag_name
				: undefined;
	if (!rawVersion) {
		return undefined;
	}
	const packageName =
		typeof data.packageName === "string" && data.packageName.trim() ? data.packageName.trim() : undefined;
	const note = typeof data.note === "string" && data.note.trim() ? data.note.trim() : undefined;
	return {
		version: rawVersion.trim().replace(/^v/, ""),
		packageName,
		...(note ? { note } : {}),
	};
}

export async function getLatestDeepSeekHelmsmanVersion(
	currentVersion: string,
	options: { timeoutMs?: number } = {},
): Promise<string | undefined> {
	return (await getLatestDeepSeekHelmsmanRelease(currentVersion, options))?.version;
}

export async function checkForNewDeepSeekHelmsmanVersion(
	currentVersion: string,
): Promise<LatestDeepSeekHelmsmanRelease | undefined> {
	try {
		const latestRelease = await getLatestDeepSeekHelmsmanRelease(currentVersion);
		if (latestRelease && isNewerPackageVersion(latestRelease.version, currentVersion)) {
			return latestRelease;
		}
		return undefined;
	} catch {
		return undefined;
	}
}
