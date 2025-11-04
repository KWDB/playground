## 准备数据

### 启动数据库

启动 KWDB（非安全模式）：
```bash {{exec}}
./kwbase start-single-node --insecure --listen-addr=0.0.0.0:26257 --http-addr=0.0.0.0:8080 --store=./kwbase-data --background
```

### 解压数据压缩包

解压数据压缩包：

`tar xvf kwbase-data/extern/rdb.tar.gz -C kwbase-data/extern/`{{exec}}

`tar xvf kwbase-data/extern/tsdb.tar.gz -C kwbase-data/extern/`{{exec}}

进入 KWDB SQL Shell 终端：

`./kwbase sql --insecure --host=127.0.0.1`{{exec}}

### 关系库 rdb

导入 rdb 数据

`import database csv data ("nodelocal://1/rdb");`{{exec}}

关系库导入验证：
`SHOW TABLES FROM rdb;`{{exec}}

### 时序库 tsdb

导入 tsdb 数据

`import database csv data ("nodelocal://1/tsdb");`{{exec}}

时序库导入验证：

`SHOW TABLES FROM tsdb;`{{exec}}

### 时序数据生成语句

若想插入任意条数据可修改下面示例中的 `generate_series(1, 10000)` 中的数字，代表插入的条数。

以下示例为 10000 条数据：
```sql {{exec}}
INSERT INTO tsdb.meter_data(ts, voltage, current, power, energy, meter_id)
SELECT 
  NOW()-(s*10)::int * INTERVAL '1 minute',
  220.0 + (s%10)::float,
  5.0 + (s%15)::float * 0.1,
  1000.0 + (s%20)::float * 50,
  5000.0 + s::float * 10,
  'M' || ((s%100)+1)::text
FROM generate_series(1, 10000) AS s;
```

---

## 普通表结构

### 电表基础信息表(普通表)

```sql
CREATE TABLE rdb.meter_info(
  meter_id VARCHAR(50) PRIMARY KEY,
  install_date DATE,
  voltage_level VARCHAR(20),
  manufacturer VARCHAR(50),
  status VARCHAR(20),
  area_id VARCHAR(20),
  user_id VARCHAR(50)
);
```

### 用户信息表(普通表)

```sql
CREATE TABLE rdb.user_info(
  user_id VARCHAR(50) PRIMARY KEY,
  user_name VARCHAR(100),
  address VARCHAR(200),
  contact VARCHAR(20)
);
```

### 区域信息表(普通表)

```sql
CREATE TABLE rdb.area_info(
  area_id VARCHAR(20) PRIMARY KEY,
  area_name VARCHAR(100),
  manager VARCHAR(50),
  region VARCHAR(50)
);
```

### 告警规则表结构(普通表)

```sql
CREATE TABLE rdb.alarm_rules(
  rule_id SERIAL PRIMARY KEY,
  rule_name VARCHAR(100),
  metric VARCHAR(50),
  operator VARCHAR(10),
  threshold FLOAT8,
  severity VARCHAR(20),
  notify_method VARCHAR(50)
);
```

## 时序表结构

### 实时用电数据表(时序表)

```sql
CREATE TABLE tsdb.meter_data(
  ts TIMESTAMPTZ(3) NOT NULL,
  voltage FLOAT8 NULL,
  current FLOAT8 NULL,
  power FLOAT8 NULL,
  energy FLOAT8 NULL,
  -- meter_id VARCHAR(50)
) TAGS(meter_id VARCHAR(50) NOT NULL)
PRIMARY TAGS(meter_id)
retentions 0s
activetime 1d
partition interval 10d;
```
