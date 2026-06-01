export function getDeepSeekHelmsmanUserAgent(version: string): string {
	const runtime = process.versions.bun ? `bun/${process.versions.bun}` : `node/${process.version}`;
	return `deepseek-helmsman/${version} (${process.platform}; ${runtime}; ${process.arch})`;
}
