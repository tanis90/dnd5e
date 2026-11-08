# 合规说明（ArcaneDesk 发行基线）

本 fork：`tanis90/dnd5e`，分支 `arcaned-5.3.3`。

## 1. 基线

基线为 `foundryvtt/dnd5e` 的 tag `release-5.3.3`（commit `965ad2d0c`）。
本 fork 在该 tag 之上只叠加以下四条补丁，不改变上游的规则实现：

- **P1 清退 WotC 商标面** —— 删除 `ui/official/`（47 个文件）。该目录内 `LICENSE` 原文声明
  其美术为 Wizards of the Coast LLC 版权、且 D&D 名称与龙形 & 为 WotC 注册商标，授权范围仅限
  「在 Foundry VTT 内运行本系统」。本 fork 不再分发该目录。
- **P2 图标同路径替换** —— `icons/classes/`（24 枚 512×512）与 `icons/species/`（14 枚 256×256）
  共 38 枚，以同路径替换件覆盖（保名保尺寸，compendium 引用零改动）。替换件为 ArcaneDesk 自绘底板
  + game-icons.net 白色图形，逐枚 CC BY 3.0 署名见 `icons/ATTRIBUTION-REPLACE.md`。
- **P3 品牌锚点补丁** —— `dnd5e.mjs` 与 `module/applications/settings/sidebar.mjs` 两处宿主 logo
  引用改指自有中性标（`assets/brand/ampersand.svg`、`assets/brand/dnd-badge.svg`），不再引用
  `ui/official/` 下的 WotC 商标图形。
- **P4 修剪非部署件** —— 按部署子集清单移除构建产物与仓库门面件：`dnd5e-compiled.mjs.map`、
  `README.md`、`json/`（构建链重新生成，不入库）。

## 2. packs 合规自证

上游 `packs/` LevelDB 源仍是 `release-5.3.3` 的 pristine 内容，未做增删。部署面
`packs-json/` 是派生产物：pristine 导出 + 中文 wash；自 2026-10-31 起，2014 SRD
1-6 环法术的结算数据改由第一方 Auto2014 数据提供（见 §2.1）。0 环与 7-9 环共 75 条
stock 法术逐字节未动。

**判定谓词**（与上游审计口径一致）：

```
system.source.book    ∈ {SRD 5.1, SRD 5.2, Free Rules, ∅}
system.source.license ∈ {CC-BY-4.0, Unlicensed, ∅}
```

**结果**：22 个包 / **13,042 条目**，谓词原始命中 **1 条**，经精确豁免后**违例 0 条**。
2014 SRD 导入法术的 `system.source` 逐条保留 stock（`book: ""`, `license: CC-BY-4.0`），
不引入任何扩展书源。

唯一豁免项：

| 包 | `_id` | 标记 | 说明 |
|---|---|---|---|
| `monsterfeatures24` | `mmPossession0000` | `book: MM 2024`，`license: ∅` | 上游自有的 Monster Manual (2024) 标记；该条为 Ghost 的 Possession 动作，规则文本源自 SRD 5.2 兼容面，不另附许可字段 |

验证日期：2026-10-31（条目总数按 2014 导入后的派生面复核）。验证人：ArcaneDesk。
方法：对 LevelDB SSTable 逐条扫描（`readSstable`），同时以构建产出的 22 个 pack JSON 与源码树
`packs/_source`（4,398 条目 / 4,674 文件，含 276 个 folder）双口径复核；2014 导入面另由
`tools/import-2014-srd-spells.mjs --check` 复核身份/source/效果引用/UUID 不变量。

### 2.1 2014 SRD 法术数据导入（2026-10-31）

- **标准**：2014 SRD 1-6 环法术以第一方策展包 `arcane-dnd5e-2014-automation` 0.4.4
  （Auto2014）的 `system.activities` / `target` / `range` / `effects` / `flags` 为准。
