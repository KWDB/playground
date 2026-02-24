<div align="center">

# KWDB Playground

**一款面向学习与演示的轻量级交互式课程平台**

[![Release](https://img.shields.io/github/v/release/KWDB/playground?style=flat-square)](https://github.com/KWDB/playground/releases)
[![License](https://img.shields.io/github/license/KWDB/playground?style=flat-square)](LICENSE)
[![Go Version](https://img.shields.io/github/go-mod/go-version/KWDB/playground?style=flat-square)](go.mod)

[快速开始](#快速开始) • [功能特性](#功能特性) • [界面预览](#界面预览与说明) • [相关文档](#相关文档)

</div>

---

KWDB Playground 帮助你在几分钟内完成从零到一的体验。它支持在同一页面中浏览课程、启动隔离的容器环境、执行命令或运行 SQL，无需复杂的本地环境配置，开箱即用。

## 功能特性

- **🚀 开箱即用**: 提供开箱即用的 Web 终端环境，用户只需打开浏览器即可学习。
- **🛡️ 环境隔离**: 基于 Docker 容器化技术，为每个用户分配独立的学习环境，随开随用，用完即焚。
- **💻 丰富交互**: 支持 Shell 和 SQL 两种终端模式，满足不同类型的课程需求。
- **⏸️ 进度管理**: 支持学习进度保存与环境状态的暂停/恢复（v0.5.0 新增）。
- **🌍 智能镜像加速**: 支持多 Docker 镜像源智能选择与连通性测试（v0.4.1 新增）。

---

## 快速开始

### 推荐：使用预编译版本

#### 一键安装脚本 (macOS / Linux / Windows)

最简单的安装方式，在终端中执行以下命令：

```bash
curl -fsSL https://kwdb.tech/playground.sh | bash
```

安装完成后，直接运行即可启动服务：

```bash
kwdb-playground server
```

#### Homebrew 安装 (macOS)

如果您使用 Homebrew，可以通过以下命令快速安装：

```bash
brew tap kwdb/tap
brew install kwdb-playground
kwdb-playground server
```

#### 手动下载

1. 在 [Release 页面](https://github.com/kwdb/playground/releases) 下载最新版本的 `kwdb-playground` 二进制文件。
2. 启动服务：
   ```bash
   kwdb-playground server
   ```
3. 打开浏览器访问 `http://localhost:3006`，进入课程列表并开始交互体验。

### Docker 一键部署

无需安装 Go 或 Node.js 环境，直接使用 Docker 部署（确保本机已安装 Docker）：

```bash
git clone https://github.com/kwdb/playground.git
cd playground
docker compose -f docker/playground/docker-compose.yml up -d
```

> **注意 (Windows 用户)**：默认配置挂载了 `/var/run/docker.sock`，仅适用于 Linux/macOS。Windows 下请通过 WSL2 运行，或参阅 [`docs/docker-deployment.md`](./docs/docker-deployment.md) 中的说明。

### 开发者模式

如果你想参与开发或本地调试：

```bash
# 1. 克隆代码仓库
git clone https://github.com/kwdb/playground.git
cd playground

# 2. 安装前端和后端依赖
make install

# 3. 启动前后端开发服务
make dev
```
启动后，访问 `http://localhost:3006` 进行体验。

---

## 界面预览与说明

### 🏠 首页 & 课程列表

- 平台入口，展示项目简介与主要功能入口。
- 浏览所有可用课程，点击课程卡片进入学习详情页。

**首页**
![首页](./docs/images/home.png)

**课程列表**
![课程列表](./docs/images/courses.png)

### 💻 课程详情与交互终端

课程详情页根据课程类型提供不同的交互区域：

- **Shell 终端型**：在浏览器内进行命令行交互，适合练习包管理、系统配置等。
- **SQL 终端型**：在浏览器内执行 SQL 语句并查看查询结果，适合数据库实操。

**Shell 终端**
![Shell 终端类型](./docs/images/ShellTerminal.gif)

**SQL 终端**
![SQL 终端类型](./docs/images/SqlTerminal.gif)

### ⚙️ 核心增强功能

#### 镜像源智能选择与测速
自动检测并支持 Docker Hub、ghcr.io、阿里云等镜像源，启动前验证连通性并自动保存您的偏好配置。

![Docker 镜像源选择器](./docs/images/ImageSelector.png)

#### 容器状态与进度管理
耗时较长的实战课程？没关系！您可以随时点击“暂停容器”保存当前环境进度，下次重新进入课程时，环境状态会被完整恢复。

---

## 相关文档

详细的使用说明、配置参数与开发指南，请参阅以下文档：

- 📖 **使用与开发指南**：[`docs/usage-guide.md`](./docs/usage-guide.md)（包含系统要求、依赖安装、开发规范）
- 🐳 **Docker 部署指南**：[`docs/docker-deployment.md`](./docs/docker-deployment.md)（镜像构建、挂载配置、故障排查）

## 📄 许可证

本项目采用 [Apache License 2.0](LICENSE) 开源许可证。
