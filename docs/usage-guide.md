# KWDB Playground

KWDB Playground 提供了一个实践环境，以便用户可以轻松地探索 KWDB 的功能。

本项目采用 Go 与 Node.js 构建，帮助用户在 Docker 容器中快速体验 KWDB。

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

### 2. 启动命令与参数

使用 `kwdb-playground server` 子命令启动项目，支持 Flags 与环境变量组合配置，优先级为：`Flags > Env > 默认值`。

- 服务启动命令

```bash
kwdb-playground server
```

- 常用 Flags（显式设置时将覆盖环境变量）
  - `--daemon`, `-d`：以守护进程模式运行（详见“守护进程模式”）
  - `--host`：服务器监听地址（覆盖 `SERVER_HOST`）
  - `--port`：服务器端口（覆盖 `SERVER_PORT`）
  - `--log-level`：日志级别（覆盖 `LOG_LEVEL`），可选：`debug|info|warn|error`，默认 `warn`
  - `--log-format`：日志格式（覆盖 `LOG_FORMAT`），可选：`json|text`，默认 `text`

- `.env` 自动加载
  - 后端启动时会尝试加载根目录 `.env`（使用 `godotenv`），便于本地开发配置。

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

访问地址：http://localhost:3006

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
  - 解决：安装或升级 pnpm 确保 Node.js 版本 ≥ 18。
- Go 版本不匹配
  - 解决：安装 Go 1.23，并使用 `go env` 确认环境。必要时调整 `PATH` 指向正确的 Go 安装目录。
- 端口被占用（3006）
  - 解决：修改 `SERVER_PORT` 或释放占用进程。
- Docker 功能不可用
  - 解决：确保本机 Docker 服务已启动；如不需要容器功能，可忽略相关警告。

## 发布流程

### 1. 发布自动化（GitHub Release）
- 本仓库已配置 GitHub Actions 自动发布工作流：`.github/workflows/release.yml`
- 触发方式：推送语义化版本标签到远程，例如 `v1.2.0`
- 工作流内容：
  - 验证构建（`make check`、前端 `pnpm run build`、Go 测试 `go test -v ./...`）
  - 跨平台构建（Linux amd64、macOS arm64、Windows amd64），启用嵌入模式打包前端与课程
  - 生成 `sha256` 校验文件并上传到 Release
  - 生成分发包（zip/tar.gz），每包包含二进制、`LICENSE` 与 `README` 摘要，并附 `distribution-checksums.txt`
  - 自动生成 Release Notes 并发布二进制制品

#### 使用步骤
1) 本地创建版本标签并推送：
```bash
git tag v1.2.0
git push origin v1.2.0
```
2) 等待 GitHub Actions 完成，访问 Releases 页面下载对应平台的二进制：
- `kwdb-playground-linux-amd64`
- `kwdb-playground-darwin-arm64`
- `kwdb-playground-windows-amd64.exe`
- `checksums.txt`（包含上述文件的 SHA256）
 或下载打包分发物：
 - `kwdb-playground-linux-amd64.tar.gz`
 - `kwdb-playground-darwin-arm64.tar.gz`
 - `kwdb-playground-windows-amd64.zip`
 - `distribution-checksums.txt`（包含上述压缩包的 SHA256）

#### 校验下载文件
```bash
# 以 Linux 为例
sha256sum -c checksums.txt | grep linux-amd64

# 校验分发包
sha256sum -c distribution-checksums.txt | grep linux-amd64
```

#### 预发布（prerelease）标签
- 若标签包含后缀 `-alpha`、`-beta` 或 `-rc`，会自动标记为 Pre-release。

#### 注意事项
- 工作流使用 `Go 1.23` 与 `Node.js 18 + pnpm 8`，确保依赖版本兼容。
- 构建过程启用 `COURSES_USE_EMBED=true` 与 `CGO_ENABLED=0`，可在 Linux Runner 上跨平台生成 macOS/Windows 二进制。

### 2. 手动发布（本地）
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

## 自检命令（check）

该命令用于快速诊断本地环境与服务状态。

检查内容：
- 端口占用：可区分“被本服务占用（正常）”与“被其他进程占用（冲突）”，仅在实际端口冲突时提示错误。
- 服务状态：检测 TCP 可达性与 HTTP 健康检查（/health）。
- Docker 环境：检测本机 Docker 客户端与服务是否可用。
- 课程资源：检测课程索引与可用性。

用法示例：
```bash
# 开发模式：从源码直接运行
go run . check

# 二进制运行
./bin/kwdb-playground check

# 指定主机与端口（默认从环境变量 SERVER_HOST/SERVER_PORT 读取，端口默认 3006）
./bin/kwdb-playground check --host localhost --port 3006
```

