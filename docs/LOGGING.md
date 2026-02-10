# KWDB Playground 日志规范

> 本文档定义了 KWDB Playground 项目的日志规范，确保日志格式一致、可读性好、易于解析。

## 1. 日志级别

| 级别 | 说明 | 使用场景 |
|-----|------|---------|
| `DEBUG` | 调试信息 | 开发调试、详细流程追踪 |
| `INFO` | 一般信息 | 重要操作完成、状态变更 |
| `WARN` | 警告 | 可能的问题、异常但可恢复 |
| `ERROR` | 错误 | 操作失败、需要关注的问题 |

## 2. 日志格式

### 2.1 标准格式

```
[TIMESTAMP] [LEVEL] [MODULE] message key=value key=value
```

### 2.2 当前实现格式

```
[LEVEL] message
```

### 2.3 推荐格式示例

```
[2026-02-10T15:30:45+08:00] [INFO] [CourseService] 加载课程完成 count=5 duration=123ms
[2026-02-10T15:30:46+08:00] [DEBUG] [DockerController] 创建容器 image=kwdb:latest
[2026-02-10T15:30:47+08:00] [WARN] [DockerController] 镜像不存在 image=unknown:latest
[2026-02-10T15:30:48+08:00] [ERROR] [APIRoutes] 容器启动失败 container_id=abc123 error=context deadline exceeded
```

## 3. 日志消息规范

### 3.1 语言规范

- **推荐使用中文**：符合现有代码风格
- **错误消息使用中文**：便于用户理解
- **变量/标识符使用英文**：便于代码维护

### 3.2 消息模板

```go
// ✅ 推荐：清晰的中文消息
logger.Info("容器创建成功", "容器ID", containerID, "镜像", image)

// ✅ 推荐：包含上下文信息
logger.Debug("开始处理请求", "路径", path, "方法", method)

// ✅ 推荐：错误消息使用中文
logger.Error("容器启动失败", "错误", err.Error())

// ❌ 避免：混合语言
logger.Info("Container created successfully, ID=", containerID)

// ❌ 避免：信息不完整
logger.Info("Failed")
```

### 3.3 前缀标记

在日志消息前添加模块前缀，便于追踪日志来源：

```go
// ✅ 推荐：添加模块前缀
logger.Debug("[CourseService] 开始加载课程", "路径", coursesDir)
logger.Info("[DockerController] 容器创建成功", "容器ID", containerID)

// ✅ 推荐：使用结构化参数
logger.Info("容器操作完成", 
    "操作", "start",
    "容器ID", containerID, 
    "结果", "success")
```

## 4. 敏感信息处理

### 4.1 需要脱敏的信息

- 密码、令牌、API 密钥
- 用户个人信息
- 数据库连接字符串（包含密码）

### 4.2 脱敏示例

```go
// ❌ 避免：日志中包含敏感信息
logger.Info("用户登录成功", "密码", password, "令牌", token)

// ✅ 推荐：脱敏处理
maskedToken := token[:8] + "****"
logger.Info("用户登录成功", "用户ID", userID, "令牌", maskedToken)
```

## 5. Logger 使用规范

### 5.1 创建 Logger

```go
// ✅ 推荐：使用配置初始化
logger := logger.NewLogger(logger.INFO)

// ✅ 推荐：使用全局级别控制
logger.SetGlobalLevel(logger.DEBUG)
```

### 5.2 日志调用

```go
// ✅ 推荐：使用结构化参数
logger.Info("操作完成", "键", value)

// ❌ 避免：使用 fmt.Sprintf 风格的字符串拼接
logger.Info(fmt.Sprintf("操作完成: %s", value))
```

## 6. 常见场景示例

### 6.1 API 请求处理

```go
func handleRequest(c *gin.Context) {
    logger := getLoggerFromContext(c)
    
    requestID := c.GetString("request_id")
    path := c.Request.URL.Path
    
    logger.Debug("开始处理请求", "请求ID", requestID, "路径", path)
    
    // 处理逻辑...
    
    logger.Info("请求处理完成", 
        "请求ID", requestID, 
        "状态码", statusCode,
        "耗时", duration)
}
```

### 6.2 容器操作

```go
func (d *dockerController) StartContainer(ctx context.Context, id string) error {
    d.logger.Info("开始启动容器", "容器ID", id)
    
    if err := d.client.ContainerStart(ctx, id); err != nil {
        d.logger.Error("容器启动失败", 
            "容器ID", id, 
            "错误", err.Error())
        return err
    }
    
    d.logger.Info("容器启动成功", "容器ID", id)
    return nil
}
```

### 6.3 错误处理

```go
func processData(data []byte) error {
    var req Request
    if err := json.Unmarshal(data, &req); err != nil {
        logger.Error("数据解析失败",
            "错误", err.Error(),
            "数据长度", len(data))
        return err
    }
    
    if req.ID == "" {
        logger.Warn("请求缺少必要字段",
            "字段", "ID",
            "请求", string(data))
        return nil // 继续处理，不返回错误
    }
    
    return nil
}
```

## 7. 配置文件日志示例

```yaml
# 日志配置示例
logging:
  level: INFO    # DEBUG, INFO, WARN, ERROR
  format: json   # json 或 text
  output: stdout # stdout, file
  # 日志文件配置
  file:
    path: /var/log/kwdb-playground.log
    max_size: 100MB
    max_backups: 5
```

## 8. 最佳实践

1. **适度日志**：不要过度日志化，只记录重要信息
2. **包含上下文**：日志应包含足够的上下文信息便于排查
3. **性能考虑**：避免在热代码路径中进行复杂的日志格式化
4. **结构化输出**：生产环境建议使用 JSON 格式便于日志收集和分析
5. **错误处理**：错误日志应包含足够的诊断信息

## 9. 相关文件

- `internal/logger/logger.go`：日志实现
- `internal/config/config.go`：日志配置加载
