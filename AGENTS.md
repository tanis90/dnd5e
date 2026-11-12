# dnd5e fork（main）—— ArcaneDesk owner CI 出件仓

本仓是 [foundryvtt/dnd5e](https://github.com/foundryvtt/dnd5e) 的 fork（默认生产分支 `main`，
含补丁 P1–P6 + 部署面快照），承担「mt-foundry-compat 前端 dnd5e 系统」的 **A 类出件**：
`web/packages/dnd5e` 的字节真源不再是任何开发机的 live 目录，而是本仓 owner CI 产出的
GitHub Release 三件。

## 出件模型（D2/D8）

- **坐标 = GitHub Release**：tag `release-*`（如 `release-5.3.3-arcane.1`）。
- **D8 血统门**：tag 必须切自默认生产分支 `main`（owner CI 用
  `git merge-base --is-ancestor` 校验，非血统 tag fail-closed 不出件）。
  `main` 是默认且受保护的生产分支，只接受经 required CI 验证的 PR 合入，禁止直推、force-push 和删除；
  旧 `arcaned-5.3.3` 仅作历史回滚参照，不再作为新 tag 来源。
- **同一 release 身份只对应一份字节**：已发布 Release 不得覆盖；修复出新 tag。
- 分支 push / PR 只跑测试（`test` job），不产出任何坐标。

## 出件三件与 recipe

| 产物 | 说明 |
|---|---|
| `system.zip` | 1022 文件部署面，确定性 zip recipe `octopus-system-artifact-zip/1`（store / 路径升序 / 固定 1980-01-01T00:00:00Z / 0644 / UTF-8 名 / 无 extra / 无 comment） |
| `system-manifest.json` | 逐文件 `{path,size,sha256}` 清单 + setHash |
| `system-receipt.json` | runUrl / commit / 三件哈希（本地跑 runUrl=null 语义正确，不伪造） |

唯一事实源 = `build/artifact-files.json`（1022 条 `{path,size,sha256}`）。工具在
`tools/owner-ci/`（无第三方依赖）；流程文档见 `tools/owner-ci/README.md`。

## 改这个仓的规则

- **packs 派生面**（`packs-json/` `packs-index/` `packs-folders/`，66 文件）已入库。
  其中 6 个文件含 Foundry 13.351 迁移元数据、无法从重建链复现——它们只此一家
  （背景见 `build/DERIVED-PROVENANCE.md`），改动前先读它。
- `templates.json` 与 `dnd5e.css` 不入库，出件时现场生成（`npm run build:templates`）。
- `tokens/`（FA 图）**禁再分发**：`foundryvtt.json` includes 已去除，不许加回来。
- 改 `system.json` 坏链/manifest 的，跑 `node tools/owner-ci/build.mjs` 现场生成物对齐。
- 出 tag 前先本地自测：`node tools/owner-ci/assemble.mjs` 两次构建 sha256 必须一致，
  解包与部署面参照物 `diff -r` 零差异。

## 消费方

mt-foundry-compat `docs/federated-manifests/dnd5e.json` 的 `source.ownerArtifact` 钉本仓
runUrl/tag/三件 sha256；正式采纳必须提供 `release.tag`，runUrl 和完整 commit 只作证据或诊断，
不得替代正式 Release。采纳 `tools/federated-adopt-artifact.mjs --system dnd5e
--from-manifest`；`web/packages/dnd5e` 由 `tools/materialize-system-surface.mjs` 从
payload 精确物化。**消费方升级 = 改钉值 + 重跑采纳，不是拷文件。**

前端集成 receipt 只上传为旁路验证证据，不回写 unit manifest 的验证状态，不改变
`manifestHash` 或 release lock。一组依赖只由前端 CI 组装和验证一次，再经 PR 合并到 main
自动部署；不得通过 receipt 回写制造第二轮组装。
