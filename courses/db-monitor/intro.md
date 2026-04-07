## 欢迎来到 KWDB 课程

本课程将带您完成一套可运行的 KWDB 监控链路：使用 Prometheus 采集监控指标，并通过 Grafana 完成可视化展示。

课程内容基于 KWDB 官方“部署监控”实践，重点覆盖以下动作：

- 启动 KWDB 并验证监控指标接口 `/_status/vars`
- 使用已挂载配置启动 Prometheus 并检查抓取状态
- 启动 Grafana 并添加 Prometheus 数据源
- 导入 KWDB 官方监控面板模板

当前课程镜像已预装 `curl`、`wget`、`Prometheus` 与 `Grafana`，监控配置文件已挂载到 `/kaiwudb/monitoring`。

在开始之前，请点击页面右上角的 `启动容器` 按钮，我们将为您准备隔离实验环境。

**准备就绪后，进入下一步开始部署。**
