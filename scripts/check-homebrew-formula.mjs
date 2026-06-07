#!/usr/bin/env bun

import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const assets = [
	"deepseek-helmsman-darwin-arm64.tar.gz",
	"deepseek-helmsman-darwin-x64.tar.gz",
	"deepseek-helmsman-linux-arm64.tar.gz",
	"deepseek-helmsman-linux-x64.tar.gz",
];
const releaseWorkflowPath = ".github/workflows/build-binaries.yml";
const buildBinariesPath = "scripts/build-binaries.sh";

function run(command, args, options = {}) {
	const result = spawnSync(command, args, {
		cwd: options.cwd,
		encoding: "utf8",
		env: options.env ? { ...process.env, ...options.env } : process.env,
		stdio: options.capture ? ["ignore", "pipe", "pipe"] : "inherit",
	});
	if (result.status !== 0) {
		const output = [result.stdout, result.stderr].filter(Boolean).join("\n").trim();
		throw new Error(output ? `Command failed: ${command} ${args.join(" ")}\n${output}` : `Command failed: ${command} ${args.join(" ")}`);
	}
	return result;
}

function sha256File(path) {
	return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function assertIncludes(content, expected) {
	if (!content.includes(expected)) {
		throw new Error(`Generated Homebrew formula is missing: ${expected}`);
	}
}

function assertNotIncludes(content, unexpected) {
	if (content.includes(unexpected)) {
		throw new Error(`Generated Homebrew formula unexpectedly contains: ${unexpected}`);
	}
}

function assertWorkflowIncludes(expected) {
	const content = readFileSync(releaseWorkflowPath, "utf8");
	assertIncludes(content, expected);
}

function assertFileIncludes(path, expected) {
	const content = readFileSync(path, "utf8");
	if (!content.includes(expected)) {
		throw new Error(`${path} is missing: ${expected}`);
	}
}

function assertFileNotIncludes(path, unexpected) {
	const content = readFileSync(path, "utf8");
	if (content.includes(unexpected)) {
		throw new Error(`${path} unexpectedly contains: ${unexpected}`);
	}
}

function commandExists(command) {
	return spawnSync(command, ["--version"], { stdio: "ignore" }).status === 0;
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
    echo "1.2.3"
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
		run("tar", ["-czf", join(archiveDir, asset), "-C", packageDir, "deepseek-helmsman"], { capture: true });
	} finally {
		rmSync(packageDir, { force: true, recursive: true });
	}
}

