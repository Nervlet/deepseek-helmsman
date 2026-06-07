#!/usr/bin/env bun

import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const releaseTarget = process.argv[2];
const bumpTypes = new Set(["major", "minor", "patch"]);
const semverPattern = /^\d+\.\d+\.\d+$/;
const packageFields = ["dependencies", "devDependencies", "peerDependencies", "optionalDependencies"];

if (!releaseTarget || (!bumpTypes.has(releaseTarget) && !semverPattern.test(releaseTarget))) {
	console.error("Usage: bun scripts/version.mjs <major|minor|patch|x.y.z>");
	process.exit(1);
}

function readJson(path) {
	return JSON.parse(readFileSync(path, "utf8"));
}

function writeJson(path, data) {
	writeFileSync(path, `${JSON.stringify(data, null, "\t")}\n`);
}

function compareVersions(a, b) {
	const aParts = a.split(".").map(Number);
	const bParts = b.split(".").map(Number);
	for (let i = 0; i < 3; i++) {
		const diff = (aParts[i] ?? 0) - (bParts[i] ?? 0);
		if (diff !== 0) return diff;
	}
	return 0;
}

function bumpVersion(version, bumpType) {
	const [major, minor, patch] = version.split(".").map(Number);
	if (bumpType === "major") return `${major + 1}.0.0`;
	if (bumpType === "minor") return `${major}.${minor + 1}.0`;
	return `${major}.${minor}.${patch + 1}`;
}

const packagesDir = join(process.cwd(), "packages");
const packageEntries = readdirSync(packagesDir, { withFileTypes: true })
	.filter((entry) => entry.isDirectory())
	.map((entry) => {
		const packagePath = join(packagesDir, entry.name, "package.json");
		return existsSync(packagePath) ? { path: packagePath, data: readJson(packagePath) } : undefined;
	})
	.filter((entry) => entry && !entry.data.private);

const versionMap = new Map(packageEntries.map((entry) => [entry.data.name, entry.data.version]));
const versions = [...new Set(versionMap.values())];
if (versions.length !== 1) {
	console.error(`Expected lockstep package versions, found: ${versions.join(", ")}`);
	process.exit(1);
}

const currentVersion = versions[0];
const nextVersion = bumpTypes.has(releaseTarget) ? bumpVersion(currentVersion, releaseTarget) : releaseTarget;
if (compareVersions(nextVersion, currentVersion) <= 0) {
	console.error(`Version ${nextVersion} must be greater than current version ${currentVersion}.`);
	process.exit(1);
}

for (const entry of packageEntries) {
	entry.data.version = nextVersion;
	for (const field of packageFields) {
		const dependencies = entry.data[field];
		if (!dependencies) continue;
		for (const packageName of Object.keys(dependencies)) {
			if (versionMap.has(packageName)) {
				dependencies[packageName] = `^${nextVersion}`;
			}
		}
	}
	writeJson(entry.path, entry.data);
}

console.log(`Updated ${packageEntries.length} packages from ${currentVersion} to ${nextVersion}.`);
