# KWDB Playground

KWDB Playground 是一个面向学习与演示 KWDB 的课程项目。

## 启动说明

### 1. 安装依赖项

请先安装以下基础环境：
- Go 1.23
- Node.js ≥ 18 与 pnpm ≥ 8
- Docker

安装项目依赖：

```bash
# 前端依赖
pnpm install

# 若使用 Python 运行 e2e 测试（可选）
pip install -r requirements.txt
```

### 2. 必要的环境配置

项目支持从环境变量进行配置。你可以在项目根目录创建 `.env` 文件（可选）：

```env
# 服务器监听地址与端口
SERVER_HOST=0.0.0.0
SERVER_PORT=3006

# 课程内容目录（开发模式）
COURSE_DIR=./courses

# 是否使用嵌入式课程与前端资源（发布模式建议开启）
COURSES_USE_EMBED=0

# 是否启用课程热重载（开发模式更友好）
COURSES_RELOAD=1
```

说明：
- 开发模式：`COURSES_USE_EMBED=0`，课程与前端资源从磁盘读取，利于本地调试与热更新。
- 发布模式：`COURSES_USE_EMBED=1`，课程与前端资源打包进单一二进制，便于部署分发。

### 3. 运行项目的具体命令

本地开发启动：

```bash
# 启动后端与前端静态资源服务（端口 http://localhost:3006）
make dev
```

构建并启动（非守护）：

```bash
# 构建前后端
make build

# 启动二进制
./bin/kwdb-playground server
```

访问地址：
- 本地页面：http://localhost:3006

## 编译指南

### 1. 编译所需工具与环境
- Go 1.23（建议 `go env` 验证）
- Node.js ≥ 18 与 pnpm ≥ 8
- macOS / Linux / Windows（编译平台，对应交叉编译目标见发布流程）

### 2. 分步骤编译过程

```bash
# 前端构建（产物将生成到 dist/）
pnpm run build

# 后端构建（默认生成 kwdb-playground 二进制）
make backend

# 或者一键构建前后端
make build
```

生成的二进制默认位于 `bin/kwdb-playground`

### 3. 常见编译问题与解决方案
- 构建后运行报错：找不到前端资源或课程
  - 解决：确保已执行 `pnpm run build` 并生成 `dist/`；开发模式下确认 `COURSE_DIR` 指向 `./courses`。
- `pnpm` 命令不存在或版本过低
  - 解决：安装或升级 pnpm（https://pnpm.io/）；确保 Node.js 版本 ≥ 18。
- Go 版本不匹配
  - 解决：安装 Go 1.23，并使用 `go env` 确认环境。必要时调整 `PATH` 指向正确的 Go 安装目录。
- 端口被占用（3006）
  - 解决：修改 `SERVER_PORT` 或释放占用进程。
- Docker 功能不可用
  - 解决：确保本机 Docker 服务已启动；如不需要容器功能，可忽略相关警告。

## 发布流程

### 1. 发布前准备
- 确认前端构建完成：`pnpm run build`（生成 `dist/`）
- 开启嵌入模式以打包静态资源与课程：`COURSES_USE_EMBED=1`
- 验证 `.env` 或环境变量设置正确（`SERVER_HOST`、`SERVER_PORT` 等）

### 2. 发布的具体操作步骤

单平台发布：
```bash
# 生成发布版二进制（嵌入静态资源与课程）
COURSES_USE_EMBED=1 make release

# 运行发布版
COURSES_USE_EMBED=1 make release-run
```

跨平台构建：
```bash
# Linux AMD64
COURSES_USE_EMBED=1 make release-linux-amd64

# macOS ARM64（Apple Silicon）
COURSES_USE_EMBED=1 make release-darwin-arm64

# Windows AMD64
COURSES_USE_EMBED=1 make release-windows-amd64

# 一键构建所有目标
COURSES_USE_EMBED=1 make release-all
```

## 守护进程模式

项目支持通过 `--daemon` 或 `-d` 以守护进程模式运行，自动 fork + detach、管理 PID 文件，标准输出与错误重定向到守护日志文件。

### 使用方法

```bash
# 开发模式（磁盘资源）后台运行
./bin/kwdb-playground server -d

# 发布模式（嵌入资源）后台运行
COURSES_USE_EMBED=1 ./bin/kwdb-playground server -d

# 查看日志
 tail -f logs/daemon.log

# 查看 PID
 cat tmp/kwdb-playground.pid

# 优雅停止（清理 PID 文件）
 kill -TERM $(cat tmp/kwdb-playground.pid)
# 或发送 SIGINT
 kill -INT $(cat tmp/kwdb-playground.pid)
```

说明：
- 守护模式当前针对类 Unix 系统（macOS/Linux）设计；Windows 下建议以服务方式运行或使用任务计划实现后台运行。
- 若存在陈旧 PID 文件或端口占用，将拒绝重复启动并给出提示。

## 常见问题与故障排除

- 启动后页面空白或资源 404
  - 检查 `dist/` 是否存在；开发模式下 `make dev` 是否已启动；发布模式下是否设置了 `COURSES_USE_EMBED=1`。
- 课程列表为空或内容无法阅读
  - 检查 `COURSE_DIR` 配置（开发模式）；确认 `courses/` 目录结构完整（含 `index.yaml` 与 Markdown 内容）。
- 守护模式无法启动或日志未写入
  - 检查 `logs/` 与 `tmp/` 目录是否有写权限；确认未有旧的 PID 持有与端口占用。
- Docker 相关功能不可用
  - 确认 Docker 服务运行正常；若不需要该功能，可忽略相关警告。
