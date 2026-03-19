## 步骤 2：修改配置文件

在这一步中，我们将修改 KWDB 的部署配置文件，为单节点安装做好准备。同时，我们还会为您详细解读配置文件中的重要参数，并提供一些常见问题的解决方案。

1.  **切换到安装目录**

    首先，请切换到我们上一步解压出来的 `kwdb_install` 目录。

    `cd kwdb_install`{{exec}}

2.  **修改 `deploy.cfg` 文件**

    使用 `vim` 编辑器打开 `deploy.cfg` 配置文件。在这个文件中，我们需要注释掉集群相关的配置。

    `vim deploy.cfg`{{exec}}

    在 `vim` 编辑器中，请将 `[cluster]` 部分的配置注释掉，然后输入 `:wq` 保存并退出。

    ```ini
    [global]
    # Whether to turn on secure mode
    secure_mode=tls
    # Management KaiwuDB user
    management_user=kaiwudb
    # KaiwuDB cluster http port
    rest_port=8080
    # KaiwuDB service port
    kaiwudb_port=26257
    # KaiwuDB brpc port
    brpc_port=27257
    # KaiwuDB data directory
    data_root=/var/lib/kaiwudb
    # CPU usage[0-1]
    # cpu=1

    [local]
    # local node configuration
    node_addr=127.0.0.1

    # [cluster]
    # remote node addr,split by ','
    # node_addr=127.0.0.2
    # ssh info
    # ssh_port=22
    # ssh_user=admin

    # [additional]
    # IPs=127.0.0.3,127.0.0.4
    ```

3.  **为部署脚本添加可执行权限**

    为了能够顺利执行部署脚本，我们需要为 `deploy.sh` 文件添加可执行权限。

    `chmod +x deploy.sh`{{exec}}

---

### 附录：详细说明

#### 配置文件 (`deploy.cfg`) 解析

`deploy.cfg` 文件是 KaiwuDB 部署的核心，它定义了数据库的各项关键参数。

- `global`：全局配置
    - `secure_mode`：是否开启安全模式，支持以下两种取值：
    - `insecure`：使用非安全模式。
    - `tls`：（默认选项）开启 TLS 安全模式。开启安全模式后，KWDB 生成 TLS 证书，作为客户端或应用程序连接数据库的凭证。生成的客户端相关证书存放在 `/etc/kaiwudb/certs` 目录。
    - `management_user`：KWDB 的管理用户，默认为 `kaiwudb`。安装部署后，KWDB 创建相应的管理用户以及和管理用户同名的用户组。
    - `rest_port`：KWDB Web 服务端口，默认为 `8080`。
    - `kaiwudb_port`：KWDB 服务端口，默认为 `26257`。
    - `brpc_port`：KWDB 时序引擎间的 brpc 通信端口，用于节点间通信。单节点部署时系统会自动忽略该设置。
    - `data_root`：数据目录，默认为 `/var/lib/kaiwudb`。
    - `cpu`：可选参数，用于指定 KWDB 服务占用当前节点服务器 CPU 资源的比例，默认无限制。取值范围为 `[0,1]`，最大精度为小数点后两位。**注意**：如果部署环境为 Ubuntu 18.04 版本，部署集群后，需要将 `kaiwudb.service` 文件中的 `CPUQuota` 修改为整型值，例如，将 `180.0%` 修改为 `180%`，以确保设置生效。具体操作步骤，参见[配置 CPU 资源占用率](https://www.kaiwudb.com/template_version/pc/doc/oss_dev/deployment/cluster-config/cluster-config-bare-metal.html#%E9%85%8D%E7%BD%AE-cpu-%E8%B5%84%E6%BA%90%E5%8D%A0%E7%94%A8%E7%8E%87)。
- `local`：本地节点配置
    - `node_addr`：本地节点对外提供服务的 IP 地址，监听地址为 `0.0.0.0`，端口为 KWDB 服务端口。

完成以上配置后，我们就可以在下一步中正式开始安装 KWDB 了。