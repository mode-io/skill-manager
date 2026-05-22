# skill-manager

[English](README.md)

<p align="center">
  <img src="assets/skill_manager_logo.svg" alt="Skill Manager" width="520" />
</p>

<p align="center">
  <strong>面向 AI 扩展的本地优先控制中心。</strong><br />
  在不同 agent harness 中统一使用、确认、扫描和发现 Skill、MCP 服务器、slash command 与 CLI 工具。
</p>

<p align="center">
  <a href="LICENSE"><img alt="License: MIT" src="https://img.shields.io/badge/license-MIT-111827?style=flat-square" /></a>
  <a href="https://github.com/mode-io/skill-manager/releases/latest"><img alt="Latest release" src="https://img.shields.io/github/v/release/mode-io/skill-manager?style=flat-square&color=EA580C" /></a>
  <a href="https://www.npmjs.com/package/@mode-io/skill-manager"><img alt="npm version" src="https://img.shields.io/npm/v/%40mode-io%2Fskill-manager?style=flat-square&logo=npm&logoColor=white" /></a>
  <a href="#安装"><img alt="Install with Homebrew" src="https://img.shields.io/badge/install-homebrew-FBBF24?style=flat-square&logo=homebrew&logoColor=111827" /></a>
  <a href="#安装"><img alt="macOS ARM64/x64 and Linux x64/ARM64" src="https://img.shields.io/badge/platform-macOS%20ARM64%2Fx64%20%2B%20Linux%20x64%2FARM64-111827?style=flat-square&logo=linux&logoColor=white" /></a>
  <a href="#本地优先安全模型"><img alt="Local-first" src="https://img.shields.io/badge/data-local--first-0F766E?style=flat-square" /></a>
</p>

![skill-market-overview](./assets/skill-manager-skill-unification.svg)

## 为什么需要它

AI 扩展通常分散在各个 harness 自己的文件夹、MCP 配置文件、slash command 位置和商城来源中。Skill Manager 提供一个本地控制界面来管理这些内容：

| 产品概念 | 含义 |
|---|---|
| **使用中** | Skill Manager 正在控制此项目，并可在不同 harness 中启用或停用。 |
| **待确认** | Skill Manager 发现了本地状态、配置差异或库存问题，需要你先做决定。 |
| **扫描** | 在信任某个 Skill 之前，使用 LLM 驱动的安全检查进行确认。 |
| **发现** | 浏览商城，并预览外部工具。 |

## 你可以做什么

- 查看哪些扩展正在使用、哪些需要确认，以及它们在哪些 harness 中启用。
- 将本地 Skill 采用到共享库存，再按 harness 启用或停用。
- 使用保存的 LLM provider 配置扫描 Skill，并在使用前查看发现项。
- 安装或采用 MCP 服务器配置，解决配置差异，并写入支持的 harness。
- 统一管理可复用的 slash command，并同步到支持的 harness。
- 从商城来源发现 Skill、MCP 服务器，以及仅预览的 CLI 工具。

## 产品导览

### 总览

从整个扩展组合开始查看：使用中、待确认、可发现内容，以及各 harness 的覆盖情况。

![skill-market-overview](./assets/skill-manager-overview.png)

### Skill

使用 Skill 作为共享本地包，而不是在每个 harness 中维护单独副本。

典型流程：

1. 确认 harness 中发现的 Skill，或从商城安装一个 Skill。
2. 将它采用到 Skill Manager 库存。
3. 只在需要的 harness 中启用。
4. 从一个地方更新、移除或删除。

![skill-market-skill-matrxi](./assets/skill-manager-skill-matrix.png)

### Skill 扫描

在依赖某个 Skill 之前，可以使用 LLM 驱动的安全确认流程先扫描它。

典型流程：

1. 添加并验证一个 LLM 扫描配置。
2. 将使用中的 Skill 切换到扫描视图。
3. 对单个 Skill、已选 Skill 或当前可见列表运行扫描。
4. 查看严重程度、发现项、代码片段和修复建议。

![skill-manager-scan-view](./assets/skill-manager-scan-view.svg)

扫描配置单独管理，因此你可以保存多个 provider，选择一个当前配置，并且在列表中只显示隐藏后的 API Key。

![skill-manager-scan-config](./assets/skill-manager-scan-config.svg)

### MCP 服务器

MCP 服务器会被规范化为 Skill Manager 记录，再转换为各 harness 期望的配置形状。

典型流程：

1. 确认 harness 中发现的 MCP 服务器，或从商城安装一个。
2. 将它采用到 Skill Manager 库存。
3. 在需要的 harness 中启用。
4. 解决配置差异、停用 harness 绑定，或从一个地方卸载。

![skill-market-skill-matrxi](./assets/skill-manager-mcp-matrix.png)

### Slash command

Slash command 作为共享 prompt 库保存，而不是在每个 harness 专用格式中重复维护。

典型流程：

