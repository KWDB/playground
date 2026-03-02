# 插入和查询数据

现在让我们向表中插入数据并查询。

## 插入数据

```python
import psycopg2

conn = psycopg2.connect(
    host="127.0.0.1",
    port=26257,
    database="shop",
    user="root"
)
cursor = conn.cursor()

# 插入商品数据
products = [
    ("iPhone 15", 6999.00, 100),
    ("MacBook Pro", 12999.00, 50),
    ("iPad Air", 4599.00, 200),
    ("AirPods Pro", 1899.00, 500)
]

for name, price, stock in products:
    cursor.execute(
        "INSERT INTO products (name, price, stock) VALUES (%s, %s, %s)",
        (name, price, stock)
    )

conn.commit()
print(f"成功插入 {len(products)} 条记录！")

cursor.close()
conn.close()
```

## 查询数据

```python
import psycopg2

conn = psycopg2.connect(
    host="127.0.0.1",
    port=26257,
    database="shop",
    user="root"
)
cursor = conn.cursor()

# 查询所有商品
cursor.execute("SELECT id, name, price, stock FROM products ORDER BY price")
products = cursor.fetchall()

print("商品列表：")
print("-" * 50)
for p in products:
    print(f"ID: {p[0]}, 名称: {p[1]}, 价格: ¥{p[2]}, 库存: {p[3]}")

# 查询高价商品（价格 > 5000）
cursor.execute("SELECT name, price FROM products WHERE price > 5000")
expensive = cursor.fetchall()

print("\n高价商品：")
for p in expensive:
    print(f"  {p[0]}: ¥{p[1]}")

cursor.close()
conn.close()
```

## 插入时序数据

KWDB 的时序表支持高效的时间序列数据写入：

```python
import psycopg2
from datetime import datetime

conn = psycopg2.connect(
    host="127.0.0.1",
    port=26257,
    database="shop",
    user="root"
)
cursor = conn.cursor()

# 插入传感器数据
import random
import time

for i in range(10):
    ts = datetime.now()
    device_id = "sensor_001"
    temperature = 20 + random.random() * 10
    humidity = 40 + random.random() * 20
    
    cursor.execute(
        "INSERT INTO sensor_data (ts, device_id, temperature, humidity) VALUES (%s, %s, %s, %s)",
        (ts, device_id, temperature, humidity)
    )
    time.sleep(0.1)

conn.commit()
print("传感器数据插入成功！")

cursor.close()
conn.close()
```

## 试一试

在右侧编辑器中依次执行：
1. 插入商品数据
2. 查询所有商品
3. 查看结果

> 注意：每次操作后记得 `conn.commit()` 提交事务。
