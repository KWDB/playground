# SQL 终端设计方案

## 背景与目标
- 为课程页面提供 SQL 终端，与现有 Shell 终端互斥显示。
- 当 `index.yaml` 中启用 `sqlTerminal` 时展示 SQL 终端，反之展示 Shell 终端。
- SQL 终端在启动 KWDB 镜像后自动连接，端口使用 `index.yaml` 的 `backend.port`。
- 后端采用 Go 的 pgx 驱动连接 KWDB（非安全模式、`root` 用户）。
- SQL 终端增加连接信息面板：KWDB 版本、端口、系统架构、编译时间。
- 在课程列表的卡片上标注 Shell/SQL 标签。

## 术语
- SQL 终端：在课程页用于执行 SQL、查看结果的交互组件。
- Shell 终端：当前已存在的命令行容器终端组件。
- KWDB：目标数据库服务，兼容 Postgres 协议。

## 配置变更（index.yaml）
- 新增配置键：`sqlTerminal: boolean`（默认 `false`）。
- 使用已有或新增的 `backend.port: number` 作为 KWDB 连接端口。
- 兼容性：为避免用户输入拼写错误，前端/后端在解析时同时兼容 `slqTerminal`（若存在则等同于 `sqlTerminal`）。

示例（课程 `index.yaml`）：

```yaml
title: "SQL 基础"
intro: intro.md
backend:
  port: 26257
  image: kwdb/kwdb:latest
  env:
    - KWDB_INSECURE=true
sqlTerminal: true
```

## 前端改造

### 课程列表卡片标签
- 在 `src/pages/CourseList.tsx` 渲染课程卡片时，读取课程配置中的 `sqlTerminal`。
- 标签规则：
  - `sqlTerminal === true` → 显示 `SQL` 标签。
  - 否则显示 `Shell` 标签。
- 样式简洁：浅色描边、统一圆角、占位大小一致，避免视觉跳动。

### 课程页面终端显示逻辑
- 终端互斥：课程页只显示一种终端。
  - `sqlTerminal === true` → 渲染 `SqlTerminal` 组件。
  - 否则 → 渲染现有 `Terminal`（Shell 终端）组件。
- 终端容器保留现有样式风格，与页面整体风格一致。

### SQL 终端组件（新）
- 新建 `src/components/SqlTerminal.tsx`：
  - 输入区：多行编辑框（支持 Shift+Enter 换行，Enter 执行）。
  - 结果区：表格展示查询结果；错误信息以醒目但简洁的提示展示。
  - 状态区：连接状态（已连接/断开/重试中）。
  - 连接信息面板：显示 KWDB 版本、端口、系统架构、编译时间；支持刷新。
- 交互与细节：
  - 自动连接：页面加载后读取课程的 `backend.port`，尝试建立连接；若未启动 KWDB，提示并支持重试。
  - 执行策略：前端调用后端 SQL 执行 API（详见后端改造）。
  - 安全与权限：仅非安全模式、`root` 用户；避免在 URL/日志中暴露密码字段。

## 后端改造（Go + pgx）

### 依赖与结构
- 依赖：`github.com/jackc/pgx/v5/pgxpool`
- 新增目录与文件（示意）：
  - `internal/sql/driver.go`：连接池、执行方法。
  - `internal/sql/controller.go`：HTTP 路由与处理器。
  - 在 `internal/api/routes.go` 注册路由。
  - 利用已有 `internal/docker` 适配器/控制器管理 KWDB 容器生命周期。

### 连接管理
- DSN 组装（非安全模式、root 用户）：
  - `postgresql://root@localhost:<port>/defaultdb?sslmode=disable`
  - 端口来源：课程 `index.yaml` 的 `backend.port`（通过课程服务提供）。
- 使用 `pgxpool.Pool` 管理连接池：懒初始化，首次请求或检测到 KWDB 已启动时建立。
- 健康检查与重试：指数退避（上限 30s）、最大重试次数可配置。

### KWDB 容器启动逻辑（后端）
- 触发时机：在首次访问 SQL 终端相关 API（`/api/sql/*`）之前，后端确保 KWDB 容器已启动并可连接。
- 实现方式：
  - 读取课程配置（`backend.*`）并调用 `internal/docker` 适配器：
    - 若存在同名容器且状态为 `running` → 复用。
    - 若不存在或已退出 → 根据配置启动容器。
  - 启动参数（建议）：
    - 镜像：`backend.image`（默认：`kwdb/kwdb:latest`）。
    - 端口映射：`-p <backend.port>:26257`（将容器内默认端口映射到主机）。
    - 环境变量：`backend.env`（如 `KWDB_INSECURE=true`）。
  - 就绪判定：
    - 连续探测 `tcp(localhost:<backend.port>)` 可用；或尝试 `SELECT 1` 成功。
    - 设置 30～60 秒超时与指数退避，失败返回 503 并提示重试。
