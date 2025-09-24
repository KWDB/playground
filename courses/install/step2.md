## 修改配置文件

切换到安装目录：
`cd kwdb_install`{{exec}}

修改 `deploy.cfg` 文件：
`vim deploy.cfg`{{exec}}

注释掉 `[cluster]` 部分，并输入 `:wq` 保存文件：

```ini
[global]
secure_mode=tls
management_user=kaiwudb
rest_port=8080
kaiwudb_port=26257
# brpc_port=27257
data_root=/var/lib/kaiwudb
cpu=1
encrypto_store=true

[local]
node_addr=your-host-ip

# [cluster]
# node_addr=your-host-ip, your-host-ip
# ssh_port=22
# ssh_user=admin
```

为 `deploy.sh` 添加可执行权限：
`chmod +x deploy.sh`{{exec}}

## 详细说明

### 配置文件解释

配置文件 `deploy.cfg` 包含了 KaiwuDB 数据库的重要配置参数：

#### [global] 部分
- `secure_mode=tls`: 启用 TLS 安全模式
- `management_user=kaiwudb`: 设置管理用户名
- `rest_port=8080`: REST API 端口
- `kaiwudb_port=26257`: 数据库主端口
- `data_root=/var/lib/kaiwudb`: 数据存储根目录
- `cpu=1`: CPU 核心数限制
- `encrypto_store=true`: 启用存储加密

#### [local] 部分
- `node_addr=your-host-ip`: 本地节点地址，需要替换为实际的主机IP

#### [cluster] 部分（已注释）
集群模式配置，在单机部署时需要注释掉：
- `node_addr`: 集群节点地址列表
- `ssh_port=22`: SSH 连接端口
- `ssh_user=admin`: SSH 用户名

### 安全注意事项

1. **IP 地址配置**：确保将 `your-host-ip` 替换为实际的主机IP地址
2. **端口开放**：确保防火墙允许相关端口的访问
3. **用户权限**：确保运行用户有足够的权限访问数据目录
4. **TLS 证书**：在生产环境中配置有效的 TLS 证书

### 常见问题

**Q: 如何查看本机IP地址？**
A: 可以使用以下命令：
```bash
ip addr show
# 或者
hostname -I
```

**Q: 端口被占用怎么办？**
A: 检查端口占用情况：
```bash
netstat -tlnp | grep :8080
netstat -tlnp | grep :26257
```

**Q: 权限不足怎么办？**
A: 确保用户有权限访问数据目录：
```bash
sudo chown -R $USER:$USER /var/lib/kaiwudb
sudo chmod -R 755 /var/lib/kaiwudb
```

### 下一步

完成配置文件修改后，我们将在下一步中启动 KaiwuDB 服务并验证安装是否成功。