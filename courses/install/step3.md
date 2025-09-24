## 安装

执行单机部署安装命令：
`./deploy.sh install --single`{{exec}}

执行成功后，控制台输出以下信息：

```log
INSTALL COMPLETED: KaiwuDB has been installed successfuly! ...
```

根据系统提示重新加载 `systemd` 守护进程的配置文件：
`systemctl daemon-reload`{{exec}}

启动 KWDB 节点：
`./deploy.sh start`{{exec}}

执行成功后，控制台输出以下信息：

```log
START COMPLETED: KaiwuDB has started successfuly.
```

查看 KWDB 阶段状态：
`./deploy.sh status`{{exec}}
