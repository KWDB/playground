## 启动 KWDB

在这一步，我们将启动 KWDB 并进入 SQL Shell。

1.  **进入 kwabase 目录**

切换至程序目录： `cd /kaiwudb/bin`{{exec}}

2.  **启动数据库**

启动 KWDB（非安全模式）：`./kwbase start-single-node --insecure --listen-addr=0.0.0.0:26257 --http-addr=0.0.0.0:8080 --store=/var/lib/kaiwudb --background`{{exec}}

3.  **检查节点状态**

检查节点状态：`./kwbase node status --insecure --host=127.0.0.1`{{exec}}

4.  **连接到数据库**

使用 `kwbase sql` 连接到数据库：`./kwbase sql --host=127.0.0.1 --insecure`{{exec}}

至此，准备工作已完成。在下一步中，我们将开始执行您的第一个查询。