- 与连接管理的协同：
  - 容器就绪后初始化/刷新 `pgxpool` 连接池。
  - 若容器重启/异常，下一次请求触发重新就绪流程。
- 可选 API（便于显式控制）：
  - `POST /api/sql/start`：显式启动 KWDB 容器（返回状态与日志摘要）。
  - `GET /api/sql/status`：查询容器与连接状态（`running`/`stopped`、端口、镜像、版本）。

### API 设计
- `GET /api/sql/info`
  - 返回连接信息：版本、端口、系统架构、编译时间、连接状态。
  - 数据来源：
    - 首选：`SELECT version()`（解析字符串中的版本、架构、编译时间）。
    - 兼容（Cockroach/KWDB）：`SELECT * FROM crdb_internal.node_build_info`（含字段：`Version`、`Build Time`、`GOARCH` 等）。
- `GET /api/sql/health`
  - 连接状态探测（连通性、延迟）。
- `POST /api/sql/execute`
  - 请求体：`{ query: string, args?: any[] }`
  - 响应：`{ columns: string[], rows: any[], rowCount: number, durationMs: number }`
  - 错误返回：`{ error: string }`，避免泄露敏感信息。

### 错误与日志
- 统一错误封装，HTTP 语义化状态码：
  - 400（参数错误）、503（未连接/服务不可用）、500（执行错误）。
- 日志记录但脱敏（不打印完整 SQL 参数）；保留 traceID 便于排查。

## SQL 终端连接信息面板
- 展示字段：
  - KWDB 版本（例如 `vX.Y.Z` 或完整版本字符串）。
  - 端口（`backend.port`）。
  - 系统架构（例如 `x86_64`、`arm64`）。
  - 编译时间（ISO8601）。
- 行为：
  - 首屏加载自动请求 `/api/sql/info`；显示加载/错误状态。
  - 刷新按钮触发重新请求；错误时显示简洁提示。
- UI 简洁：
  - 统一边框与浅色背景；与课程页风格一致。
  - 标签式展示（字段名+值），适配窄屏换行。

## 权限与安全
- 使用 `root` 用户，`sslmode=disable`；仅在本地/教学环境使用。
- 对外不暴露数据库写入型 API；仅透传用户的 SQL 执行。
- 严控跨域与来源（同源），防止被其他页面滥用。

## 兼容性与回退
- 当 `sqlTerminal !== true` 或无 `backend.port` 时：
  - 不加载 SQL 终端，显示 Shell 终端。
  - SQL 相关 API 不被前端调用。
- 当 KWDB 未启动：
  - 连接状态显示为未连接，提供重试与启动指引。

## 测试与验证
- 单元测试（后端）：
  - `driver` 连接管理与失败重试。
  - `execute` 行结果映射与错误处理。
- 前端测试（Playwright）：
  - 课程列表显示 Shell/SQL 标签。
  - 课程页互斥显示终端（根据 `sqlTerminal` 切换）。
  - KWDB 启动后自动连接、执行简单查询（如 `SELECT 1`）。
  - 连接信息面板显示并可刷新。
  - SQL 终端通过 WebSocket 建立连接并完成握手（`init`→`ready`）。
  - 发送查询消息并接收分片结果（`result`/`complete`），验证分页与渲染。
  - 取消执行与断线重连行为。

## 交付清单（实施建议）
1. 后端：新增 `internal/sql` 模块（pgxpool、API、路由）。
2. 前端：新增 `SqlTerminal.tsx` 与课程页路由/渲染逻辑（互斥）。
3. 课程列表：卡片标注 Shell/SQL 标签。
4. 配置解析：兼容 `sqlTerminal` 与误拼 `slqTerminal`；读取 `backend.port`。
5. 文档：在课程编写指引中加入 `sqlTerminal` 使用说明与示例。

## 示例响应（参考）
`GET /api/sql/info`：
```json
{
  "version": "KWDB v1.2.3",
  "port": 26257,
  "arch": "arm64",
  "buildTime": "2025-08-12T10:22:33Z",
  "connected": true
}
```

`POST /api/sql/execute`：
```json
{
  "columns": ["id", "name"],
  "rows": [[1, "Alice"], [2, "Bob"]],
  "rowCount": 2,
  "durationMs": 12
}
```

## 风险与备注
- KWDB 的版本/构建信息查询在不同版本可能有差异：
  - 优先使用 `SELECT version()`；若不含架构与构建时间，则查询内置系统表（例如 `crdb_internal.node_build_info`）。
- `backend.port` 为空的课程需明确指引（课程编写规范）。
- 若后续需要安全模式（TLS/用户鉴权），将引入证书与会话管理的额外工作量。