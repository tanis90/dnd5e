# 派生面 provenance（packs-json / packs-index / packs-folders）

本仓的 66 个派生文件为什么入库、字节从哪来、哪些能重建、哪些不能。

## 1. 为什么入库

上游 `dnd5e` 仓不跟踪 `packs-json/`、`packs-index/`、`packs-folders/`：它们是
`packs/`（LevelDB / `_source` YAML）经 export + wash + 索引构建后的产物。因此
「clone 一下就能出真版本」在上游是假命题——**产物只存在于某台机器的部署面里**。

ArcaneDesk 的部署面（`mt-foundry-compat/web/packages/dnd5e`，1022 文件）正是这样一份产物
快照。本仓把它们收编进 git，使 fork 自身成为完整事实源：owner CI 出件不再需要从前端仓或
私有桶回捞字节，`build/artifact-files.json` 里的每一条都能在本仓 HEAD 找到。

## 2. 字节来源

| 来源 | 说明 |
|---|---|
| 部署面快照 | `BaccanoEva/mt-foundry-compat@384eeaa5` 的 `web/packages/dnd5e/{packs-json,packs-index,packs-folders}` 66 文件，逐字节拷贝，零改写 |
| 该快照的 artifact | 同一批字节已作为 dnd5e artifact `cd745d66e5d7a5b907b9cc6dafd0b426e234d17fcc91ad73ed872768dd154de3`（1022 文件）上架到公开桶 `oss://arcanedesk-artifacts`，1022/1022 回读对账通过 |

派生链（见 `mt-foundry-compat/tools/rebuild-vendor-assets.mjs` 与 `COMPLIANCE.md` §2.1）：

```
packs/ (pristine 5.3.3 LevelDB)
  → export-packs.mjs            packs-json（22 包）
  → wash-packs-zh.mjs           中文化
  → import-2014-srd-spells.mjs  2014 SRD 1-6 环 244 条法术结算数据（Auto2014 为准）
  → assign-srd-monster-images.mjs  SRD 怪物 Actor 图片回填（fa-token-mapping → assets/tokens/{dn,gi}）
  → build-pack-index.mjs        packs-index（22）/ packs-folders（22）
```

## 3. 可重建性（实测）

在干净检出（`git archive`，956 tracked 文件）上跑上述重建链，**60/66 逐字节复现**：
`packs-index` 22/22、`packs-folders` 21/22、`packs-json` 17/22。

**6 个复现不出来**（正是本仓入库的核心价值，`mt-foundry-compat/HANDOFF.md` §1.5）：

```
packs-json/actors24.json
packs-json/content24.json
packs-json/equipment24.json
packs-json/spells.json
packs-json/tables24.json
packs-folders/content24.json
```

差异全部集中在 **Foundry 13.351 迁移后的元数据**：`_stats.coreVersion`、
`_stats.exportSource`、`_stats.compendiumSource`、`category`、`text`、`documentId`、
`img`、`system.materials`。试过 Auto2014 的 0.4.4 / 0.5.2 / 0.5.5 / 0.5.6 四版 SRD 源，
都对不上——这批字段是当时那台 Foundry 实例在迁移时写入的，没有第二个可复现来源。

结论：这 6 个文件**只此一家**（部署面快照 = artifact 字节），故随仓入库并在
`build/artifact-files.json` 里钉死 sha256。任何「从 packs/ 重新生成」的尝试都必须先
证明能复现这 6 个文件，否则不得替换它们。

## 4. 维护约定

- 换 packs 源或改 wash/导入规则 → 必须重新生成全部 66 个文件，并同时更新
  `build/artifact-files.json` 的 `size`/`sha256`/`setHash`（owner CI 会逐条校验，漂移即红）。
- 只改 UI/模板/图标等运行面 → 不要碰这三个目录。
- 6 个迁移元数据文件的 `_stats` 字段是历史事实，不做「规范化」清洗：清洗会改变字节，
  进而让 artifact 坐标与现行部署面脱钩。
