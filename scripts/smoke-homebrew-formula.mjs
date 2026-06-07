#!/usr/bin/env bun

import { spawnSync } from "node:child_process";
import { chmodSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const version = "1.2.3";
const tapName = "deepseek-helmsman-smoke/local";
const assets = [
	"deepseek-helmsman-darwin-arm64.tar.gz",
	"deepseek-helmsman-darwin-x64.tar.gz",
	"deepseek-helmsman-linux-arm64.tar.gz",
	"deepseek-helmsman-linux-x64.tar.gz",
];

process.env.HOMEBREW_NO_AUTO_UPDATE = "1";
process.env.HOMEBREW_NO_ENV_HINTS = "1";
process.env.HOMEBREW_NO_INSTALL_CLEANUP = "1";

function run(command, args, options = {}) {
	console.log(`$ ${[command, ...args].join(" ")}`);
	const result = spawnSync(command, args, {
		cwd: options.cwd,
		encoding: "utf8",
		env: {
			...process.env,
			HOMEBREW_NO_AUTO_UPDATE: "1",
			HOMEBREW_NO_ENV_HINTS: "1",
			HOMEBREW_NO_INSTALL_CLEANUP: "1",
		},
		stdio: options.capture ? ["ignore", "pipe", "pipe"] : "inherit",
	});
	if (result.status !== 0) {
		const output = [result.stdout, result.stderr].filter(Boolean).join("\n").trim();
		throw new Error(output ? `Command failed: ${command} ${args.join(" ")}\n${output}` : `Command failed: ${command} ${args.join(" ")}`);
	}
	return result.stdout ?? "";
}

function commandExists(command) {
	return spawnSync(command, ["--version"], { stdio: "ignore" }).status === 0;
}

function getInstalledHomebrewVersion() {
	const result = spawnSync("brew", ["list", "--versions", "deepseek-helmsman"], {
		encoding: "utf8",
		stdio: ["ignore", "pipe", "pipe"],
	});
	return result.status === 0 ? result.stdout.trim() : "";
}

function isHomebrewDeveloperModeEnabled() {
	const result = spawnSync("brew", ["developer"], {
		encoding: "utf8",
		stdio: ["ignore", "pipe", "pipe"],
	});
	return result.stdout.includes("is enabled") || result.stderr.includes("is enabled");
}

function createFakeArchive(archiveDir, asset) {
	const packageDir = mkdtempSync(join(tmpdir(), "deepseek-helmsman-fake-package-"));
	try {
		const root = join(packageDir, "deepseek-helmsman");
		const executable = join(root, "deepseek-helmsman");
		mkdirSync(root, { recursive: true });
		writeFileSync(
			executable,
			`#!/bin/bash
case "$1" in
  --version|-v)
    echo "${version}"
    ;;
  --help|-h)
    echo "DeepSeek Helmsman fake help"
    ;;
  --list-models)
    echo "deepseek-v4-pro"
    ;;
  *)
    echo "DeepSeek Helmsman fake"
    ;;
esac
`,
		);
		chmodSync(executable, 0o755);
		run("tar", ["-czf", join(archiveDir, asset), "-C", packageDir, "deepseek-helmsman"]);
	} finally {
		rmSync(packageDir, { force: true, recursive: true });
	}
}

if (!commandExists("brew")) {
	throw new Error("Homebrew is required for this smoke test.");
}

const existing = getInstalledHomebrewVersion();
if (existing) {
	throw new Error(`deepseek-helmsman is already installed by Homebrew; refusing to modify it: ${existing}`);
}

const homebrewDeveloperModeWasEnabled = isHomebrewDeveloperModeEnabled();
const tempDir = mkdtempSync(join(tmpdir(), "deepseek-helmsman-homebrew-smoke-"));
try {
	const archiveDir = join(tempDir, "archives");
	let tapDir = "";
	mkdirSync(archiveDir, { recursive: true });
	for (const asset of assets) {
		createFakeArchive(archiveDir, asset);
	}

	spawnSync("brew", ["untap", tapName], { stdio: "ignore" });
	run("brew", ["tap-new", tapName]);
	tapDir = run("brew", ["--repo", tapName], { capture: true }).trim();

	run("bun", [
		"scripts/update-homebrew-tap.mjs",
		"--archive-dir",
		archiveDir,
		"--repository",
		"Nervlet/deepseek-helmsman",
		"--version",
		version,
		"--tag",
		`v${version}`,
		"--asset-base-url",
		pathToFileURL(archiveDir).href,
		"--tap-dir",
		tapDir,
	]);

	run("brew", ["install", `${tapName}/deepseek-helmsman`]);
	run("brew", ["test", "deepseek-helmsman"]);

	const actualVersion = run("deepseek-helmsman", ["--version"], { capture: true }).trim();
	if (actualVersion !== version) {
		throw new Error(`Expected deepseek-helmsman --version to print ${version}, got ${actualVersion}`);
	}
	run("deepseek-helmsman", ["--help"]);
	run("deepseek-helmsman", ["--list-models"]);

	console.log("Local Homebrew formula smoke test passed.");
} finally {
	spawnSync("brew", ["uninstall", "--force", "deepseek-helmsman"], { stdio: "inherit" });
	spawnSync("brew", ["untap", tapName], { stdio: "inherit" });
	if (!homebrewDeveloperModeWasEnabled) {
		spawnSync("brew", ["developer", "off"], { stdio: "inherit" });
	}
	rmSync(tempDir, { force: true, recursive: true });
}
