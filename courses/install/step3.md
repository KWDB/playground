## 步骤 3：安装 KWDB

在这一步中，我们将执行单节点部署的安装命令，设置初始密码，并启动 KWDB 服务。请仔细按照以下指引操作。

1.  **执行单节点安装命令**

    在 `kwdb_install` 目录下，执行以下命令以单节点模式安装 KWDB。

    `./deploy.sh install --single`{{exec}}

2.  **设置初始密码**

    安装脚本会提示您为创建的系统用户设置密码。请输入一个安全的密码并牢记它。

    ```text
    Please input kaiwudb's password:  
    ```

    安装成功后，您将看到以下确认信息：

    ```log
    INSTALL COMPLETED: KaiwuDB has been installed successfuly! ...
    ```

3.  **重新加载 `systemd` 配置**

    为了让系统识别新安装的 KWDB 服务，需要重新加载 `systemd` 的守护进程配置文件。

    `systemctl daemon-reload`{{exec}}

完成这些步骤后，您的 KWDB 单节点实例就已经成功安装了。我们就可以在下一步中启动并测试 KWDB 了。