- **选择口径**：stock spells 的 244 个 1-6 环 identifier 为 allowlist，含 2 个别名
  （`faithful-hound`、`private-sanctum`）；Auto2014 其余 155 条 1-6 环条目排除（扩展书
  与重名副本）。0 环与 7-9 环共 75 条 stock 法术逐字节不动。
- **保留面**：`_id` / `name` / `img` / `folder` / `sort` / `ownership` / `_stats` /
  `system.source` / `system.identifier` / `system.description` / `flags.mtzh` 均保留 stock；
  中文描述沿用仓内 wash 译文。
- **效果/UUID**：本包内被引用的 ActiveEffect 一并导入，UUID 命名空间改到
  `Compendium.dnd5e.spells.Item.*`；每个法术的顶层 `effects` 规范为「原顶层引用 ∪ 所有
  activity.effects 引用」的稳定去重并集（Bestow 9 个变体；Sleep 同时含 Auto 顶层与 stock
  回退），确保克隆/入卡时活动引用的效果文档被嵌入。缺效果 `iFzYw1EyPwirtf14` 剔除并留痕；
  19 个 summons Actor 引用（21 处）只登记、不导入，保留原模块命名空间。UUID 校验只证明
  `dnd5e.spells` 包内部 Item/effect 引用；`dnd5e.monsters.Actor` / `dnd5e.tables.RollTable`
  仅做当前 packs-index 存在性抽验，不证明跨包 runtime 可解析。
- **Bestow Curse 选择面**：9 个可见 activity，每个只挂 1 个 stock 变体，交给 Midi
  `ActivityChoiceDialog` 选择；`midiProperties.chooseEffects` 保持 false（shim
  `DialogV2.wait/prompt` 返回 null 时会全部不应用）。Cursed Attacks / Cursed Actions /
  Cursed Resilience 三个无 `changes` 变体只保证可选与 marker 应用，机制自动结算待 runtime
  后续，不宣称完整规则。
- **原生回退**：Sleep / Color Spray / Heroes' Feast 保留 Auto `runtimePlan`，同时从 stock
  回填活动 effects（MowBnXpRu2aG48i9 / eDXjhC3F3I0x2fUd / RY4byZPJu4TkIxyz），让现有
  Midi 至少恢复状态/抗性效果应用；HP 池分配、按当前 HP 排序、2d10 HP 上限与 source
  生命周期等高级 runtime 仍未实现，回退不代表规则完整。
- **工具**：`node tools/import-2014-srd-spells.mjs [--apply|--check]`；报告
  `docs/srd-zh/import-2014-srd-spells.json`。旧的 `merge-arcane-2014mod.mjs` /
  `split-arcane-2014mod.mjs` / `import-module.mjs` 不参与本流程，仍禁止运行。
- **边界**：本次只保证数据与 `runtimePlan` 进入包，不宣称 HP 池、多飞弹、光环、重复
  豁免、召唤等 runtime 已实现。
- **产物规模**：`spells.json` 510 文档 = 319 法术（244 导入 + 75 不变）+ 177
  ActiveEffect（174 base + 3 aura）+ 4 enchantment + 10 目录 folder。

### 2.2 SRD 怪物 Actor 图片回填（2026-11-06）

- **问题**：合集怪物的 `img` / `prototypeToken.texture.src` 在 `packs-json` 里为空（2014
  `monsters.json` 331 个 Actor 全空；2024 `actors24.json` 除 17 条已有真图外几乎全空）。
  上游 Foundry 靠 `game.compendiumArt` 运行期注入，本宿主无该机制；FA 原图因许可已删除。
- **做法**：`tools/assign-srd-monster-images.mjs` 以 `json/fa-token-mapping.json`（上游
  vendor FA 映射快照，随包入库）取每个 Actor 的 FA token 路径，经 `web/token-map.mjs` 的
  `TOKEN_REMAP` 换成**可再分发替身**，写入 `img` 与 `prototypeToken.texture.src`，指向包内
  `assets/tokens/{dn,gi}/…`。已有真图的条目不动；无替身的条目保持空（画布走首字方块回退）。
  命中：2014 **280/331**、2024 **315/440**（含 2 条死路径 `systems/dnd5e/tokens/` 修复）。
