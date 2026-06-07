#!/usr/bin/env bun

import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";

const formulaName = "deepseek-helmsman";
const formulaPath = join("Formula", `${formulaName}.rb`);
const defaultArchiveDir = "packages/coding-agent/binaries";
const defaultTapBranch = "main";

const archivePlatforms = [
	{ asset: "deepseek-helmsman-darwin-arm64.tar.gz", label: "darwinArm64" },
	{ asset: "deepseek-helmsman-darwin-x64.tar.gz", label: "darwinX64" },
	{ asset: "deepseek-helmsman-linux-arm64.tar.gz", label: "linuxArm64" },
	{ asset: "deepseek-helmsman-linux-x64.tar.gz", label: "linuxX64" },
];

function printUsage() {
	console.log(`Usage: bun scripts/update-homebrew-tap.mjs [options]

Generates the Homebrew formula for GitHub Release binary archives and updates
the configured Homebrew tap.

Options:
  --archive-dir <dir>       Directory containing release archives
                            (default: ${defaultArchiveDir})
  --repository <owner/repo> GitHub repository that hosts release assets
                            (default: GITHUB_REPOSITORY or Nervlet/deepseek-helmsman)
  --version <x.y.z>         Release version (default: packages/coding-agent version)
  --tag <tag>               Release tag (default: v<version>)
  --asset-base-url <url>    Override the release asset base URL. Primarily for
                            local formula smoke tests.
  --formula-out <file>      Write the generated formula to a local file
  --tap-dir <dir>           Write the formula into an existing local tap checkout
                            without committing or pushing
  --tap-repository <repo>   Homebrew tap repository, owner/repo
                            (default: HOMEBREW_TAP_REPOSITORY)
  --tap-branch <branch>     Tap branch to update (default: HOMEBREW_TAP_BRANCH or main)
  --help                    Show this help

Environment:
  HOMEBREW_TAP_TOKEN must be set when updating a tap.
`);
}

function readJson(path) {
	return JSON.parse(readFileSync(path, "utf8"));
}

function parseArgs() {
	const packageJson = readJson("packages/coding-agent/package.json");
	const version = packageJson.version;
	const options = {
		archiveDir: defaultArchiveDir,
		assetBaseUrl: undefined,
		formulaOut: undefined,
		repository: process.env.GITHUB_REPOSITORY || "Nervlet/deepseek-helmsman",
		tag: `v${version}`,
		tapDir: undefined,
		tapBranch: process.env.HOMEBREW_TAP_BRANCH || defaultTapBranch,
		tapRepository: process.env.HOMEBREW_TAP_REPOSITORY,
		version,
	};
	const args = process.argv.slice(2);

	for (let i = 0; i < args.length; i++) {
		const arg = args[i];
		if (arg === "--help") {
			printUsage();
			process.exit(0);
		}
		if (arg === "--archive-dir") {
			options.archiveDir = requireValue(args, ++i, arg);
			continue;
		}
		if (arg === "--repository") {
			options.repository = requireValue(args, ++i, arg);
			continue;
		}
		if (arg === "--version") {
			options.version = requireValue(args, ++i, arg);
			options.tag = `v${options.version}`;
			continue;
		}
		if (arg === "--tag") {
			options.tag = requireValue(args, ++i, arg);
			continue;
		}
		if (arg === "--asset-base-url") {
			options.assetBaseUrl = requireValue(args, ++i, arg);
			continue;
		}
		if (arg === "--formula-out") {
			options.formulaOut = requireValue(args, ++i, arg);
			continue;
		}
		if (arg === "--tap-dir") {
			options.tapDir = requireValue(args, ++i, arg);
			continue;
		}
		if (arg === "--tap-repository") {
			options.tapRepository = requireValue(args, ++i, arg);
			continue;
		}
		if (arg === "--tap-branch") {
			options.tapBranch = requireValue(args, ++i, arg);
			continue;
		}
		throw new Error(`Unknown option: ${arg}`);
	}

	return options;
}

function requireValue(args, index, option) {
	const value = args[index];
	if (!value) {
		throw new Error(`${option} requires a value`);
	}
	return value;
}

function run(command, args, options = {}) {
	console.log(`$ ${[command, ...(options.displayArgs ?? args)].join(" ")}`);
	const result = spawnSync(command, args, {
		cwd: options.cwd,
		encoding: "utf8",
		stdio: options.capture ? ["ignore", "pipe", "pipe"] : "inherit",
	});

	if (result.status !== 0) {
		const output = [result.stdout, result.stderr].filter(Boolean).join("\n").trim();
		throw new Error(output ? `Command failed: ${command} ${args.join(" ")}\n${output}` : `Command failed: ${command} ${args.join(" ")}`);
	}

	return result.stdout ?? "";
}

