FROM ubuntu:22.04

# 设置环境变量，避免apt-get在构建过程中进行交互式提问
ENV DEBIAN_FRONTEND=noninteractive
ENV LANG=C.UTF-8
ENV LC_ALL=C.UTF-8

# 根据构建架构动态配置阿里云镜像源
# amd64 使用 'ubuntu', arm64 等其他架构使用 'ubuntu-ports'
RUN set -e && \
    ARCH_SUFFIX="" && \
    if [ "$(dpkg --print-architecture)" != "amd64" ]; then \
        ARCH_SUFFIX="-ports"; \
    fi && \
    rm -f /etc/apt/sources.list.d/ubuntu.sources && \
    cat <<EOF > /etc/apt/sources.list
deb http://mirrors.aliyun.com/ubuntu${ARCH_SUFFIX}/ jammy main restricted universe multiverse
deb http://mirrors.aliyun.com/ubuntu${ARCH_SUFFIX}/ jammy-security main restricted universe multiverse
deb http://mirrors.aliyun.com/ubuntu${ARCH_SUFFIX}/ jammy-updates main restricted universe multiverse
deb http://mirrors.aliyun.com/ubuntu${ARCH_SUFFIX}/ jammy-backports main restricted universe multiverse
EOF

# 安装 systemd、SSH 与课程常用工具，并保留 root SSH 登录能力
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        systemd \
        systemd-sysv \
        openssh-server \
        ca-certificates \
        wget \
        vim \
        unzip \
        sudo && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/* && \
    echo 'root:root' | chpasswd && \
    mkdir -p /run/sshd && \
    sed -i 's/^#\?PermitRootLogin .*/PermitRootLogin yes/' /etc/ssh/sshd_config && \
    systemctl enable ssh

# systemd需要一个特定的停止信号来优雅地关闭
STOPSIGNAL SIGRTMIN+3

# 设置容器的默认启动命令
CMD ["/sbin/init"]
