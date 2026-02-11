# 在 Docker 容器中体验完整的 systemctl 功能

## 问题背景

标准的 Ubuntu Docker 镜像为了保持轻量和安全，默认使用 `bash` 或 `sh` 作为其入口点（PID 1），而不是完整的 `systemd` init 系统。然而，`systemctl` 命令是 `systemd` 的主控制工具，它需要与 `systemd` 进程（通常作为 PID 1 运行）通过 D-Bus 通信。因此，在标准的 Ubuntu 容器中直接运行 `systemctl` 会失败，并提示类似 "System has not been booted with systemd as init system (PID 1). Can't operate." 的错误。

此外，`systemd` 深度依赖 Linux 的 cgroup 机制来管理服务资源。在 Docker 中运行 `systemd` 的一种常见方法是挂载主机的 `/sys/fs/cgroup` 目录，但这会打破容器的隔离性，并可能引起版本不匹配的问题。

本文将提供切实可行的方案，在不挂载主机 cgroup 文件系统的前提下，让你在 Ubuntu Docker 容器中体验完整的 `systemctl` 功能。

## 方案：构建自定义的 systemd-enabled Docker 镜像

此方案通过编写一个 Dockerfile 来创建一个内置 `systemd` 并将其作为启动进程的 Ubuntu 镜像。这种方法提供了最大的灵活性和控制力。

### 1. 编写 Dockerfile

创建一个名为 `Dockerfile` 的文件，内容如下：

```dockerfile
# 使用一个稳定的 Ubuntu 版本作为基础镜像
FROM ubuntu:22.04

# 设置环境变量，避免 apt-get 在构建过程中进行交互式提问
ENV DEBIAN_FRONTEND=noninteractive

# 1. 更新包列表并安装 systemd 和一个测试服务（如 ssh）
# 2. 清理 apt 缓存以减小镜像体积
# 3. 启用 ssh 服务，以便后续在容器内测试 systemctl
RUN apt-get update && \
    apt-get install -y systemd systemd-sysv ssh && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/* && \
    systemctl enable ssh

# systemd 需要一个特定的停止信号来优雅地关闭。
# SIGRTMIN+3 是 systemd 期望的关机信号。
STOPSIGNAL SIGRTMIN+3

# 设置容器的默认启动命令。
# /sbin/init 是 systemd init 程序的可执行文件。
# 当容器启动时，它将作为 PID 1 运行，从而使 systemctl 可以正常工作。
CMD ["/sbin/init"]
```

**Dockerfile 关键点解释:**
- `FROM ubuntu:22.04`: 我们选择一个长期支持（LTS）版本的 Ubuntu。
- `ENV DEBIAN_FRONTEND=noninteractive`: 这是在 Docker 构建中运行 `apt-get` 的最佳实践，可以防止构建过程因等待用户输入而挂起。
- `RUN apt-get install -y systemd systemd-sysv ssh`: `systemd-sysv` 包确保 `systemd` 被正确设置为 init 系统。我们还安装了 `ssh` 服务作为一个例子，来演示如何用 `systemctl` 管理它。
- `STOPSIGNAL SIGRTMIN+3`: 当你执行 `docker stop` 时，Docker 会发送这个信号给容器的 PID 1 进程。将其设置为 `systemd` 期望的信号可以确保容器能够优雅地关闭，而不是被强制杀死。
- `CMD ["/sbin/init"]`: 这是最关键的一步。它覆盖了基础镜像的默认 `CMD`，告诉 Docker 启动容器时运行 `/sbin/init`。这使得 `systemd` 成为容器的 init 进程（PID 1）。

### 2. 构建镜像

在包含 `Dockerfile` 的目录中，运行以下命令来构建镜像：

```bash
docker build -t ubuntu-with-systemd .
```

### 3. 运行容器

为了让 `systemd` 在容器内获得足够的权限来管理其子进程和 cgroup，你需要使用 `--privileged` 标志来运行容器。

```bash
docker run -d --name systemd-ubuntu-test --privileged ubuntu-with-systemd
```

**`--privileged` 标志说明:**
`systemd` 需要执行一些特权操作，例如挂载文件系统、管理设备和网络接口等。在标准的 Docker 环境中，这些权限是被限制的。`--privileged` 标志会移除这些限制，给予容器几乎与主机同等的内核访问权限。

**安全提示**: 在生产环境中，`--privileged` 存在安全风险。但对于本地开发和测试 `systemctl` 功能而言，这是最直接和可靠的方法。

### 4. 测试 `systemctl`

现在，你可以进入正在运行的容器并使用 `systemctl` 了。

```bash
# 进入容器
docker exec -it systemd-ubuntu-test /bin/bash

# 在容器内，检查 systemd 状态
root@<container_id>:/# systemctl status

# 检查我们安装的 ssh 服务状态
root@<container_id>:/# systemctl status ssh

# 停止并重启 ssh 服务
root@<container_id>:/# systemctl stop ssh
root@<container_id>:/# systemctl start ssh
root@<container_id>:/# systemctl status ssh
```

## 总结

在 Docker 容器中运行 `systemd` 的核心是让 `systemd` 作为 PID 1 启动，并给予它足够的权限。在不挂载主机 cgroup 的前提下，使用 `--privileged` 模式是实现这一目标最简单直接的方法。

对于大多数需要在容器中测试 `systemctl` 的开发场景，以上两种方案都是切实可行的。你可以根据自己对控制力和便捷性的需求来选择最适合你的方法。