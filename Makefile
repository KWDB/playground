# KWDB Playground Makefile
# 支持跨平台开发、调试和部署的完整构建脚本

# 检测操作系统
UNAME_S := $(shell uname -s)
ifeq ($(UNAME_S),Linux)
	OS = linux
endif
ifeq ($(UNAME_S),Darwin)
	OS = macos
endif
ifeq ($(OS),Windows_NT)
	OS = windows
endif

# 设置默认变量
APP_NAME ?= kwdb-playground
VERSION ?= $(shell git describe --tags --always --dirty 2>/dev/null || echo "dev")
BUILD_TIME ?= $(shell date -u +"%Y-%m-%dT%H:%M:%SZ")
GIT_COMMIT ?= $(shell git rev-parse --short HEAD 2>/dev/null || echo "unknown")

# 端口配置 - 统一端口部署
SERVER_PORT ?= 3006
DEBUG_PORT ?= 2345

# 构建标志
LDFLAGS = -X main.Version=$(VERSION) -X main.BuildTime=$(BUILD_TIME) -X main.GitCommit=$(GIT_COMMIT) -X kwdb-playground/internal/config.BuildDefaultUseEmbed=true

# 环境变量文件
ENV_FILE ?= .env

.PHONY: all build dev debug dev-debug clean install install-tools deps frontend backend run stop logs status fmt test check help release release-run release-linux-amd64 release-darwin-arm64 release-windows-amd64 release-all

# 默认目标
all: build

# 加载环境变量（如果存在）
ifneq (,$(wildcard $(ENV_FILE)))
	include $(ENV_FILE)
	export
endif

# 安装依赖
install:
	@echo "📦 Installing dependencies..."
	pnpm install
	go mod tidy
	@echo "✅ Dependencies installed successfully!"

# 安装开发工具
install-tools:
	@echo "🔧 Installing development tools..."
	@command -v air >/dev/null 2>&1 || { \
		echo "Installing air for Go hot reload..."; \
		go install github.com/cosmtrek/air@latest; \
	}
	@command -v dlv >/dev/null 2>&1 || { \
		echo "Installing delve for Go debugging..."; \
		go install github.com/go-delve/delve/cmd/dlv@latest; \
	}
	@echo "✅ Development tools installed successfully!"

# 开发模式（统一端口）
dev: install-tools
	@echo "🚀 Starting unified development server..."
	@echo "Building frontend first..."
	pnpm run build
	@echo "Server will be available at http://localhost:$(SERVER_PORT)"
	@echo "Press Ctrl+C to stop the service"
	SERVER_PORT=$(SERVER_PORT) air -c .air.toml

# 调试模式 - 后端调试
debug: install-tools
	@echo "🐛 Starting backend in debug mode..."
	@echo "Building frontend first..."
	pnpm run build
	@echo "Debug server: http://localhost:$(SERVER_PORT)"
	@echo "Debug port: $(DEBUG_PORT)"
	@echo "Connect your IDE to debug port $(DEBUG_PORT)"
	@if [ "$(OS)" = "Windows_NT" ]; then \
		set SERVER_PORT=$(SERVER_PORT) && dlv debug --headless --listen=:$(DEBUG_PORT) --api-version=2 --accept-multiclient; \
	else \
		SERVER_PORT=$(SERVER_PORT) dlv debug --headless --listen=:$(DEBUG_PORT) --api-version=2 --accept-multiclient; \
	fi

# 开发+调试模式 - 统一端口调试
dev-debug: install-tools
	@echo "🚀🐛 Starting unified development with debug mode..."
	@echo "Building frontend first..."
	pnpm run build
	@echo "Debug server: http://localhost:$(SERVER_PORT)"
	@echo "Debug port: $(DEBUG_PORT)"
	@echo "Press Ctrl+C to stop the service"
	@if [ "$(OS)" = "Windows_NT" ]; then \
		set SERVER_PORT=$(SERVER_PORT) && dlv debug --headless --listen=:$(DEBUG_PORT) --api-version=2 --accept-multiclient; \
	else \
		SERVER_PORT=$(SERVER_PORT) dlv debug --headless --listen=:$(DEBUG_PORT) --api-version=2 --accept-multiclient; \
	fi

# 构建前端
frontend:
	@echo "🏗️ Building frontend..."
	pnpm run build
	@echo "✅ Frontend build completed!"

# 构建后端
backend: frontend
	@echo "🏗️ Building backend..."
	@echo "Version: $(VERSION)"
	@echo "Build Time: $(BUILD_TIME)"
	@echo "Git Commit: $(GIT_COMMIT)"
	@mkdir -p bin
	go build -ldflags "$(LDFLAGS)" -o bin/$(APP_NAME) .
	@echo "✅ Backend build completed!"

