## 步骤 4：启动并验证 3.1.0

升级完成后，需要重新启动 KaiwuDB，并确认版本、服务状态和业务数据都正常。

1. **启动数据库服务**

   `systemctl start kaiwudb`{{exec}}

   `systemctl status kaiwudb`{{exec}}

2. **验证版本与数据**

   进入 SQL 模式：

   ```bash {{exec}}
    cd /bin && sudo -u kaiwudb ./kwbase sql --certs-dir=/etc/kaiwudb/certs --host=127.0.0.1:26257
   ```

   验证版本与数据：

   ```sql {{exec}}
   SELECT version();
   USE upgrade_demo;
   SELECT * FROM device_metric ORDER BY ts DESC;
   ```

   如果结果中可以看到 `3.1.0` 版本信息，并且仍能查询出第 2 步插入的两条数据，说明本次升级成功完成。

   退出 SQL 客户端： `\q`{{exec}}

3. **确认备份仍可用**

   `ls -lh /tmp/kaiwudb-data-backup-${OLD_KW_VERSION}.tar.gz`{{exec}}

至此，单机升级流程已经闭环：旧版本安装、升级前备份、执行升级、升级后验证全部完成。
