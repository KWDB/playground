#!/bin/bash
# 统一的 Docker 镜像构建与推送脚本

set -e

# 全局配置
NAMESPACE="kwdb"
IMAGE_TAG="3.1.0"
ARCHITECTURES=("amd64" "arm64")
REGISTRIES=("docker.io" "ghcr.io" "registry.cn-hangzhou.aliyuncs.com")
BUILDER_NAME="multiarch-builder"

# 支持构建的镜像列表及其对应的目录
# 由于 macOS 自带的 Bash 版本较低 (3.2)，不支持关联数组 (declare -A)，
# 故改用平铺数组配合获取目录的辅助函数
IMAGES_KEYS=("kwdb-monitor" "kwdb-java" "kwdb-python" "ubuntu")

get_image_dir() {
    local repo=$1
    case "$repo" in
        "kwdb-monitor") echo "db-monitor" ;;
        "kwdb-java") echo "java-kwdb" ;;
        "kwdb-python") echo "python-kwdb" ;;
        "ubuntu") echo "ubuntu-20.04" ;;
        *) echo "" ;;
    esac
}

# 打印帮助信息
show_help() {
    cat << 'EOF'
build_all.sh - KWDB Playground Docker 镜像全量构建与管理工具

用法 (USAGE):
  ./build_all.sh [options] <image_name...>

描述 (DESCRIPTION):
  集中纳管 docker 目录下所有组件镜像的构建、检查与推送工作。
  支持基于 Docker Buildx 的多架构 (amd64, arm64) 交叉编译，并可一键发布到多个远端 Registry。

选项 (OPTIONS):
  -h, --help               打印此帮助信息
  -a, --all                对所有支持的镜像执行操作 (构建并推送)
  -c, --check              仅检查目标镜像在远端仓库中是否存在，不执行任何构建或推送
      --build-only         仅执行构建，并尝试将产物加载到本地 Docker daemon，不推送到远端
      --push-only          仅推送本地已存在的镜像到远端仓库，跳过构建过程
  -t, --tag <string>       指定构建/推送时使用的镜像标签 (默认: 3.1.0)
  -n, --namespace <string> 指定 Docker 命名空间 (默认: kwdb)

支持的镜像 (SUPPORTED IMAGES):
  - kwdb-monitor    (对应目录: docker/db-monitor)
  - kwdb-java       (对应目录: docker/java-kwdb)
  - kwdb-python     (对应目录: docker/python-kwdb)
  - kwdb-ubuntu     (对应目录: docker/ubuntu-20.04)

注意 (NOTE):
  kwdb-ubuntu 镜像的标签强制固定为 20.04，不受 -t/--tag 参数的影响。

示例 (EXAMPLES):
  # 基础用法：构建并推送特定镜像
  $ ./build_all.sh kwdb-java kwdb-python

  # 全量操作：构建并推送所有镜像
  $ ./build_all.sh --all

  # 高阶用法：指定自定义标签并仅在本地构建所有镜像
  $ ./build_all.sh --build-only --all -t 3.2.0

  # 检查远端：检查版本为 3.1.0 的所有镜像是否已发布
  $ ./build_all.sh -c --all
EOF
}

# 预检：检查 Docker 和 Buildx
check_env() {
    if ! docker info > /dev/null 2>&1; then
        echo "错误：Docker 守护进程未运行，请先启动 Docker。" >&2
        exit 1
    fi

    if ! docker buildx version > /dev/null 2>&1; then
        echo "错误：未找到 docker buildx。请确保您的 Docker 版本支持 buildx 并已正确安装。" >&2
        exit 1
    fi
}

# 准备 Buildx 构建器
setup_builder() {
    if ! docker buildx ls | grep -q "$BUILDER_NAME"; then
        echo "正在创建新的 buildx 构建器 '$BUILDER_NAME'..."
        docker buildx create --name "$BUILDER_NAME" --use
    else
        echo "使用已存在的 buildx 构建器 '$BUILDER_NAME'..."
        docker buildx use "$BUILDER_NAME"
    fi
    docker buildx inspect --bootstrap
}

