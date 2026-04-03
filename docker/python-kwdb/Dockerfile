FROM kwdb/kwdb:3.1.0

# 安装 Python 和基础工具并清理缓存，利用同一层级进行 pip 安装减小镜像层
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    python3-pip \
    python3-psycopg2 \
    && rm -rf /var/lib/apt/lists/* \
    && pip3 install --no-cache-dir psycopg2-binary

# 保持原始镜像的入口点和命令
# 默认启动 KWDB，但 Python 环境已可用