- **软件面不变**：只改 `packs-json` 派生数据（gitignored），`packs/` LevelDB 源仍为 pristine；
  `--check` 固化命中期望并断言无 `systems|packages/dnd5e/tokens/` 残留。

## 3. 许可总纲

- **软件**：MIT。`LICENSE.txt` 完整保留（Copyright 2021 Andrew Clayton）。本 fork 对上游代码的
  修改亦按 MIT 提供。
- **SRD 内容**：CC-BY-4.0。packs 内 SRD 5.1 / SRD 5.2 素材按 CC-BY-4.0 使用，署名链见下。
- **2014 SRD 自动化数据**：自有策展 Auto2014 0.4.4；仅导入 SRD 1-6 环 244 条，
  中文描述沿用仓内 wash 译文，不含任何扩展书文本。
- **替换件美术**：ArcaneDesk 自绘底板 + game-icons.net 白色图形（CC BY 3.0）。逐枚署名与作者
  覆盖见 `icons/ATTRIBUTION-REPLACE.md`；许可全文
  <https://creativecommons.org/licenses/by/3.0/>。
- **上游自有美术**：`icons/` 其余目录（`currency`、`spell-tiers`、`svg`）、`fonts/`、
  `templates/` 等随上游分发，各自 `LICENSE` 文件为准。上游 `tokens/`（Forgotten Adventures）
  已按 P1 同批清退，不再分发。
- **替身 token 美术**（`assets/tokens/{dn,gi}/`，381 枚）：Devin Night 免费 token（作者条款
  明示免费包可分发、不得单独成包/不得占产品主体；排除包未纳入）与 game-icons.net 白剪影
  （CC BY 3.0，逐枚署名）。署名：本包外 `THIRD_PARTY_NOTICES.txt` §七/§八；来源与许可核查记录：
  `asset-pack/PROVENANCE.md` §五/§六、`asset-pack/tokens-dn/README.md`、`asset-pack/licenses/`。

### SRD 署名链（CC-BY-4.0）

This work includes material taken from the System Reference Document 5.1 ("SRD 5.1") by Wizards of the
Coast LLC and available at https://dnd.wizards.com/resources/systems-reference-document. The SRD 5.1 is
licensed under the Creative Commons Attribution 4.0 International License available at
https://creativecommons.org/licenses/by/4.0/legalcode.

This work includes material from the System Reference Document 5.2 ("SRD 5.2") by Wizards of the Coast
LLC, available at https://www.dndbeyond.com/srd. The SRD 5.2 is licensed under the Creative Commons
Attribution 4.0 International License, available at
https://creativecommons.org/licenses/by/4.0/legalcode.

上游将上述声明置于 `README.md`；本 fork 的 P4 将 `README.md` 作为非部署件移除，故该署名链在此
承接，内容与上游逐字一致。`system.json` 的 `flags.dnd5e.sourceBooks`（SRD 5.1 / SRD 5.2）作为
条目级书目标记保留。

## 4. 变更声明

依 CC-BY-4.0 第 4 条，本 fork 相对上游的修改为：删除 `ui/official/` 与 `tokens/`；替换 `icons/classes` 与
`icons/species` 共 38 枚图标；改写两处品牌 logo 引用路径；移除 `README.md`、构建 map 与
`json/{icon-migration,spell-icon-migration}.json`（保留 `json/fa-token-mapping.json`）；新增
`assets/tokens/{dn,gi}/` 替身图并在派生面回填怪物 Actor 的 img/texture.src；
在派生面 `packs-json` 中对 244 条 2014 SRD 1-6 环法术采用第一方 Auto2014
`activities/target/range/effects/flags` 数据（身份/展示/description/source 保留 stock），并导入
同包 ActiveEffect；0 环与 7-9 环 75 条 stock 法术逐字节不变。扩展书条目 155 条排除，未进入
分发面。除上述 2014 法术派生数据外，其余 compendium 条目与 `release-5.3.3` 一致。
