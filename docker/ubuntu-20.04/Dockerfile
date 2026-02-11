FROM ubuntu:20.04

# 设置环境变量，避免apt-get在构建过程中进行交互式提问
ENV DEBIAN_FRONTEND=noninteractive

# 根据构建架构动态配置阿里云镜像源
# amd64 使用 'ubuntu', arm64 等其他架构使用 'ubuntu-ports'
RUN set -e && \
    ARCH_SUFFIX="" && \
    if [ "$(dpkg --print-architecture)" != "amd64" ]; then \
        ARCH_SUFFIX="-ports"; \
    fi && \
    cat <<EOF > /etc/apt/sources.list
deb http://mirrors.aliyun.com/ubuntu${ARCH_SUFFIX}/ focal main restricted universe multiverse
deb http://mirrors.aliyun.com/ubuntu${ARCH_SUFFIX}/ focal-security main restricted universe multiverse
deb http://mirrors.aliyun.com/ubuntu${ARCH_SUFFIX}/ focal-updates main restricted universe multiverse
deb http://mirrors.aliyun.com/ubuntu${ARCH_SUFFIX}/ focal-proposed main restricted universe multiverse
deb http://mirrors.aliyun.com/ubuntu${ARCH_SUFFIX}/ focal-backports main restricted universe multiverse
deb-src http://mirrors.aliyun.com/ubuntu${ARCH_SUFFIX}/ focal main restricted universe multiverse
deb-src http://mirrors.aliyun.com/ubuntu${ARCH_SUFFIX}/ focal-security main restricted universe multiverse
deb-src http://mirrors.aliyun.com/ubuntu${ARCH_SUFFIX}/ focal-updates main restricted universe multiverse
deb-src http://mirrors.aliyun.com/ubuntu${ARCH_SUFFIX}/ focal-proposed main restricted universe multiverse
deb-src http://mirrors.aliyun.com/ubuntu${ARCH_SUFFIX}/ focal-backports main restricted universe multiverse
EOF

# 更新并安装所需服务
RUN apt-get update && \
    apt-get install -y systemd systemd-sysv ssh wget vim sudo && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/* && \
    systemctl enable ssh

# systemd需要一个特定的停止信号来优雅地关闭
STOPSIGNAL SIGRTMIN+3

# 设置容器的默认启动命令
CMD ["/sbin/init"]
