FROM kwdb/kwdb:3.2.0

# 安装 Python 和 PostgreSQL 驱动，并清理缓存
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    python3-pip \
    python3-psycopg2 \
    && rm -rf /var/lib/apt/lists/*

# 保持原始镜像的入口点和命令
# 默认启动 KWDB，但 Python 环境已可用
