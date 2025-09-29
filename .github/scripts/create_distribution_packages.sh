#!/usr/bin/env bash
set -euo pipefail

# Create distribution directory
mkdir -p dist

# Prepare README summary
cat > dist/README.txt << 'EOF'
KWDB Playground - 快速开始

1) 解压本包
2) 确保 Docker 已启动
3) 运行：
   - Linux/macOS: ./kwdb-playground server
   - Windows: kwdb-playground.exe server
4) 打开 http://localhost:3006

可选环境变量：SERVER_PORT, SERVER_HOST, COURSE_DIR, COURSES_USE_EMBED
详情参见项目 README.md。
EOF

# LICENSE file
if [ -f LICENSE ]; then
  cp LICENSE dist/LICENSE
else
  cat > dist/LICENSE << 'EOF'
License: see repository policy

本仓库未检测到顶层 LICENSE 文件。请参考 GitHub 项目主页或组织内授权策略。
EOF
fi

# Linux amd64 tar.gz
pkg_linux=kwdb-playground-linux-amd64
mkdir -p "$pkg_linux"
cp bin/kwdb-playground-linux-amd64 "$pkg_linux"/kwdb-playground
cp dist/README.txt "$pkg_linux"/
cp dist/LICENSE "$pkg_linux"/
tar -czf dist/kwdb-playground-linux-amd64.tar.gz "$pkg_linux"/

# macOS arm64 tar.gz
pkg_darwin=kwdb-playground-darwin-arm64
mkdir -p "$pkg_darwin"
cp bin/kwdb-playground-darwin-arm64 "$pkg_darwin"/kwdb-playground
cp dist/README.txt "$pkg_darwin"/
cp dist/LICENSE "$pkg_darwin"/
tar -czf dist/kwdb-playground-darwin-arm64.tar.gz "$pkg_darwin"/

# Windows amd64 zip
pkg_win=kwdb-playground-windows-amd64
mkdir -p "$pkg_win"
cp bin/kwdb-playground-windows-amd64.exe "$pkg_win"/kwdb-playground.exe
cp dist/README.txt "$pkg_win"/
cp dist/LICENSE "$pkg_win"/
(cd "$pkg_win" && zip -r ../dist/kwdb-playground-windows-amd64.zip .)

# Checksums for distributions
(cd dist && sha256sum *.tar.gz *.zip > distribution-checksums.txt)
ls -lh dist