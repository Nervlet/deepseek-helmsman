#!/usr/bin/env bun

import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { isAbsolute, join, relative, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const packages = ["packages/ai", "packages/tui", "packages/agent", "packages/coding-agent"];

function printUsage() {
	console.log(`Usage: bun scripts/local-release.mjs [options]

Builds a local Bun compiled binary release for the current platform into an
isolated directory outside the repository.

Options:
  --out <dir>      Output directory. Defaults to a new directory under ${tmpdir()}
  --force          Remove --out first if it already exists
  --skip-check     Do not run bun run check before building
  --skip-build     Use existing package build output instead of rebuilding packages
  --help           Show this help
`);
}

function parseArgs() {
	const options = { force: false, outDir: undefined, skipBuild: false, skipCheck: false };
	const args = process.argv.slice(2);

	for (let i = 0; i < args.length; i++) {
		const arg = args[i];
		if (arg === "--help") {
			printUsage();
			process.exit(0);
		}
		if (arg === "--force") {
			options.force = true;
			continue;
		}
		if (arg === "--skip-check") {
			options.skipCheck = true;
			continue;
		}
		if (arg === "--skip-build") {
			options.skipBuild = true;
			continue;
		}
		if (arg === "--out") {
			const value = args[++i];
			if (!value) {
				throw new Error("--out requires a directory");
			}
			options.outDir = value;
			continue;
		}
		throw new Error(`Unknown option: ${arg}`);
	}

	return options;
}

function run(command, args, options = {}) {
	console.log(`$ ${[command, ...args].join(" ")}`);
	const result = spawnSync(command, args, {
		cwd: options.cwd,
		encoding: "utf8",
		shell: process.platform === "win32",
		stdio: "inherit",
	});

	if (result.status !== 0) {
		throw new Error(`Command failed: ${[command, ...args].join(" ")}`);
	}
}

function readPackageJson(directory) {
	return JSON.parse(readFileSync(join(directory, "package.json"), "utf8"));
}

function commandExists(command) {
	return spawnSync(command, ["--version"], { stdio: "ignore" }).status === 0;
}

function isInsidePath(child, parent) {
	const relativePath = relative(parent, child);
	return relativePath === "" || (!relativePath.startsWith("..") && !isAbsolute(relativePath));
}

function prepareOutputDirectory(options, repoRoot) {
	if (!options.outDir) {
		return mkdtempSync(join(tmpdir(), "deepseek-helmsman-local-release-"));
	}

	const outDir = resolve(options.outDir);

	if (isInsidePath(outDir, repoRoot)) {
		throw new Error(`Output directory must be outside the repository: ${outDir}`);
	}

	if (existsSync(outDir)) {
		if (!options.force) {
			throw new Error(`Output directory already exists. Use --force to replace it: ${outDir}`);
		}
		rmSync(outDir, { force: true, recursive: true });
	}

	mkdirSync(outDir, { recursive: true });
	return outDir;
}

function currentBinaryPlatform() {
	if (process.platform === "win32") return process.arch === "arm64" ? "windows-arm64" : "windows-x64";
	if (process.platform === "darwin") return process.arch === "arm64" ? "darwin-arm64" : "darwin-x64";
	if (process.platform === "linux") return process.arch === "arm64" ? "linux-arm64" : "linux-x64";
	throw new Error(`Unsupported binary platform: ${process.platform} ${process.arch}`);
}

function buildLocalBinaryRelease(outDir) {
	if (!commandExists("bun")) {
		throw new Error("Bun is required for the local binary release build.");
	}
	const platform = currentBinaryPlatform();
	const buildDirectory = join(outDir, "binary-build");
	run("./scripts/build-binaries.sh", [
		"--skip-install",
		"--skip-deps",
		"--skip-build",
		"--platform",
		platform,
		"--out",
		buildDirectory,
	]);

	const binaryDirectory = join(outDir, "binary");
	rmSync(binaryDirectory, { force: true, recursive: true });
	cpSync(join(buildDirectory, platform), binaryDirectory, { recursive: true });

	const archiveName = platform.startsWith("windows-")
		? `deepseek-helmsman-${platform}.zip`
		: `deepseek-helmsman-${platform}.tar.gz`;
	cpSync(join(buildDirectory, archiveName), join(outDir, archiveName));
	return { archiveName, binaryDirectory, platform };
}

const options = parseArgs();
const repoRoot = process.cwd();
const rootPackageJson = readPackageJson(repoRoot);

if (rootPackageJson.name !== "deepseek-helmsman-monorepo") {
	throw new Error("Run this script from the repository root");
}

const outDir = prepareOutputDirectory(options, repoRoot);

if (!options.skipCheck) {
	run("bun", ["run", "check"], { cwd: repoRoot });
}

if (!options.skipBuild) {
	for (const pkg of packages) {
		run("bun", ["run", "clean"], { cwd: pkg });
		run("bun", ["run", "build"], { cwd: pkg });
	}
}

const { archiveName, binaryDirectory, platform } = buildLocalBinaryRelease(outDir);

console.log("\nLocal binary release artifacts created:");
console.log(`  ${outDir}`);
console.log("\nArchive:");
console.log(`  ${join(outDir, archiveName)}`);
console.log("\nExtracted binary release:");
console.log(`  ${binaryDirectory}`);
console.log("\nRun the local binary release from outside the repository:");
console.log(
	`  ${join(binaryDirectory, platform.startsWith("windows-") ? "deepseek-helmsman.exe" : "deepseek-helmsman")} --help`,
);
