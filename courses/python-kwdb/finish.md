# 课程完成

恭喜你已完成「Python 连接 KWDB」课程！

## 学习总结

在本课程中，你学会了：

1. **连接数据库** - 使用 `psycopg2` 库连接到 KWDB
2. **创建数据库和表** - 创建自定义数据库和表结构
3. **时序表** - KWDB 特色的时序数据表
4. **数据操作** - 插入、查询数据

## 进阶学习

以下是进一步学习的方向：

### 1. 使用 ORM
推荐使用 SQLAlchemy 或 SQLModel 进行更高级的数据库操作：

```python
from sqlmodel import SQLModel, Field, Session, create_engine

class Product(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    name: str
    price: float
    stock: int
```

### 2. 连接池
生产环境建议使用连接池：

```python
from psycopg2 import pool

connection_pool = pool.ThreadedConnectionPool(
    minconn=1,
    maxconn=10,
    host="localhost",
    port=26257,
    database="shop",
    user="root"
)
```

### 3. KWDB 高级特性
- 学习时序数据的聚合查询
- 使用跨模查询同时查询关系数据和时序数据
- 了解 KWDB 的数据分区和压缩策略

## 下一步

- 尝试创建自己的 Python 应用连接 KWDB
- 探索 KWDB 的其他高级特性
- 学习使用 KWDB 的集群部署

## 相关资源

- [KWDB 官方文档](https://kwdb.io)
- [psycopg2 文档](https://www.psycopg.org/docs/)

感谢学习本课程！
