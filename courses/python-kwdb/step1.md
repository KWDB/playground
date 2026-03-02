首先，我们需要使用 Python 的 `psycopg2` 库连接到 KWDB 数据库。

## 安装依赖

在运行代码前，确保已安装 `psycopg2-binary`：

```bash
pip install psycopg2-binary -q
```

## 连接 KWDB

使用以下 Python 代码连接到 KWDB：

```python
import psycopg2

# 连接到 KWDB
conn = psycopg2.connect(
    host="localhost",
    port=26257,
    database="defaultdb",
    user="root",
    password=""
)

# 创建游标
cursor = conn.cursor()

# 测试连接
cursor.execute("SELECT 1 as result")
result = cursor.fetchone()
print("连接测试结果:", result[0])

# 关闭连接
cursor.close()
conn.close()
print("连接已关闭")
```

## 代码说明

| 参数 | 说明 |
|------|------|
| `host` | 数据库主机地址，使用 `127.0.0.1`（容器内本地） |
| `port` | KWDB 端口，默认 `26257` |
| `database` | 数据库名称，`defaultdb` 是默认数据库 |
| `user` | 用户名，`root` 是管理员用户 |
| `password` | 密码，`--insecure` 模式下为空 |

> 注意：
> - 请确保容器已启动，KWDB 服务正在运行
> - 首次运行需要安装 psycopg2-binary，可能会稍慢
