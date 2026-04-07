## 步骤 1：启动 KWDB 并验证指标接口

在监控系统接入前，需要先确保 KWDB 已启动，并能正常暴露监控指标接口。

1. **进入 KWDB 工作目录**

`cd /kaiwudb/bin`{{exec}}

2. **启动单节点 KWDB**

```bash {{exec}}
./kwbase start-single-node --insecure --listen-addr=0.0.0.0:26257 --http-addr=0.0.0.0:8080 --store=/var/lib/kaiwudb --background > kwbase.log 2>&1
```

3. **检查节点状态**

`./kwbase node status --insecure --host=127.0.0.1`{{exec}}

4. **验证监控指标接口**

`curl -s http://127.0.0.1:8080/_status/vars | head -n 20`{{exec}}

如果能够看到 Prometheus 文本格式的指标内容，说明 KWDB 指标端点可用。

下一步我们将部署 Prometheus，并让它持续采集这些指标。