# 登录检查
check_login() {
    # 如果仅检查镜像，且不推送到私有仓库，则不强制要求登录，但可能因为速率限制受影响
    if [ "$CHECK_ONLY" = true ] || [ "$BUILD_ONLY" = true ]; then
        echo "当前为检查或构建模式，跳过目标仓库登录校验..."
        return
    fi

    if [[ " ${REGISTRIES[*]} " =~ " docker.io " ]]; then
        if ! docker info | grep -q "Username: ${NAMESPACE}"; then
            echo "提示：您似乎尚未登录到 Docker Hub 的 '${NAMESPACE}' 账户。"
            echo "请输入您的凭据以继续："
            docker login -u "$NAMESPACE" || echo "警告: 登录 Docker Hub 失败，可能会导致推送失败"
        fi
    fi

    echo "请确保您已登录到以下所有目标仓库（如需要）："
    for REGISTRY in "${REGISTRIES[@]}"; do
        echo " - $REGISTRY"
    done
    echo ""
}

# 检查镜像是否存在于远端
check_remote_image() {
    local FULL_IMAGE_NAME=$1
    echo -n "检查 $FULL_IMAGE_NAME ... "
    # 使用 docker manifest inspect 来检查远端仓库镜像是否存在
    if docker manifest inspect "$FULL_IMAGE_NAME" > /dev/null 2>&1; then
        echo "✅ 存在"
        return 0
    else
        echo "❌ 不存在"
        return 1
    fi
}

# 解析参数
BUILD_ALL=false
CHECK_ONLY=false
BUILD_ONLY=false
PUSH_ONLY=false
TARGET_IMAGES=()
IMAGE_TAG="3.1.0"
NAMESPACE="kwdb"

while [[ $# -gt 0 ]]; do
    case $1 in
        -h|--help)
            show_help
            exit 0
            ;;
        -a|--all)
            BUILD_ALL=true
            shift
            ;;
        -c|--check)
            CHECK_ONLY=true
            shift
            ;;
        --build-only)
            BUILD_ONLY=true
            shift
            ;;
        --push-only)
            PUSH_ONLY=true
            shift
            ;;
        -t|--tag)
            IMAGE_TAG="$2"
            shift 2
            ;;
        -n|--namespace)
            NAMESPACE="$2"
            shift 2
            ;;
        -*)
            echo "未知选项: $1"
            show_help
            exit 1
            ;;
        *)
            TARGET_IMAGES+=("$1")
            shift
            ;;
    esac
done

if [ "$BUILD_ONLY" = true ] && [ "$PUSH_ONLY" = true ]; then
    echo "错误：--build-only 和 --push-only 不能同时使用。"
    exit 1
fi

if [ "$BUILD_ALL" = true ]; then
    TARGET_IMAGES=("${IMAGES_KEYS[@]}")
fi

