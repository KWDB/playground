## 步骤 2：修改配置文件

在这一步中，我们将修改 KWDB 的部署配置文件，为单节点安装做好准备。同时，我们还会为您详细解读配置文件中的重要参数，并提供一些常见问题的解决方案。

1.  **切换到安装目录**

    首先，请切换到我们上一步解压出来的 `kwdb_install` 目录。

    `cd kwdb_install`{{exec}}

2.  **修改 `deploy.cfg` 文件**

    使用 `vim` 编辑器打开 `deploy.cfg` 配置文件。在这个文件中，我们需要注释掉集群相关的配置。

    `vim deploy.cfg`{{exec}}

    在 `vim` 编辑器中，请将 `[cluster]` 部分的配置注释掉，然后输入 `:wq`{{exec}} 保存并退出。

    ```ini
    [global]
    secure_mode=tls
    management_user=kaiwudb
    rest_port=8080
    kaiwudb_port=26257
    # brpc_port=27257
    data_root=/var/lib/kaiwudb
    cpu=1
    encrypto_store=true

    [local]
    node_addr=your-host-ip

    # [cluster]
    # node_addr=your-host-ip, your-host-ip
    # ssh_port=22
    # ssh_user=admin
    ```

3.  **为部署脚本添加可执行权限**

    为了能够顺利执行部署脚本，我们需要为 `deploy.sh` 文件添加可执行权限。

    `chmod +x deploy.sh`{{exec}}

---

### 附录：详细说明

#### 配置文件 (`deploy.cfg`) 解析

`deploy.cfg` 文件是 KaiwuDB 部署的核心，它定义了数据库的各项关键参数。

-   **`[global]` 部分**：全局配置
    -   `secure_mode=tls`: 启用 TLS 安全模式，保障数据传输安全。
    -   `management_user=kaiwudb`: 指定数据库的管理用户名。
    -   `rest_port=8080`: REST API 服务的端口。
    -   `kaiwudb_port=26257`: KaiwuDB 数据库的主服务端口。
    -   `data_root=/var/lib/kaiwudb`: 数据文件的存储根目录。
    -   `cpu=1`: 限制数据库使用的 CPU 核心数。
    -   `encrypto_store=true`: 启用静态数据加密，保护存储在磁盘上的数据。

-   **`[local]` 部分**：本地节点配置
    -   `node_addr=your-host-ip`: 本地节点的 IP 地址。**请务必将其替换为您的实际主机 IP**。

-   **`[cluster]` 部分** (已注释)
    -   这部分用于配置集群模式。在单节点部署中，我们需要将其注释掉。

完成以上配置后，我们就可以在下一步中正式开始安装 KWDB 了。
