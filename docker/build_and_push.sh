#!/bin/bash
# 脚本将在任何命令失败时立即退出
set -e

# --- 配置信息 --- #
# Docker Hub 用户名
DOCKERHUB_USER="kwdb"
# 镜像仓库名
REPO_NAME="ubuntu"
# 镜像标签
IMAGE_TAG="20.04"
# 目标架构列表 (amd64, arm64 是 Docker buildx 的标准命名)
ARCHITECTURES=("amd64" "arm64")
# Dockerfile 所在路径
DOCKERFILE_PATH="."
# --- 配置结束 --- #

# 检查 DOCKERHUB_USER 是否已设置
if [ -z "$DOCKERHUB_USER" ]; then
    echo "错误：请在脚本中设置 DOCKERHUB_USER 变量。" >&2
    exit 1
fi

# 检查 Docker 是否正在运行
if ! docker info > /dev/null 2>&1; then
    echo "错误：Docker 守护进程未运行，请先启动 Docker。" >&2
    exit 1
fi

# 检查 buildx 是否可用
if ! docker buildx version > /dev/null 2>&1; then
    echo "错误：未找到 docker buildx。请确保您的 Docker 版本支持 buildx 并已正确安装。" >&2
    exit 1
fi

# 检查是否已登录到 Docker Hub
# 注意：此检查依赖于 `docker info` 的输出格式，可能不完全可靠
if ! docker info | grep -q "Username: ${DOCKERHUB_USER}"; then
    echo "提示：您似乎尚未登录到 Docker Hub 的 '${DOCKERHUB_USER}' 账户。"
    echo "请输入您的凭据以继续："
    docker login -u "$DOCKERHUB_USER"
fi

# 创建或复用一个 buildx 构建器实例
BUILDER_NAME="multiarch-builder"
if ! docker buildx ls | grep -q "$BUILDER_NAME"; then
    echo "正在创建新的 buildx 构建器 '$BUILDER_NAME'..."
    docker buildx create --name "$BUILDER_NAME" --use
else
    echo "使用已存在的 buildx 构建器 '$BUILDER_NAME'..."
    docker buildx use "$BUILDER_NAME"
fi
docker buildx inspect --bootstrap

# 将架构数组转换为逗号分隔的平台字符串，例如：linux/amd64,linux/arm64
PLATFORMS=$(printf "linux/%s," "${ARCHITECTURES[@]}" | sed 's/,$//')

FULL_IMAGE_NAME="${DOCKERHUB_USER}/${REPO_NAME}:${IMAGE_TAG}"

# 构建并推送多架构镜像
echo ""
echo "=================================================="
echo "开始构建并推送多架构镜像：${FULL_IMAGE_NAME}"
echo "目标平台: ${PLATFORMS}"
echo "=================================================="

docker buildx build \
    --platform "${PLATFORMS}" \
    -t "${FULL_IMAGE_NAME}" \
    --push \
    "${DOCKERFILE_PATH}"

# 脚本执行成功后，可以选择性地清理构建器
# echo "正在清理构建器 '$BUILDER_NAME'..."
# docker buildx rm $BUILDER_NAME

echo ""
echo "✅ 多架构镜像推送成功！"
echo "您可以通过以下命令在不同架构的机器上拉取和使用它："
echo "   docker pull ${FULL_IMAGE_NAME}"
    