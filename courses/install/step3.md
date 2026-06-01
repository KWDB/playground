## 步骤 3：连接&探索 KWDB

### 连接 KWDB

1.  **确认节点状态**

    - 在任一目录下使用 `systemctl` 命令: `systemctl status kaiwudb`{{exec}}
    - 在任一目录下使用便捷脚本（推荐）: `kw-status`{{exec}}

2.  **（可选）配置 KWDB 开机自启动。**

    配置 KWDB 开机自启动后，如果系统重启，则自动启动 KWDB。

     `systemctl enable kaiwudb`{{exec}}

3.  **连接到数据库**

    使用内置脚本：执行 `kw-sql`{{exec}} 使用 root 用户登录数据库

完成这些步骤后，您的 KWDB 单节点实例就已经成功安装并运行了。

### 探索 KWDB

您已成功在本地环境中安装并启动了 KWDB 单节点实例！

现在，您已经拥有了一个功能完备的分布式多模数据库。接下来，您可以开始探索 KWDB 的强大功能了。

1.  **创建您的第一个表**

    连接成功后，尝试创建一个表并插入一些数据吧！

    创建一个时序数据库：`CREATE TS DATABASE monitoring;`{{exec}}

    切换到时序数据库： `USE monitoring;`{{exec}}

    创建时序表：
    ```sql {{exec}}
    CREATE TABLE sensor_data (
        ts TIMESTAMP NOT NULL,            -- 时间戳（必须为第一列）
        temperature FLOAT,                -- 温度
        humidity FLOAT                    -- 湿度
    ) TAGS (
        device_id INT NOT NULL,           -- 设备ID（标签）
        sensor_type VARCHAR NOT NULL      -- 传感器类型（标签）
    ) PRIMARY TAGS(device_id);            -- 主标签
    ```

2.  **插入时序数据**

    ```sql {{exec}}
    -- 插入当前时间的传感器监控数据
    INSERT INTO sensor_data VALUES
        (NOW(), 25.5, 60.2, 101, 'temperature'),
        (NOW(), 26.1, 58.7, 102, 'temperature'),
        (NOW(), 24.8, 62.1, 103, 'temperature');
    ```

3.  **查询时序数据**

    ```sql {{exec}}
    -- 查询最新的5条传感器数据，按时间倒序排列
    SELECT * FROM sensor_data 
    ORDER BY ts DESC 
    LIMIT 5;
    ```

4. 退出 SQL 终端

    测试完成后，可以输入 `\q`{{exec}} 退出 SQL 终端。
