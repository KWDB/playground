# 版本更新机制说明

本项目支持在页面内进行版本检查与在线升级，包含二进制部署与 Docker 部署两类场景。本文档说明核心逻辑、API 接口与关键限制。

## 1. 总体流程

1) 前端启动后会调用更新检查接口，获取最新版本与是否可升级
2) 若发现新版本：
   - 开发模式：显示“有更新”提示，但不允许在线升级
   - 生产二进制：允许在线升级
   - Docker 部署：允许在线升级（通过重建容器）

## 2. 版本检查接口

`GET /api/upgrade/check`

返回字段：
- `currentVersion`：当前运行版本（`dev` 表示开发模式）
- `latestVersion`：GitHub Release 最新版本号
- `hasUpdate`：是否存在新版本
- `canUpgrade`：是否允许在线升级
- `message`：提示语（包含限制原因或新版本提示）
- `dockerDeploy`：是否为 Docker 部署模式

示例响应：
```json
{
  "currentVersion": "dev",
  "latestVersion": "0.4.2",
  "hasUpdate": true,
  "canUpgrade": false,
  "message": "发现新版本 v0.4.2（开发模式仅提示）",
  "dockerDeploy": false
}
```

## 3. 在线升级接口

`POST /api/upgrade`

触发升级流程，返回 `202 Accepted` 后会异步完成升级与重启。

### 3.1 二进制部署（非 Docker）

适用条件：
- 非 Windows
- 版本号不是 `dev`

流程：
1) 获取 GitHub Releases 最新版本
2) 匹配当前系统与架构，下载对应二进制
3) 备份现有可执行文件
4) 替换为新版本并重新启动
5) 旧进程退出

限制：
- Windows 不支持在线升级
- `dev` 版本仅提示，不执行升级

### 3.2 Docker 部署

适用条件：
- `DOCKER_DEPLOY=true`
- 已挂载 `/var/run/docker.sock`

流程：
1) 读取当前 Playground 容器配置
2) 拉取最新镜像
3) 停止并删除旧容器
4) 用相同配置（端口、环境变量、网络、卷等）启动新容器

说明：
- 通过独立的升级任务容器执行重建
- 升级期间短暂不可用，等待新容器健康检查通过

## 4. 前端展示逻辑

导航栏版本组件与环境面板会显示更新状态：
- `hasUpdate=true` 时显示“有更新”提示
- 开发模式只提示，不允许点击“立即升级”

## 5. 常见问题

1) 为什么开发模式不能升级？
   - 开发模式通常使用本地源码与未发布版本，直接替换二进制会导致环境不一致。

2) 如果使用 Homebrew 安装，是否可以升级？
   - 可以。在线升级会检测 Homebrew 安装，并自动触发 `brew upgrade kwdb-playground`。
   - 若系统未找到 brew 命令，将提示无法升级。
   - 也可以手动执行：`brew update && brew upgrade kwdb-playground`

3) Docker 升级失败怎么办？
   - 检查 `/var/run/docker.sock` 权限
   - 确认镜像可拉取
   - 查看 Playground 容器日志排查
