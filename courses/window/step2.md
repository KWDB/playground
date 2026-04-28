## 场景查询

本项目使用交通流量监测场景来演示窗口函数。

样例表中的 6 条数据如下：

```sql
ts                       | vehicle_id | speed | lane_no | location
-------------------------+------------+-------+---------+---------
2025-01-10 12:01:00.000  | A11111     | 35    | 1       | 1
2025-01-10 12:02:00.000  | A22222     | 30    | 1       | 1
2025-01-10 12:09:00.000  | A33333     | 35    | 2       | 1
2025-01-10 12:11:00.000  | A44444     | 40    | 3       | 1
2025-01-10 12:12:00.000  | A55555     | 25    | 2       | 1
2025-01-10 12:21:00.000  | A66666     | 35    | 1       | 1
```

进入 SQL Shell 模式：

```bash {{exec}}
./kwbase sql --insecure --host=127.0.0.1
```

**场景一：** 使用 `COUNT_WINDOW` 按固定 3 条记录划分窗口，统计每个窗口内的记录数与平均车速

```sql {{exec}}
SELECT
  count(ts) AS records,
  avg(speed) AS avg_speed
FROM ts_window.vehicles
GROUP BY COUNT_WINDOW(3);
```

**场景二：** 使用 `EVENT_WINDOW` 识别低速拥堵事件。当车速降到 30 以下时视为拥堵开始，当车速回升到 35 及以上时视为拥堵结束，统计每次拥堵事件的持续记录数和平均车速

```sql {{exec}}
SELECT
  count(ts) AS records,
  avg(speed) AS avg_speed
FROM ts_window.vehicles
GROUP BY EVENT_WINDOW(speed < 30, speed >= 35);
```

**场景三：** 使用 `SESSION_WINDOW` 按 5 分钟最大连续间隔划分会话窗口

```sql {{exec}}
SELECT
  count(ts) AS records,
  avg(speed) AS avg_speed
FROM ts_window.vehicles
GROUP BY SESSION_WINDOW(ts, '5m');
```

**场景四：** 使用 `STATE_WINDOW` 分析车流状态持续情况。将“是否处于低速状态”作为状态量，按状态变化切分连续区间，观察低速与非低速状态分别持续了多久

```sql {{exec}}
SELECT
  count(ts) AS records,
  avg(speed) AS avg_speed
FROM ts_window.vehicles
GROUP BY STATE_WINDOW(CASE WHEN speed < 35 THEN 'low' ELSE 'high' END);
```

**场景五：** 使用 `TIME_WINDOW` 按 10 分钟固定时间窗口聚合车流数据

```sql {{exec}}
SELECT
  count(ts) AS records,
  avg(speed) AS avg_speed
FROM ts_window.vehicles
GROUP BY TIME_WINDOW(ts, '10m');
```
