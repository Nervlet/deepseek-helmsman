#!/usr/bin/env bun

import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

const registryUrl = (process.env.NPM_CONFIG_REGISTRY || process.env.npm_config_registry || "https://registry.npmjs.org").replace(/\/+$/, "");
const basePackageName = "@mariozechner/clipboard";
const nativePackageNames = [
	"@mariozechner/clipboard-darwin-arm64",
	"@mariozechner/clipboard-darwin-x64",
	"@mariozechner/clipboard-linux-arm64-gnu",
	"@mariozechner/clipboard-linux-x64-gnu",
	"@mariozechner/clipboard-win32-arm64-msvc",
	"@mariozechner/clipboard-win32-x64-msvc",
];
const packageNames = [basePackageName, ...nativePackageNames];

function readJson(path) {
	return JSON.parse(readFileSync(path, "utf8"));
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

function escapeRegExp(value) {
	return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function readLockfileIntegrity(packageName, version) {
	const lockfile = readFileSync("bun.lock", "utf8");
	const escapedName = escapeRegExp(packageName);
	const escapedVersion = escapeRegExp(version);
	const pattern = new RegExp(`"${escapedName}": \\["${escapedName}@${escapedVersion}",[^\\n]*"([^"]+)"\\],`);
	const match = lockfile.match(pattern);
	if (!match) {
		throw new Error(`Missing ${packageName}@${version} integrity in bun.lock. Run bun install --lockfile-only --ignore-scripts.`);
	}
	return match[1];
}

function packageMetadataUrl(packageName, version) {
	return `${registryUrl}/${encodeURIComponent(packageName).replace("%2F", "%2f")}/${version}`;
}

function packageTargetDir(packageName) {
	const [scope, name] = packageName.split("/");
	if (scope !== "@mariozechner" || !name?.startsWith("clipboard")) {
		throw new Error(`Unexpected package name: ${packageName}`);
	}
	return join("node_modules", scope, name);
}

function verifyIntegrity(buffer, integrity, label) {
	const token = integrity.split(/\s+/)[0];
	const separator = token.indexOf("-");
	if (separator === -1) {
		throw new Error(`Invalid integrity for ${label}: ${integrity}`);
	}
	const algorithm = token.slice(0, separator);
	const expectedDigest = token.slice(separator + 1);
	const actualDigest = createHash(algorithm).update(buffer).digest("base64");
	if (actualDigest !== expectedDigest) {
		throw new Error(`Integrity mismatch for ${label}`);
	}
}

async function fetchJson(url) {
	const response = await fetch(url);
	if (!response.ok) {
		throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
	}
	return response.json();
}

async function downloadTarball(url, path, integrity, label) {
	const response = await fetch(url);
	if (!response.ok) {
		throw new Error(`Failed to download ${url}: ${response.status} ${response.statusText}`);
	}
	const buffer = Buffer.from(await response.arrayBuffer());
	verifyIntegrity(buffer, integrity, label);
	writeFileSync(path, buffer);
}

async function installPackage(packageName, version) {
	const expectedIntegrity = readLockfileIntegrity(packageName, version);
	const metadata = await fetchJson(packageMetadataUrl(packageName, version));
	if (metadata.name !== packageName || metadata.version !== version) {
		throw new Error(`Registry metadata mismatch for ${packageName}@${version}`);
	}
	if (metadata.dist?.integrity !== expectedIntegrity) {
		throw new Error(`Registry integrity for ${packageName}@${version} does not match bun.lock.`);
	}
	if (!metadata.dist?.tarball) {
		throw new Error(`Registry metadata for ${packageName}@${version} is missing a tarball URL.`);
	}

	const tempDir = mkdtempSync(join(tmpdir(), "deepseek-helmsman-native-binding-"));
	try {
		const tarballPath = join(tempDir, "package.tgz");
		const extractDir = join(tempDir, "extract");
		const packageDir = join(extractDir, "package");
		await downloadTarball(metadata.dist.tarball, tarballPath, expectedIntegrity, `${packageName}@${version}`);
		mkdirSync(extractDir, { recursive: true });
		run("tar", ["-xzf", tarballPath, "-C", extractDir], { capture: true });
		if (!existsSync(packageDir)) {
			throw new Error(`Tarball for ${packageName}@${version} did not contain a package directory.`);
		}

		const extractedPackageJson = readJson(join(packageDir, "package.json"));
		if (extractedPackageJson.name !== packageName || extractedPackageJson.version !== version) {
			throw new Error(`Extracted package mismatch for ${packageName}@${version}`);
		}

		const targetDir = packageTargetDir(packageName);
		rmSync(targetDir, { force: true, recursive: true });
		mkdirSync(dirname(targetDir), { recursive: true });
		cpSync(packageDir, targetDir, { recursive: true });
		console.log(`Installed ${packageName}@${version}`);
	} finally {
		rmSync(tempDir, { force: true, recursive: true });
	}
}

const codingAgentPackageJson = readJson("packages/coding-agent/package.json");
const clipboardVersion = codingAgentPackageJson.optionalDependencies?.[basePackageName];
if (!clipboardVersion) {
	throw new Error(`Missing ${basePackageName} in packages/coding-agent/package.json optionalDependencies.`);
}

for (const packageName of packageNames) {
	await installPackage(packageName, clipboardVersion);
}
