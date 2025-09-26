## 步骤 1：下载并解压安装包

在这一步，我们将完成 KWDB 安装前的准备工作，包括更新系统、安装依赖以及下载并解压最新的安装包。

1.  **更新软件包列表**

    首先，我们来更新一下系统的软件包列表，确保我们能获取到最新的软件版本。

    `apt update`{{exec}}

2.  **安装依赖工具**

    接下来，安装 KWDB 运行所需的一些基础依赖。

    `apt install -y libprotobuf17 squashfs-tools`{{exec}}

3.  **下载 KWDB 安装包**

    现在，我们从官方仓库下载最新的 KWDB 安装包。

    `wget https://github.com/KWDB/KWDB/releases/download/V2.2.2/KWDB-2.2.2-ubuntu20.04-aarch64-debs.tar.gz`{{exec}}

4.  **解压安装包**

    下载完成后，解压刚刚下载的 `tar.gz` 文件。

    `tar -xzvf KWDB-2.2.2-ubuntu20.04-aarch64-debs.tar.gz`{{exec}}

至此，准备工作已完成。在下一步中，我们将开始修改配置文件，为正式安装做准备。