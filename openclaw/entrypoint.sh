#!/usr/bin/env node
// Copy skill templates to a writable location, substitute {{VAR}} placeholders
// from environment variables, then launch OpenClaw gateway.
//
// Skills are mounted read-only at /home/node/.openclaw/workspace/skills-src
// and copied to /home/node/.openclaw/workspace/skills before substitution.

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const SRC_DIR = "/home/node/.openclaw/workspace/skills-src";
const DEST_DIR = "/home/node/.openclaw/workspace/skills";

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

function substituteTemplates(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      substituteTemplates(full);
    } else if (entry.name.endsWith(".md")) {
      const content = fs.readFileSync(full, "utf8");
      const replaced = content.replace(/\{\{([A-Z0-9_]+)\}\}/g, (match, key) => {
        return process.env[key] !== undefined ? process.env[key] : match;
      });
      fs.writeFileSync(full, replaced);
    }
  }
}

console.log("Copying and resolving skill template variables...");
try {
  copyDir(SRC_DIR, DEST_DIR);
  substituteTemplates(DEST_DIR);
  console.log("Done.");
} catch (e) {
  console.error("Warning: template setup failed:", e.message);
}

const args = process.argv.slice(2);
const result = spawnSync("node", ["/app/openclaw.mjs", ...args], {
  stdio: "inherit",
  env: process.env,
});
process.exit(result.status ?? 1);