1. 创建包含名称、描述和 prompt 的 slash command。
2. 用 `$ARGUMENTS` 表示运行时输入插入位置。
3. 同步到支持的 harness。
4. 确认已有的 harness command 文件，并在需要时采用到共享库。

![skill-market-slash-commands-matrix](./assets/skill-manager-slash_commands-matrix.png)

### 商城

商城是发现界面：

- **Skill 商城**：浏览并安装 Skill。
- **MCP 商城**：浏览并安装 MCP 服务器。
- **CLI 商城**：从 CLIs.dev 预览外部 CLI 工具。此区域仅展示，Skill Manager 不安装或管理 CLI。

![skill-market-skill-matrxi](./assets/skill-manager-marketplace.png)

## 安装

### Homebrew（macOS 推荐）

```bash
brew tap mode-io/tap
brew install skill-manager
skill-manager start
```

### npm（macOS ARM64/x64 和 Linux x64/ARM64）

```bash
npm install -g @mode-io/skill-manager
skill-manager start
```

npm wrapper 会为当前平台和 CPU 架构下载对应的原生 release artifact。

## 支持的 harness

| Harness | Skill | MCP 服务器 | Slash command |
|---|---:|---:|---:|
| Codex CLI | 支持 | 支持 | 支持 |
| Claude Code | 支持 | 支持 | 支持 |
| Cursor | 支持 | 支持 | 支持 |
| OpenCode | 支持 | 支持 | 支持 |
| OpenClaw | 支持 | 暂不支持 | 暂不支持 |

## 本地优先安全模型

Skill Manager 是本地配置管理工具。它在你的机器上运行，并读取或写入本地 harness 扩展状态。

可能修改本地状态的操作包括：

- 采用本地 Skill 文件夹
- 为某个 harness 启用或停用 Skill
- 更新带来源信息的 Skill
- 移除或删除 Skill
- 创建、更新、验证、激活或删除 LLM 扫描配置
- 运行 Skill 扫描，这会将所选 Skill 上下文发送给已配置的 LLM provider
- 将 MCP 服务器安装到来源 harness
- 采用已有 MCP 配置
- 启用、停用、解决差异或卸载 MCP 服务器
- 创建、更新、同步、导入或删除 slash command
- 修改 harness 支持设置

在 macOS 上，应用拥有的文件位于 `~/Library/Application Support/skill-manager`；在 Linux 上使用 XDG base directories。

## 工作方式

### Skill

采用之前，各 harness 指向各自的本地 Skill 文件夹。采用之后，Skill Manager 会在共享本地存储中保留一个规范包，并通过本地链接暴露给选定 harness。停用某个 harness 会移除该 harness 绑定，但不会删除包本身。

![skill-market-overview](./assets/skill-manager-skill-unification.svg)

### Skill 扫描

Skill 扫描会从 `SKILL.md`、manifest 元数据、脚本与配置文件，以及 Skill 指令引用的文件中构建受限 prompt 上下文。`.env`、私钥、证书和 credential 文件等可能包含 secret 的文件会从 prompt 上下文中排除；超过扫描器限制的大文件也会被跳过。

扫描器优先使用当前激活的已保存 LLM 配置。如果没有激活配置，也可以回退到支持的环境变量，例如 `ANTHROPIC_API_KEY`、`OPENAI_API_KEY`、`OPENROUTER_API_KEY`、`GEMINI_API_KEY`、`GOOGLE_API_KEY`、`AZURE_OPENAI_API_KEY`、`AWS_BEDROCK_MODEL` 或 `OLLAMA_HOST`。

扫描报告会展示 Skill 是否安全、最高严重程度、发现项、位置、片段和修复建议。前端会将已完成报告缓存在浏览器 localStorage 中，因此最近结果在页面切换后仍可查看。

### MCP 服务器

MCP 服务器以规范化 Skill Manager 记录保存，再转换为每个 harness 需要的配置形状：

- Codex 使用 `mcp_servers` 下的 TOML。
- Claude Code 和 Cursor 使用 `mcpServers` JSON 条目。
- OpenCode 使用类型化的本地或远程 MCP 条目。
- OpenClaw 暂不支持 MCP 写入。

当 Skill Manager 发现同一个 MCP 服务器存在不同配置时，会先要求你选择事实来源。

![skill-market-overview](./assets/skill-manager-mcp-translation.svg)

### Slash command

Slash command 以 TOML 记录保存在 Skill Manager 应用存储中，再渲染到每个支持 harness 的格式：

- OpenCode 写入 `~/.config/opencode/commands` 下的 Markdown command 文件，并通过 `/` 调用。
- Claude Code 写入 `~/.claude/commands` 下的 Markdown command 文件，并通过 `/` 调用。
- Cursor 写入 `~/.cursor/commands` 下的纯文本 command 文件，并通过 `/` 调用。
- Codex 写入 `~/.codex/prompts` 下的 prompt 文件，并通过 `/prompts:` 调用。
- OpenClaw 暂不支持 slash command 写入。

