// 解包面复核：zip 解到磁盘后的文件集必须与 payload 清单恰等（不多不少）。
//
// 为什么还要这一步：verify-payload 走本仓的 zip reader，解包走系统 unzip；
// 两条路径若对文件名编码/路径处理有分歧，只有落盘再数文件才暴露。
//
// 用法：node tools/owner-ci/check-unpacked.mjs <unpacked-dir>
import { readFileSync, readdirSync, realpathSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const PAYLOAD_FILE = "build/artifact-files.json";

const main = () => {
  const dir = process.argv[2] ? resolve(process.argv[2]) : null;
  if (!dir) {
    console.error("用法: node tools/owner-ci/check-unpacked.mjs <unpacked-dir>");
    process.exit(1);
  }
  const want = new Set(JSON.parse(readFileSync(PAYLOAD_FILE, "utf8")).files.map((entry) => entry.path));
  const have = new Set();
  const walk = (current, rel = "") => {
    for (const name of readdirSync(current).sort()) {
      const path = join(current, name);
      const next = rel ? `${rel}/${name}` : name;
      if (statSync(path).isDirectory()) walk(path, next);
      else have.add(next);
    }
  };
  walk(dir);

  const missing = [...want].filter((path) => !have.has(path));
  const extra = [...have].filter((path) => !want.has(path));
  if (missing.length || extra.length) {
    console.error(`解包面与清单不符：缺 ${missing.length} / 多 ${extra.length}`);
    missing.slice(0, 10).forEach((path) => console.error(`  - 缺 ${path}`));
    extra.slice(0, 10).forEach((path) => console.error(`  - 多 ${path}`));
    process.exit(1);
  }
  console.log(JSON.stringify({ fileCount: have.size, result: "unpacked-matches-payload" }, null, 2));
};

const invokedDirectly = process.argv[1]
  && import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href;
if (invokedDirectly) main();
