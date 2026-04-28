## 分时负荷统计

按 1 小时粒度统计重点电表的平均功率、峰值功率与样本数，适合用于查看分时负荷变化趋势：

```sql {{exec}}
SELECT
  meter_id,
  time_bucket(ts, '1h') AS bucket_start,
  COUNT(*) AS sample_count,
  AVG(power) AS avg_power,
  MAX(power) AS max_power
FROM tsdb.meter_data
WHERE meter_id IN ('M1', 'M2', 'M3')
GROUP BY meter_id, bucket_start
ORDER BY meter_id, bucket_start;
```

## 用电会话分析

以 30 分钟空闲间隔划分会话窗口，查看单个电表在每个会话中的起止时间与累计能耗，适合识别一次连续用电过程：

```sql {{exec}}
SELECT
  meter_id,
  first(ts) AS session_start,
  last(ts) AS session_end,
  COUNT(*) AS sample_count,
  SUM(energy) AS total_energy
FROM tsdb.meter_data
WHERE meter_id = 'M1'
GROUP BY meter_id, session_window(ts, '30m')
ORDER BY session_start;
```

## 电压状态持续分析

按“是否处于高压状态”切分连续区间，观察电表高压状态持续了多久。

```sql {{exec}}
SELECT
  meter_id,
  first(ts) AS window_start,
  last(ts) AS window_end,
  COUNT(*) AS sample_count,
  MIN(voltage) AS min_voltage,
  MAX(voltage) AS max_voltage
FROM tsdb.meter_data
WHERE meter_id = 'M1'
GROUP BY 
  meter_id, 
  state_window(CASE WHEN voltage >= 225 THEN 'high' ELSE 'low' END)
ORDER BY window_start;
```

## 异常电流事件识别

将“电流升高到 6A 及以上”视为事件开始，“回落到 5.3A 及以下”视为事件结束，用于识别一次完整的异常波动事件：

```sql {{exec}}
SELECT
  meter_id,
  first(ts) AS event_start,
  last(ts) AS event_end,
  COUNT(*) AS sample_count,
  MAX(current) AS peak_current,
  AVG(power) AS avg_power
FROM tsdb.meter_data
WHERE meter_id = 'M1'
GROUP BY meter_id, event_window(current >= 6, current <= 5.3)
ORDER BY event_start;
```

## 滑动采样趋势分析

每 12 条采样做一个窗口，并以 6 条为滑动步长观察功率变化，适合做连续采样趋势分析：

```sql {{exec}}
SELECT
  meter_id,
  first(ts) AS window_start,
  last(ts) AS window_end,
  COUNT(*) AS sample_count,
  AVG(power) AS avg_power,
  MAX(power) AS max_power
FROM tsdb.meter_data
WHERE meter_id = 'M1'
GROUP BY meter_id, count_window(12, 6)
ORDER BY window_start;
```
