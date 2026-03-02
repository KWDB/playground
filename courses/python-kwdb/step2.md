# 创建数据库和表

连接成功后，我们可以创建自己的数据库和表。

## 创建数据库

```python
import psycopg2

conn = psycopg2.connect(
    host="127.0.0.1",
    port=26257,
    database="defaultdb",
    user="root"
)
conn.autocommit = True
cursor = conn.cursor()

# 创建数据库
cursor.execute("CREATE DATABASE shop")
print("数据库创建成功！")

cursor.close()
conn.close()
```

## 创建表

连接到新创建的数据库并创建表：

```python
import psycopg2

conn = psycopg2.connect(
    host="127.0.0.1",
    port=26257,
    database="shop",
    user="root"
)
cursor = conn.cursor()

# 创建商品表
cursor.execute("""
CREATE TABLE products (
    id SERIAL PRIMARY KEY,
    name STRING,
    price DECIMAL(10, 2),
    stock INT
)
""")
print("表创建成功！")

conn.commit()
cursor.close()
conn.close()
```

## KWDB 特色：时序表

KWDB 支持时序数据，我们可以创建一个时序表：

```python
import psycopg2

conn = psycopg2.connect(
    host="127.0.0.1",
    port=26257,
    database="shop",
    user="root"
)
cursor = conn.cursor()

# 创建时序表（存储传感器数据）
cursor.execute("""
CREATE TABLE sensor_data (
    ts TIMESTAMP,
    device_id STRING,
    temperature DOUBLE,
    humidity DOUBLE
)
""")
print("时序表创建成功！")

conn.commit()
cursor.close()
conn.close()
```

## 试一试

在右侧编辑器中输入代码，创建 `shop` 数据库和 `products` 表。

> 注意：如果数据库已存在，会报错。可以先删除再创建：`DROP DATABASE IF EXISTS shop`