端口占用判定规则：
- 若检测到端口被占用，将主动请求 `http://<host>:<port>/health`。
- 若返回符合 KWDB Playground 的健康响应（例如 status: ok 等特征），判定为“被本服务使用（正常）”，不会报错。
- 若健康端点不可达或响应不符合预期，则判定为“被其他进程占用（冲突）”，会给出错误提示。

示例输出（仅示意）：
```
================ 环境检查开始 ================
[✅] Docker 环境：Docker 客户端与守护进程连接正常
[✅] 端口占用 (localhost:3006)：端口被本服务使用（正常）
[✅] 课程加载与完整性：课程加载成功，共 2 门，数据完整性检查通过
[✅] 服务健康检查 (localhost:3006)：服务正在运行且健康（/health 返回 200）
================ 环境检查结束 ================
```

## Docker 镜像源选择器

KWDB Playground 支持灵活的 Docker 镜像源选择功能，允许用户根据网络环境选择最佳的镜像源，提高容器启动速度。

### 功能特性

1. **预设镜像源**
   - Docker Hub（官方）：默认镜像仓库
   - GitHub Container Registry (ghcr.io)：GitHub容器镜像仓库
   - 自定义源：支持输入任意镜像仓库地址

2. **镜像可用性检查**
   - 在启动容器前检查镜像是否可访问
   - 显示响应时间，帮助选择最快的镜像源
   - 支持本地镜像检测和远程仓库验证

3. **配置持久化**
   - 镜像源选择自动保存到浏览器本地存储
   - 下次访问时自动恢复上次选择的镜像源

### 使用方法

1. **打开镜像选择器**
   - 在课程详情页面，当容器停止时，点击"启动容器"按钮旁边的镜像图标
   - 或者在容器错误状态下，通过镜像选择器切换到可用的镜像源

2. **选择镜像源**
   - 从预设的镜像源列表中选择合适的源
   - 或选择"自定义源"，输入完整的镜像地址

3. **检查可用性**
   - 点击"检查可用性"按钮验证选择的镜像源是否可访问
   - 查看响应时间和可用性状态

4. **应用配置**
   - 确认镜像源可用后，点击"应用"按钮
   - 再次启动容器时将使用选择的镜像源

### API 接口

#### 获取镜像源列表

```bash
GET /api/images/sources
```

响应示例：
```json
{
  "sources": [
    {
      "id": "docker-hub",
      "name": "Docker Hub (官方)",
      "prefix": "",
      "description": "Docker官方镜像仓库",
      "example": "kwdb/kwdb:latest"
    },
    {
      "id": "ghcr",
      "name": "GitHub Container Registry",
      "prefix": "ghcr.io/",
      "description": "GitHub容器镜像仓库",
      "example": "ghcr.io/kwdb/kwdb:latest"
    }
  ]
}
```

#### 检查镜像可用性

```bash
POST /api/images/check-availability
Content-Type: application/json

{
  "imageName": "kwdb/kwdb:latest"
}
```

响应示例：
```json
{
  "available": true,
  "imageName": "kwdb/kwdb:latest",
  "message": "镜像可从远程仓库获取",
  "checkedAt": "2024-12-18T10:30:00Z",
  "responseTime": 1250
}
```

### 配置说明

课程配置文件（`index.yaml`）中的 `backend.imageid` 字段定义默认镜像：

```yaml
backend:
  imageid: kwdb/kwdb:latest
  port: 26257
  workspace: /kaiwudb/bin
```

用户通过镜像选择器选择的镜像将覆盖此默认配置。

### 注意事项

1. 镜像可用性检查会发起网络请求，可能需要一些时间
2. 选择的镜像源会保存在浏览器本地存储中，清除浏览器数据会重置为默认配置
3. 如果镜像源不可用，建议切换到其他镜像源或使用默认的 Docker Hub
4. 自定义镜像源需要输入完整的镜像地址，包括仓库地址和镜像名称

## e2e Playwright 测试

### 1. 测试环境准备

```bash
# 安装测试环境依赖
pnpm run pw:install

```

### 2. 执行测试

```bash
# 执行所有 e2e 测试
make e2e-playwright

# 单独执行特定测试
pnpm test:pw tests/playwright/smoke.spec.ts 
```

### 3. 查看结果

```bash
# 查看HTML测试报告
open tests/reports/index.html
```

## 常见问题与故障排除

- 启动后页面空白或资源 404
  - 检查 `dist/` 是否存在；开发模式下 `make dev` 是否已启动；发布模式下是否设置了 `COURSES_USE_EMBED=1`。
- 课程列表为空或内容无法阅读
  - 检查 `COURSE_DIR` 配置（开发模式）；确认 `courses/` 目录结构完整（含 `index.yaml` 与 Markdown 内容）。
- 守护模式无法启动或日志未写入
  - 检查 `logs/` 与 `tmp/` 目录是否有写权限；确认未有旧的 PID 持有与端口占用。
- Docker 相关功能不可用
  - 确认 Docker 服务运行正常；若不需要该功能，可忽略相关警告。
