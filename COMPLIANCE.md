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

`packs/` 内容与上游 `release-5.3.3` 逐字节一致，未做任何增删。上游 pristine packs 本身即为
SRD 干净面，故本 fork 无需剥离条目。

**判定谓词**（与上游审计口径一致）：

```
system.source.book    ∈ {SRD 5.1, SRD 5.2, Free Rules, ∅}
system.source.license ∈ {CC-BY-4.0, Unlicensed, ∅}
```

**结果**：22 个包 / **12,954 条目**，谓词原始命中 **1 条**，经精确豁免后**违例 0 条**。

唯一豁免项：

| 包 | `_id` | 标记 | 说明 |
|---|---|---|---|
| `monsterfeatures24` | `mmPossession0000` | `book: MM 2024`，`license: ∅` | 上游自有的 Monster Manual (2024) 标记；该条为 Ghost 的 Possession 动作，规则文本源自 SRD 5.2 兼容面，不另附许可字段 |

验证日期：2026-10-23。验证人：ArcaneDesk。
方法：对 LevelDB SSTable 逐条扫描（`readSstable`），同时以构建产出的 22 个 pack JSON 与源码树
`packs/_source`（4,398 条目 / 4,674 文件，含 276 个 folder）双口径复核，两口径违例计数一致。

## 3. 许可总纲

- **软件**：MIT。`LICENSE.txt` 完整保留（Copyright 2021 Andrew Clayton）。本 fork 对上游代码的
  修改亦按 MIT 提供。
- **SRD 内容**：CC-BY-4.0。packs 内 SRD 5.1 / SRD 5.2 素材按 CC-BY-4.0 使用，署名链见下。
- **替换件美术**：ArcaneDesk 自绘底板 + game-icons.net 白色图形（CC BY 3.0）。逐枚署名与作者
  覆盖见 `icons/ATTRIBUTION-REPLACE.md`；许可全文
  <https://creativecommons.org/licenses/by/3.0/>。
- **上游自有美术**：`icons/` 其余目录（`currency`、`spell-tiers`、`svg`）、`fonts/`、`tokens/`、
  `templates/` 等随上游分发，各自 `LICENSE` 文件为准。

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

依 CC-BY-4.0 第 4 条，本 fork 相对上游的修改为：删除 `ui/official/`；替换 `icons/classes` 与
`icons/species` 共 38 枚图标；改写两处品牌 logo 引用路径；移除 `README.md`、`json/` 与构建 map。
其余内容（含全部 compendium 条目）与 `release-5.3.3` 一致。
