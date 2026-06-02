# PROJECT KNOWLEDGE BASE

**Branch:** fix/progress · **Commit:** dcabfad
**Stack:** Go 1.25.0 + React 19 + Vite 8 + Gin 1.12 · **Default port:** 3006

## 个人偏好

- 使用中文沟通
- 提交前 `make fmt` + `pnpm run check:all`

## Quick Commands

| 场景 | 命令 |
|------|------|
| 安装依赖 | `make install` (pnpm + go mod tidy) |
| 开发模式（热重载） | `make dev` → http://localhost:3006 |
| 单元测试 | `make test`（Go + Vitest） |
| E2E 测试 | `make e2e-playwright`（CI 也跑 Docker 版：`make e2e-docker`） |
| Type/Lint 检查 | `pnpm run check:all`（tsc + eslint） |
| 单二进制发布构建 | `COURSES_USE_EMBED=true make release` |
| 跨平台构建 | `make release-all` |
| Docker 部署 | `make docker-up` / `make docker-down` |
| 环境诊断+自动修复 | `kwdb-playground doctor --fix` |
| VSCode 调试 | `.vscode/launch.json` 配 dlv 端口 2345 |

## Repository Layout

```
.
├── main.go                    # Cobra root, 唯一 go:embed: dist/* + courses/*
├── cmd/                       # CLI 子命令 (start / stop / doctor / update + 已弃用的 check)
├── internal/                  # Go 核心包
│   ├── api/                   # Gin HTTP handlers + routes.go (528L)
│   ├── docker/controller.go   # 2678L 容器编排（含 mutex map + 轮询循环）
│   ├── course/                # YAML+MD 课程加载、进度
│   ├── websocket/             # Terminal + Code WS；SQL WS 在 internal/api/
│   ├── check/                 # 诊断+自动修复（doctor 后端）
│   ├── upgrade/               # 自升级服务（GitHub/AtomGit/Homebrew）
│   ├── config/                # YAML 配置 + 环境变量覆盖
│   └── procutil/              # PID/端口解析
├── src/                       # React 前端
│   ├── pages/                 # 4 个顶级页 + learn/ 子模块
│   ├── components/business/   # Terminal/SqlCodeEditor/SqlTerminal/PortConflict
│   ├── components/ui/         # Button/Dialog/Dropdown 等基础组件
│   ├── store/                 # Zustand（learnStore, tourStore, uiPreferences, upgrade）
│   ├── hooks/                 # 通用 hooks（业务 hooks 在 pages/learn/hooks/）
│   └── lib/api/               # Axios 客户端 + 类型
├── courses/                   # 课程内容 (YAML index + intro/step/finish MD)
├── tests/playwright/          # E2E（serial, project dependencies）
├── docker/                    # playground + 课程镜像
└── docs/                      # usage-guide / upgrade / docker-deployment
```

## Sub-AGENTS.md 索引

仓库有 17 个分层 AGENTS.md。深入某模块前**先读对应子文档**：

| 路径 | 主题 |
|------|------|
| [`cmd/AGENTS.md`](cmd/AGENTS.md) | CLI 入口、start/stop 守护进程、doctor |
| [`internal/api/AGENTS.md`](internal/api/AGENTS.md) | HTTP handlers、REST 端点清单、WS 端点 |
| [`internal/docker/AGENTS.md`](internal/docker/AGENTS.md) | controller.go 复杂点、mutex 锁、轮询循环 |
| [`internal/course/AGENTS.md`](internal/course/AGENTS.md) | Course 类型、YAML schema、进度 |
| [`internal/websocket/AGENTS.md`](internal/websocket/AGENTS.md) | WS 协议、写泵、context 级联 |
| [`internal/check/AGENTS.md`](internal/check/AGENTS.md) | 诊断项、fix-scope 选项、自动修复 |
| [`internal/upgrade/AGENTS.md`](internal/upgrade/AGENTS.md) | 自升级流程、模式分发、回滚 |
| [`src/pages/AGENTS.md`](src/pages/AGENTS.md) | 顶级页 + learn/ 模块结构 |
| [`src/pages/learn/AGENTS.md`](src/pages/learn/AGENTS.md) | Learn 子模块 hooks 依赖链 |
| [`src/store/AGENTS.md`](src/store/AGENTS.md) | Zustand 状态 |
| [`src/lib/AGENTS.md`](src/lib/AGENTS.md) | API 客户端、utils |
| [`src/hooks/AGENTS.md`](src/hooks/AGENTS.md) | 通用 hooks |
| [`src/components/business/AGENTS.md`](src/components/business/AGENTS.md) | 交互组件、WS 端点 |
| [`src/components/ui/AGENTS.md`](src/components/ui/AGENTS.md) | UI 原语、cn() 模式 |
| [`courses/AGENTS.md`](courses/AGENTS.md) | 课程结构、YAML schema |
| [`tests/playwright/AGENTS.md`](tests/playwright/AGENTS.md) | E2E 规范、状态重置 |

## Conventions（与默认不同的部分）

### 前后端共享
- **Import 顺序**：React → `@/*`（绝对路径）→ 相对路径（前端）；stdlib → 外部 → internal（后端）
- **错误包装**：`fmt.Errorf("action: %w", err)`
- **日志**：中文消息、英文标识符
- **YAML**：使用 `gopkg.in/yaml.v3`

