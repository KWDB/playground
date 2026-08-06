## 步骤 1：下载并解压安装包

在这一步，我们将完成 KWDB 安装前的准备工作，包括更新系统、安装依赖以及下载并解压最新的安装包。

1.  **更新软件包列表**

    首先，我们来更新一下系统的软件包列表，确保我们能获取到最新的软件版本。

    `apt update`{{exec}}

2.  **安装依赖工具**

    接下来，安装 KWDB 运行所需的一些基础依赖。

    `apt install -y squashfs-tools libgflags2.2 libgomp1`{{exec}}

3.  **下载 KWDB 安装包**

    现在，我们官网下载最新的 KWDB 安装包。

    首先，获取系统架构（`x86_64`、`aarch64` 均为官网支持的架构名）：

    `ARCH=$(uname -m)`{{exec}}

    然后，拼接下载链接：

    `DOWNLOAD_URL="https://www.kaiwudb.com/api/download/direct-download/KWDB/v${KW_VERSION}/Linux/${ARCH}"`{{exec}}

    最后，下载安装包：

    `wget -O KWDB-${KW_VERSION}.run "${DOWNLOAD_URL}"`{{exec}}

至此，准备工作已完成。在下一步中，我们将开始正式安装。
