# 贡献指南 (Contributing to KWDB Playground)

首先，非常感谢你考虑为 KWDB Playground 做出贡献！正是因为有你们，开源社区才如此繁荣。

KWDB Playground 是一个全栈交互式课程平台，后端采用 Go 1.25 (Gin, Docker SDK, WebSocket)，前端采用 React 18 (TypeScript, Vite, Tailwind)，并依赖 Docker 运行隔离的课程容器环境。

## 1. 本地开发环境搭建

请按照以下步骤在本地运行该项目：

### 环境要求
- **Go**: >= 1.25
- **Node.js**: 推荐 >= 20
- **包管理器**: pnpm (前端), Go modules (后端)
- **Docker**: 必须安装并运行 Docker 守护进程 (Docker Desktop 或 Docker Engine)
- **Make**: 用于执行构建和本地开发脚本

### 安装步骤
1. Fork 本仓库并克隆到本地：
   ```bash
   git clone https://github.com/<your-username>/playground.git
   cd playground
   ```
2. 安装前后端依赖：
   ```bash
   make install
   ```

## 2. 开发工作流

### 运行项目
启动前后端开发服务（带有热重载）：
```bash
make dev
```
启动后，本地页面可通过 `http://localhost:3006` 访问。**请勿直接使用 `npm` 启动。**

### 代码结构指南
- `cmd/`: CLI 命令入口 (start, stop, check 等)
- `internal/`: 后端 Go 核心逻辑 (api, docker, course, websocket 等)
- `src/`: 前端 React 源码 (pages, components, store, hooks 等)
- `courses/`: 课程内容文档 (YAML + MD 格式)
- `docker/`: 课程运行时依赖的 Docker 镜像配置
- `tests/playwright/`: 端到端 (E2E) 测试

### 代码风格规范
#### TypeScript / React
- **导入顺序**: `React` → `@/*` 绝对路径 → 相对路径
- **命名规范**: 组件使用 `PascalCase`，自定义 Hook 使用 `use*`，Zustand Store 使用 `*Store`
- **样式**: 使用 `cn()` 辅助函数拼接 Tailwind 类名
- **TypeScript**: `tsconfig` 中 `strict` 模式为 `false`，但仍建议尽量提供清晰的类型定义

#### Go
- **导入顺序**: 标准库 → 外部依赖库 → 内部包 (`internal/*`)
- **错误处理**: 统一使用 `fmt.Errorf("action: %w", err)` 包装错误
- **日志记录**: 日志信息使用中文，标识符使用英文

### 运行测试
在提交代码之前，请确保所有测试用例都能通过。本项目包含后端单元测试、前端单元测试以及 E2E 测试：

```bash
# 运行 Go 后端单元测试
go test ./...

# 运行前端 Vitest 单元测试
pnpm run test:unit

# 运行 Playwright 端到端测试 (串行执行)
make e2e-playwright
```

### 构建与发布
如需在本地构建单文件可执行二进制包（内嵌前端静态资源）：
```bash
make release
```

## 3. 提交 Pull Request (PR)

1. 确保你的代码基于最新的 `main` 分支：`git checkout main && git pull`
2. 从 `main` 分支创建一个新分支：`git checkout -b feature/你的特性名称` (或 `fix/你的修复名称`)
3. 编写代码并提交。建议使用 [约定式提交 (Conventional Commits)](https://www.conventionalcommits.org/) 规范。
4. 推送到你的 Fork 仓库：`git push origin feature/你的特性名称`
5. 向我们的 `main` 分支发起 Pull Request。
6. 在 PR 描述中清晰地说明你的改动动机、实现细节以及任何需要注意的地方。

## 4. 行为准则
参与本项目的开发即表示你同意遵守我们的行为准则。请尊重所有的维护者和其他贡献者，保持友善和建设性的交流。
