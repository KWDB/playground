## 步骤 4：启动 KWDB 节点

在这一步中，我们将启动 KWDB 节点并连接到数据库。

1.  **进入 kwabase 目录**

    切换至程序目录： `cd /usr/local/kaiwudb/bin`{{exec}}

2.  **（可选）创建证书**

    > 如果采用非安全模式体验，请跳过这一步。

    创建证书存放目录：`mkdir -p certs`{{exec}}

    创建数据库证书颁发机构及密钥：`./kwbase cert create-ca --certs-dir=certs --ca-key=certs/ca.key`{{exec}}

    创建 root 用户或安装数据库用户的客户端证书及密钥：`./kwbase cert create-client root --certs-dir=certs --ca-key=certs/ca.key`{{exec}}

    创建节点服务器证书及密钥：`./kwbase cert create-node 127.0.0.1 localhost 0.0.0.0 --certs-dir=certs --ca-key=certs/ca.key`{{exec}}

3.  **启动数据库**

    非安全模式：

    ```bash {{exec}}
    ./kwbase start-single-node --insecure \
    --listen-addr=0.0.0.0:26257 \
    --http-addr=0.0.0.0:8080 \
    --store=/var/lib/kaiwudb \
    --background
    ```

    安全模式：

    ```bash {{exec}}
    ./kwbase start-single-node \
    --certs-dir=/usr/local/kaiwudb/bin/certs \
    --listen-addr=0.0.0.0:26257 \
    --http-addr=0.0.0.0:8080 \
    --store=/var/lib/kaiwudb \
    --background
    ```

    （可选）为了确保 KWDB 节点在系统启动时自动运行，我们需要将其配置为开机自启动服务。

    `systemctl enable kaiwudb`{{exec}}

<!-- 4.  **启动 KWDB 节点**

    现在，我们可以启动 KWDB 节点了。

    `./deploy.sh start`{{exec}}

    启动成功后，您会看到以下确认信息：

    ```log
    START COMPLETED: KaiwuDB has started successfuly.
    ``` -->

4.  **检查节点状态**

    非安全模式：

    `./kwbase node status --insecure --host=127.0.0.1`{{exec}}

    安全模式：

    `./kwbase node status --certs-dir=certs --host=127.0.0.1`{{exec}}

    如果一切顺利，您将看到节点的运行状态信息。

5.  **连接到数据库**

    非安全模式（不带密码）连接到数据库： `./kwbase sql --insecure --host=127.0.0.1`{{exec}}

    安全模式（带密码）连接到数据库： `./kwbase sql --certs-dir=certs --host=127.0.0.1`{{exec}}

完成这些步骤后，您的 KWDB 单节点实例就已经成功安装并运行了。在最后一个步骤中，我们将连接到数据库并进行简单的交互。
