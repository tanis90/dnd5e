// dnd5e owner CI 出件工具（无第三方依赖，只吃 node + git + 本仓 devDependencies）。
//
// 唯一事实源 = build/artifact-files.json（payload 清单）：
//   每条 { path, size, sha256 } 就是「应进 zip 的相对路径 + 字节口径」。清单以现行部署面
//   （mt-foundry-compat web/packages/dnd5e，1022 文件）为准，扣掉 fork 不该带的东西
//   （packs/ LevelDB 源、tokens/ FA 图、module/ 源码、less/、build map、README 等）。
//
// 子命令：
//   node tools/owner-ci/build.mjs generate --out <dir>          只生成派生字节（4 个文件）
//   node tools/owner-ci/build.mjs assemble --out-dir <dir>      出件：校验→zip→manifest→receipt→verify
//   node tools/owner-ci/build.mjs verify --artifact/--manifest/--receipt [--root]
//                                                              复核 zip ↔ manifest ↔ 源树字节
//   node tools/owner-ci/build.mjs payload                      只按清单校验源树/生成字节
//
// 关键口径（与 brp 的 octopus-system-artifact-zip/1 一致）：
//   store 不压缩、路径 code-unit 升序、固定 1980-01-01T00:00:00Z DOS 时间戳、0644、
//   UTF-8 文件名；同一输入两次构建逐字节一致。
//   manifest 的 axes 分两轴（与 octopus 采纳器同构）：content = packs*/ 派生内容面，
//   runtime = 其余运行面；两轴同 commit（dnd5e 是单树出件，没有独立内容基线）。
//   本地出证的 receipt.runUrl 为 null；只有真实 CI run 才写实际 URL，绝不伪造。
import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, readdirSync, realpathSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { pathToFileURL } from "node:url";
import { byPath, makeZip, readZip, sha256Hex, ZIP_RECIPE } from "./zip.mjs";

const TOOL = "tools/owner-ci/build.mjs";
const PAYLOAD_FILE = "build/artifact-files.json";
const PAYLOAD_SCHEMA = "dnd5e-owner-ci-payload/1";
const MANIFEST_SCHEMA = "octopus-system-artifact/1";
const RECEIPT_SCHEMA = "octopus-system-artifact-receipt/1";
const SET_HASH_NAMESPACE = "octopus-owner-ci-set-hash/1";
const CONTENT_PREFIXES = ["packs/", "packs-json/", "packs-index/", "packs-folders/"];
const FORBIDDEN_PREFIXES = ["packs/", "tokens/", "module/", "less/", "utils/", "node_modules/", ".github/"];
const ZIP_FILE = "system.zip";
const MANIFEST_FILE = "system-manifest.json";
const RECEIPT_FILE = "system-receipt.json";
// 生成物文件名；字节由 generate 现场产出，清单只钉期望 hash。
const GENERATED = new Set(["dnd5e.mjs", "dnd5e.css", "templates.json", "system.json"]);

const usage = (message) => {
  if (message) console.error(`${message}\n`);
  console.error(`用法:
  node ${TOOL} generate --out <dir>
  node ${TOOL} assemble --out-dir <dir> [--root <dir>] [--run-url <url>] [--commit <sha>]
  node ${TOOL} verify --artifact <zip> --manifest <json> --receipt <json> [--root <dir>]
  node ${TOOL} templates [--out <file>] [--root <dir>]
  node ${TOOL} payload [--root <dir>]`);
  process.exit(1);
};

const parseArgs = (argv) => {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const eq = arg.indexOf("=");
    const key = eq > 0 && arg.startsWith("--") ? arg.slice(0, eq) : arg;
    const inline = eq > 0 && arg.startsWith("--") ? arg.slice(eq + 1) : undefined;
    const value = () => {
      if (inline !== undefined) return inline;
      i += 1;
      if (i >= argv.length) usage(`${key} 缺少参数`);
      return argv[i];
    };
    switch (key) {
      case "--root": args.root = value(); break;
      case "--out": args.out = value(); break;
      case "--out-dir": args.outDir = value(); break;
      case "--run-url": args.runUrl = value(); break;
      case "--commit": args.commit = value(); break;
      case "--artifact": args.artifact = value(); break;
      case "--manifest": args.manifest = value(); break;
      case "--receipt": args.receipt = value(); break;
      default: usage(`未知参数 ${arg}`);
    }
  }
  return args;
};

