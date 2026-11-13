// 聚焦数据回归：feats24 的 7 条史诗恩惠必须都声明数字前置等级 19。
// Boon of Fate / Boon of Irresistible Offense 曾漏写 level（null），这里同时把
// 「除 level 外整条记录不变」钉成快照，防止修字段时顺手改到描述、_stats 或 id。
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import YAML from "js-yaml";

const ROOT = fileURLToPath(new URL("../../", import.meta.url));
const FEATS_PACK = "packs-json/feats24.json";
const PAYLOAD = "build/artifact-files.json";

const TARGETS = [
  {
    id: "phbBoonofFate000",
    source: "packs/_source/feats24/epic-boon-feats/boon-of-fate.yml",
    // 快照：sha256(JSON.stringify(entry 去掉 system.prerequisites.level))；仅当有意修改该条数据时更新。
    unchangedDigest: "5550ab5b00854463f0fe76b82bb5afb653299394dd77fbfda6d2f22380be91c5"
  },
  {
    id: "phbBoonofIrresis",
    source: "packs/_source/feats24/epic-boon-feats/boon-of-irresistible-offense.yml",
    unchangedDigest: "b963ccabe1ce98d15688bd626f6dc1e23bb5a66640cd47ddb19767c514fe2cd6"
  }
];

const sha256 = value => createHash("sha256").update(value, "utf8").digest("hex");
const readJson = path => JSON.parse(readFileSync(join(ROOT, path), "utf8"));
const feats = readJson(FEATS_PACK);
const epicBoons = feats.filter(entry => entry.system?.type?.subtype === "epicBoon");

test("feats24 的 7 条 epicBoon 前置等级均为数字 19", () => {
  assert.equal(epicBoons.length, 7, "epicBoon 条目数应为 7");
  for (const entry of epicBoons) {
    assert.equal(
      typeof entry.system.prerequisites.level,
      "number",
      `${entry._id} 的 prerequisites.level 必须是数字（不能是 null 或字符串）`
    );
    assert.equal(entry.system.prerequisites.level, 19, `${entry._id} 的 prerequisites.level 必须是 19`);
  }
});

test("两条目标条目除 prerequisites.level 外保持原字节内容", () => {
  for (const { id, unchangedDigest } of TARGETS) {
    const entry = feats.find(candidate => candidate._id === id);
    assert.ok(entry, `缺少目标条目 ${id}`);
    assert.equal(entry.system.prerequisites.level, 19, `${id} 的 prerequisites.level 必须是数字 19`);

    const withoutLevel = structuredClone(entry);
    delete withoutLevel.system.prerequisites.level;
    assert.equal(
      sha256(JSON.stringify(withoutLevel)),
      unchangedDigest,
      `${id} 除 prerequisites.level 外的字段发生了变化`
    );
  }
});

test("两条目标条目的 packs-json 派生面与 packs/_source 一致", () => {
  for (const { id, source } of TARGETS) {
    const entry = feats.find(candidate => candidate._id === id);
    const pristine = YAML.load(readFileSync(join(ROOT, source), "utf8"));
    assert.equal(pristine.system.prerequisites.level, 19, `${source} 的 prerequisites.level 必须是 19`);

    delete pristine._key;
    pristine.name = entry.name;
    pristine.system.description.value = entry.system.description.value;

    const derived = structuredClone(entry);
    delete derived.flags.mtzh;

    assert.deepEqual(derived, pristine, `${id} 的 packs-json 与 packs/_source 派生结果不一致`);
    assert.deepEqual(entry.flags.mtzh, { s: "srd52chm", m: "srd52" }, `${id} 的中文化标记被改动`);
  }
});

test("build/artifact-files.json 的 feats24 条目与 setHash 自洽", () => {
  const payload = readJson(PAYLOAD);
  const bytes = readFileSync(join(ROOT, FEATS_PACK));
  const record = payload.files.find(entry => entry.path === FEATS_PACK);
  assert.ok(record, `清单缺少 ${FEATS_PACK}`);
  assert.equal(record.size, bytes.length, `${FEATS_PACK} 的 size 与清单不符`);
  assert.equal(record.sha256, sha256(bytes), `${FEATS_PACK} 的 sha256 与清单不符`);
  assert.equal(payload.fileCount, payload.files.length, "payload.fileCount 与 files 长度不符");
  assert.equal(
    payload.bytes,
    payload.files.reduce((sum, entry) => sum + entry.size, 0),
    "payload.bytes 与文件 size 合计不符"
  );

  const canonical = [...payload.files]
    .sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0))
    .map(entry => `${entry.path}\n${entry.size}\n${entry.sha256}\n`)
    .join("");
  assert.equal(payload.setHash, sha256(canonical), "payload.setHash 与 files 重算不符");
});
