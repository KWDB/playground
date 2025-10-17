## 创建数据库

1. **创建时序数据库**

创建一个名为 `sensor_data` 的时序数据库：`CREATE TS DATABASE sensor_data;`{{exec}}

2. **创建关系数据库**

创建一个名为 `device_management` 的关系数据库：`CREATE DATABASE device_management;`{{exec}}

3. **创建时序表**

```sql {{exec}}
-- 在时序数据库中创建传感器读数表
CREATE TABLE sensor_data.readings (
    ts TIMESTAMPTZ NOT NULL,         -- 时间戳(主列)
    temperature FLOAT,               -- 温度值
    humidity FLOAT                   -- 湿度值
) TAGS (
    device_id INT NOT NULL,          -- 设备ID(标签)
    location VARCHAR(256) NOT NULL   -- 设备位置(标签)
) PRIMARY TAGS(device_id);          -- 主标签设为device_id
```

4. **创建关系表**

```sql {{exec}}
-- 在关系数据库中创建设备信息表
CREATE TABLE device_management.devices (
    device_id INT PRIMARY KEY,       -- 设备ID(主键)
    device_name VARCHAR(100),       -- 设备名称
    device_type VARCHAR(50),        -- 设备类型
    installation_date DATE,         -- 安装日期
    warranty_period INT             -- 保修期(月)
);
```

至此，准备工作已完成。在下一步中，我们将开始插入数据并进行跨模查询。
