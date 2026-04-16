## 步骤 3：执行 3.1.0 本地升级

完成停机与备份后，就可以使用新版本安装包执行本地升级。

1. **下载并解压 3.1.0 安装包**

   `cd ~`{{exec}}

   `wget https://kwdb.tech/download/KWDB-${NEW_KW_VERSION}-ubuntu20.04-$(arch)`{{exec}}

   `tar -xzvf KWDB-${NEW_KW_VERSION}-ubuntu20.04-$(arch)`{{exec}}

   `mv kwdb_install kwdb_install_${NEW_KW_VERSION}`{{exec}}

2. **进入新版本目录并执行升级命令**

   `cd kwdb_install_${NEW_KW_VERSION}`{{exec}}

   `./deploy.sh upgrade -l`{{exec}}

   也可以使用长参数写法：

   `./deploy.sh upgrade --local`

3. **确认升级结果**

   升级成功后，控制台会输出如下提示：

   ```text
   UPGRADE COMPLETED: KaiwuDB has been upgraded successfully!
   ```

如果升级过程中发现节点未安装 KaiwuDB、KaiwuDB 服务仍在运行、版本不合法或部署方式不匹配，系统会中止升级并给出提示。请根据提示修复问题后重新执行。
