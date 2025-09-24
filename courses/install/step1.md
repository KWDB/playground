## 下载安装包

更新软件包：
`apt update`{{exec}}

安装工具和依赖：
`apt install -y wget vim sudo libprotobuf17 squashfs-tools systemctl systemd-container`{{exec}}

下载最新的 KWDB 安装包：
`wget https://github.com/KWDB/KWDB/releases/download/V2.2.2/KWDB-2.2.2-ubuntu20.04-aarch64-debs.tar.gz`{{exec}}

解压安装包：
`tar -xzvf KWDB-2.2.2-ubuntu20.04-aarch64-debs.tar.gz`{{exec}}

接下来您就可以安装依赖并修改配置文件了。