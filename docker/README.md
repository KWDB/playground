# KWDB Playground 镜像构建与管理工具

`build_all.sh` 是一个集中纳管 `docker/` 目录下所有组件镜像的构建、检查与推送工具。它简化了过去分散在各个组件目录下的单调脚本，支持**多架构（amd64, arm64）**构建，并能一键发布到多个远端 Registry（Docker Hub, GitHub Container Registry, 阿里云容器镜像服务）。

## 主要功能

- 🚀 **一键全量构建**：只需一条命令，即可并行/串行构建所有支持的镜像。
- 🎯 **按需单独处理**：支持指定构建某个（或某几个）特定镜像。
- 🔍 **远端镜像检查**：利用 `manifest inspect` 检查镜像是否已存在于远端仓库。
- 🏗️ **分离构建与推送**：支持 `--build-only`（仅本地构建加载）和 `--push-only`（仅推送本地已构建镜像）。
- 🐳 **智能多架构**：使用 Docker Buildx 自动进行多架构（`linux/amd64`, `linux/arm64`）交叉编译。
- 🏷️ **特殊标签处理**：智能识别 `kwdb-ubuntu` 镜像，并强制锁定 `20.04` 标签，避免因全局 `--tag` 导致的错误。

---

## 快速开始

在项目根目录下执行：

```bash
# 赋予执行权限 (如果尚未赋予)
chmod +x docker/build_all.sh

# 查看帮助信息
./docker/build_all.sh --help
```

## 支持纳管的镜像

| 镜像名称 | 对应 Dockerfile 所在目录 | 默认标签 (Tag) | 说明 |
| :--- | :--- | :--- | :--- |
| `kwdb-monitor` | `docker/db-monitor` | `3.1.0` | 包含 Prometheus 和 Grafana 及相关大屏面板配置 |
| `kwdb-java` | `docker/java-kwdb` | `3.1.0` | 基于 KWDB 并预装 Java 环境与 JDBC 驱动 |
| `kwdb-python` | `docker/python-kwdb` | `3.1.0` | 基于 KWDB 并预装 Python 3 与 psycopg2 驱动 |
| `kwdb-ubuntu` | `docker/ubuntu-20.04` | `20.04` (固定) | 用于 Systemd 环境测试的底层镜像，使用阿里云国内源 |

> **提示**：除了 `kwdb-ubuntu` 标签为强制固定的 `20.04`，其余镜像的默认标签受 `-t` 参数控制。

---

## 常用场景与示例

### 1. 构建并推送所有镜像
这是最常用的发布命令。执行前请确保你已经使用 `docker login` 登录了相应的 Registry。
```bash
./docker/build_all.sh --all
```

### 2. 仅处理特定的镜像
只构建并推送 Java 和 Python 两个镜像：
```bash
./docker/build_all.sh kwdb-java kwdb-python
```

### 3. 指定标签 (Tag) 进行构建
为新版本打 Tag 发布时使用（注意：`kwdb-ubuntu` 仍会保持 `20.04`）：
```bash
./docker/build_all.sh -t 3.2.0 --all
```

### 4. 检查远端镜像是否已存在
当你需要确认某些架构或版本的镜像是否已经发布成功时：
```bash
# 检查所有镜像 (版本 3.1.0)
./docker/build_all.sh -c --all

# 检查特定版本的 Python 镜像
./docker/build_all.sh -c -t 3.2.0 kwdb-python
```
*说明：此模式不会执行任何真实的构建或推送动作。*

### 5. 仅本地构建 (不推送)
用于本地开发、调试 Dockerfile：
```bash
./docker/build_all.sh --build-only kwdb-monitor
```
*说明：使用 Docker Buildx 的 `--load` 机制加载到本地。注意：由于 Docker 限制，多架构的镜像通常无法直接 load 到本地 daemon 中，如需使用请查阅 buildx 的相关单架构配置。*

### 6. 仅推送本地已构建镜像
当你已经在本地准备好了镜像（例如通过 CI 或者手动 `docker build` 产生），只需要为其打上各 Registry 的标签并推送到远端：
```bash
./docker/build_all.sh --push-only kwdb-java
```

---

## 全局配置修改

如果需要更改默认的命名空间（如使用你自己的 Docker Hub 账号测试）、架构列表或推送的 Registries，可以直接编辑 `docker/build_all.sh` 顶部的全局配置区：

```bash
# 全局配置
NAMESPACE="kwdb"                                      # 默认命名空间
IMAGE_TAG="3.1.0"                                     # 默认镜像标签
ARCHITECTURES=("amd64" "arm64")                       # 默认多架构目标
REGISTRIES=("docker.io" "ghcr.io" "registry.cn-hangzhou.aliyuncs.com") # 默认 Registry
BUILDER_NAME="multiarch-builder"                      # Buildx 实例名
```

*如果你只想临时修改命名空间进行测试，推荐使用命令行参数：*
```bash
./docker/build_all.sh --all -n my-test-account
```
