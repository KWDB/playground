FROM kwdb/kwdb:3.1.0

ARG PROM_VERSION=2.53.0
ARG GRAFANA_VERSION=11.1.0

RUN apt-get -o Acquire::Retries=5 update && apt-get install -y --no-install-recommends \
    ca-certificates \
    curl \
    wget \
    tar \
    && rm -rf /var/lib/apt/lists/*

RUN set -eux; \
    ARCH="$(dpkg --print-architecture)"; \
    case "${ARCH}" in \
      amd64) ARCH_SUFFIX="amd64" ;; \
      arm64) ARCH_SUFFIX="arm64" ;; \
      *) echo "unsupported arch: ${ARCH}" && exit 1 ;; \
    esac; \
    cd /tmp; \
    wget -q "https://github.com/prometheus/prometheus/releases/download/v${PROM_VERSION}/prometheus-${PROM_VERSION}.linux-${ARCH_SUFFIX}.tar.gz"; \
    tar -zxf "prometheus-${PROM_VERSION}.linux-${ARCH_SUFFIX}.tar.gz"; \
    mv "prometheus-${PROM_VERSION}.linux-${ARCH_SUFFIX}" /opt/prometheus; \
    ln -sf /opt/prometheus/prometheus /usr/local/bin/prometheus; \
    ln -sf /opt/prometheus/promtool /usr/local/bin/promtool; \
    rm -f "prometheus-${PROM_VERSION}.linux-${ARCH_SUFFIX}.tar.gz"; \
    wget -q "https://dl.grafana.com/enterprise/release/grafana-enterprise-${GRAFANA_VERSION}.linux-${ARCH_SUFFIX}.tar.gz"; \
    tar -zxf "grafana-enterprise-${GRAFANA_VERSION}.linux-${ARCH_SUFFIX}.tar.gz"; \
    mv "grafana-v${GRAFANA_VERSION}" /opt/grafana; \
    ln -sf /opt/grafana/bin/grafana-server /usr/local/bin/grafana-server; \
    ln -sf /opt/grafana/bin/grafana /usr/local/bin/grafana; \
    rm -f "grafana-enterprise-${GRAFANA_VERSION}.linux-${ARCH_SUFFIX}.tar.gz"

RUN mkdir -p /opt/grafana/dashboards/kaiwudb
COPY grafana-dashboards/*.json /opt/grafana/dashboards/kaiwudb/
RUN find /opt/grafana/dashboards/kaiwudb -type f -name "*.json" -exec sed -i 's/\${DS_PROMETHEUS}/prometheus/g' {} +
COPY provisioning/dashboards/*.yaml /opt/grafana/conf/provisioning/dashboards/
COPY provisioning/datasources/*.yaml /opt/grafana/conf/provisioning/datasources/
