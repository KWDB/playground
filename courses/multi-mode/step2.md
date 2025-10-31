本项目使用城市管道网络（以下简称“管网”）物联网IoT场景。

管网场景是跨模查询的一个典型示例：

1. 静态属性较多，但数据量都不大，因此可以使用关系型数据进行存储；
2. 此场景下，时序表仅记录实时数据以及部分关键属性即可。

通过使用 KWDB，我们将管网场景的数据分类存储在 KWDB 的关系引擎以及时序引擎中，通过跨模查询，既能有效提升查询速率，又能帮助用户节省存储成本。

以下场景涉及共计8家公司，41个作业区，436个场站，26个管道，1497个测点。

|层级 | 定位  | 职能  | 规模逻辑 |  
|:-|:-|:-|:-|
公司层级（8个）​​|最高管理单元，负责跨区域资源协调、标准制定及战略决策。|统筹全局性运维策略、预算分配、跨作业区应急预案联动。|8家公司可能对应不同行政区划或运营主体（如省级分管公司）。|  
|​作业区（41个）|区域运维中心，覆盖一定地理范围的管网集群。|执行公司指令，管理下属场站；监督管道巡检、设备维护及数据汇总。<br>示例：按《管道灾害防控规定》，作业区需建立水工保护档案，汛期每周全面巡检1次。|平均每公司管辖5\~6个作业区，体现分级管理效率。|  
|​场站（436个）|管网关键节点（如泵站、调压站、处理厂），承担工艺控制与数据采集。| - 实时监控设备状态（如泵机、阀门）并执行远程控制；<br>- 汇聚所属管道测点数据，边缘计算预处理后上传；<br>- 安全核心：部署独立安全仪表系统（SIS）防范泄漏爆炸风险。|平均每作业区管理10\~11个场站，符合区域设施密度分布。|  
|​管道（26条）|连接场站的输送干线/支线，物理管网载体。| - 传输水、气、热等介质，需结构安全监测（如腐蚀、地质灾害）；<br>- 承载测点部署，实现全线状态可视化。|26条主干管道由436个场站分段管控，单管道可能跨越多作业区。|  
|​测点（1497个）|管网"神经末梢"，部署于管道或场站关键位置。|实时采集数据并上传，包括：<br>- 感知层参数：压力、流量、温度、泄漏（如声波传感器）；<br>- 环境参数：地质位移、土壤湿度（防范滑坡、渗漏）；<br>- 安全参数：可燃气体浓度（联动报警系统）。|-|

进入 SQL Shell 模式：

```bash {{exec}}
./kwbase sql --insecure --host=127.0.0.1
```

**场景一：** 查询每个站点采集类型为1且采集数值高于50的且采集条目多余3条的数据均值和条目数

```sql {{exec}}
SELECT si.station_name,
       COUNT(t.measure_value),
       AVG(t.measure_value)
FROM pipec_r.station_info si,              
     pipec_r.workarea_info wi,             
     db_pipec.t_point t                    
WHERE wi.work_area_sn = si.work_area_sn    
  AND si.station_sn = t.station_sn         
  AND t.measure_type = 1                   
  AND t.measure_value > 50                 
GROUP BY si.station_name
HAVING COUNT(t.measure_value) > 3
ORDER BY si.station_name;
```

**场景二：** 按照10s一个时间窗口查询某三个区域内每个站点的某条管线在23年8月1日之后的每种采集类型数值的均值、最大最小值、条目数

```sql {{exec}}
SELECT wi.work_area_name,
       si.station_name,
       t.measure_type,
       time_bucket(t.k_timestamp, '10s') AS timebucket,
       AVG(t.measure_value) AS avg_value,
       MAX(t.measure_value) AS max_value,
       MIN(t.measure_value) AS min_value,
       COUNT(t.measure_value) AS number_of_value
FROM pipec_r.station_info si,
     pipec_r.workarea_info wi,
     pipec_r.pipeline_info li,
     pipec_r.point_info pi,
     db_pipec.t_point t
WHERE li.pipeline_sn = pi.pipeline_sn
  AND pi.station_sn = si.station_sn
  AND si.work_area_sn = wi.work_area_sn
  AND t.point_sn = pi.point_sn
  AND li.pipeline_name = 'Pipe_3'
  AND wi.work_area_name in ('Area_8', 'Area_Z', 'Area_f')
  AND t.k_timestamp >= '2023-08-01 01:00:00'
GROUP BY wi.work_area_name,
         si.station_name,
         t.measure_type,
         timebucket;
```

**场景三：** 按照1h一个时间窗口查询每个区域中每条管线自23年1月4日14点31分起七年内的条目数、累计值、均值

```sql {{exec}}
	SELECT
    time_bucket(t.k_timestamp, '1h') AS timebucket,
    s.work_area_sn,
    w.work_area_name,
    pinfo.pipeline_name,
    COUNT(t.k_timestamp) AS measurement_count,
    SUM(t.measure_value) AS total_measure_value,
    AVG(t.measure_value) AS avg_measure_value
FROM
    db_pipec.t_point t,        -- 45M
    pipec_r.station_info s,    -- 436
    pipec_r.workarea_info w,   -- 41
    pipec_r.pipeline_info pinfo  -- 26
WHERE
    t.work_area_sn = s.work_area_sn    -- 41, 41
    AND t.pipeline_sn = pinfo.pipeline_sn    -- 21, 41
    AND s.work_area_sn = w.work_area_sn    -- 41, 41
    AND t.k_timestamp BETWEEN '2023-01-04 14:31:00' AND '2030-01-04 14:31:00'    -- 2M/45M
GROUP BY
    timebucket, s.work_area_sn, w.work_area_name, pinfo.pipeline_name
ORDER BY
    timebucket, s.work_area_sn
LIMIT 100;
```

**场景四：** 按照5s一个时间窗口查询某个区域中每个站点内某条管线的每一种采集类型的数据均值

```sql {{exec}}
SELECT wi.work_area_name,
       si.station_name,
       t.measure_type,
       time_bucket(t.k_timestamp, '5s') as timebucket,
       avg(t.measure_value)
FROM pipec_r.point_info pi,           -- 41
     pipec_r.pipeline_info li,        -- 41
     pipec_r.workarea_info wi,        -- 41
     pipec_r.station_info si,         -- 436
     db_pipec.t_point t               -- 45M
WHERE pi.pipeline_sn = li.pipeline_sn
  AND pi.station_sn = si.station_sn
  AND si.work_area_sn = wi.work_area_sn -- 41, 41
  AND pi.point_sn = t.point_sn      -- 436, 401
  AND li.pipeline_name = 'Pipe_t'    -- 1/26
  AND wi.work_area_name = 'Area_f' -- 1/41
GROUP BY wi.work_area_name, si.station_name, t.measure_type, timebucket
LIMIT 100;
```