if [ ${#TARGET_IMAGES[@]} -eq 0 ]; then
    echo "错误：未指定要构建的镜像。"
    show_help
    exit 1
fi

# 执行主流程
check_env
if [ "$CHECK_ONLY" != true ]; then
    check_login
    # 如果是只推送模式，不需要构建环境
    if [ "$PUSH_ONLY" != true ]; then
        setup_builder
    fi
fi

# 构建并推送单个镜像
for REPO_NAME in "${TARGET_IMAGES[@]}"; do
    DIR_NAME=$(get_image_dir "$REPO_NAME")
    DOCKERFILE_PATH="docker/${DIR_NAME}"

    if [ -z "$DIR_NAME" ]; then
        echo "错误: 未知的镜像名称 '$REPO_NAME'"
        continue
    fi

    # --- 特殊处理 kwdb-ubuntu 标签逻辑 ---
    CURRENT_TAG=$IMAGE_TAG
    if [ "$REPO_NAME" == "ubuntu" ]; then
        CURRENT_TAG="20.04"
        echo "🔔 检测到 ubuntu 镜像，强制使用特定标签: $CURRENT_TAG"
    fi
    # ----------------------------------------

    if [ "$CHECK_ONLY" = true ]; then
        echo ""
        echo "=================================================="
        echo "🔍 检查镜像: ${REPO_NAME}"
        for REGISTRY in "${REGISTRIES[@]}"; do
            if [ "$REGISTRY" == "docker.io" ]; then
                FULL_IMAGE_NAME="${NAMESPACE}/${REPO_NAME}:${CURRENT_TAG}"
            else
                FULL_IMAGE_NAME="${REGISTRY}/${NAMESPACE}/${REPO_NAME}:${CURRENT_TAG}"
            fi
            check_remote_image "$FULL_IMAGE_NAME"
        done
        echo "=================================================="
        continue
    fi

    if [ ! -f "${DOCKERFILE_PATH}/Dockerfile" ]; then
        echo "错误: 找不到 Dockerfile: ${DOCKERFILE_PATH}/Dockerfile"
        continue
    fi

    PLATFORMS=$(printf "linux/%s," "${ARCHITECTURES[@]}" | sed 's/,$//')
    
    TAG_ARGS=()
    echo ""
    echo "=================================================="
    if [ "$BUILD_ONLY" = true ]; then
        echo "🚀 开始构建: ${REPO_NAME} (仅本地，不推送)"
    elif [ "$PUSH_ONLY" = true ]; then
        echo "🚀 开始推送: ${REPO_NAME} (不构建，直接打标签并推送本地已有镜像)"
    else
        echo "🚀 开始构建并推送: ${REPO_NAME}"
    fi
    echo "工作目录: ${DOCKERFILE_PATH}"
    echo "目标平台: ${PLATFORMS}"
    echo "目标镜像:"

    for REGISTRY in "${REGISTRIES[@]}"; do
        if [ "$REGISTRY" == "docker.io" ]; then
            FULL_IMAGE_NAME="${NAMESPACE}/${REPO_NAME}:${CURRENT_TAG}"
        else
            FULL_IMAGE_NAME="${REGISTRY}/${NAMESPACE}/${REPO_NAME}:${CURRENT_TAG}"
        fi
        TAG_ARGS+=("-t" "${FULL_IMAGE_NAME}")
        echo " - ${FULL_IMAGE_NAME}"
    done
    echo "=================================================="

    if [ "$PUSH_ONLY" = true ]; then
        # 仅推送模式：假设本地已有镜像 NAMESPACE/REPO_NAME:CURRENT_TAG
        LOCAL_IMAGE="${NAMESPACE}/${REPO_NAME}:${CURRENT_TAG}"
        if ! docker image inspect "$LOCAL_IMAGE" > /dev/null 2>&1; then
            echo "错误: 本地未找到镜像 $LOCAL_IMAGE，请先执行构建。"
            continue
        fi

        for REGISTRY in "${REGISTRIES[@]}"; do
            if [ "$REGISTRY" == "docker.io" ]; then
                FULL_IMAGE_NAME="${NAMESPACE}/${REPO_NAME}:${CURRENT_TAG}"
            else
                FULL_IMAGE_NAME="${REGISTRY}/${NAMESPACE}/${REPO_NAME}:${CURRENT_TAG}"
                echo "正在打标签: $FULL_IMAGE_NAME"
                docker tag "$LOCAL_IMAGE" "$FULL_IMAGE_NAME"
            fi
            echo "正在推送: $FULL_IMAGE_NAME"
            docker push "$FULL_IMAGE_NAME"
        done
        echo "✅ ${REPO_NAME} 镜像推送成功！"
    else
        # 构建（可能含推送）模式
        BUILD_ARGS=(--platform "${PLATFORMS}" "${TAG_ARGS[@]}" "${DOCKERFILE_PATH}")
        
        if [ "$BUILD_ONLY" = true ]; then
            # 仅构建并加载到本地 Docker daemon，通常 buildx 在多架构构建下需要 load，或者只能构建单架构
            # 为了能在本地看到，这里如果架构包含多个可能需要特定配置，但基础 --load 可以尝试导出
            echo "提示: --build-only 使用 --load 参数。多架构构建可能无法同时 load 到本地 Docker daemon。"
            BUILD_ARGS+=(--load)
        else
            BUILD_ARGS+=(--push)
        fi

        docker buildx build "${BUILD_ARGS[@]}"
        
        if [ "$BUILD_ONLY" = true ]; then
            echo "✅ ${REPO_NAME} 镜像构建完成！"
        else
            echo "✅ ${REPO_NAME} 镜像构建并推送成功！"
        fi
    fi
    echo "=================================================="
done

echo ""
echo "🎉 所有指定的镜像已处理完毕！"
