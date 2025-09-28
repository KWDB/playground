## 体验您的第一个查询

## 准备数据

1. **创建数据库**

创建一个名为 `factory_iot` 的时序数据库：`CREATE TS DATABASE factory_iot;`{{exec}}

2. **创建关系数据库**

创建一个名为 `factory_management` 的关系数据库：`CREATE DATABASE factory_management;`{{exec}}

3. **创建时序表**

```sql {{exec}}
CREATE TABLE factory_iot.machine_sensors (
    ts TIMESTAMPTZ NOT NULL,
    vibration FLOAT,
    temperature FLOAT,
    power_consumption FLOAT
) TAGS (
    machine_id INT NOT NULL,
    production_line VARCHAR(50),
    machine_type VARCHAR(50)
) PRIMARY TAGS(machine_id);
```

4. **创建关系表**

```sql {{exec}}
CREATE TABLE factory_management.production_orders (
    order_id VARCHAR(20) PRIMARY KEY,
    machine_id INT,  -- 逻辑上引用machine_sensors.machine_id
    product_code VARCHAR(20),
    start_time TIMESTAMPTZ,
    end_time TIMESTAMPTZ,
    quality_rating FLOAT
);
```

5. **插入数据**

插入时序数据（设备传感器数据）:

```sql {{exec}}
INSERT INTO factory_iot.machine_sensors VALUES
('2023-08-01 08:00:00', 2.3, 65.2, 1200, 101, 'LineA', 'CNC'),
('2023-08-01 09:15:00', 2.5, 66.1, 1250, 101, 'LineA', 'CNC'),
('2023-08-01 10:30:00', 2.7, 67.0, 1300, 101, 'LineA', 'CNC'),
('2023-08-01 11:45:00', 2.6, 66.5, 1280, 102, 'LineB', 'CNC'),
('2023-08-01 13:00:00', 2.8, 67.2, 1320, 102, 'LineB', 'CNC');
```

插入关系数据（生产订单数据）:

```sql {{exec}}
INSERT INTO factory_management.production_orders VALUES
('ORD-2023-101', 101, 'PROD-A100', NOW() - INTERVAL '8 hours', NOW() - INTERVAL '2 hours', 0.98),
('ORD-2023-102', 101, 'PROD-A200', NOW() - INTERVAL '7 hours 30 minutes', NOW() - INTERVAL '1 hour', 0.95),
('ORD-2023-103', 102, 'PROD-B100', NOW() - INTERVAL '8 hours', NOW() - INTERVAL '3 hours', 0.92),
('ORD-2023-104', 102, 'PROD-B200', NOW() - INTERVAL '7 hours', NOW() - INTERVAL '2 hours 30 minutes', 0.90);
```

### 执行查询

查询分析：

1. 关联关系：通过 machine_id 关联生产订单和设备传感器数据
2. 时间过滤：只查询2023-08-01当天的传感器数据
3. 聚合计算：计算每个订单期间设备的平均温度、振动和功耗
4. 分组：按订单、产品、设备等维度分组
5. 排序：按订单开始时间降序排列

预期结果：

- 展示每个订单的基本信息和对应的设备运行状态平均值
- 可以分析设备运行参数与产品质量的关系
- 可以比较不同生产线或设备类型的生产表现

```sql {{exec}}
-- 执行跨模分析查询
SELECT
    po.order_id,
    po.product_code,
    ms.machine_id,
    ms.production_line,
    ms.machine_type,
    po.start_time,
    po.end_time,
    po.quality_rating,
    AVG(ms.temperature) AS avg_temperature,
    AVG(ms.vibration) AS avg_vibration,
    AVG(ms.power_consumption) AS avg_power
FROM
    factory_management.production_orders AS po
JOIN
    factory_iot.machine_sensors AS ms
    ON po.machine_id = ms.machine_id
WHERE
    ms.ts BETWEEN '2023-08-01 00:00:00' AND '2023-08-02 00:00:00'
GROUP BY
    po.order_id,
    po.product_code,
    ms.machine_id,
    ms.production_line,
    ms.machine_type,
    po.start_time,
    po.end_time,
    po.quality_rating
ORDER BY
    po.start_time DESC;
```
