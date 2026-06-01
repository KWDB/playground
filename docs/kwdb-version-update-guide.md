# KWDB 版本更新适配指南

## 升级前确认

每次升级前先确认以下信息：

1. 新版本号，例如 `3.2.0`
2. 旧版本号，例如 `3.1.0`
3. 新版本官方安装包命名规则
4. 新版本支持的 Ubuntu 基础环境
5. 运行依赖包在目标 Ubuntu 版本中的包名是否变化
6. `kwdb/kwdb:<version>` 基础镜像是否已经发布
7. 安装向导菜单、配置项、卸载流程是否有行为变化

## Docker 镜像适配

### 1. 更新 KWDB 派生镜像基础版本

需要同步修改这些 Dockerfile 的 `FROM`：

- `docker/db-monitor/Dockerfile`
- `docker/java-kwdb/Dockerfile`
- `docker/python-kwdb/Dockerfile`

示例：

```dockerfile
FROM kwdb/kwdb:3.2.0
```

如果新版本升级到 `3.3.0`，则改为：

```dockerfile
FROM kwdb/kwdb:3.3.0
```

### 2. 更新 Ubuntu systemd 基础镜像

当前版本引入了：

- `docker/ubuntu-24.04`：用于新版本安装课程
- `docker/ubuntu-22.04`：用于旧版本到新版本升级课程

后续升级时，如果 KWDB 安装包支持的 Ubuntu 版本变化，需要同步：

- 新增或调整 `docker/ubuntu-xx.xx/Dockerfile`
- 使用对应 Ubuntu codename，例如 `22.04=jammy`、`24.04=noble`
- 保留 systemd、SSH、root 登录、`/sbin/init` 等课程所需能力
- 避免启用 `*-proposed` 和 `deb-src` 源
- 使用 `--no-install-recommends` 并清理 `/var/lib/apt/lists/*`

### 3. 更新统一构建脚本

修改 `docker/build_all.sh`：

- 更新默认 `IMAGE_TAG`
- 在 `IMAGES_KEYS` 中加入需要构建的 Ubuntu 版本目标
- 在 `get_image_dir` 中维护目标名到目录的映射
- 在 `get_image_repo` 中确保 Ubuntu 版本目标最终发布到 `kwdb/ubuntu`
- 在 `get_image_tag` 中固定 Ubuntu 标签，例如 `22.04`、`24.04`
- 同步 `--help` 文案

当前约定：

```bash
./docker/build_all.sh --build-only ubuntu-24.04
./docker/build_all.sh --build-only ubuntu-22.04
./docker/build_all.sh --build-only --all -t 3.2.0
```

Ubuntu 系列最终镜像名应为：

```text
kwdb/ubuntu:24.04
kwdb/ubuntu:22.04
```

而不是：

```text
kwdb/ubuntu-24.04:24.04
kwdb/ubuntu-22.04:22.04
```

### 4. 更新 Docker 文档

同步修改 `docker/README.md`：

- 支持镜像列表
- 默认版本号
- Ubuntu 固定标签说明
- 构建、检查、推送示例
- 登录环境变量说明

## 课程配置适配

### 1. 安装课程

入口文件：`courses/install/index.yaml`

需要更新：

- `title` 和 `description`
- `backend.imageid`
- `backend.env.KW_VERSION`
- 步骤标题和步骤数量

当前 3.2.0 示例：

```yaml
backend:
  imageid: kwdb/ubuntu:24.04
  cmd: ["/sbin/init"]
  privileged: true
  env:
    - "KW_VERSION=3.2.0"
```

步骤文档需要重点检查：

- `courses/install/step1.md`：依赖包、下载地址、解压方式
- `courses/install/step2.md`：安装向导菜单与配置流程
- `courses/install/step3.md`：连接方式和验证 SQL
- `courses/install/step4.md`：卸载流程
- `courses/install/finish.md`：结课说明

依赖包要按目标 Ubuntu 版本确认，不能沿用旧版本包名。例如 Ubuntu 24.04 中旧的 `libprotobuf17` 不存在，不能继续写入安装命令。

### 2. 升级课程

当前升级课程目录已从 `courses/upgrade-3.0-to-3.1` 调整为：

```text
courses/upgrade
```

入口文件：`courses/upgrade/index.yaml`

需要更新：

- 标题中的旧版本和新版本
- `backend.imageid`
- `OLD_KW_VERSION`
- `NEW_KW_VERSION`
- 步骤标题

当前 3.1.0 到 3.2.0 示例：

