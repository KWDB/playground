# ============================================================
# Stage 1: 前端构建
# ============================================================
FROM node:20-alpine AS frontend

WORKDIR /build

RUN corepack enable && corepack prepare pnpm@latest --activate

# 先复制依赖清单以利用缓存
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# 复制前端源码并构建
COPY tsconfig*.json vite.config.ts tailwind.config.js postcss.config.js index.html ./
COPY src/ src/
COPY public/ public/
RUN pnpm run build

# ============================================================
# Stage 2: Go 编译
# ============================================================
FROM golang:1.24-alpine AS backend

WORKDIR /build

RUN apk add --no-cache git

# 先复制依赖清单以利用缓存
COPY go.mod go.sum ./
RUN go mod download

# 复制前端构建产物（go:embed dist/*）
COPY --from=frontend /build/dist/ dist/

# 复制课程文件（go:embed courses/*）
COPY courses/ courses/

# 复制 Go 源码
COPY main.go ./
COPY cmd/ cmd/
COPY internal/ internal/

ARG VERSION=dev
ARG BUILD_TIME=unknown
ARG GIT_COMMIT=unknown

RUN CGO_ENABLED=0 GOOS=linux go build -trimpath \
    -ldflags "-s -w \
      -X main.Version=${VERSION} \
      -X main.BuildTime=${BUILD_TIME} \
      -X main.GitCommit=${GIT_COMMIT} \
      -X kwdb-playground/internal/config.BuildDefaultUseEmbed=true" \
    -o /app/kwdb-playground .

# ============================================================
# Stage 3: 运行时镜像
# 课程文件已通过 go:embed 嵌入二进制，无需额外复制。
# 启动课程容器时通过 Docker API (CopyToContainer) 注入文件。
# ============================================================
FROM alpine:3.21

RUN apk add --no-cache ca-certificates tzdata

WORKDIR /app

COPY --from=backend /app/kwdb-playground .

ENV GIN_MODE=release \
    SERVER_HOST=0.0.0.0 \
    SERVER_PORT=3006 \
    LOG_LEVEL=info \
    LOG_FORMAT=json \
    COURSES_USE_EMBED=true \
    DOCKER_DEPLOY=true

EXPOSE 3006

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD wget -qO- http://localhost:3006/health || exit 1

ENTRYPOINT ["/app/kwdb-playground"]
CMD ["server"]
