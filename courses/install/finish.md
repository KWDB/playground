## 恭喜您，KWDB 安装完成！

🎉 您已成功在本地环境中安装并启动了 KWDB 单节点实例！

现在，您已经拥有了一个功能完备的分布式多模数据库。接下来，您可以开始探索 KWDB 的强大功能了。

### 接下来做什么？

1.  **连接到数据库**

    使用部署数据库时所用的用户连接 KWDB：

    切换至程序目录： `cd /usr/local/kaiwudb/bin`{{exec}}

    使用 `kwbase` 连接到数据库： `./kwbase sql --insecure --host=127.0.0.1`{{exec}}

2.  **创建您的第一个表**

    连接成功后，尝试创建一个表并插入一些数据吧！

    创建一个时序数据库：`CREATE TS DATABASE monitoring;`{{exec}}

    切换到时序数据库： `USE monitoring;`{{exec}}

    创建时序表：
    ```sql
    CREATE TABLE sensor_data (
        ts TIMESTAMP NOT NULL,            -- 时间戳（必须为第一列）
        temperature FLOAT,                -- 温度
        humidity FLOAT                    -- 湿度
    ) TAGS (
        device_id INT NOT NULL,           -- 设备ID（标签）
        sensor_type VARCHAR NOT NULL      -- 传感器类型（标签）
    ) PRIMARY TAGS(device_id);            -- 主标签
    ```
    {{exec}}

    插入时序数据：
    ```sql
    -- 插入当前时间的传感器监控数据
    INSERT INTO sensor_data VALUES
        (NOW(), 25.5, 60.2, 101, 'temperature'),
        (NOW(), 26.1, 58.7, 102, 'temperature'),
        (NOW(), 24.8, 62.1, 103, 'temperature');
    ```
    {{exec}}

    查询时序数据：
    ```sql
    -- 查询最新的5条传感器数据，按时间倒序排列
    SELECT * FROM sensor_data 
    ORDER BY ts DESC 
    LIMIT 5;
    ```
    {{exec}}

3.  **探索更多功能**

    - **跨模查询**：了解 KWDB 如何支持多种数据模型，包括关系、时序等。
    - **集群部署**：探索如何通过多节点部署实现数据冗余和故障转移。
    - **应用开发**：学习如何使用 KWDB 开发应用程序，包括数据写入、查询和分析。

### 获取帮助与资源

- **官方文档**：[https://www.kaiwudb.com/docs](https://www.kaiwudb.com/docs)
- **KWDB 开发站**：[https://kwdb.atomgit.net/dev/](https://kwdb.atomgit.net/dev/)
- **Gitee 仓库**：[https://gitee.com/kwdb/kwdb](https://gitee.com/kwdb/kwdb)
- **GitHub 仓库**：[https://github.com/kwdb/kwdb](https://github.com/kwdb/kwdb)

感谢您完成本课程！我们期待看到您使用 KWDB 构建出色的应用。
