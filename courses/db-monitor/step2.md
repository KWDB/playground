## 步骤 2：部署 Prometheus 采集指标

镜像已预装 Prometheus，本步骤直接使用已挂载在 `/kaiwudb/monitoring` 的配置与规则文件启动采集。

1. **检查监控配置挂载**

`ls -lah /kaiwudb/monitoring && ls -lah /kaiwudb/monitoring/rules`{{exec}}

2. **确认 Prometheus 配置内容**

`sed -n '1,160p' /kaiwudb/monitoring/prometheus.yml`{{exec}}

3. **启动 Prometheus**

`prometheus --config.file=/kaiwudb/monitoring/prometheus.yml --web.listen-address=:9090 > /tmp/prometheus.log 2>&1 &`{{exec}}

4. **检查 Prometheus 就绪状态**

`curl -s http://127.0.0.1:9090/-/ready`{{exec}}

5. **检查抓取目标状态**

`curl -s http://127.0.0.1:9090/api/v1/targets | head -n 60`{{exec}}

6. **验证 Prometheus 已采集数据**

`curl -s 'http://127.0.0.1:9090/api/v1/query?query=up' | head -n 40`{{exec}}

当 `targets` 中的 `kaiwudb` 目标状态为 `up` 时，Prometheus 采集链路即部署成功。

## 补充信息

配置文件示例:

```yaml
# Prometheus configuration for kaiwudb clusters.
# Requires prometheus 2.X
#
# Run with:
# $ prometheus -config.file=prometheus.yml
global:
  scrape_interval: 10s
  evaluation_interval: 10s

rule_files:
- "rules/alerts.rules.yml"
- "rules/aggregation.rules.yml"

scrape_configs:
  - job_name: 'kaiwudb'
    metrics_path: '/_status/vars'
    # Insecure mode:
    scheme: 'http'
    # Secure mode:
    # scheme: 'https'
    tls_config:
      insecure_skip_verify: true

    static_configs:
    - targets: ['localhost:8080', 'localhost:8081', 'localhost:8082']
      labels:
        cluster: 'my-kaiwudb-cluster'
```

配置参数说明：

- `global`：Prometheus Server 的全局配置。
    - `scrape_interval`：配置 Prometheus Server 采集数据的周期。
    - `evaluation_interval`：配置 Prometheus Server 评估规则的周期。Prometheus 使用规则创建新的时间序列并生成报警。
- `rule_files`：指定 Prometheus Server 加载的规则文件的路径。
- `scrape_configs`：数据采集的目标对象和参数。一般情况下，一个采集配置指定一个作业。可以通过 `static_configs` 参数配置静态目标，也可以使用支持的服务发现机制动态发现目标。
    - `job_name`：数据采集作业的名称。
    - `metrics_path`：从目标采集数据指标的 HTTP 资源路径。
    - `scheme`：用于请求的协议。
    - `tls_config`：数据采集请求的 TLS 设置。
    - `static_configs`：配置静态目标列表。

有关 Prometheus 所有配置项的详细信息，参见 [Prometheus 官方文档](https://prometheus.io/docs/prometheus/latest/configuration/configuration/)。