const fail = (problems) => {
  console.error(`dnd5e owner CI 失败 ${problems.length} 条：`);
  problems.slice(0, 24).forEach((problem) => console.error(`  - ${problem}`));
  if (problems.length > 24) console.error(`  … 其余 ${problems.length - 24} 条省略`);
  process.exit(1);
};

const isFullCommit = (value) => typeof value === "string" && /^[0-9a-f]{40}$/.test(value);
const isSha256 = (value) => typeof value === "string" && /^[0-9a-f]{64}$/.test(value);

const canonicalSetHash = (files) => {
  const hash = [];
  for (const entry of [...files].sort(byPath)) hash.push(`${entry.path}\n${entry.size}\n${entry.sha256}\n`);
  return sha256Hex(Buffer.from(hash.join(""), "utf8"));
};

const run = (command, args, options = {}) => {
  const result = spawnSync(command, args, { stdio: "inherit", ...options });
  if (result.status !== 0) throw new Error(`${command} ${args.join(" ")} 退出码 ${result.status}`);
};

const git = (root, args) => {
  const result = spawnSync("git", ["-C", root, ...args], { maxBuffer: 64 * 1024 * 1024 });
  if (result.status !== 0) {
    const stderr = (result.stderr || Buffer.alloc(0)).toString("utf8").trim();
    throw new Error(`git ${args.join(" ")} 失败${stderr ? `: ${stderr}` : ""}`);
  }
  return result.stdout.toString("utf8").trim();
};

const readPayload = (root) => {
  const path = join(root, PAYLOAD_FILE);
  let doc;
  try {
    doc = JSON.parse(readFileSync(path, "utf8"));
  } catch (error) {
    fail([`payload 清单不可读: ${path}（${error.message}）`]);
  }
  if (doc.schema !== PAYLOAD_SCHEMA) fail([`payload.schema ${doc.schema} != ${PAYLOAD_SCHEMA}`]);
  const files = Array.isArray(doc.files) ? doc.files : fail(["payload.files 不是数组"]);
  const problems = [];
  for (let i = 0; i < files.length; i += 1) {
    const entry = files[i];
    if (!entry || typeof entry.path !== "string" || !entry.path) problems.push(`files[${i}] 缺 path`);
    else if (entry.path.startsWith("/") || entry.path.includes("\\") || entry.path.split("/").includes("..")) {
      problems.push(`files[${i}] 路径非法: ${entry.path}`);
    }
    if (!Number.isSafeInteger(entry?.size) || entry.size < 0) problems.push(`files[${i}] size 非法`);
    if (!isSha256(entry?.sha256)) problems.push(`files[${i}] sha256 非法`);
    if (i > 0 && byPath(files[i - 1], entry) >= 0) problems.push(`files 未按 path 严格升序或重复: ${entry?.path}`);
    if (FORBIDDEN_PREFIXES.some((p) => entry?.path?.startsWith(p))) {
      problems.push(`payload 含禁入前缀文件: ${entry.path}`);
    }
  }
  if (doc.fileCount !== files.length) problems.push(`payload.fileCount ${doc.fileCount} != ${files.length}`);
  const bytes = files.reduce((sum, entry) => sum + entry.size, 0);
  if (doc.bytes !== bytes) problems.push(`payload.bytes ${doc.bytes} != 文件合计 ${bytes}`);
  if (doc.setHash !== canonicalSetHash(files)) problems.push("payload.setHash 与 files 重算不符");
  if (problems.length) fail(problems);
  return doc;
};

// ---------------------------------------------------------------- generation
// 四个派生件全部现场生成到 staging，不落工作树（工作树保持可 git status 干净）。
const walkHbs = (dir) => {
  const out = [];
  const rec = (current) => {
    for (const name of readdirSync(current).sort()) {
      const path = join(current, name);
      if (statSync(path).isDirectory()) rec(path);
      else if (name.endsWith(".hbs")) out.push(path);
    }
  };
  rec(dir);
  return out;
};

// templates.json 的纯函数版本：fork 侧的 `npm run build:templates` 也走这一条，
// 保证 owner CI 与手工构建产出同一份字节。
const templateBundle = (root) => {
  const tplDir = join(root, "templates");
  const bundle = {};
  for (const file of walkHbs(tplDir)) {
    bundle[relative(tplDir, file).split(sep).join("/")] = readFileSync(file, "utf8");
  }
  return bundle;
};

