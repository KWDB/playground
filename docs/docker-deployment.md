# Docker 部署指南

KWDB Playground 支持通过 Docker 容器化部署。由于 Playground 运行时会创建课程容器，采用 **Docker Socket Mount** 方式，将宿主机 Docker daemon 共享给应用容器。

课程文件通过 `go:embed` 嵌入到二进制中，启动课程容器时通过 Docker API (`CopyToContainer`) 自动注入，无需主机路径挂载。

## 前置条件

- Docker Engine 20.10+
- Docker Compose V2
- 宿主机需有足够磁盘空间拉取课程镜像（1-3 GB）

## 快速启动

### 使用 docker compose（推荐）

```bash
git clone https://github.com/kwdb/playground.git
cd playground

# 启动
docker compose -f docker/playground/docker-compose.yml up -d

# 查看日志
docker compose -f docker/playground/docker-compose.yml logs -f

# 停止
docker compose -f docker/playground/docker-compose.yml down
```

或使用 Makefile 快捷命令：

```bash
make docker-up    # 启动
make docker-down  # 停止
```

访问 http://localhost:3006 即可使用。

### 从源码构建

```bash
git clone https://github.com/kwdb/playground.git
cd playground

# 构建镜像
make docker-build

# 启动
docker compose -f docker/playground/docker-compose.yml up -d
```

## 配置

### 环境变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `SERVER_PORT` | `3006` | HTTP 服务端口 |
| `LOG_LEVEL` | `info` | 日志级别 (debug/info/warn/error) |
| `GIN_MODE` | `release` | Gin 框架运行模式 |
| `DOCKER_DEPLOY` | `true` | Docker 部署模式（镜像内已默认开启） |
| `DOCKER_NETWORK` | `kwdb-playground-net` | Docker 网络名称，确保 Playground 与课程容器互通 |
| `COURSES_USE_EMBED` | `true` | 使用嵌入式课程文件（镜像内已默认开启） |

### 自定义端口

```bash
SERVER_PORT=8080 docker compose -f docker/playground/docker-compose.yml up -d
```

## 架构说明

```
┌─────────────────────────────────────────┐
│   宿主机 Docker                          │
│                                         │
│  ┌───────────────┐                      │
│  │  Playground   │──▶ Docker Socket     │
│  │  Container    │                      │
│  │  (课程文件     │   CopyToContainer    │
│  │   嵌入二进制)  │─────────────────┐    │
│  └───────────────┘                 │    │
│                                    ▼    │
│  ┌───────────────┐   文件已注入容器  │
│  │ Course        │◀─────────────────┘    │
│  │ Container(s)  │                      │
│  └───────────────┘                      │
└─────────────────────────────────────────┘
```

Playground 容器通过挂载的 Docker socket 调用宿主机 Docker daemon 创建课程容器。课程容器与 Playground 容器是同级关系（sibling containers），而非嵌套关系。两者通过 Docker 命名网络（`kwdb-playground-net`）互相通信。

课程所需的文件（如 `tsdb.tar.gz`、SQL 脚本等）已嵌入 Playground 二进制中。启动课程容器时，Playground 在容器创建后、启动前，通过 Docker API 将文件注入课程容器，无需宿主机路径挂载。

SQL 类型课程（如 `sql`、`data-query`）通过容器 IP 地址连接同级的 KWDB 容器（同一 Docker 网络内），而非 `localhost`。

## 安全注意事项

- Docker socket 挂载赋予容器对宿主机 Docker daemon 的完整访问权限。仅在受信环境中使用。
- 部分课程需要 `privileged` 模式运行容器（如需要 systemd 的课程）。
- 建议在生产环境中配合反向代理（如 Nginx/Caddy）使用，并启用 HTTPS。

## 多架构支持

预构建镜像支持以下架构：
- `linux/amd64` (x86_64)
- `linux/arm64` (aarch64, Apple Silicon)

Docker 会自动拉取匹配当前架构的镜像。

## 故障排查

### Windows 部署

默认的 `docker-compose.yml` 挂载 `/var/run/docker.sock`（Unix socket），Windows 原生环境不支持此路径。以下是两种解决方式：

**方式一：通过 WSL2 运行（推荐）**

在 WSL2 终端中执行所有 Docker 命令即可，Docker Desktop 会在 WSL2 内自动提供 `/var/run/docker.sock`，无需额外配置。

**方式二：使用 Windows Named Pipe**

修改 `docker/playground/docker-compose.yml`，将 volumes 替换为 Windows named pipe：

```yaml
volumes:
  - //./pipe/docker_engine://./pipe/docker_engine
```

同时需要在 environment 中添加 `DOCKER_HOST`：

```yaml
environment:
  - DOCKER_HOST=npipe:////./pipe/docker_engine
```

> 注意：使用 named pipe 方式需要 Docker Desktop for Windows 处于运行状态。

### 容器无法启动

```bash
# 检查 Docker socket 权限
ls -la /var/run/docker.sock

# 确认 Docker daemon 运行中
docker info
```

### 课程容器创建失败

```bash
# 查看 Playground 日志
docker compose -f docker/playground/docker-compose.yml logs playground

# 检查 Docker 网络
docker network ls
```

### 健康检查失败

```bash
# 手动检查健康端点
curl http://localhost:3006/health

# 查看容器状态
docker compose -f docker/playground/docker-compose.yml ps
```
