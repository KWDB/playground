## 查询区域用电量TOP10

```sql {{exec}}
SELECT 
  a.area_name,
  SUM(md.energy) AS total_energy
FROM tsdb.meter_data md
JOIN rdb.meter_info mi ON md.meter_id = mi.meter_id
JOIN rdb.area_info a ON mi.area_id = a.area_id
GROUP BY a.area_name
ORDER BY total_energy DESC
LIMIT 10;
```

## 查询故障电表及用户信息

```sql {{exec}}
SELECT 
  mi.meter_id,
  u.user_name,
  u.contact,
  a.area_name
FROM rdb.meter_info mi
JOIN rdb.user_info u ON mi.user_id = u.user_id
JOIN rdb.area_info a ON mi.area_id = a.area_id
WHERE mi.status = 'Fault';
```

## 电表概要查询

```sql {{exec}}
SELECT 
  mi.meter_id,
  mi.voltage_level,
  mi.status,
  u.user_name,
  a.area_name,
  (SELECT COUNT(*) 
   FROM tsdb.meter_data md 
   WHERE md.meter_id = mi.meter_id) AS data_points
FROM rdb.meter_info mi
JOIN rdb.user_info u ON mi.user_id = u.user_id
JOIN rdb.area_info a ON mi.area_id = a.area_id
WHERE mi.meter_id = 'M1';
```

## 告警检测查询

```sql {{exec}}
SELECT 
  md.meter_id,
  md.ts,
  ar.rule_name,
  md.voltage,
  md.current,
  md.power
FROM tsdb.meter_data md
JOIN rdb.alarm_rules ar ON 1=1
WHERE (ar.metric = 'voltage' 
       AND ((ar.operator = '>' AND md.voltage < ar.threshold) 
            OR (ar.operator = '<' AND md.voltage > ar.threshold)))
   OR (ar.metric = 'current' AND md.current > ar.threshold)
   OR (ar.metric = 'power' AND md.power > ar.threshold)
ORDER BY md.ts DESC
LIMIT 100;
```

## 区域用电量统计

```sql {{exec}}
SELECT 
  a.region,
  a.area_name,
  SUM(md.energy) AS total_energy,
  AVG(md.power) AS avg_power
FROM tsdb.meter_data md
JOIN rdb.meter_info mi ON md.meter_id = mi.meter_id
JOIN rdb.area_info a ON mi.area_id = a.area_id
GROUP BY a.region, a.area_name;
```

## 查询指定电表最近24小时用电趋势量

```sql {{exec}}
SELECT 
  md.ts,
  md.power,
  md.energy
FROM tsdb.meter_data md
WHERE md.meter_id = 'M1'
  AND md.ts > NOW() - INTERVAL '24 hours'
ORDER BY md.ts;
```
