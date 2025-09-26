## 步骤 3：执行安装与启动

在这一步中，我们将执行单节点部署的安装命令，设置初始密码，并启动 KWDB 服务。请仔细按照以下指引操作。

1.  **执行单节点安装命令**

    在 `kwdb_install` 目录下，执行以下命令以单节点模式安装 KWDB。

    `./deploy.sh install --single`{{exec}}

2.  **设置初始密码**

    安装脚本会提示您设置初始密码。请输入一个安全的密码并牢记它。

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

4.  **启动 KWDB 节点**

    现在，我们可以启动 KWDB 节点了。

    `./deploy.sh start`{{exec}}

    启动成功后，您会看到以下确认信息：

    ```log
    START COMPLETED: KaiwuDB has started successfuly.
    ```

5.  **检查节点状态**

    最后，让我们来检查一下 KaiwuDB 节点的状态，确保一切正常。

    `./deploy.sh status`{{exec}}

    如果一切顺利，您将看到节点的运行状态信息。

6. **（可选）配置开机自启动**

    为了确保 KWDB 节点在系统启动时自动运行，我们需要将其配置为开机自启动服务。

    `systemctl enable kaiwudb`{{exec}}

7. **（可选）创建数据库用户**

    执行 `./add_user.sh`{{exec}} 脚本创建数据库用户。如果跳过该步骤，系统将默认使用部署数据库时使用的用户，且无需密码访问数据库。

    执行成功后，您将看到以下确认信息：

    ```log
    [ADD USER COMPLETED]:User creation completed.
    ```

---

完成这些步骤后，您的 KWDB 单节点实例就已经成功安装并运行了。在最后一个步骤中，我们将连接到数据库并进行简单的交互。