const generate = (root, outDir) => {
  mkdirSync(outDir, { recursive: true });
  const bin = (name) => join(root, "node_modules", ".bin", name);

  // dnd5e.mjs：rollup 编译包。参数与上游 release.yml / package.json build:code 逐字一致
  // （先出 dnd5e-compiled.mjs 再改名 dnd5e.mjs），sourceMappingURL 因此与部署面同字节；
  // 编译出的 .map 是 CI artifact 证据，不进 zip（payload 清单无 .map 条目）。
  run(bin("rollup"), ["dnd5e.mjs", "-f", "es", "-o", join(outDir, "dnd5e-compiled.mjs"),
    "-p", "node-resolve", "-m", "--sourcemapFile", "dnd5e.mjs"], { cwd: root });
  renameSync(join(outDir, "dnd5e-compiled.mjs"), join(outDir, "dnd5e.mjs"));
  rmSync(join(outDir, "dnd5e-compiled.mjs.map"), { force: true });
  // dnd5e.css：lessc（--source-map 让注释与部署面逐字节对齐）。
  run(bin("lessc"), ["less/dnd5e.less", join(outDir, "dnd5e.css"),
    `--source-map=${join(outDir, "dnd5e.css.map")}`], { cwd: root });
  // templates.json：{ 相对 templates/ 的路径: 模板文本 }，键按名称递归排序（与部署面同口径）。
  writeFileSync(join(outDir, "templates.json"), JSON.stringify(templateBundle(root)));

  // system.json：源树 + 发行期变换。变换项固定为四项，逐项可解释：
  //   · flags.hotReload → false（发行包不做热重载；上游 release.yml 同款替换）
  //   · flags.dnd5e.sourceBooks 追加 Free Rules（上游 release 集成免费规则的产物）
  //   · media[1]（type=setup）与 background/thumbnail → 中性 system 图（WotC 商标面已清退）
  const src = JSON.parse(readFileSync(join(root, "system.json"), "utf8"));
  src.flags.hotReload = false;
  src.flags.dnd5e.sourceBooks["Free Rules"] = "SOURCE.BOOK.FreeRules";
  src.media[1].url = "assets/system/background.svg";
  src.media[1].thumbnail = "assets/system/thumbnail.svg";
  src.background = "assets/system/background.svg";
  src.thumbnail = "assets/system/thumbnail.svg";
  writeFileSync(join(outDir, "system.json"), JSON.stringify(src, null, 2));
  return outDir;
};

// ------------------------------------------------------------------- payload
const resolvePayloadBytes = (root, staged, entry, problems) => {
  const path = GENERATED.has(entry.path) ? join(staged, entry.path) : join(root, entry.path);
  let bytes;
  try {
    bytes = readFileSync(path);
  } catch {
    problems.push(`文件缺失: ${entry.path}（${path}）`);
    return null;
  }
  const digest = sha256Hex(bytes);
  if (bytes.length !== entry.size) {
    problems.push(`size 与清单不符: ${entry.path}（清单 ${entry.size}，实得 ${bytes.length}）`);
  }
  if (digest !== entry.sha256) {
    problems.push(`sha256 与清单不符: ${entry.path}（清单 ${entry.sha256}，实得 ${digest}）`);
  }
  return { path: entry.path, bytes };
};

const payloadBytes = (root, staged) => {
  const payload = readPayload(root);
  const problems = [];
  const entries = [];
  for (const entry of payload.files) {
    const file = resolvePayloadBytes(root, staged, entry, problems);
    if (file) entries.push(file);
  }
  if (problems.length) fail(problems);
  return { payload, entries };
};

// ------------------------------------------------------------------ assemble
const axisOf = (path) => (CONTENT_PREFIXES.some((p) => path.startsWith(p)) ? "content" : "runtime");

const axisRecord = (axis, commit, files) => {
  const scoped = files.filter((entry) => axisOf(entry.path) === axis)
    .map((entry) => ({ path: entry.path, size: entry.bytes.length, sha256: sha256Hex(entry.bytes) }));
  return {
    commit,
    setHash: canonicalSetHash(scoped),
    setHashNamespace: SET_HASH_NAMESPACE,
    fileCount: scoped.length,
    bytes: scoped.reduce((sum, entry) => sum + entry.size, 0),
    files: scoped,
  };
};

