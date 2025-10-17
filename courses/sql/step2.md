## 插入&查询

1. **插入关系数据**

向关系表插入设备信息:

```sql {{exec}}
INSERT INTO device_management.devices VALUES
(101, '温度传感器-101', '温度传感器', '2023-01-15', 24),
(102, '湿度传感器-102', '湿度传感器', '2023-02-20', 36),
(103, '多功能传感器-103', '复合传感器', '2023-03-10', 12);
```

2. **插入时序数据**:

向时序表插入传感器读数数据

```sql {{exec}}
INSERT INTO sensor_data.readings VALUES
('2025-08-15 13:00:00', 23.5, 45.2, 101, '机房A'),
('2025-08-15 13:30:00', 24.1, 46.8, 101, '机房A'),
('2025-08-15 14:00:00', 22.9, 47.5, 101, '机房A'),
('2025-08-15 14:30:00', 19.8, 65.3, 102, '机房B'),
('2025-08-15 15:00:00', 20.2, 64.7, 102, '机房B'),
('2025-08-15 15:30:00', 20.5, 63.9, 102, '机房B'),
('2025-08-15 16:00:00', 25.3, 42.1, 103, '走廊'),
('2025-08-15 16:30:00', 25.8, 41.7, 103, '走廊');
```

### 执行查询

跨模查询数据，查询设备最新读数及其详细信息：

```sql {{exec}}
SELECT 
    r.ts AS timestamp,
    r.temperature,
    r.humidity,
    d.device_name,
    d.device_type,
    r.location
FROM 
    sensor_data.readings AS r
INNER JOIN 
    device_management.devices AS d 
ON 
    r.device_id = d.device_id
WHERE 
    r.ts > '2025-08-15 10:00:00'
ORDER BY 
    r.ts DESC;
```