# 完整构建
build: backend
	@echo "🎉 Build completed: bin/$(APP_NAME)"
	@echo "📊 Build info:"
	@echo "  - Version: $(VERSION)"
	@echo "  - Build Time: $(BUILD_TIME)"
	@echo "  - Git Commit: $(GIT_COMMIT)"
	@ls -lh bin/$(APP_NAME)

# 发布模式（单一二进制，嵌入 courses 与 dist）
release: frontend
	@echo "🚀📦 Building RELEASE (single binary with embedded assets and courses) ..."
	@mkdir -p bin
	COURSES_USE_EMBED=true CGO_ENABLED=0 go build -trimpath -ldflags "$(LDFLAGS) -s -w" -o bin/$(APP_NAME) .
	@echo "✅ Release build completed: bin/$(APP_NAME)"
	@ls -lh bin/$(APP_NAME)

# 以发布模式运行（使用嵌入式FS）
release-run: release
	@echo "🚀 Running in RELEASE mode (embedded FS) ..."
	COURSES_USE_EMBED=true SERVER_PORT=$(SERVER_PORT) ./bin/$(APP_NAME)

# 跨平台发布构建
release-linux-amd64: frontend
	@echo "🐧 Building RELEASE for Linux amd64 ..."
	@mkdir -p bin
	GOOS=linux GOARCH=amd64 COURSES_USE_EMBED=true CGO_ENABLED=0 go build -trimpath -ldflags "$(LDFLAGS) -s -w" -o bin/$(APP_NAME)-linux-amd64 .
	@ls -lh bin/$(APP_NAME)-linux-amd64

release-darwin-arm64: frontend
	@echo "🍎 Building RELEASE for macOS arm64 ..."
	@mkdir -p bin
	GOOS=darwin GOARCH=arm64 COURSES_USE_EMBED=true CGO_ENABLED=0 go build -trimpath -ldflags "$(LDFLAGS) -s -w" -o bin/$(APP_NAME)-darwin-arm64 .
	@ls -lh bin/$(APP_NAME)-darwin-arm64

release-windows-amd64: frontend
	@echo "🪟 Building RELEASE for Windows amd64 ..."
	@mkdir -p bin
	GOOS=windows GOARCH=amd64 COURSES_USE_EMBED=true CGO_ENABLED=0 go build -trimpath -ldflags "$(LDFLAGS) -s -w" -o bin/$(APP_NAME)-windows-amd64.exe .
	@ls -lh bin/$(APP_NAME)-windows-amd64.exe

release-all: release-linux-amd64 release-darwin-arm64 release-windows-amd64
	@echo "🎉 All release builds completed!"
	@ls -lh bin/$(APP_NAME)

# 运行应用
run: build
	@echo "🚀 Starting KWDB Playground..."
	@echo "Server will be available at http://localhost:$(SERVER_PORT)"
	SERVER_PORT=$(SERVER_PORT) ./bin/$(APP_NAME)

# 停止所有服务
stop:
	@echo "🛑 Stopping all services..."
	@if [ "$(OS)" = "windows" ]; then \
		taskkill /F /IM node.exe 2>/dev/null || true; \
		taskkill /F /IM air.exe 2>/dev/null || true; \
		taskkill /F /IM dlv.exe 2>/dev/null || true; \
		taskkill /F /IM $(APP_NAME).exe 2>/dev/null || true; \
	else \
		pkill -f "vite" 2>/dev/null || true; \
		pkill -f "air" 2>/dev/null || true; \
		pkill -f "dlv" 2>/dev/null || true; \
		pkill -f "$(APP_NAME)" 2>/dev/null || true; \
	fi
	@echo "✅ All services stopped!"

# 查看日志
logs:
	@echo "📋 Checking service status..."
	@echo "Server (port $(SERVER_PORT)):"
	@lsof -i :$(SERVER_PORT) 2>/dev/null || echo "  Not running"
	@echo "Debug (port $(DEBUG_PORT)):"
	@lsof -i :$(DEBUG_PORT) 2>/dev/null || echo "  Not running"

# 服务状态检查
status:
	@echo "📊 Service Status:"
	@echo "Server ($(SERVER_PORT)): $$(curl -s http://localhost:$(SERVER_PORT)/health >/dev/null && echo '✅ Running' || echo '❌ Stopped')"
	@echo "Debug ($(DEBUG_PORT)): $$(nc -z localhost $(DEBUG_PORT) 2>/dev/null && echo '✅ Running' || echo '❌ Stopped')"

# 清理构建文件
clean:
	@echo "🧹 Cleaning build files..."
	rm -rf dist/
	rm -rf bin/
	rm -rf node_modules/.vite/
	rm -rf tmp/
	@echo "✅ Clean completed!"

# 初始化Go模块依赖
deps:
	@echo "📦 Downloading Go dependencies..."
	go mod download
	go mod verify
	@echo "✅ Go dependencies downloaded!"

