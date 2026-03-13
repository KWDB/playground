## 步骤 4：启动 KWDB 节点

在这一步中，我们将启动 KWDB 节点并连接到数据库。

1.  **启动 KWDB 节点**

    `./deploy.sh start`{{exec}} 

    启动成功后，您会看到以下确认信息：

    ```log
    [START COMPLETED]:KaiwuDB start successfully.
    ```

2.  **确认节点状态**

    - 在当前目录使用部署脚本检查节点状态： `./deploy.sh status`{{exec}}
    - 在任一目录下使用 `systemctl` 命令: `systemctl status kaiwudb`{{exec}}
    - 在任一目录下使用便捷脚本（推荐）: `kw-status`{{exec}}

3.  **（可选）配置 KWDB 开机自启动。**

    配置 KWDB 开机自启动后，如果系统重启，则自动启动 KWDB。

     `systemctl enable kaiwudb`{{exec}}

4.  **（可选）创建数据库用户**

    执行 `add_user.sh`{{exec}} 脚本创建数据库用户。如果跳过该步骤，系统将默认使用部署数据库时使用的用户，且无需密码访问数据库。

    ```text
    ./add_user.sh
    Please enter the username: 
    Please enter the password: 
    ```

    执行成功后，控制台输出以下信息：

    ```text
    [ADD USER COMPLETED]:User creation completed.
    ```

5.  **连接到数据库**

    使用内置脚本：执行 `kw-sql`{{exec}} 使用 root 用户登录数据库

完成这些步骤后，您的 KWDB 单节点实例就已经成功安装并运行了。在最后一个步骤中，我们将连接到数据库并进行简单的交互。