Skill Manager 使用同步状态和内容哈希跟踪目标所有权。它不会自动覆盖未跟踪的 command 文件；当目标不再匹配上次同步哈希时，会报告托管文件已变更或缺失。确认操作可用于采用未托管 command、恢复托管内容、将已变更的 harness command 采用为新来源，或移除损坏绑定且保留 harness 文件。

### CLI

CLI marketplace 条目仅用于预览。

## 配置

在 macOS 上，应用拥有的文件位于 `~/Library/Application Support/skill-manager`；在 Linux 上使用 XDG base directories。

常用 macOS 路径：

- 共享 Skill 存储：`~/Library/Application Support/skill-manager/shared`
- MCP manifest：`~/Library/Application Support/skill-manager/mcp/manifest.json`
- slash command 库：`~/Library/Application Support/skill-manager/slash-commands/commands`
- slash command 同步状态：`~/Library/Application Support/skill-manager/slash-commands/sync-state.json`
- 商城缓存：`~/Library/Application Support/skill-manager/marketplace`
- 应用数据库和 LLM 扫描配置：`~/Library/Application Support/skill-manager/skill-manager.db`
- 应用设置：`~/Library/Application Support/skill-manager/settings.json`

常用 Linux 路径：

- 共享 Skill 存储：`${XDG_DATA_HOME:-~/.local/share}/skill-manager/shared`
- MCP manifest：`${XDG_DATA_HOME:-~/.local/share}/skill-manager/mcp/manifest.json`
- slash command 库：`${XDG_DATA_HOME:-~/.local/share}/skill-manager/slash-commands/commands`
- slash command 同步状态：`${XDG_DATA_HOME:-~/.local/share}/skill-manager/slash-commands/sync-state.json`
- 商城缓存：`${XDG_DATA_HOME:-~/.local/share}/skill-manager/marketplace`
- 应用数据库和 LLM 扫描配置：`${XDG_DATA_HOME:-~/.local/share}/skill-manager/skill-manager.db`
- 应用设置：`${XDG_CONFIG_HOME:-~/.config}/skill-manager/settings.json`

大多数用户不需要修改这些位置。如果你在自定义环境中管理 Skill，可以用环境变量覆盖单个 Skill 根目录。

| Harness | 环境变量 | 默认 Skill Manager Skill 根目录 |
|---|---|---|
| Codex | `SKILL_MANAGER_CODEX_ROOT` | `~/.agents/skills` |
| Claude | `SKILL_MANAGER_CLAUDE_ROOT` | `~/.claude/skills` |
| Cursor | `SKILL_MANAGER_CURSOR_ROOT` | `~/.cursor/skills` |
| OpenCode | `SKILL_MANAGER_OPENCODE_ROOT` | `~/.config/opencode/skills` |
| OpenClaw | `n/a` | `~/.openclaw/skills` |

MCP 配置位置由 harness 拥有。Skill Manager 只写入经过验证的配置路径，并跳过不支持的 harness 写入。

## 从源码运行

### 要求

- Python 3.11+
- Node.js 18+
- npm

`skill-manager` 支持 Python 3.11+。CI 会验证 Python 3.11 到 3.14 的后端兼容性；为了确定性，打包和发布构建仍固定在 Python 3.11。

### 贡献者设置

```bash
scripts/install-dev.sh
```

### 本地运行

```bash
scripts/start-dev.sh
```

停止本地托管实例：

```bash
scripts/stop-dev.sh
```

需要 Vite 热更新时，可以使用拆分开发流程：

```bash
npm run dev
npm run dev:backend
```

默认本地 URL：

- Frontend：`http://127.0.0.1:5173`
- Backend：`http://127.0.0.1:8000`
- Health：`http://127.0.0.1:8000/api/health`

验证：

```bash
scripts/install-dev.sh
npm run typecheck
bash scripts/test_backend.sh
npm test
npm run build
```

## 故障排查

- 如果商城请求失败并显示 `Marketplace is temporarily unavailable`，请确认网络连接后重试。
- 在 macOS 上，如果 `npm install -g @mode-io/skill-manager` 提示 Homebrew 已拥有 `skill-manager`，请先卸载 Homebrew formula。反过来也一样：切回 Homebrew 前请先卸载 npm 包。
- 如果某个 MCP harness 显示为不可用，说明 Skill Manager 检测到本地客户端缺失，或该客户端不支持所需配置界面。

## 后续计划

### 扩展类型

- [ ] Hook 支持
- [x] Slash command 支持
- [ ] Plugin 支持

### Harness 扩展

- [ ] GitHub Copilot
- [ ] Gemini CLI
- [ ] Cline
- [ ] Windsurf
- [ ] Qwen Code
- [ ] Kimi Code
- [ ] Qoder

## 社区

- 查看 [CONTRIBUTING.md](CONTRIBUTING.md) 了解贡献指南。
- 查看 [SECURITY.md](SECURITY.md) 以私下报告安全漏洞。
