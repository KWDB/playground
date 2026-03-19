## 步骤 3：部署 Grafana 并接入 Prometheus

> 本示例采用 Grafana v11.1.0 版本。

完成 Prometheus 后，我们继续启动镜像中预装的 Grafana。当前镜像已内置数据源与 Dashboard provisioning 配置，启动后会自动导入。

1. **启动 Grafana 服务**

`grafana-server --homepath=/opt/grafana --config=/opt/grafana/conf/defaults.ini > /tmp/grafana.log 2>&1 &`{{exec}}

2. **确认 Grafana 端口可访问**

`curl -I http://127.0.0.1:3000 | head -n 5`{{exec}}

3. **检查 provisioning 配置是否存在**

`ls -lah /opt/grafana/conf/provisioning/datasources && ls -lah /opt/grafana/conf/provisioning/dashboards`{{exec}}

4. **验证已自动注册的数据源与面板**

`curl -s -u admin:admin http://127.0.0.1:3000/api/datasources | head -n 40`{{exec}}

`curl -s -u admin:admin 'http://127.0.0.1:3000/api/search?query=KaiwuDB' | head -n 80`{{exec}}

5. **在浏览器中登录 Grafana**

- 默认地址：[http://localhost:{{LOCAL_PORT}}](http://localhost:{{LOCAL_PORT}})
- 默认账号：`admin`{{copy}}
- 默认密码：`admin`{{copy}}

6. **查看自动导入结果**

进入左侧 `Dashboards`，在 `KaiwuDB` 文件夹中可直接看到概览、硬件、运行时、SQL、存储、副本、分布式、队列、慢查询等面板。

Grafana 支持查看 KWDB 集群及各个节点的监控指标，包括指标概览、硬件指标、运行指标、SQL 指标、存储指标、副本指标、分布式指标、队列指标和慢查询指标。详细介绍请参考 [使用 Grafana 查看指标数据](https://www.kaiwudb.com/kaiwudb_docs/#/oss_dev/db-monitor/view-metrics-grafana.html)。

## 补充信息

默认情况下，KWDB 在 [monitoring/grafana-dashboards](https://gitee.com/kwdb/kwdb/tree/master/kwbase/monitoring/grafana-dashboards) 目录下提供以下指标模板。KWDB 各指标面板对应的文件名如下所示：

- 概览：[1.KaiwuDB_Console_Overview.json](https://gitee.com/kwdb/kwdb/blob/master/kwbase/monitoring/grafana-dashboards/1.KaiwuDB_Console_Overview.json)
- 硬件：[2.KaiwuDB_Console_Hardware.json](https://gitee.com/kwdb/kwdb/blob/master/kwbase/monitoring/grafana-dashboards/2.KaiwuDB_Console_Hardware.json)
- 运行时：[3.KaiwuDB_Console_Runtime.json](https://gitee.com/kwdb/kwdb/blob/master/kwbase/monitoring/grafana-dashboards/3.KaiwuDB_Console_Runtime.json)
- SQL：[4.KaiwuDB_Console_SQL.json](https://gitee.com/kwdb/kwdb/blob/master/kwbase/monitoring/grafana-dashboards/4.KaiwuDB_Console_SQL.json)
- 存储：[5.KaiwuDB_Console_Storage.json](https://gitee.com/kwdb/kwdb/blob/master/kwbase/monitoring/grafana-dashboards/5.KaiwuDB_Console_Storage.json)
- 副本：[6.KaiwuDB_Console_Replication.json](https://gitee.com/kwdb/kwdb/blob/master/kwbase/monitoring/grafana-dashboards/6.KaiwuDB_Console_Replication.json)
- 分布式：[7.KaiwuDB_Console_Distribution.json](https://gitee.com/kwdb/kwdb/blob/master/kwbase/monitoring/grafana-dashboards/7.KaiwuDB_Console_Distribution.json)
- 队列：[8.KaiwuDB_Console_Queue.json](https://gitee.com/kwdb/kwdb/blob/master/kwbase/monitoring/grafana-dashboards/8.KaiwuDB_Console_Queue.json)
- 慢查询：[9.KaiwuDB_Console_Slow_Query.json](https://gitee.com/kwdb/kwdb/blob/master/kwbase/monitoring/grafana-dashboards/9.KaiwuDB_Console_Slow_Query.json)
