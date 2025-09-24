# REST API

<cite>
**本文档中引用的文件**  
- [routes.go](file://internal/api/routes.go)
- [models.go](file://internal/course/models.go)
- [types.go](file://internal/docker/types.go)
- [CourseList.tsx](file://src/pages/CourseList.tsx)
- [controller.go](file://internal/docker/controller.go)
</cite>

## 目录
1. [API版本策略](#apiversion)
2. [错误响应格式](#errorformat)
3. [健康检查接口](#healthcheck)
4. [课程管理接口](#coursemanagement)
5. [容器操作接口](#containeroperations)
6. [WebSocket终端接口](#websocketterminal)
7. [前端调用示例](#frontendexample)
8. [接口功能边界说明](#apiboundary)

## API版本策略
当前API版本为v1，所有接口均位于`/api/v1`命名空间下。通过在路由组中统一管理版本，确保API演进时的向后兼容性。版本号在路由配置中作为路径前缀，便于未来进行版本迭代和灰度发布。

**Section sources**
- [routes.go](file://internal/api/routes.go#L64-L92)

## 错误响应格式
所有API接口采用统一的错误响应格式，确保客户端能够一致地处理错误情况。错误响应包含`code`和`message`两个核心字段，便于前端进行国际化处理和用户友好的错误展示。

```json
{
  "error": "错误描述信息"
}
```

HTTP状态码语义：
- `400 Bad Request`：客户端请求参数错误
- `404 Not Found`：请求的资源不存在
- `500 Internal Server Error`：服务器内部错误
- `503 Service Unavailable`：依赖的服务不可用

**Section sources**
- [routes.go](file://internal/api/routes.go#L132-L154)
- [routes.go](file://internal/api/routes.go#L168-L302)

## 健康检查接口
提供服务健康状态检查接口，用于监控系统运行状态和负载均衡器的健康探测。

### GET /health
检查服务健康状态

**请求示例**
```bash
curl -X GET http://localhost:8080/health
```

**响应**
```json
{
  "status": "ok",
  "message": "KWDB Playground is running"
}
```

**状态码**
- `200 OK`：服务正常运行

**Section sources**
- [routes.go](file://internal/api/routes.go#L97-L102)

## 课程管理接口
提供课程元数据的读取功能，不涉及容器生命周期管理。这些接口仅负责课程信息的查询，与Docker容器操作完全解耦。

### GET /api/courses
获取所有可用课程列表

**请求示例**
```bash
curl -X GET http://localhost:8080/api/courses
```

**响应格式**
```json
{
  "courses": [
    {
      "id": "string",
      "title": "string",
      "description": "string",
      "difficulty": "string",
      "estimatedMinutes": 0,
      "tags": ["string"],
      "dockerImage": "string",
      "backend": {
        "imageid": "string",
        "workspace": "string"
      }
    }
  ]
}
```

**状态码**
- `200 OK`：成功获取课程列表

**Section sources**
- [routes.go](file://internal/api/routes.go#L107-L119)
- [models.go](file://internal/course/models.go#L5-L16)

### GET /api/courses/:id
获取指定课程的详细信息

**路径参数**
- `id`：课程唯一标识符

**请求示例**
```bash
curl -X GET http://localhost:8080/api/courses/quick-start
```

**响应格式**
```json
{
  "course": {
    "id": "string",
    "title": "string",
    "description": "string",
    "details": {
      "intro": {
        "text": "string",
        "content": "string"
      },
      "steps": [
        {
          "title": "string",
          "text": "string",
          "content": "string"
        }
      ],
      "finish": {
        "text": "string",
        "content": "string"
      }
    },
    "backend": {
      "imageid": "string",
      "workspace": "string"
    },
    "difficulty": "string",
    "estimatedMinutes": 0,
    "tags": ["string"],
    "dockerImage": "string"
  }
}
```

**状态码**
- `200 OK`：成功获取课程信息
- `400 Bad Request`：课程ID为空
- `404 Not Found`：课程不存在

**Section sources**
- [routes.go](file://internal/api/routes.go#L132-L154)
- [models.go](file://internal/course/models.go#L5-L16)

## 容器操作接口
负责Docker容器的生命周期管理，包括启动、停止、状态查询等操作。这些接口由Docker控制器处理，与课程管理接口分离，确保关注点分离。

### POST /api/courses/:id/start
为指定课程启动Docker容器环境

**路径参数**
- `id`：课程ID

**请求示例**
```bash
curl -X POST http://localhost:8080/api/courses/quick-start/start
```

**响应格式**
```json
{
  "message": "课程容器启动成功",
  "courseId": "string",
  "containerId": "string",
  "image": "string"
}
```

**状态码**
- `200 OK`：容器启动成功（包括已运行的情况）
- `400 Bad Request`：课程ID为空
- `404 Not Found`：课程不存在
- `500 Internal Server Error`：容器启动失败
- `503 Service Unavailable`：Docker服务不可用

**Section sources**
- [routes.go](file://internal/api/routes.go#L168-L302)
- [controller.go](file://internal/docker/controller.go#L430-L520)

### POST /api/courses/:id/stop
停止指定课程的Docker容器

**路径参数**
- `id`：课程ID

**请求示例**
```bash
curl -X POST http://localhost:8080/api/courses/quick-start/stop
```

**响应格式**
```json
{
  "message": "课程容器停止成功",
  "courseId": "string",
  "containerId": "string"
}
```

**状态码**
- `200 OK`：容器停止成功
- `400 Bad Request`：课程ID为空
- `404 Not Found`：未找到对应的容器
- `500 Internal Server Error`：容器停止失败
- `503 Service Unavailable`：Docker服务不可用

**Section sources**
- [routes.go](file://internal/api/routes.go#L316-L402)
- [controller.go](file://internal/docker/controller.go#L290-L320)

### GET /api/containers/:id/status
获取指定容器的运行状态

**路径参数**
- `id`：容器名称或ID

**请求示例**
```bash
curl -X GET http://localhost:8080/api/containers/kwdb-playground-quick-start-1717000000/status
```

**响应格式**
```json
{
  "status": "running",
  "containerId": "string",
  "info": {
    "id": "string",
    "courseId": "string",
    "dockerId": "string",
    "image": "string",
    "startedAt": "2024-05-29T10:00:00Z",
    "ports": {
      "string": "string"
    },
    "env": {
      "string": "string"
    }
  }
}
```

**状态码**
- `200 OK`：成功获取容器状态
- `400 Bad Request`：容器ID为空
- `404 Not Found`：容器不存在
- `500 Internal Server Error`：获取状态失败
- `503 Service Unavailable`：Docker服务不可用

**Section sources**
- [routes.go](file://internal/api/routes.go#L416-L492)
- [types.go](file://internal/docker/types.go#L17-L28)

### GET /api/containers/:id/logs
获取指定容器的日志信息

**路径参数**
- `id`：容器ID

**查询参数**
- `lines`：日志行数限制（默认100）
- `follow`：是否持续跟踪日志（默认false）

**请求示例**
```bash
curl -X GET "http://localhost:8080/api/containers/kwdb-playground-quick-start-1717000000/logs?lines=50&follow=false"
```

**响应格式**
```json
{
  "logs": "日志内容",
  "containerId": "string",
  "lines": 50,
  "follow": false
}
```

**状态码**
- `200 OK`：成功获取容器日志
- `400 Bad Request`：容器ID为空
- `404 Not Found`：容器不存在
- `500 Internal Server Error`：获取日志失败
- `503 Service Unavailable`：Docker服务不可用

**Section sources**
- [routes.go](file://internal/api/routes.go#L511-L566)
- [controller.go](file://internal/docker/controller.go#L650-L680)

### POST /api/containers/:id/restart
重启指定的Docker容器

**路径参数**
- `id`：容器ID

**请求示例**
```bash
curl -X POST http://localhost:8080/api/containers/kwdb-playground-quick-start-1717000000/restart
```

**响应格式**
```json
{
  "message": "容器重启成功",
  "containerId": "string"
}
```

**状态码**
- `200 OK`：容器重启成功
- `400 Bad Request`：容器ID为空
- `404 Not Found`：容器不存在
- `500 Internal Server Error`：容器重启失败
- `503 Service Unavailable`：Docker服务不可用

**Section sources**
- [routes.go](file://internal/api/routes.go#L580-L623)
- [controller.go](file://internal/docker/controller.go#L340-L360)

## WebSocket终端接口
提供WebSocket连接，用于建立与容器的交互式终端会话。

### GET /ws/terminal
建立WebSocket终端连接

**查询参数**
- `container_id`：容器ID（必需）
- `session_id`：会话ID（可选）

**请求示例**
```bash
# 使用JavaScript
const socket = new WebSocket('ws://localhost:8080/ws/terminal?container_id=kwdb-playground-quick-start-1717000000');
```

**状态码**
- `101 Switching Protocols`：WebSocket连接建立成功
- `400 Bad Request`：容器ID为空
- `500 Internal Server Error`：终端会话创建失败

**Section sources**
- [routes.go](file://internal/api/routes.go#L637-L693)

## 前端调用示例
展示前端组件如何调用API接口，以及异常处理模式。

### 获取课程列表
```typescript
const fetchCourses = async () => {
  try {
    const response = await fetch('/api/courses')
    if (!response.ok) {
      throw new Error('Failed to fetch courses')
    }
    const data = await response.json()
    setCourses(data.courses || [])
  } catch (err) {
    setError(err instanceof Error ? err.message : 'Unknown error')
  } finally {
    setLoading(false)
  }
}
```

### 启动课程容器
```typescript
const startCourse = async (courseId: string) => {
  try {
    const response = await fetch(`/api/courses/${courseId}/start`, {
      method: 'POST'
    })
    
    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(errorData.error || 'Failed to start course')
    }
    
    const data = await response.json()
    setContainerId(data.containerId)
  } catch (error) {
    console.error('启动课程失败:', error)
    setError(error.message)
  }
}
```

**Section sources**
- [CourseList.tsx](file://src/pages/CourseList.tsx#L23-L32)

## 接口功能边界说明
明确划分了课程管理接口和容器操作接口的职责边界：

1. **课程管理接口**（`/api/courses`）
   - 仅负责课程元数据的读取
   - 不涉及任何容器操作
   - 与Docker服务解耦，即使Docker不可用也能正常工作

2. **容器操作接口**（`/api/containers` 和 `/api/courses/:id/start|stop`）
   - 专门处理Docker容器的生命周期
   - 由Docker控制器统一管理
   - 包含互斥锁机制防止并发操作

3. **关注点分离原则**
   - 课程服务只关注课程内容和配置
   - Docker控制器只关注容器操作
   - API处理器负责协调两者，但不包含业务逻辑

这种设计确保了系统的可维护性和可测试性，每个组件都有明确的职责边界。

**Section sources**
- [routes.go](file://internal/api/routes.go#L64-L92)
- [controller.go](file://internal/docker/controller.go#L430-L520)