## 步骤 1：安装 3.0.0 单机实例

升级课程需要一个已经运行的旧版本节点，因此我们先在当前环境中安装并启动 `3.0.0`。

1. **更新软件包并安装依赖**

   `apt update`{{exec}}

   `apt install -y libprotobuf17 squashfs-tools libgflags2.2`{{exec}}

2. **下载并解压 3.0.0 安装包**

   `wget https://github.com/KWDB/KWDB/releases/download/V${OLD_KW_VERSION}/KWDB-${OLD_KW_VERSION}-ubuntu20.04-$(arch)-debs.tar.gz`{{exec}}

   > 如果当前网络环境无法访问 GitHub，可以改用 Gitee 镜像：
   > `wget https://gitee.com/kwdb/kwdb/releases/download/V${OLD_KW_VERSION}/KWDB-${OLD_KW_VERSION}-ubuntu20.04-$(arch)-debs.tar.gz`{{exec}}

   `tar -xzvf KWDB-${OLD_KW_VERSION}-ubuntu20.04-$(arch)-debs.tar.gz`{{exec}}

   `mv kwdb_install kwdb_install_${OLD_KW_VERSION}`{{exec}}

3. **修改部署配置并安装单机版本**

   进入旧版本安装目录：

   `cd kwdb_install_${OLD_KW_VERSION}`{{exec}}

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

4. **启动 3.0.0 服务**

   `systemctl daemon-reload`{{exec}}

   `systemctl start kaiwudb`{{exec}}

   `systemctl status kaiwudb`{{exec}}

当状态显示为 `active (running)` 时，说明旧版本节点已经准备完成，可以进入升级前检查阶段。
