#!/bin/bash

set -euo pipefail

# 颜色输出函数
info() {
    echo -e "\033[1;34m[INFO] $1\033[0m"
}

warn() {
    echo -e "\033[1;33m[WARN] $1\033[0m"
}

error() {
    echo -e "\033[1;31m[ERROR] $1\033[0m"
    exit 1
}

# 检查 Docker 是否安装
if ! command -v docker &> /dev/null; then
    error "未检测到 Docker，请先安装"
fi

# 检查是否提供镜像参数
if [ $# -eq 0 ]; then
    error "请指定需要清理的镜像（支持名称、标签或ID），例如：\n./cleanup_specified_image.sh nginx:latest\n./cleanup_specified_image.sh 5f515359c7f8"
fi

TARGET_IMAGE="$1"

# 检查目标镜像是否存在
info "检查镜像是否存在: $TARGET_IMAGE"
if ! docker images -q "$TARGET_IMAGE" &> /dev/null; then
    error "未找到镜像: $TARGET_IMAGE"
fi

# 获取依赖该镜像的容器
info "查找使用该镜像的容器..."
DEPENDENT_CONTAINERS=$(docker ps -aq --filter "ancestor=$TARGET_IMAGE")

if [ -n "$DEPENDENT_CONTAINERS" ]; then
    info "发现 $(echo "$DEPENDENT_CONTAINERS" | wc -l) 个依赖容器，正在停止并删除..."
    
    # 停止容器
    docker stop $DEPENDENT_CONTAINERS || warn "部分容器停止失败，将继续删除"
    
    # 删除容器
    docker rm $DEPENDENT_CONTAINERS || warn "部分容器删除失败，将继续清理镜像"
else
    info "没有依赖该镜像的容器"
fi

# 清理目标镜像（支持多标签镜像）
info "正在删除镜像: $TARGET_IMAGE"
if docker rmi "$TARGET_IMAGE"; then
    info "镜像 $TARGET_IMAGE 已成功删除"
else
    error "删除镜像失败，请检查是否有其他依赖或权限问题"
fi

# 验证清理结果
info "验证清理结果..."
if docker images -q "$TARGET_IMAGE" &> /dev/null; then
    warn "警告：镜像 $TARGET_IMAGE 仍存在（可能存在多个标签）"
    docker images "$TARGET_IMAGE"
else
    info "确认：镜像 $TARGET_IMAGE 已完全清理"
fi