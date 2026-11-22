// 回填 build/artifact-files.json 的派生内容面哈希（packs-*/spells 三项）。
//
// 用场景：改了 packs-json/packs-index/packs-folders 的 spells 派生字节后，清单仍钉着旧
// size/sha256，owner CI 会当场 fail-closed。本工具只重算**目标路径**的 size/sha256，
// 再重算 fileCount/bytes/setHash（recipe 与 tools/owner-ci/build.mjs 的 canonicalSetHash 同构）。
//
// 用法：node tools/owner-ci/update-derived-hash.mjs [--paths a,b] [--check]
//   --paths  逗号分隔的相对路径（缺省 = 三个 spells 派生面）
//   --check  只校验清单是否与盘面一致（不一致即非零退出），不写盘
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("../..", import.meta.url)).replace(/\/$/, "");
const PAYLOAD = `${ROOT}/build/artifact-files.json`;
const sha256 = (buf) => createHash("sha256").update(buf).digest("hex");
const byPath = (a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0);
const canonicalSetHash = (files) => sha256(Buffer.from([...files].sort(byPath)
  .map((e) => `${e.path}\n${e.size}\n${e.sha256}\n`).join(""), "utf8"));

const CHECK = process.argv.includes("--check");
const pathsArg = process.argv.find((arg) => arg.startsWith("--paths="))?.slice("--paths=".length)
  ?? (process.argv.includes("--paths") ? process.argv[process.argv.indexOf("--paths") + 1] : null);
const targets = pathsArg ? pathsArg.split(",").map((v) => v.trim()).filter(Boolean)
  : ["packs-json/spells.json", "packs-index/spells.json", "packs-folders/spells.json"];

const doc = JSON.parse(readFileSync(PAYLOAD, "utf8"));
const changes = [];
for (const entry of doc.files) {
  if (!targets.includes(entry.path)) continue;
  const bytes = readFileSync(`${ROOT}/${entry.path}`);
  const next = { path: entry.path, size: bytes.length, sha256: sha256(bytes) };
  if (next.size !== entry.size || next.sha256 !== entry.sha256) {
    changes.push({ path: entry.path, from: { size: entry.size, sha256: entry.sha256 }, to: next });
    entry.size = next.size;
    entry.sha256 = next.sha256;
  }
}
if (!changes.length) { console.log("[check] 清单与盘面一致"); process.exit(0); }
if (CHECK) {
  console.error("[check] 清单与盘面不一致：");
  for (const change of changes) console.error(`  - ${change.path} ${change.from.sha256.slice(0, 12)} → ${change.to.sha256.slice(0, 12)}`);
  process.exit(1);
}
doc.fileCount = doc.files.length;
doc.bytes = doc.files.reduce((sum, e) => sum + e.size, 0);
doc.setHash = canonicalSetHash(doc.files);
writeFileSync(PAYLOAD, `${JSON.stringify(doc, null, 2)}\n`);
console.log(JSON.stringify({ changes, fileCount: doc.fileCount, bytes: doc.bytes, setHash: doc.setHash }, null, 2));
