FROM kwdb/kwdb:3.1.0

# 安装 Python 和基础工具
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    python3-psycopg2 \
    && rm -rf /var/lib/apt/lists/*

# 安装 Python 库
RUN pip3 install --no-cache-dir psycopg2-binary

# 保持原始镜像的入口点和命令
# 默认启动 KWDB，但 Python 环境已可用