const inspectSystem = (systemBytes) => {
  const system = JSON.parse(systemBytes.toString("utf8"));
  const compat = system.compatibility ?? {};
  const minimum = String(compat.minimum ?? "");
  const verified = String(compat.verified ?? "");
  return {
    id: system.id,
    version: system.version,
    title: system.title ?? "",
    hostGeneration: minimum || verified.split(".")[0],
    hostVersionVerified: verified,
    hostCompatibility: { minimum, verified, maximum: String(compat.maximum ?? "") },
    entryPoints: system.esmodules ?? [],
    license: typeof system.license === "string" ? system.license : null,
    changelog: typeof system.changelog === "string" ? system.changelog : null,
  };
};

const assemble = (args) => {
  const root = resolve(args.root ?? process.cwd());
  if (!args.outDir) usage("assemble 需要 --out-dir");
  const outDir = resolve(args.outDir);
  const commit = args.commit ? args.commit : git(root, ["rev-parse", "HEAD"]);
  if (!isFullCommit(commit)) fail([`commit 不是完整 40 位: ${commit}`]);

  const staged = join(outDir, "generated");
  generate(root, staged);
  const { payload, entries } = payloadBytes(root, staged);
  const files = entries.map((entry) => ({
    path: entry.path,
    size: entry.bytes.length,
    sha256: sha256Hex(entry.bytes),
  }));

  // 两次独立构建必须逐字节一致（确定性口令）。
  const zipFirst = makeZip(entries);
  const zipSecond = makeZip(entries);
  if (!zipFirst.equals(zipSecond)) fail(["两次构建的 system.zip 字节不一致"]);

  mkdirSync(outDir, { recursive: true });
  const zipPath = join(outDir, ZIP_FILE);
  writeFileSync(zipPath, zipFirst);

  const systemBytes = entries.find((entry) => entry.path === "system.json").bytes;
  const system = inspectSystem(systemBytes);
  const runtime = axisRecord("runtime", commit, entries);
  const content = axisRecord("content", commit, entries);

  const artifact = {
    path: ZIP_FILE,
    sha256: sha256Hex(zipFirst),
    size: zipFirst.length,
    fileCount: files.length,
    bytes: files.reduce((sum, entry) => sum + entry.size, 0),
    zipRecipe: ZIP_RECIPE,
    layout: "system-root",
  };
  const manifest = {
    schema: MANIFEST_SCHEMA,
    system,
    artifact,
    binding: {
      runtimeCommit: runtime.commit,
      contentCommit: content.commit,
      runtimeSetHash: runtime.setHash,
      contentSetHash: content.setHash,
      artifactSha256: artifact.sha256,
    },
    payloadManifest: {
      path: PAYLOAD_FILE,
      setHash: payload.setHash,
      fileCount: payload.fileCount,
      reference: payload.reference,
    },
    axes: { runtime, content },
    notices: [{
      path: "LICENSE.txt",
      kind: "license",
      size: files.find((entry) => entry.path === "LICENSE.txt").size,
      sha256: files.find((entry) => entry.path === "LICENSE.txt").sha256,
    }],
    forbiddenPrefixes: [...FORBIDDEN_PREFIXES],
    generatedBy: TOOL,
  };
  const manifestBytes = Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  const manifestPath = join(outDir, MANIFEST_FILE);
  writeFileSync(manifestPath, manifestBytes);

  const receipt = {
    schema: RECEIPT_SCHEMA,
    kind: "system-artifact",
    system: { id: system.id, version: system.version },
    result: "passed",
    runUrl: args.runUrl ?? null,
    commit,
    commands: [
      "node tools/owner-ci/build.mjs assemble",
      "node tools/owner-ci/build.mjs verify --artifact system.zip "
        + "--manifest system-manifest.json --receipt system-receipt.json",
    ],
    manifest: MANIFEST_FILE,
    manifestSha256: sha256Hex(manifestBytes),
    artifact: { path: ZIP_FILE, sha256: artifact.sha256, size: artifact.size },
    payload: { path: PAYLOAD_FILE, setHash: payload.setHash, fileCount: payload.fileCount },
    axes: {
      runtime: {
        commit: runtime.commit,
        setHash: runtime.setHash,
        fileCount: runtime.fileCount,
        manifestSha256: sha256Hex(manifestBytes),
      },
      content: {
        commit: content.commit,
        setHash: content.setHash,
        fileCount: content.fileCount,
        manifestSha256: sha256Hex(manifestBytes),
      },
    },
    generatedBy: TOOL,
  };
  const receiptPath = join(outDir, RECEIPT_FILE);
  writeFileSync(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`);

  verify({ artifact: zipPath, manifest: manifestPath, receipt: receiptPath, root });

  console.log(JSON.stringify({
    system: { id: system.id, version: system.version },
    commit,
    artifact: artifact.sha256,
    artifactSize: artifact.size,
    fileCount: artifact.fileCount,
    runtime: { setHash: runtime.setHash, files: runtime.fileCount },
    content: { setHash: content.setHash, files: content.fileCount },
    payload: { setHash: payload.setHash, files: payload.fileCount },
    zip: zipPath,
    manifest: manifestPath,
    receipt: receiptPath,
    runUrl: receipt.runUrl,
  }, null, 2));
};

// -------------------------------------------------------------------- verify
const verify = (args) => {
  if (!args.artifact || !args.manifest || !args.receipt) {
    usage("verify 需要 --artifact / --manifest / --receipt");
  }
  const problems = [];
  const zipBytes = readFileSync(args.artifact);
  const manifestBytes = readFileSync(args.manifest);
  const receiptBytes = readFileSync(args.receipt);
  const manifest = JSON.parse(manifestBytes.toString("utf8"));
  const receipt = JSON.parse(receiptBytes.toString("utf8"));

  if (manifest.schema !== MANIFEST_SCHEMA) problems.push(`manifest.schema ${manifest.schema} != ${MANIFEST_SCHEMA}`);
  if (receipt.schema !== RECEIPT_SCHEMA) problems.push(`receipt.schema ${receipt.schema} != ${RECEIPT_SCHEMA}`);
  if (receipt.kind !== "system-artifact") problems.push(`receipt.kind ${receipt.kind} != system-artifact`);
  if (receipt.result !== "passed") problems.push(`receipt.result=${receipt.result}`);
  if (receipt.manifestSha256 !== sha256Hex(manifestBytes)) problems.push("receipt.manifestSha256 与 manifest 字节不符");
  if (receipt.runUrl !== null && typeof receipt.runUrl !== "string") problems.push("receipt.runUrl 必须是 null 或字符串");
  if (!isFullCommit(receipt.commit)) problems.push("receipt.commit 不是完整 40 位");
  if (!Array.isArray(receipt.commands) || receipt.commands.length === 0) problems.push("receipt.commands 为空");

  const artifact = manifest.artifact ?? {};
  if (artifact.path !== ZIP_FILE) problems.push(`artifact.path ${artifact.path} != ${ZIP_FILE}`);
  if (artifact.sha256 !== sha256Hex(zipBytes)) problems.push("artifact.sha256 与 zip 字节不符");
  if (artifact.size !== zipBytes.length) problems.push("artifact.size 与 zip 大小不符");
  if (artifact.zipRecipe !== ZIP_RECIPE) problems.push("artifact.zipRecipe 与 recipe 不符");
  if (receipt.artifact?.sha256 !== artifact.sha256) problems.push("receipt.artifact.sha256 与 manifest 不符");
  if (receipt.artifact?.size !== artifact.size) problems.push("receipt.artifact.size 与 manifest 不符");

  const zip = readZip(zipBytes);
  problems.push(...zip.problems.map((problem) => `zip: ${problem}`));
  const axes = manifest.axes ?? {};
  const union = [];
  for (const axis of ["runtime", "content"]) {
    const record = axes[axis];
    if (!record) { problems.push(`manifest.axes.${axis} 缺失`); continue; }
    if (!isFullCommit(record.commit)) problems.push(`${axis}.commit 非法`);
    if (record.setHashNamespace !== SET_HASH_NAMESPACE) problems.push(`${axis}.setHashNamespace 非法`);
    if (record.setHash !== canonicalSetHash(record.files ?? [])) problems.push(`${axis}.setHash 与 files 重算不符`);
    if (record.fileCount !== (record.files ?? []).length) problems.push(`${axis}.fileCount 与 files 长度不符`);
    for (const entry of record.files ?? []) {
      const packed = zip.entries.find((candidate) => candidate.path === entry.path);
      if (!packed) problems.push(`zip 缺文件: ${entry.path}`);
      else if (packed.size !== entry.size || packed.sha256 !== entry.sha256) {
        problems.push(`zip 字节与 manifest 不符: ${entry.path}`);
      }
      if (axisOf(entry.path) !== axis) problems.push(`${axis} 轴归属错误: ${entry.path}`);
      union.push(entry);
    }
  }
  if (zip.entries.length !== union.length) problems.push(`zip 文件数 ${zip.entries.length} != manifest ${union.length}`);
  const zipOrder = zip.entries.map((entry) => entry.path);
  const manifestOrder = [...union].sort(byPath).map((entry) => entry.path);
  if (JSON.stringify(zipOrder) !== JSON.stringify(manifestOrder)) problems.push("zip 条目次序不是 path 升序");
  for (const path of zip.entries.map((entry) => entry.path)) {
    if (!union.some((entry) => entry.path === path)) problems.push(`zip 多出 manifest 外文件: ${path}`);
  }
  if (artifact.fileCount !== union.length) problems.push(`artifact.fileCount ${artifact.fileCount} != ${union.length}`);
  const unionBytes = union.reduce((sum, entry) => sum + entry.size, 0);
  if (artifact.bytes !== unionBytes) problems.push(`artifact.bytes ${artifact.bytes} != ${unionBytes}`);
  const system = manifest.system ?? {};
  if (system.id !== "dnd5e") problems.push(`system.id ${system.id} != dnd5e`);
  if (receipt.system?.id !== system.id || receipt.system?.version !== system.version) {
    problems.push("receipt.system 与 manifest.system 不一致");
  }
  if (problems.length) fail(problems);

  // 有源树时做最严格的一步：按 payload 清单重新取字节、重建 zip，要求与 artifact 逐字节一致。
  let rebuild = "skipped";
  if (args.root) {
    const root = resolve(args.root);
    const staged = join(dirname(resolve(args.artifact)), "generated-verify");
    generate(root, staged);
    const { entries } = payloadBytes(root, staged);
    const rebuilt = makeZip(entries);
    rebuild = rebuilt.equals(zipBytes) ? "byte-identical" : "MISMATCH";
    if (rebuild !== "byte-identical") fail(["从源树重建的 zip 与 artifact 不是逐字节一致"]);
    const systemPacked = zip.entries.find((entry) => entry.path === "system.json");
    const inspected = inspectSystem(systemPacked.bytes);
    for (const key of ["id", "version", "title", "hostGeneration", "hostVersionVerified", "entryPoints", "license", "changelog"]) {
      if (JSON.stringify(inspected[key] ?? null) !== JSON.stringify(system[key] ?? null)) {
        fail([`manifest.system.${key} 与 system.json 不符`]);
      }
    }
  }

  console.log(JSON.stringify({
    system: { id: system.id, version: system.version },
    artifact: artifact.sha256,
    artifactSize: artifact.size,
    fileCount: artifact.fileCount,
    runtime: { setHash: axes.runtime?.setHash, files: axes.runtime?.fileCount },
    content: { setHash: axes.content?.setHash, files: axes.content?.fileCount },
    rebuild,
    result: "verified",
  }, null, 2));
  return true;
};

const main = () => {
  const [mode, ...rest] = process.argv.slice(2);
  try {
    if (mode === "generate") {
      const args = parseArgs(rest);
      if (!args.out) usage("generate 需要 --out");
      generate(resolve(args.root ?? process.cwd()), resolve(args.out));
      console.log(`generated → ${resolve(args.out)}`);
    } else if (mode === "assemble") {
      assemble(parseArgs(rest));
    } else if (mode === "verify") {
      verify(parseArgs(rest));
    } else if (mode === "templates") {
      const args = parseArgs(rest);
      const out = resolve(args.out ?? "templates.json");
      writeFileSync(out, JSON.stringify(templateBundle(resolve(args.root ?? process.cwd()))));
      console.log(`templates.json → ${out}`);
    } else if (mode === "payload") {
      const args = parseArgs(rest);
      const root = resolve(args.root ?? process.cwd());
      const payload = readPayload(root);
      console.log(JSON.stringify({
        fileCount: payload.fileCount, bytes: payload.bytes, setHash: payload.setHash,
      }, null, 2));
    } else {
      usage(mode ? `未知子命令 ${mode}` : "缺少子命令");
    }
  } catch (error) {
    fail([String(error?.message ?? error)]);
  }
};

const invokedDirectly = process.argv[1]
  && import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href;
if (invokedDirectly) main();

export { canonicalSetHash, generate, inspectSystem, payloadBytes, templateBundle };