### 前端特定
- **TS strict OFF**（`tsconfig.json`），仍有部分检查：`noUnusedLocals: false` 等全关
- **路径别名**：`@/*` → `./src/*`，前后端一致
- **Tailwind 4.2** + `cn()` 辅助（`lib/utils.ts` 中 `clsx` + `tailwind-merge`）
- **Vite dev server**：`/api` 和 `/ws` 代理到 `http://localhost:3006`（注意：dev 启动必须 `make dev` 起后端，否则 404）
- **状态**：Zustand，store 文件以 `*Store` 结尾
- **业务 hooks 分散在 `src/pages/learn/hooks/`**（不是 `src/hooks/`），导入用 `learn/hooks` 的 barrel

### 后端特定
- **CLI 入口**是 `main.go`（78 行），所有子命令在 `cmd/*`
- **Daemon 默认开启**（`start` 走 `--daemon`），PID 文件 `tmp/kwdb-playground.pid`
- **课程双模式**：`COURSES_USE_EMBED=true` 走 `embed.FS`，否则走 `COURSE_DIR` 磁盘
- **静态文件回退**：运行时优先磁盘 `dist/`，回退到 `staticFiles embed.FS`
- **`cmd/check/` 是已弃用 wrapper**（17 行）→ 改用 `doctor`；不要在那里加新功能
- **WebSocket 关闭顺序**（`internal/websocket`）：不要在 handler 中关闭 conn；由 writePump 在 `ctx.Done()` 时关闭
- **API handler 是 `handlers_course_runtime.go`**（不是旧的 `handlers_run.go`）

## Critical Hotspots

| 区域 | 风险 |
|------|------|
| `internal/docker/controller.go` (2678L) | mutex 锁密集、容器状态轮询存在竞态风险 |
| `internal/api/routes.go` (528L) | 长 handler、嵌套错误处理 |
| `src/pages/CourseList.tsx` (~1280L) | 需要按功能拆分 |
| `src/pages/CourseImageManagement.tsx` (~1310L) | 同上 |
| `src/pages/learn/Learn.tsx` (~1460L) | 子模块已拆分但主文件仍过大 |
| `dist/` 嵌入 | 必须 `pnpm run build` 后再 `go build`，否则前端为空白 |
| `tmp/` 路径 | daemon PID/编译产物，开发模式下 `make clean` 会清空 |

## Test Workflow

```bash
# 单元测试（并行）
go test ./...                                              # 后端
pnpm run test                                              # 前端 Vitest (jsdom)

# E2E（串行，依赖链：quick-start → course-list-status → sql-terminal → port-conflict → course-pause → code-terminal → onboarding）
make e2e-playwright          # 本地/CI（用 make playwright 启服，非 make dev）
make e2e-docker              # Docker 部署版

# 单测试
npx playwright test --project=sql-terminal -g "具体描述"
```

**Playwright 约定**：测试用 `data-testid`；Chinese `test.describe`；`beforeEach` 通过 `/api/progress/:id/reset` + `/api/containers` 重置状态；`localStorage` 用 `page.addInitScript` 清；screenshots → `tests/screenshots/`，reports → `tests/reports/`。

**服务端不能用 `make dev`**：E2E 用 `make playwright`（先 `pnpm run build` 再 `go build`），禁用热重载以保证 SIGINT 行为一致。

## Environment Setup

- **Go**: 1.25+（CI 默认 1.25）
- **Node.js**: 20+（CI 默认 25）
- **pnpm**: 10+（`packageManager` 锁 pnpm 10.32.1）
- **Docker**: 必须运行（核心依赖）
- **调试工具**：`make install-tools` 安装 `air`（热重载）+ `dlv`（调试，端口 2345）
- **健康检查**：`curl http://localhost:3006/health`

`.env` 默认值（已 `.gitignore`，可创建自定义）：
```
SERVER_HOST=localhost
SERVER_PORT=3006
COURSE_DIR=./courses
LOG_LEVEL=debug
LOG_FORMAT=text
```

## CI/CD (`.github/workflows/`)

| Workflow | 触发 | 内容 |
|----------|------|------|
| `unit-tests.yml` | push/PR to main | Go 测试 + 覆盖率、`go fmt` 检查、前端 tsc+ESLint |
| `playwright.yml` | push/PR to main | 两个 job：本地 Playwright + Docker 部署 Playwright |
| `release.yml` | tags `v*` | `make release-all` + 创建 GitHub Release（5 平台 + checksums） |
| `docker-publish.yml` | push | `kwdb/playground` 镜像 |
| `sync-to-atomgit.yml` | release 后 | 同步到 AtomGit（国内镜像） |

## Non-Standard 注意事项

- **AI 工具目录**：`.trae/`、`.sisyphus/`、`.qoder/`、`.augment/`、`.omo/` 都是 Sisyphus/Trae/Qoder 状态目录，**已 gitignore**
- **`docs/ARCHITECTURE_ISSUES.md` 和 `docs/LOGGING.md`** 已 gitignore（内部文档，不进提交）
- **`opencode.json` 不存在**（无 OpenCode 特定配置）
- **Course 嵌入**：课程是构建时 `go:embed` 进去的，运行时无法动态新增；新增课程后必须重新 `make release`
- **TypeScript 严格度全关**——新代码保持纪律性，但编译器不会强制

## Entry Points

| 用途 | 文件 |
|------|------|
| Cobra 根 | `main.go` |
| HTTP 服务启动 | `cmd/start/start.go` |
| 路由注册 | `internal/api/routes.go` |
| React 入口 | `src/main.tsx` |
| Vite 配置 | `vite.config.ts`（端口代理、manualChunks） |
| 课程加载 | `internal/course/service.go` |
| 容器编排 | `internal/docker/controller.go` |
