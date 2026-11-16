// 聚焦数据回归：origins24 的 2024 SRD 正文必须是中文，且回填过的 44 条源 YAML
// 与 packs-json 派生面描述一致。内置 SRD 卡不展开 content24 的英文 lore，
// 所以 14 条 species 正文里不得再出现 content24 @Embed。
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import YAML from "js-yaml";

const ROOT = fileURLToPath(new URL("../../", import.meta.url));
const PACK = "packs-json/origins24.json";
const SOURCE_DIR = join(ROOT, "packs/_source/origins24");
const SRD_LICENSE = "CC-BY-4.0";
const CONTENT24_EMBED = /@Embed\[Compendium\.dnd5e\.content24\./;
const CJK = /[\u3400-\u4dbf\u4e00-\u9fff]/;

// 本次回填目标：54 条 SRD 文档中原先仍为英文的 44 条（8 race + 36 feat）。
const BACKFILLED_IDS = new Set([
  "phbspAbyssalTief", "phbspChthonicTie", "phbspDrow0000000", "phbspForestGnome", "phbspHighElf0000", "phbspInfernalTie",
  "phbspRockGnome00", "phbspWoodElf0000", "phbsptAbyssalLeg", "phbsptAdrenaline", "phbsptBrave00000", "phbsptBreathWeap",
  "phbsptChthonicLe", "phbsptCloudsJaun", "phbsptDraconicFl", "phbsptDrowElfLin", "phbsptDwarvenRes", "phbsptDwarvenTou",
  "phbsptFeyAncestr", "phbsptFiresBurn0", "phbsptForestGnom", "phbsptFrostsChil", "phbsptGiantAnces", "phbsptGnomishCun",
  "phbsptHalflingNi", "phbsptHighElfLin", "phbsptHillsTumbl", "phbsptInfernalLe", "phbsptKeenSenses", "phbsptLargeForm0",
  "phbsptLuck000000", "phbsptNaturallyS", "phbsptOtherworld", "phbsptPowerfulBu", "phbsptRelentless", "phbsptResourcefu",
  "phbsptRockGnomeL", "phbsptSkillful00", "phbsptStonecunni", "phbsptStonesEndu", "phbsptStormsThun", "phbsptTrance0000",
  "phbsptVersatile0", "phbsptWoodElfLin"
]);

const docs = JSON.parse(readFileSync(join(ROOT, PACK), "utf8"));
const srd = docs.filter(entry => entry.system?.source?.license === SRD_LICENSE);
const byId = new Map(srd.map(entry => [entry._id, entry]));
const description = entry => entry.system?.description?.value ?? "";

const walk = directory => {
  const out = [];
  for (const name of readdirSync(directory).sort()) {
    const path = join(directory, name);
    if (statSync(path).isDirectory()) out.push(...walk(path));
    else if (name.endsWith(".yml")) out.push(path);
  }
  return out;
};

const sourceDocuments = () => {
  const bySourceId = new Map();
  for (const path of walk(SOURCE_DIR)) {
    const document = YAML.load(readFileSync(path, "utf8"));
    if (!document?._id) continue;
    bySourceId.set(document._id, {path, document});
  }
  return bySourceId;
};

test("origins24 的 54 条 SRD 正文全部含中文", () => {
  assert.equal(srd.length, 54, "CC-BY-4.0 SRD 文档数应为 54");
  const counts = srd.reduce((acc, entry) => {
    acc[entry.type] = (acc[entry.type] ?? 0) + 1;
    return acc;
  }, {});
  assert.deepEqual(counts, {background: 4, feat: 36, race: 14}, "SRD 文档类型分布应为 4/36/14");

  const untranslated = srd.filter(entry => !CJK.test(description(entry))).map(entry => entry._id);
  assert.deepEqual(untranslated, [], `仍有英文正文: ${untranslated.join(", ")}`);
});

test("14 条 SRD race 正文不含 content24 @Embed", () => {
  const races = srd.filter(entry => entry.type === "race");
  assert.equal(races.length, 14, "SRD race 文档数应为 14");
  const embedded = races.filter(entry => CONTENT24_EMBED.test(description(entry))).map(entry => entry._id);
  assert.deepEqual(embedded, [], `race 正文仍引用 content24 @Embed: ${embedded.join(", ")}`);
});

test("44 条回填文档的源 YAML 与 packs-json 描述一致", () => {
  assert.equal(BACKFILLED_IDS.size, 44, "回填目标数应为 44");
  const sources = sourceDocuments();
  for (const id of [...BACKFILLED_IDS].sort()) {
    const entry = byId.get(id);
    assert.ok(entry, `packs-json 缺少 SRD 条目 ${id}`);
    assert.equal(entry.system.source.license, SRD_LICENSE, `${id} 不是 CC-BY-4.0 SRD 条目`);

    const source = sources.get(id);
    assert.ok(source, `packs/_source/origins24 缺少条目 ${id}`);
    assert.equal(
      source.document.system?.description?.value,
      description(entry),
      `${id} 的源 YAML（${source.path.slice(ROOT.length)}）与 packs-json 描述不一致`
    );
  }
});