function sha256File(path) {
	if (!existsSync(path)) {
		throw new Error(`Missing release archive: ${path}`);
	}
	return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function releaseUrl(options, asset) {
	if (options.assetBaseUrl) {
		return `${options.assetBaseUrl.replace(/\/+$/, "")}/${asset}`;
	}
	const repository = options.repository;
	const tag = options.tag;
	return `https://github.com/${repository}/releases/download/${tag}/${asset}`;
}

function generateFormula(options) {
	const archiveDir = resolve(options.archiveDir);
	const sha256ByPlatform = Object.fromEntries(
		archivePlatforms.map((platform) => [platform.label, sha256File(join(archiveDir, platform.asset))]),
	);

	return `class DeepseekHelmsman < Formula
  desc "DeepSeek-only terminal coding agent"
  homepage "https://github.com/${options.repository}"
  version "${options.version}"
  license "MIT"

  on_macos do
    if Hardware::CPU.arm?
      url "${releaseUrl(options, "deepseek-helmsman-darwin-arm64.tar.gz")}"
      sha256 "${sha256ByPlatform.darwinArm64}"
    else
      url "${releaseUrl(options, "deepseek-helmsman-darwin-x64.tar.gz")}"
      sha256 "${sha256ByPlatform.darwinX64}"
    end
  end

  on_linux do
    if Hardware::CPU.arm?
      url "${releaseUrl(options, "deepseek-helmsman-linux-arm64.tar.gz")}"
      sha256 "${sha256ByPlatform.linuxArm64}"
    else
      url "${releaseUrl(options, "deepseek-helmsman-linux-x64.tar.gz")}"
      sha256 "${sha256ByPlatform.linuxX64}"
    end
  end

  def install
    libexec.install Dir["*"]
    (bin/"deepseek-helmsman").write <<~SH
      #!/bin/bash
      export DEEPSEEK_HELMSMAN_PACKAGE_DIR="#{libexec}"
      exec "#{libexec}/deepseek-helmsman" "$@"
    SH
    chmod 0755, bin/"deepseek-helmsman"
  end

  test do
    assert_match version.to_s, shell_output("#{bin}/deepseek-helmsman --version")
  end
end
`;
}

function writeFormulaOut(path, content) {
	const outputPath = resolve(path);
	mkdirSync(dirname(outputPath), { recursive: true });
	writeFileSync(outputPath, content);
	console.log(`Wrote ${outputPath}`);
}

function writeTapFormula(tapDir, formulaContent) {
	const tapFormulaPath = join(resolve(tapDir), formulaPath);
	mkdirSync(dirname(tapFormulaPath), { recursive: true });
	writeFileSync(tapFormulaPath, formulaContent);
	console.log(`Wrote ${tapFormulaPath}`);
	return tapFormulaPath;
}

function assertTapOptions(options) {
	if (!options.tapRepository) {
		throw new Error("Set HOMEBREW_TAP_REPOSITORY or pass --tap-repository <owner/repo>.");
	}
	if (!process.env.HOMEBREW_TAP_TOKEN) {
		throw new Error("Set HOMEBREW_TAP_TOKEN to update the Homebrew tap.");
	}
}

function updateTap(options, formulaContent) {
	assertTapOptions(options);
	const token = process.env.HOMEBREW_TAP_TOKEN;
	const tempDir = mkdtempSync(join(tmpdir(), "deepseek-helmsman-homebrew-tap-"));
	const remoteUrl = `https://x-access-token:${encodeURIComponent(token)}@github.com/${options.tapRepository}.git`;
	const displayUrl = `https://github.com/${options.tapRepository}.git`;

	try {
		run("git", ["clone", "--depth", "1", "--branch", options.tapBranch, remoteUrl, tempDir], {
			displayArgs: ["clone", "--depth", "1", "--branch", options.tapBranch, displayUrl, tempDir],
		});
		writeTapFormula(tempDir, formulaContent);

		const diff = run("git", ["status", "--short", "--", formulaPath], { capture: true, cwd: tempDir });
		if (!diff.trim()) {
			console.log(`${formulaPath} is already up to date in ${options.tapRepository}.`);
			return;
		}

		run("git", ["config", "user.name", "deepseek-helmsman-release-bot"], { cwd: tempDir });
		run("git", ["config", "user.email", "actions@github.com"], { cwd: tempDir });
		run("git", ["add", formulaPath], { cwd: tempDir });
		run("git", ["commit", "-m", `Update deepseek-helmsman to ${options.tag}`], { cwd: tempDir });
		run("git", ["push", "origin", `HEAD:${options.tapBranch}`], { cwd: tempDir });
	} finally {
		rmSync(tempDir, { force: true, recursive: true });
	}
}

const options = parseArgs();
const formulaContent = generateFormula(options);

if (options.formulaOut) {
	writeFormulaOut(options.formulaOut, formulaContent);
}

if (options.tapDir) {
	writeTapFormula(options.tapDir, formulaContent);
}

if (options.tapRepository) {
	updateTap(options, formulaContent);
}
