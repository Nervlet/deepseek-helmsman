#!/usr/bin/env bun

import { execFileSync } from "node:child_process";

const allowValue = process.env.DEEPSEEK_HELMSMAN_ALLOW_LOCKFILE_CHANGE;
const allowed = allowValue === "1" || allowValue === "true" || allowValue === "yes";
const protectedLockfiles = ["bun.lock"];

function git(args) {
	return execFileSync("git", args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
}

const stagedFiles = git(["diff", "--cached", "--name-only"])
	.split("\n")
	.map((line) => line.trim())
	.filter(Boolean);

const stagedLockfiles = protectedLockfiles.filter((file) => stagedFiles.includes(file));
if (stagedLockfiles.length === 0) {
	process.exit(0);
}

if (allowed) {
	console.error(`${stagedLockfiles.join(", ")} staged; DEEPSEEK_HELMSMAN_ALLOW_LOCKFILE_CHANGE is set, allowing commit.`);
	process.exit(0);
}

console.error(`${stagedLockfiles.join(", ")} staged.`);
console.error("");
console.error("Review lockfile changes before committing:");
console.error("  - confirm every new/updated package is intentional");
console.error("  - confirm Bun age gates were active for resolution");
console.error("  - review any new lifecycle scripts in the dependency tree");

console.error("");
console.error("If this lockfile change is intentional, commit with:");
console.error("  DEEPSEEK_HELMSMAN_ALLOW_LOCKFILE_CHANGE=1 git commit ...");
process.exit(1);
