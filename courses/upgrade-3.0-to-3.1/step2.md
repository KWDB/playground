## 步骤 2：升级前检查与备份

官方升级流程要求在升级前停止服务并备份用户数据目录。为了在升级后更容易验证结果，我们先准备一份测试数据。

1. **写入一份升级验证数据**

    进入 SQL 模式：

    ```bash {{exec}}
    cd /bin && sudo -u kaiwudb ./kwbase sql --certs-dir=/etc/kaiwudb/certs --host=127.0.0.1:26257
    ```

    写入验证数据：

    ```sql {{exec}}
    CREATE TS DATABASE upgrade_demo;
    USE upgrade_demo;
    CREATE TABLE device_metric (
        ts TIMESTAMP NOT NULL,
        temperature FLOAT,
        humidity FLOAT
    ) TAGS (
        device_id INT NOT NULL,
        site VARCHAR NOT NULL
    ) PRIMARY TAGS(device_id);
    INSERT INTO device_metric VALUES
        (NOW(), 25.6, 41.2, 1001, 'workshop-a'),
        (NOW(), 26.1, 39.8, 1002, 'workshop-b');
    SELECT COUNT(*) FROM device_metric;
    ```

   查询结果返回 `2`，表示验证数据已成功写入。

   退出 SQL 客户端： `\q`{{exec}}

2. **备份数据目录**

   `tar -czvf /tmp/kaiwudb-data-backup-${OLD_KW_VERSION}.tar.gz /var/lib/kaiwudb`{{exec}}

   备份文件会保存在 `/tmp/kaiwudb-data-backup-${OLD_KW_VERSION}.tar.gz`，如果升级失败或后续需要回退，这份备份会非常重要。

3. **停止 KaiwuDB 服务**

   `systemctl stop kaiwudb`{{exec}}

   `systemctl status kaiwudb`{{exec}}

升级前请确认服务已经停止。如果此时仍显示运行中，请先排查占用情况，再继续执行升级命令。