# 格式化代码
fmt:
	@echo "🎨 Formatting code..."
	@echo "Formatting Go code..."
	go fmt ./...
	go mod tidy
	@echo "Formatting frontend code..."
	pnpm run lint --fix 2>/dev/null || pnpm run lint || echo "Frontend linting skipped"
	@echo "✅ Code formatting completed!"

# 测试
test:
	@echo "🧪 Running tests..."
	@echo "Running Go tests..."
	go test -v ./...
	@echo "Running frontend tests..."
	pnpm run test 2>/dev/null || echo "Frontend tests skipped"
	@echo "✅ Tests completed!"

# 开发环境检查
check:
	@echo "🔍 Checking development environment..."
	@echo "Checking required tools..."
	@command -v go >/dev/null 2>&1 || { echo "❌ Go is not installed"; exit 1; }
	@echo "✅ Go: $$(go version)"
	@command -v pnpm >/dev/null 2>&1 || { echo "❌ pnpm is not installed"; exit 1; }
	@echo "✅ pnpm: $$(pnpm --version)"
	@command -v docker >/dev/null 2>&1 || { echo "❌ Docker is not installed"; exit 1; }
	@echo "✅ Docker: $$(docker --version)"
	@echo "Checking optional tools..."
	@command -v air >/dev/null 2>&1 && echo "✅ air: $$(air -v 2>&1 | head -1)" || echo "⚠️ air: Not installed (run 'make install-tools')"
	@command -v dlv >/dev/null 2>&1 && echo "✅ dlv: $$(dlv version 2>&1 | head -1)" || echo "⚠️ dlv: Not installed (run 'make install-tools')"
	@echo "🎉 Development environment check completed!"

# 帮助信息
help:
	@echo "🚀 KWDB Playground - 构建和开发脚本"
	@echo ""
	@echo "📋 可用目标:"
	@echo ""
	@echo "🔧 环境设置:"
	@echo "  install       - 安装所有依赖 (pnpm + go mod)"
	@echo "  install-tools - 安装开发工具 (air, dlv)"
	@echo "  deps          - 下载Go模块依赖"
	@echo "  check         - 检查开发环境"
	@echo ""
	@echo "🚀 开发模式:"
	@echo "  dev           - 启动统一开发服务器 (端口 $(SERVER_PORT))"
	@echo "  debug         - 启动后端调试模式 (端口 $(DEBUG_PORT))"
	@echo "  dev-debug     - 前端开发 + 后端调试模式"
	@echo ""
	@echo "🏗️ 构建和部署:"
	@echo "  frontend      - 构建前端"
	@echo "  backend       - 构建后端 (包含前端)"
	@echo "  build         - 完整构建 (生产环境)"
	@echo "  release       - 发布构建（嵌入模式，单一二进制）"
	@echo "  release-run   - 以发布模式运行（启用嵌入式FS）"
	@echo "  release-all   - 生成 Linux/macOS/Windows 的发布二进制"
	@echo ""
	@echo "🛠️ 维护工具:"
	@echo "  fmt           - 格式化代码 (Go + 前端)"
	@echo "  test          - 运行测试"
	@echo "  clean         - 清理构建文件"
	@echo ""
	@echo "📊 服务管理:"
	@echo "  status        - 检查服务状态"
	@echo "  logs          - 查看端口占用情况"
	@echo "  stop          - 停止所有服务"
	@echo ""
	@echo "🌍 环境变量:"
	@echo "  SERVER_PORT   - 服务器端口 (默认: $(SERVER_PORT))"
	@echo "  DEBUG_PORT    - 调试端口 (默认: $(DEBUG_PORT))"
	@echo "  ENV_FILE      - 环境变量文件 (默认: $(ENV_FILE))"
	@echo "  COURSES_USE_EMBED - 是否使用嵌入式FS（发布模式建议：true）"
	@echo ""
	@echo "📖 使用示例:"
	@echo "  make install install-tools         # 初始化开发环境"
	@echo "  make dev                          # 启动开发环境 (磁盘模式)"
	@echo "  COURSES_USE_EMBED=true make build # 构建生产版本（启用嵌入）"
	@echo "  make release                      # 一键发布（单一二进制，嵌入）"
	@echo "  make release-run                  # 以发布模式运行"
	@echo "  make release-all                  # 生成跨平台发布二进制"
	@echo "  SERVER_PORT=3006 make run         # 自定义端口运行"
	@echo ""
	@echo "💡 提示:"
	@echo "  - 使用 Ctrl+C 停止开发服务器"
	@echo "  - 调试模式需要IDE连接到调试端口"
	@echo "  - 支持 Windows, macOS, Linux 跨平台"
	@echo "  - 环境变量可通过 .env 文件配置"