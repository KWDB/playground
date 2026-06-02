## 技术特点

KWDB 的聚合函数具备以下特点：

1. 支持标准 SQL 基础聚合，兼容通用 SQL 使用习惯。
2. 提供时序专属聚合函数，适配时序数据时间有序、非均匀采样等特点。
3. 自动忽略 `NULL` 空值，适合传感器采集丢点、数据缺失等实际工业场景。
4. 可单独使用，也可搭配 `GROUP BY` 实现按设备标签或时间窗口的分组聚合分析。
5. 支持字段算术运算后再聚合，满足复杂业务统计需求。

## 使用规则

1. 聚合函数用于 `SELECT` 子句，支持单列聚合、多列同时聚合和分组聚合。
2. `FIRST`、`LAST`、`TWA` 等时序专属函数依赖时间戳列，并基于时序数据计算。
3. `time_bucket()` 必须搭配 `GROUP BY` 使用，适用于时间窗口分桶聚合。
4. `TWA()` 必须指定时间戳列和数值列，适配非均匀采样时序数据。
5. 分组聚合时，`SELECT` 中的非聚合列必须出现在 `GROUP BY` 子句中。
6. 支持先通过 `WHERE` 条件过滤数据，再进行聚合计算。

## 语法格式

```sql
-- 基础聚合
SELECT aggregate_function(column_name)
FROM ts_table
[WHERE condition];

-- 分组聚合
SELECT group_column, aggregate_function(column_name)
FROM ts_table
[WHERE condition]
GROUP BY group_column;

-- 时间窗口分桶聚合
SELECT time_bucket(ts_column, duration) AS bucket,
       aggregate_function(column_name)
FROM ts_table
GROUP BY bucket;

aggregate_function: {
    COUNT(*) | COUNT(column_name)
  | AVG(column_name)
  | SUM(column_name)
  | MIN(column_name)
  | MAX(column_name)
  | STDDEV(column_name)
  | FIRST(column_name)
  | LAST(column_name)
  | TWA(ts_column, column_name)
}
```

## 生成数据

本课程使用工业传感器监测场景，通过设备时序数据展示聚合函数的常见用法。

**启动数据库**

启动 KWDB（非安全模式）：

```bash {{exec}}
./kwbase start-single-node --insecure --listen-addr=0.0.0.0:26257 --http-addr=0.0.0.0:8080 --store=./kwbase-data --background > kwbase.log 2>&1
```

可以指定数据存储路径，如 `bash generate_data.sh ./kwbase-data12`，该路径需要与启动命令中的 `--store` 保持一致。如果不指定，默认是 `./kwbase-data`。

```bash {{exec}}
./generate_data.sh
```

创建数据库、时序表，并将数据导入表中：

```bash {{exec}}
./kwbase sql --insecure --host=127.0.0.1 < create_load.sql
```

表结构如下：

```sql
CREATE TS DATABASE sensors;

CREATE TABLE sensors.sensor_data (
  ts timestamp NOT NULL,
  normal_time timestamp NOT NULL,
  temperature smallint,
  temperature2 int,
  temperature3 bigint,
  stress float4,
  stress2 double
) TAGS (
  ptagID int NOT NULL
)
PRIMARY TAGS(ptagID);
```

字段说明：

| 字段 | 说明 |
|------|------|
| `ts` | 传感器数据采集时间 |
| `normal_time` | 标准时间字段 |
| `temperature` / `temperature2` / `temperature3` | 多类型温度监测值 |
| `stress` / `stress2` | 多精度压力监测值 |
| `ptagID` | 传感器编号，作为主标签区分不同设备 |
