## 技术特点

KWDB的跨模查询主要包含以下三项技术：

1. 跨模统计信息和代价估算融合技术：融合了多模的数据统计信息模型和代价估算策略，并以此为基础优化了跨模执行计划的规划和剪枝的逻辑，从而在遇到包括连接、聚合、排序、过滤、嵌套等非常复杂的业务查询的时候也能确保获得较优的执行计划。
2. 跨模聚合下推技术：针对跨模计算中包含聚合计算的情况，本项目不仅实现了将常见且理论体系比较成熟的基于关系代数理论的聚合计算下推到时序引擎的优化技术，并且针对时序引擎中数据往往具有静态标签的特性，实现了时序引擎中聚合算子自适应降维和降维算子的自动调用。
3. 高速跨模连接算子技术：针对传统数据库系统在跨引擎计算时处理跨模数据连接计算存在的性能问题，KWDB探索并实现了高速跨模连接算子的技术，此项技术通过在引擎融合、算子对接、内存管理、连接策略等方面一系列优化，实现了跨模连接计算效率提升几十倍甚至上百倍。

下图示例展示的是时序数据跟关系数据的跨模查询计划，同时标识了我们应用的三种跨模查询的技术，首先基于跨模统计信息和代价估算融合技术来可以调整时序算子和关系算子的最优连接顺序，同时评估查询是否可以应用跨模聚合下推技术和高速跨模连接算子技术。图中 BatchLookJoin 就是 KWDB 创新研发的高速跨模连接算子，可以进行高速连接计算，而跨模聚合下推会将聚合操作中关于时序部分的聚合操作推到前面提前聚合，大量裁剪传输的数据量。

![architecture diagram](/assets/multi-mode.png)  

## 生成数据

**启动数据库**

启动 KWDB（非安全模式）：
```bash {{exec}}
./kwbase start-single-node --insecure --listen-addr=0.0.0.0:26257 --http-addr=0.0.0.0:8080 --store=./kwbase-data --background
```

可以指定数据存储路径，如 `bash generate_data.sh ./kwbase-data12`，该路径需要与启动命令中的 `--store` 的保持一致，如果不指定的话，默认是 `./kwbase-data`

```bash {{exec}}
./generate_data.sh
```

创建数据库、时序表、关系表，并将数据导入表中

```bash {{exec}}
./kwbase sql --insecure --host=127.0.0.1 < create_load.sql
```

（到此本页所有的操作均已完成，想查看场景示例请直接点击`下一页`查看）

### 导入数据说明

生成数据的脚本可以并行生成数据，也可以串行，并行模式要求环境安装 GUN paraller, 如：Linux 的 Ubuntu 环境使用 `sudo apt install parallel` 命令安装。

数据生成脚本会在数据库数据目录下生成 extern 文件，然后在 extern 目录下生成一张时序表以及四张关系表的数据，脚本内写死每张表的数据行数，如果希望更大数据量，可以改脚本内的数值即可，数据量大时建议并行生成模式。

最终生成5个 csv 文件，目录如：`kwbase-data/extern/*.csv`

**导入时序数据**

```sql
import into db_monitor.t_monitor_point CSV DATA ("nodelocal://1/t_monitor_point");
```

**导入关系数据**

```sql
import into monitor_r.site_info CSV DATA ("nodelocal://1/site_info/site_info.csv");
import into monitor_r.region_info CSV DATA ("nodelocal://1/region_info/region_info.csv");
import into monitor_r.pipeline_info CSV DATA ("nodelocal://1/pipeline_info/pipeline_info.csv");
import into monitor_r.point_base_info CSV DATA ("nodelocal://1/point_base_info/point_base_info.csv");
import into monitor_r.operation_branch CSV DATA ("nodelocal://1/operation_branch/operation_branch.csv");
```

## 表结构设计

* 时序表结构

  ```sql
  // 测点数据表，可以是某些采集传感器，采集温度、电压、电流等实时数据
  CREATE TABLE db_monitor.t_monitor_point (
  k_collect_time timestamp NOT NULL,  
  monitor_value double               
  ) ATTRIBUTES (
    point_id varchar(64) NOT NULL,   
    branch_id varchar(32),           
    region_id varchar(16),           
    site_id varchar(16),             
    pipeline_id varchar(16) not null,
    monitor_type smallint,             
    monitor_position varchar(64)       
  )
  PRIMARY TAGS(point_id)             
  ACTIVETIME 3h;
  ```

* 关系表结构

  ```sql
  // 业务实体表
  CREATE TABLE monitor_r.operation_branch (
    branch_id varchar(32) PRIMARY KEY, 
    branch_name varchar(50),            
    business_scope varchar(128)         
  );

  // 场站信息表，记录站点的静态信息，记录站点SN码、站点名、属于哪个区域、属于哪家公司等
  CREATE TABLE monitor_r.site_info (
    site_id varchar(16) PRIMARY KEY,  
    site_name varchar(80),               
    region_id varchar(16),             
    branch_id varchar(32),             
    site_address varchar(64),            
    site_desc varchar(128)              
  );

  // 工作区域信息表，记录地区的静态信息
  CREATE TABLE monitor_r.region_info (
    region_id varchar(16) PRIMARY KEY, 
    region_name varchar(80),             
    region_address varchar(64),          
    region_desc varchar(128)            
  );

  // 管线表信息表，记录管线的静态信息，记录管线SN码、管线名
  CREATE TABLE monitor_r.pipeline_info (
    pipeline_id varchar(16) PRIMARY KEY,
    pipeline_name varchar(60),            
    pipe_start_point varchar(80),         
    pipe_end_point varchar(80),           
    pipe_spec varchar(30)                 
  );

  // 测点信息表，记录测点的静态信息，记录测点SN码、属于哪条管线、属于哪个站点等
  CREATE TABLE monitor_r.point_base_info (
    point_id varchar(64) PRIMARY KEY, 
    signal_id varchar(120),            
    signal_desc varchar(200),           
    signal_type varchar(50),            
    site_id varchar(16),               
    pipeline_id varchar(16)            
  );
  ```