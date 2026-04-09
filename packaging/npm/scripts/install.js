#!/usr/bin/env node

const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const https = require("node:https");
const { spawnSync } = require("node:child_process");

const packageJson = require("../package.json");

function artifactArch() {
  if (process.platform !== "darwin") {
    throw new Error(`Unsupported platform: ${process.platform}. npm distribution is macOS-first.`);
  }
  if (process.arch === "arm64") {
    return "arm64";
  }
  if (process.arch === "x64") {
    return "x64";
  }
  throw new Error(`Unsupported architecture: ${process.arch}`);
}

function artifactName(version) {
  return `skill-manager-v${version}-darwin-${artifactArch()}.tar.gz`;
}

function releaseBaseUrl(version) {
  return process.env.SKILL_MANAGER_RELEASE_BASE_URL || `https://github.com/mode-io/skill-manager/releases/download/v${version}`;
}

function copyFile(source, destination) {
  fs.copyFileSync(source, destination);
}

function downloadToFile(url, destination, redirects = 5) {
  return new Promise((resolve, reject) => {
    const request = https.get(url, (response) => {
      if (response.statusCode && response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
        response.resume();
        if (redirects <= 0) {
          reject(new Error(`Too many redirects downloading ${url}`));
          return;
        }
        downloadToFile(response.headers.location, destination, redirects - 1).then(resolve, reject);
        return;
      }
      if (response.statusCode !== 200) {
        reject(new Error(`Failed to download ${url}: HTTP ${response.statusCode}`));
        response.resume();
        return;
      }
      const file = fs.createWriteStream(destination);
      response.pipe(file);
      file.on("finish", () => {
        file.close(resolve);
      });
      file.on("error", reject);
    });
    request.on("error", reject);
  });
}

function sha256(filePath) {
  const hash = crypto.createHash("sha256");
  hash.update(fs.readFileSync(filePath));
  return hash.digest("hex");
}

function extractArtifact(artifactPath, vendorDir) {
  fs.rmSync(vendorDir, { recursive: true, force: true });
  fs.mkdirSync(vendorDir, { recursive: true });
  const result = spawnSync("tar", ["-xzf", artifactPath, "-C", vendorDir], { stdio: "inherit" });
  if (result.status !== 0) {
    throw new Error("Failed to extract skill-manager release artifact.");
  }
}

async function main() {
  const version = packageJson.version;
  const artifact = artifactName(version);
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "skill-manager-npm-"));
  const artifactPath = path.join(tempDir, artifact);
  const checksumPath = `${artifactPath}.sha256`;
  const vendorDir = path.resolve(__dirname, "..", "vendor");
  const localArtifactPath = process.env.SKILL_MANAGER_LOCAL_ARTIFACT_PATH;

  if (localArtifactPath) {
    copyFile(localArtifactPath, artifactPath);
    copyFile(`${localArtifactPath}.sha256`, checksumPath);
  } else {
    const baseUrl = releaseBaseUrl(version);
    const artifactUrl = process.env.SKILL_MANAGER_LOCAL_ARTIFACT_URL || `${baseUrl}/${artifact}`;
    const checksumUrl = `${artifactUrl}.sha256`;
    await downloadToFile(artifactUrl, artifactPath);
    await downloadToFile(checksumUrl, checksumPath);
  }

  const expected = fs.readFileSync(checksumPath, "utf8").trim().split(/\s+/)[0];
  const actual = sha256(artifactPath);
  if (expected !== actual) {
    throw new Error(`Checksum mismatch for ${artifact}: expected ${expected}, got ${actual}`);
  }

  extractArtifact(artifactPath, vendorDir);
  const binaryPath = path.join(vendorDir, "skill-manager", "skill-manager");
  if (!fs.existsSync(binaryPath)) {
    throw new Error("Installed artifact is missing vendor/skill-manager/skill-manager.");
  }
  fs.chmodSync(binaryPath, 0o755);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
