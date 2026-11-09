# owner CI（fork 自产发布件）

本目录是 dnd5e fork 的出件工具链。它与 `build/artifact-files.json` 一起构成
「fork 能自产与现行部署面逐字节相同的 release 件」这件事的全部机制。

```
build/artifact-files.json     出件成员白名单 + 逐文件 size/sha256（唯一事实源）
tools/owner-ci/zip.mjs        确定性 zip writer/reader（octopus-system-artifact-zip/1）
tools/owner-ci/build.mjs      generate / assemble / verify / payload
tools/owner-ci/verify-payload.mjs   zip ↔ 清单 的成员与字节复核
.github/workflows/owner-ci.yml     测试线 + 出件线（tag + D8 血统门）
```

## 本地一条命令复现 release 件

```bash
npm ci --ignore-scripts --no-audit --no-fund
node tools/owner-ci/build.mjs assemble --out-dir /tmp/dnd5e-artifact
# → system.zip / system-manifest.json / system-receipt.json
# 期望 zip sha256 = 59a1bfe372a607f1a69017cf5b6a22dc3bbf7105cf1f72d18ead29e5ea296b94
```

`assemble` 自带全部门：清单逐文件 sha256 → 两次构建逐字节一致 → 从源树重建 zip
逐字节复核 → manifest 的 system 字段与 zip 内 `system.json` 对齐。

## 四个派生件的生成口径

| 文件 | 生成 |
|---|---|
| `dnd5e.mjs` | rollup（`-o dnd5e-compiled.mjs` 后改名，`sourceMappingURL` 因此与上游 release 逐字节一致） |
| `dnd5e.css` | `lessc less/dnd5e.less --source-map` |
| `templates.json` | `templates/**/*.hbs` → `{相对路径: 文本}`，目录按名称递归排序 |
| `system.json` | 源树 `system.json` + 4 项发行期变换（`flags.hotReload=false`、`Free Rules` 书目、`media[1]`/`background`/`thumbnail` 指中性 `assets/system/*`） |

前两项依赖 devDependencies；后两项是纯 node。CI 一律 `npm ci --ignore-scripts`
（上游 `postinstall` 会跑 `build:css`+`build:db`，出件链不需要，也不该让派生面在 checkout 里凭空出现）。

## 为什么 `packs/` 在仓里但不进包

`packs/`（LevelDB / `_source` YAML）是**构建输入**，不是部署面。部署面是 `packs-json/`。
所以 `packs/` 留在 git（fork 是完整源树），但 `build/artifact-files.json` 里没有它一条，
`FORBIDDEN_PREFIXES` 还会在清单被误改时当场报错。

同理：`tokens/`（Forgotten Adventures 图，许可仅限在 FVTT 内使用、禁止再分发）已在
`eb6a6a0b5` 退役并由 `assets/tokens/{dn,gi}` 替身图取代；`foundryvtt.json` 的 `includes`
也已去掉 `tokens/`，防止任何按 includes 打目录的旧路径把它带进包。

## D8：出件只认主线上的 tag

`publish` job 只在 `release-*` tag 上跑，并在出件前做两条硬校验：

1. `git merge-base --is-ancestor <tag commit> origin/arcaned-5.3.3`——tag 必须落在主线血统上；
2. 出件后 `verify-payload` 与解包文件集复核——包内成员必须与清单恰等。

分支 push / PR 只跑 `test`（出件到 workflow run artifact，保留 7 天），**不建 Release**，
因此分支产物永远不可能被当作坐标采纳。
