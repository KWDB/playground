#!/bin/bash
set -e

NAMESPACE="kwdb"
REPO_NAME="kwdb-java"
IMAGE_TAG="3.1.0"
ARCHITECTURES=("amd64" "arm64")
REGISTRIES=("docker.io" "ghcr.io" "registry.cn-hangzhou.aliyuncs.com")
DOCKERFILE_PATH="."

if [ -z "$NAMESPACE" ]; then
    echo "错误：请在脚本中设置 NAMESPACE 变量。" >&2
    exit 1
fi

if ! docker info > /dev/null 2>&1; then
    echo "错误：Docker 守护进程未运行，请先启动 Docker。" >&2
    exit 1
fi

if ! docker buildx version > /dev/null 2>&1; then
    echo "错误：未找到 docker buildx。请确保您的 Docker 版本支持 buildx 并已正确安装。" >&2
    exit 1
fi

if [ ${#REGISTRIES[@]} -eq 0 ]; then
    REGISTRIES=("docker.io")
fi

if [[ " ${REGISTRIES[*]} " =~ " docker.io " ]]; then
    if ! docker info | grep -q "Username: ${NAMESPACE}"; then
        echo "提示：您似乎尚未登录到 Docker Hub 的 '${NAMESPACE}' 账户。"
        echo "请输入您的凭据以继续："
        docker login -u "$NAMESPACE"
    fi
fi

if [ ${#REGISTRIES[@]} -gt 1 ] || [[ ! " ${REGISTRIES[*]} " =~ " docker.io " ]]; then
    echo "请确保您已登录到所有目标仓库："
    for REGISTRY in "${REGISTRIES[@]}"; do
        echo " - $REGISTRY"
    done
    echo ""
fi

BUILDER_NAME="multiarch-builder"
if ! docker buildx ls | grep -q "$BUILDER_NAME"; then
    echo "正在创建新的 buildx 构建器 '$BUILDER_NAME'..."
    docker buildx create --name "$BUILDER_NAME" --use
else
    echo "使用已存在的 buildx 构建器 '$BUILDER_NAME'..."
    docker buildx use "$BUILDER_NAME"
fi
docker buildx inspect --bootstrap

PLATFORMS=$(printf "linux/%s," "${ARCHITECTURES[@]}" | sed 's/,$//')

TAG_ARGS=()
echo ""
echo "=================================================="
echo "开始构建并推送多架构镜像"
echo "目标平台: ${PLATFORMS}"
echo "目标镜像:"

for REGISTRY in "${REGISTRIES[@]}"; do
    if [ "$REGISTRY" == "docker.io" ]; then
        FULL_IMAGE_NAME="${NAMESPACE}/${REPO_NAME}:${IMAGE_TAG}"
    else
        FULL_IMAGE_NAME="${REGISTRY}/${NAMESPACE}/${REPO_NAME}:${IMAGE_TAG}"
    fi
    TAG_ARGS+=("-t" "${FULL_IMAGE_NAME}")
    echo " - ${FULL_IMAGE_NAME}"
done
echo "=================================================="

docker buildx build \
    --platform "${PLATFORMS}" \
    "${TAG_ARGS[@]}" \
    --push \
    "${DOCKERFILE_PATH}"

echo ""
echo "✅ 多架构镜像推送成功！"
echo "您可以通过以下命令在不同架构的机器上拉取和使用它："
for REGISTRY in "${REGISTRIES[@]}"; do
    if [ "$REGISTRY" == "docker.io" ]; then
        FULL_IMAGE_NAME="${NAMESPACE}/${REPO_NAME}:${IMAGE_TAG}"
    else
        FULL_IMAGE_NAME="${REGISTRY}/${NAMESPACE}/${REPO_NAME}:${IMAGE_TAG}"
    fi
    echo "   docker pull ${FULL_IMAGE_NAME}"
done