```yaml
backend:
  imageid: kwdb/ubuntu:22.04
  cmd: ["/sbin/init"]
  privileged: true
  env:
    - "OLD_KW_VERSION=3.1.0"
    - "NEW_KW_VERSION=3.2.0"
```

步骤文档需要重点检查：

- `step1.md`：旧版本安装包下载地址、解压方式、旧版本依赖包
- `step2.md`：升级前 SQL 验证数据、数据目录备份、停服流程
- `step3.md`：新版本安装包下载、升级向导菜单、配置提示
- `step4.md`：版本验证、数据验证、备份文件确认
- `finish.md`：升级清单和后续建议

升级课程应保持闭环：旧版本安装、升级前备份、执行升级、升级后验证。

### 3. 派生课程镜像

同步更新这些课程入口的 `imageid`：

- `courses/db-monitor/index.yaml`
- `courses/java-kwdb/index.yaml`
- `courses/python-kwdb/index.yaml`

当前示例：

```yaml
imageid: kwdb/kwdb-monitor:3.2.0
imageid: kwdb/kwdb-java:3.2.0
imageid: kwdb/kwdb-python:3.2.0
```

## 依赖包与安装包规则

版本升级时，最容易出错的是系统包名和安装包格式。

需要逐项确认：

- Ubuntu 22.04 与 24.04 的 protobuf 包名不同
- 旧版本安装包可能包含 Ubuntu 版本后缀，例如 `ubuntu22.04`
- 新版本安装包可能改为通用文件名，例如 `KWDB-${KW_VERSION}-$(arch)`
- 解压命令可能在 `tar -xzvf` 和 `unzip` 之间变化
- 课程中所有 `{{exec}}` 命令必须能在对应镜像内直接执行

建议在目标镜像中验证：

```bash
apt update
apt-cache policy <package-name>
apt install -y <dependency-list>
```

## 测试适配

当前提交同步更新了 `internal/course/service_test.go` 中的 Ubuntu 镜像版本。

后续升级时至少运行：

```bash
bash -n docker/build_all.sh
GOCACHE=/private/tmp/kwdb-go-cache go test ./internal/course
```

如果修改了 API、课程加载或镜像运行逻辑，再扩大到：

```bash
go test ./...
```

如果修改了课程交互步骤，需要手动跑对应课程或 E2E。

## 发布验证清单

1. 构建基础 Ubuntu 镜像

```bash
./docker/build_all.sh --build-only ubuntu-24.04
./docker/build_all.sh --build-only ubuntu-22.04
```

2. 构建 KWDB 派生镜像

```bash
./docker/build_all.sh --build-only kwdb-monitor kwdb-java kwdb-python -t 3.2.0
```

3. 检查远端镜像是否齐全

```bash
./docker/build_all.sh -c --all -t 3.2.0
```

4. 验证安装课程

- 能下载新版本安装包
- 依赖安装不报错
- 安装向导菜单与文档一致
- `kw-status`、`systemctl status kaiwudb` 正常
- `kw-sql` 能连接并执行示例 SQL
- 卸载流程能清理服务

5. 验证升级课程

- 能安装旧版本实例
- 能写入升级验证数据
- 能备份 `/var/lib/kaiwudb`
- 能执行新版本升级向导
- 升级后 `SELECT version()` 显示新版本
- 升级前写入的数据仍可查询

## 常见遗漏

- 只改 Dockerfile，忘记课程 `imageid`
- 只改课程版本号，忘记 `docker/build_all.sh` 默认 tag
- 只验证 amd64，忘记 arm64 构建
- 沿用旧 Ubuntu 依赖包名，导致 `apt install` 找不到包
- 旧版本和新版本安装包格式不同，但课程仍使用旧解压命令
- 更新了升级课程目录名，但没有确认课程加载器是否还能发现该课程
- `docker/README.md` 与脚本默认值不一致

## 本次 3.2.0 升级的关键结论

- KWDB 派生镜像统一升级为 `kwdb/kwdb:3.2.0`
- 默认构建版本更新为 `3.2.0`
- 安装课程使用 `kwdb/ubuntu:24.04`
- 升级课程使用 `kwdb/ubuntu:22.04`
- 旧的 `docker/ubuntu-20.04` 被移除
- 新增 `docker/ubuntu-22.04` 和 `docker/ubuntu-24.04`
- 升级课程从 `3.1.0` 升级到 `3.2.0`
- 远端 registry 登录改为使用本地环境变量 token
