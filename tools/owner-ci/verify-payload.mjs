// 出件后复核：把 zip 里的字节与 build/artifact-files.json（payload 清单）逐条对齐。
//
// 与 build.mjs verify 的区别：verify 比的是「manifest ↔ zip ↔ 源树重建」，
// 本工具比的是「清单 ↔ zip」，也就是发布面的成员白名单口径。两步都过才算
// 「清单 == zip == 源树字节」三方一致。
//
// 用法：node tools/owner-ci/verify-payload.mjs --artifact <system.zip> [--manifest <system-manifest.json>]
import { readFileSync, realpathSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { readZip, sha256Hex } from "./zip.mjs";

const PAYLOAD_FILE = "build/artifact-files.json";

const fail = (problems) => {
  console.error(`payload 复核失败 ${problems.length} 条：`);
  problems.slice(0, 24).forEach((problem) => console.error(`  - ${problem}`));
  process.exit(1);
};

const main = () => {
  const args = process.argv.slice(2);
  let artifact = null;
  let manifest = null;
  for (let i = 0; i < args.length; i += 1) {
    if (args[i] === "--artifact") artifact = args[++i];
    else if (args[i] === "--manifest") manifest = args[++i];
    else fail([`未知参数 ${args[i]}`]);
  }
  if (!artifact) fail(["--artifact 必填"]);

  const zipBytes = readFileSync(resolve(artifact));
  const payload = JSON.parse(readFileSync(PAYLOAD_FILE, "utf8"));
  const zip = readZip(zipBytes);
  const problems = [...zip.problems];

  const packed = new Map();
  for (const entry of zip.entries) {
    if (packed.has(entry.path)) problems.push(`zip 含重复路径: ${entry.path}`);
    packed.set(entry.path, entry);
  }
  for (const entry of payload.files) {
    const hit = packed.get(entry.path);
    if (!hit) { problems.push(`zip 缺清单文件: ${entry.path}`); continue; }
    if (hit.size !== entry.size) problems.push(`size 不符: ${entry.path}（清单 ${entry.size}，zip ${hit.size}）`);
    if (hit.sha256 !== entry.sha256) problems.push(`sha256 不符: ${entry.path}`);
  }
  for (const path of packed.keys()) {
    if (!payload.files.some((entry) => entry.path === path)) problems.push(`zip 多出清单外文件: ${path}`);
  }
  if (problems.length) fail(problems);

  if (manifest) {
    const doc = JSON.parse(readFileSync(resolve(manifest), "utf8"));
    const manifestProblems = [];
    if (doc.artifact?.sha256 !== sha256Hex(zipBytes)) manifestProblems.push("manifest.artifact.sha256 与 zip 不符");
    if (doc.artifact?.fileCount !== payload.files.length) manifestProblems.push("manifest.artifact.fileCount 与清单不符");
    if (doc.payloadManifest?.setHash !== payload.setHash) manifestProblems.push("manifest.payloadManifest.setHash 与清单不符");
    if (manifestProblems.length) fail(manifestProblems);
  }

  console.log(JSON.stringify({
    fileCount: payload.files.length,
    bytes: payload.files.reduce((sum, entry) => sum + entry.size, 0),
    payloadSetHash: payload.setHash,
    zipSha256: sha256Hex(zipBytes),
    result: "payload-verified",
  }, null, 2));
};

const invokedDirectly = process.argv[1]
  && import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href;
if (invokedDirectly) main();
