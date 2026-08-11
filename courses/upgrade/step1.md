## 步骤 1：安装 3.2.1 单机实例

升级课程需要一个已经运行的旧版本节点，因此我们先在当前环境中安装并启动 `3.2.1`。

1. **更新软件包并安装依赖**

   `apt update`{{exec}}

   `apt install -y squashfs-tools libgflags2.2 libgomp1 tzdata`{{exec}}

2. **下载并解压 3.2.1 安装包**

   `wget -O KWDB-${OLD_KW_VERSION}.run https://www.kaiwudb.com/api/download/direct-download/KWDB/v${OLD_KW_VERSION}/Linux/$(arch)`{{exec}}

3.  **赋予执行权限**

    为了能够顺利执行部署脚本，我们需要为 `KWDB-${OLD_KW_VERSION}.run` 文件添加可执行权限。

    `chmod +x KWDB-${OLD_KW_VERSION}.run`{{exec}}

4.  **启动向导程序**

    执行以下命令，以命令行模式启动向导程序：

    `./KWDB-${OLD_KW_VERSION}.run -c`{{exec}}

5.  **进入安装向导**

    安装程序启动后，进入主功能菜单，输入 `1` 选择升级节点:

    ```text
    1. 安装 KWDB
    2. 卸载 KWDB
    3. 安装 KWDB 并加入集群
    4. 升级节点
    5. 退出

    请输入操作 [1-5]:
    ```

6.  **修改配置**

    引导程序自动打开编辑器。根据实际环境修改各参数，保存并退出后，引导程序将自动开始升级。

    在 `vim` 编辑器中，请将 `user` 设置为 `root`{{copy}}，`passwd` 设置为 `root`{{copy}}，然后输入 `:wq` 保存并退出。

    >⚠️注意：这里为了测试方便，我们将系统用户名设置的比较简单，在生产环境中，请使用符合安全规范的用户名和密码。

7. **选择是否为所有用户安装 KWDB**：

    输入 `y` 为所有用户安装 KWDB，输入 `N` 仅为当前用户安装 KWDB。

    ```text
    是否为所有用户安装：(y/N)
    ```

8. **安装 KWDB**

    安装过程中终端会实时显示安装进度。出现错误时，可以通过查看安装目录 `log` 目录下的日志文件获取详细信息。

9. **启动数据库**

    完成安装后，根据提示选择是否立即启动数据库：

    ```text
    是否立即启动数据库：(y/N)
    ```

10. 退出引导程序

    成功后会返回主功能菜单，输入 `5` 退出部署流程。

11.  **确认节点状态**

   - 在任一目录下使用 `systemctl` 命令: `systemctl status kaiwudb`{{exec}}
   - 在任一目录下使用便捷脚本（推荐）: `kw-status`{{exec}}

当状态显示为 `active (running)` 时，说明旧版本节点已经准备完成，可以进入升级前检查阶段。
