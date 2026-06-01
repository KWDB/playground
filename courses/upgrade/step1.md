## 步骤 1：安装 3.1.0 单机实例

升级课程需要一个已经运行的旧版本节点，因此我们先在当前环境中安装并启动 `3.1.0`。

1. **更新软件包并安装依赖**

   `apt update`{{exec}}

   `apt install -y libprotobuf23 squashfs-tools libgflags2.2 libgomp1 tzdata`{{exec}}

2. **下载并解压 3.1.0 安装包**

   `wget https://kwdb.tech/download/KWDB-${OLD_KW_VERSION}-ubuntu22.04-$(arch)`{{exec}}

   `tar -xzvf KWDB-${OLD_KW_VERSION}-ubuntu22.04-$(arch)`{{exec}}

3. **修改部署配置并安装单机版本**

   进入旧版本安装目录：

   `cd kwdb_install`{{exec}}

   使用 `vim` 打开配置文件：

   `vim deploy.cfg`{{exec}}

   将 `[cluster]` 段落注释掉，保留 `local` 节点配置，示例如下：

   ```ini
   [global]
   secure_mode=tls
   management_user=kaiwudb
   rest_port=8080
   kaiwudb_port=26257
   brpc_port=27257
   data_root=/var/lib/kaiwudb

   [local]
   node_addr=127.0.0.1

   # [cluster]
   # node_addr=127.0.0.2
   # ssh_port=22
   # ssh_user=admin
   ```

   执行单机安装：

   `./deploy.sh install --single`{{exec}}

   安装过程中按照提示输入 `Y` 确认安装信息，并设置系统用户密码。

4. **启动 3.1.0 服务**

   `./deploy.sh start`{{exec}} 

   启动成功后，您会看到以下确认信息：

   ```log
   [START COMPLETED]:KaiwuDB start successfully.
   ```

5.  **确认节点状态**

   - 在当前目录使用部署脚本检查节点状态： `./deploy.sh status`{{exec}}
   - 在任一目录下使用 `systemctl` 命令: `systemctl status kaiwudb`{{exec}}
   - 在任一目录下使用便捷脚本（推荐）: `kw-status`{{exec}}

当状态显示为 `active (running)` 时，说明旧版本节点已经准备完成，可以进入升级前检查阶段。
