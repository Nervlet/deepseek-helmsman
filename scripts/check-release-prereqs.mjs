#!/usr/bin/env bun

import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const defaultRepository = "Nervlet/deepseek-helmsman";
const defaultTapRepository = "Nervlet/homebrew-deepseek-helmsman";
const defaultTapBranch = "main";
const defaultSecretName = "HOMEBREW_TAP_TOKEN";
const dryRunBranch = "deepseek-helmsman-token-check";

function printUsage() {
	console.log(`Usage: bun scripts/check-release-prereqs.mjs [options]

Checks external GitHub/Homebrew prerequisites for release publishing.

Options:
  --repository <owner/repo>      Source repository (default: ${defaultRepository})
  --tap-repository <owner/repo>  Homebrew tap repository (default: ${defaultTapRepository})
  --tap-branch <branch>          Homebrew tap branch (default: ${defaultTapBranch})
  --secret-name <name>           Actions secret used to update the tap (default: ${defaultSecretName})
  --help                         Show this help
`);
}

function requireValue(args, index, option) {
	const value = args[index];
	if (!value) throw new Error(`${option} requires a value`);
	return value;
}

function parseArgs() {
	const options = {
		repository: process.env.GITHUB_REPOSITORY || defaultRepository,
		secretName: defaultSecretName,
		tapBranch: process.env.HOMEBREW_TAP_BRANCH || defaultTapBranch,
		tapRepository: process.env.HOMEBREW_TAP_REPOSITORY || defaultTapRepository,
	};
	const args = process.argv.slice(2);

	for (let i = 0; i < args.length; i++) {
		const arg = args[i];
		if (arg === "--help") {
			printUsage();
			process.exit(0);
		}
		if (arg === "--repository") {
			options.repository = requireValue(args, ++i, arg);
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
		if (arg === "--secret-name") {
			options.secretName = requireValue(args, ++i, arg);
			continue;
		}
		throw new Error(`Unknown option: ${arg}`);
	}

	return options;
}

function run(command, args, options = {}) {
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

function ghJson(args) {
	return JSON.parse(run("gh", args, { capture: true }));
}

function assertRepository(repository, expectedBranch) {
	const data = ghJson(["repo", "view", repository, "--json", "nameWithOwner,viewerPermission,visibility,defaultBranchRef,url"]);
	if (data.defaultBranchRef?.name !== expectedBranch) {
		throw new Error(`${repository} default branch is ${data.defaultBranchRef?.name ?? "<none>"}, expected ${expectedBranch}.`);
	}
	if (!["ADMIN", "MAINTAIN", "WRITE"].includes(data.viewerPermission)) {
		throw new Error(`Current GitHub token has ${data.viewerPermission} permission for ${repository}; WRITE or higher is required.`);
	}
	return data;
}

function assertSecret(repository, secretName) {
	const output = run("gh", ["secret", "list", "--repo", repository, "--app", "actions"], { capture: true });
	const hasSecret = output
		.split("\n")
		.map((line) => line.split(/\s+/)[0])
		.includes(secretName);
	if (!hasSecret) {
		throw new Error(`Missing Actions secret ${secretName} in ${repository}.`);
	}
}

function assertTapBranchExists(tapRepository, tapBranch) {
	const output = run("git", ["ls-remote", `https://github.com/${tapRepository}.git`, `refs/heads/${tapBranch}`], { capture: true });
	if (!output.trim()) {
		throw new Error(`${tapRepository} does not have branch ${tapBranch}.`);
	}
}

function assertTapDryRunPush(tapRepository) {
	const tempDir = mkdtempSync(join(tmpdir(), "deepseek-helmsman-release-prereqs-"));
	try {
		run("gh", ["repo", "clone", tapRepository, tempDir, "--", "--depth", "1"], { capture: true });
		run("git", ["push", "--dry-run", "origin", `HEAD:refs/heads/${dryRunBranch}`], { capture: true, cwd: tempDir });
		const branchCheck = spawnSync("gh", ["api", `repos/${tapRepository}/branches/${dryRunBranch}`], {
			encoding: "utf8",
			stdio: ["ignore", "pipe", "pipe"],
		});
		if (branchCheck.status === 0) {
			throw new Error(`Dry-run branch unexpectedly exists in ${tapRepository}: ${dryRunBranch}`);
		}
	} finally {
		rmSync(tempDir, { force: true, recursive: true });
	}
}

const options = parseArgs();

run("gh", ["auth", "status"], { capture: true });
const source = assertRepository(options.repository, "main");
const tap = assertRepository(options.tapRepository, options.tapBranch);
assertSecret(options.repository, options.secretName);
assertTapBranchExists(options.tapRepository, options.tapBranch);
assertTapDryRunPush(options.tapRepository);

console.log("Release prerequisites check passed.");
console.log(`  Source: ${source.nameWithOwner} (${source.visibility}, ${source.viewerPermission})`);
console.log(`  Tap: ${tap.nameWithOwner} (${tap.visibility}, ${tap.viewerPermission}, ${options.tapBranch})`);
console.log(`  Secret: ${options.secretName}`);