const tempDir = mkdtempSync(join(tmpdir(), "deepseek-helmsman-homebrew-check-"));
try {
	const archiveDir = join(tempDir, "archives");
	const formulaPath = join(tempDir, "deepseek-helmsman.rb");
	const tapDir = join(tempDir, "homebrew-deepseek-helmsman");
	const tapFormulaPath = join(tapDir, "Formula", "deepseek-helmsman.rb");
	mkdirSync(archiveDir, { recursive: true });

	for (const asset of assets) {
		createFakeArchive(archiveDir, asset);
	}

	run("bun", [
		"scripts/update-homebrew-tap.mjs",
		"--archive-dir",
		archiveDir,
		"--repository",
		"Nervlet/deepseek-helmsman",
		"--version",
		"1.2.3",
		"--tag",
		"v1.2.3",
		"--formula-out",
		formulaPath,
		"--tap-dir",
		tapDir,
	]);

	if (!existsSync(formulaPath)) {
		throw new Error("Generated Homebrew formula was not written.");
	}
	if (!existsSync(tapFormulaPath)) {
		throw new Error("Generated Homebrew tap formula was not written.");
	}

	const formula = readFileSync(formulaPath, "utf8");
	const tapFormula = readFileSync(tapFormulaPath, "utf8");
	if (formula !== tapFormula) {
		throw new Error("Formula output and local tap formula output differ.");
	}
	assertIncludes(formula, "class DeepseekHelmsman < Formula");
	assertIncludes(formula, 'homepage "https://github.com/Nervlet/deepseek-helmsman"');
	assertIncludes(formula, 'version "1.2.3"');
	assertIncludes(formula, 'license "MIT"');
	assertIncludes(formula, 'libexec.install Dir["*"]');
	assertIncludes(formula, 'export DEEPSEEK_HELMSMAN_PACKAGE_DIR="#{libexec}"');
	assertIncludes(formula, 'assert_match version.to_s, shell_output("#{bin}/deepseek-helmsman --version")');
	assertNotIncludes(formula, "windows");

	for (const asset of assets) {
		assertIncludes(formula, `https://github.com/Nervlet/deepseek-helmsman/releases/download/v1.2.3/${asset}`);
		assertIncludes(formula, `sha256 "${sha256File(join(archiveDir, asset))}"`);
	}

	const localFormulaPath = join(tempDir, "deepseek-helmsman-local.rb");
	const assetBaseUrl = pathToFileURL(archiveDir).href;
	run("bun", [
		"scripts/update-homebrew-tap.mjs",
		"--archive-dir",
		archiveDir,
		"--repository",
		"Nervlet/deepseek-helmsman",
		"--version",
		"1.2.3",
		"--tag",
		"v1.2.3",
		"--asset-base-url",
		assetBaseUrl,
		"--formula-out",
		localFormulaPath,
	]);
	const localFormula = readFileSync(localFormulaPath, "utf8");
	for (const asset of assets) {
		assertIncludes(localFormula, `${assetBaseUrl}/${asset}`);
		assertIncludes(localFormula, `sha256 "${sha256File(join(archiveDir, asset))}"`);
	}

	const tokenOnlyFormulaPath = join(tempDir, "deepseek-helmsman-token-only.rb");
	run(
		"bun",
		[
			"scripts/update-homebrew-tap.mjs",
			"--archive-dir",
			archiveDir,
			"--repository",
			"Nervlet/deepseek-helmsman",
			"--version",
			"1.2.3",
			"--tag",
			"v1.2.3",
			"--formula-out",
			tokenOnlyFormulaPath,
		],
		{ env: { HOMEBREW_TAP_TOKEN: "token-only-should-not-update-remote", HOMEBREW_TAP_REPOSITORY: "" } },
	);
	if (!existsSync(tokenOnlyFormulaPath)) {
		throw new Error("Formula generation with token-only environment did not write local output.");
	}

	if (commandExists("ruby")) {
		run("ruby", ["-c", formulaPath], { capture: true });
		run("ruby", ["-c", localFormulaPath], { capture: true });
	}

	assertWorkflowIncludes("homebrew-smoke:");
	assertWorkflowIncludes("needs: build");
	assertWorkflowIncludes("Verify Homebrew tap access");
	assertWorkflowIncludes('HOMEBREW_TAP_TOKEN is required to update ${HOMEBREW_TAP_REPOSITORY}.');
	assertWorkflowIncludes('gh repo view "${HOMEBREW_TAP_REPOSITORY}" --json nameWithOwner >/dev/null');
	assertWorkflowIncludes('tap_remote="https://x-access-token:${HOMEBREW_TAP_TOKEN}@github.com/${HOMEBREW_TAP_REPOSITORY}.git"');
	assertWorkflowIncludes('git clone --depth 1 --branch "${HOMEBREW_TAP_BRANCH}" "${tap_remote}" "${tap_dir}"');
	assertWorkflowIncludes("git -C \"${tap_dir}\" push --dry-run origin HEAD:refs/heads/deepseek-helmsman-token-check");
	assertWorkflowIncludes("brew uninstall --force deepseek-helmsman || true");
	assertWorkflowIncludes('brew untap "${HOMEBREW_TAP_NAME}" || true');
	assertWorkflowIncludes('brew tap "${HOMEBREW_TAP_NAME}" "https://github.com/${HOMEBREW_TAP_REPOSITORY}.git"');
	assertWorkflowIncludes("brew cleanup -s deepseek-helmsman || true");
	assertWorkflowIncludes('HOMEBREW_NO_AUTO_UPDATE=1 brew install "${HOMEBREW_TAP_NAME}/deepseek-helmsman"');
	assertWorkflowIncludes('brew test "${HOMEBREW_TAP_NAME}/deepseek-helmsman"');
	assertWorkflowIncludes('test "$(brew list --versions deepseek-helmsman | awk \'{print $2}\')" = "${expected_version}"');
	assertWorkflowIncludes('test "${actual_version}" = "${expected_version}"');
	assertWorkflowIncludes("deepseek-helmsman --list-models");
	assertFileNotIncludes(releaseWorkflowPath, "actions/setup-node");
	assertFileNotIncludes(releaseWorkflowPath, "Setup npm fallback tooling");
	assertFileNotIncludes(releaseWorkflowPath, "npm install");
	assertFileIncludes(buildBinariesPath, "bun scripts/install-cross-platform-native-bindings.mjs");
	assertFileNotIncludes(buildBinariesPath, "npm install");

	console.log("Homebrew formula generator check passed.");
} finally {
	rmSync(tempDir, { force: true, recursive: true });
}
