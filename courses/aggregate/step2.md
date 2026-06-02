## 场景查询

本项目使用温度传感器数据来演示聚合函数。

样例表中包含 29 条数据，覆盖正常数值、负数、`NULL` 空值和多个传感器标签。可以先查看导入结果：

```bash {{exec}}
./kwbase sql --insecure --host=127.0.0.1
```

```sql {{exec}}
SELECT *
FROM sensors.sensor_data
ORDER BY ts
LIMIT 10;
```

**场景一：** 使用 `COUNT` 统计传感器 `ptagID = 3` 的上报数据条数，适合做设备数据量核查。

```sql {{exec}}
SELECT COUNT(*) AS records
FROM sensors.sensor_data
WHERE ptagID = 3;
```

**场景二：** 使用 `AVG` 按传感器分组统计平均温度，观察不同设备的整体运行水平。

```sql {{exec}}
SELECT
  ptagID,
  AVG(temperature) AS avg_temperature
FROM sensors.sensor_data
GROUP BY ptagID
ORDER BY ptagID;
```

**场景三：** 使用 `SUM` 汇总压力值，适合能耗、压力、流量等累计量统计。

```sql {{exec}}
SELECT SUM(stress) AS total_stress
FROM sensors.sensor_data
WHERE ts > '2024-12-01';
```

**场景四：** 使用 `MIN` 和 `MAX` 查询每个传感器的温度范围，辅助识别异常低点或超温风险。

```sql {{exec}}
SELECT
  ptagID,
  MIN(temperature) AS min_temperature,
  MAX(temperature) AS max_temperature
FROM sensors.sensor_data
GROUP BY ptagID
ORDER BY ptagID;
```

**场景五：** 使用 `STDDEV` 计算温度波动程度，结合均值评估设备运行稳定性。

```sql {{exec}}
SELECT
  ptagID,
  AVG(temperature) AS avg_temperature,
  STDDEV(temperature) AS temperature_stddev
FROM sensors.sensor_data
GROUP BY ptagID
ORDER BY ptagID;
```

**场景六：** 使用 `FIRST` 和 `LAST` 获取时序首值与末值，适合查看设备初始值和最新状态。

```sql {{exec}}
SELECT
  FIRST(temperature) AS first_temperature,
  LAST(temperature) AS last_temperature
FROM sensors.sensor_data;
```

**场景七：** 使用 `time_bucket` 按 2 小时窗口降采样，并在每个窗口中取最后一条温度值。

```sql {{exec}}
SELECT
  time_bucket(ts, '2h') AS bucket,
  LAST(temperature) AS last_temperature
FROM sensors.sensor_data
GROUP BY bucket
ORDER BY bucket;
```

**场景八：** 使用 `TWA` 计算时间加权平均值，适合非均匀采样数据。

```sql {{exec}}
SELECT TWA(ts, temperature) AS twa_temperature
FROM sensors.sensor_data;
```

也可以先做表达式计算，再进行时间加权平均：

```sql {{exec}}
SELECT TWA(ts, temperature * 2) AS doubled_twa_temperature
FROM sensors.sensor_data;
```
