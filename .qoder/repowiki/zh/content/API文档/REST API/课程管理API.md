# 课程管理API

<cite>
**本文档中引用的文件**  
- [routes.go](file://internal/api/routes.go)
- [models.go](file://internal/course/models.go)
- [service.go](file://internal/course/service.go)
- [CourseList.tsx](file://src/pages/CourseList.tsx)
</cite>

## 目录
1. [简介](#简介)
2. [接口概览](#接口概览)
3. [GET /api/courses 接口详情](#get-apicourses-接口详情)
4. [GET /api/courses/:id 接口详情](#get-apicoursesid-接口详情)
5. [响应数据结构说明](#响应数据结构说明)
6. [前端调用示例](#前端调用示例)
7. [错误处理机制](#错误处理机制)
8. [缓存策略](#缓存策略)
9. [前端UI映射说明](#前端ui映射说明)
10. [注意事项](#注意事项)

## 简介
本接口文档详细描述了 `playground` 项目中用于课程管理的两个核心 RESTful API 端点：`GET /api/courses` 和 `GET /api/courses/:id`。这些接口为前端课程列表和课程详情页面提供课程元数据，不涉及任何容器生命周期操作。文档基于 `routes.go` 中的路由定义，结合 `models.go` 中的结构体定义和 `CourseList.tsx` 的实际使用场景，全面说明接口功能、请求响应格式、错误处理及前端集成方式。

## 接口概览
课程管理API提供了两个核心端点，用于获取课程信息：

| 接口 | 方法 | 描述 |
| :--- | :--- | :--- |
| `/api/courses` | GET | 获取系统中所有可用课程的列表 |
| `/api/courses/:id` | GET | 根据课程ID获取指定课程的完整详细信息 |

这两个接口是前端 `CourseList` 和 `Learn` 页面的数据基础，仅提供静态的课程元数据，与Docker容器的启动、停止等操作完全解耦。

**Section sources**
- [routes.go](file://internal/api/routes.go#L107-L154)

## GET /api/courses 接口详情
该接口用于获取系统中所有已加载课程的列表。

### 请求信息
- **方法**: `GET`
- **URL**: `/api/courses`
- **参数**: 无
- **请求头**: 无特殊要求

### 响应信息
- **成功响应 (200 OK)**:
  - **内容类型**: `application/json`
  - **响应体**: 包含所有课程对象的JSON数组，包裹在 `courses` 字段中。
    ```json
    {
      "courses": [
        {
          "id": "quick-start",
          "title": "快速开始",
          "description": "欢迎来到 KWDB 课程，本场景将引导您快速开始使用 KWDB。",
          "difficulty": "beginner",
          "estimatedMinutes": 10,
          "tags": ["quick-start", "快速开始"],
          "dockerImage": "kwdb/kwdb"
        },
        // ... 其他课程
      ]
    }
    ```
- **服务器错误响应 (500 Internal Server Error)**:
  - 如果课程服务内部发生错误（如无法读取课程目录），将返回500状态码及错误信息。

**Section sources**
- [routes.go](file://internal/api/routes.go#L107-L119)
- [service.go](file://internal/course/service.go#L227-L237)

## GET /api/courses/:id 接口详情
该接口用于根据课程ID获取单个课程的完整详细信息。

### 请求信息
- **方法**: `GET`
- **URL**: `/api/courses/:id`
- **URL参数**:
  - `id` (必需): 课程的唯一标识符（字符串）。例如，`quick-start` 或 `install`。
- **请求头**: 无特殊要求

### 响应信息
- **成功响应 (200 OK)**:
  - **内容类型**: `application/json`
  - **响应体**: 包含指定课程完整信息的JSON对象，包裹在 `course` 字段中。
    ```json
    {
      "course": {
        "id": "quick-start",
        "title": "快速开始",
        "description": "欢迎来到 KWDB 课程，本场景将引导您快速开始使用 KWDB。",
        "details": {
          "intro": {
            "content": "# 欢迎\n这是介绍内容..."
          },
          "steps": [
            {
              "title": "Install",
              "content": "# 第一步\n这是第一步内容..."
            },
            {
              "title": "Exec",
              "content": "# 第二步\n这是第二步内容..."
            }
          ],
          "finish": {
            "content": "# 完成\n恭喜你完成了课程！"
          }
        },
        "backend": {
          "imageid": "kwdb/kwdb",
          "workspace": "/kaiwudb/bin"
        },
        "difficulty": "beginner",
        "estimatedMinutes": 10,
        "tags": ["quick-start", "快速开始"],
        "dockerImage": "kwdb/kwdb"
      }
    }
    ```
- **客户端错误响应 (400 Bad Request)**:
  - 如果 `id` 参数为空或仅包含空白字符，返回400状态码。
  - **响应体**: `{"error": "课程ID不能为空"}`
- **未找到响应 (404 Not Found)**:
  - 如果指定的 `id` 在系统中不存在，返回404状态码。
  - **响应体**: `{"error": "课程不存在"}`

**Section sources**
- [routes.go](file://internal/api/routes.go#L132-L154)
- [service.go](file://internal/course/service.go#L250-L256)

## 响应数据结构说明
响应数据基于 `models.go` 文件中定义的 `Course` 结构体。以下是关键字段的详细说明：

| 字段名 (JSON) | 类型 | 语义说明 |
| :--- | :--- | :--- |
| `id` | string | 课程的唯一标识符，通常与 `courses` 目录下的子目录名称一致。 |
| `title` | string | 课程的标题，用于在UI上显示。 |
| `description` | string | 课程的简短描述，用于在课程列表中预览。 |
| `details` | object | 课程的详细内容，包含 `intro`（介绍）、`steps`（步骤数组）和 `finish`（完成页）三个部分。每个部分的 `content` 字段包含从Markdown文件加载的完整文本内容。 |
| `backend` | object | 课程运行所需的后端配置，包括 `imageid`（Docker镜像ID）和 `workspace`（容器内工作目录）。 |
| `difficulty` | string | 课程难度等级，如 `beginner`（初级）、`intermediate`（中级）、`advanced`（高级），用于在UI上进行分类和样式化。 |
| `estimatedMinutes` | number | 完成本课程的预估时间（分钟），用于帮助用户规划学习时间。 |
| `tags` | array of string | 与课程相关的标签数组，可用于搜索和分类。 |
| `dockerImage` | string | 课程使用的Docker镜像名称，是 `backend.imageid` 的兼容性字段。 |

**Section sources**
- [models.go](file://internal/course/models.go#L5-L16)

## 前端调用示例
前端 `CourseList` 组件通过 `fetch` API 调用 `GET /api/courses` 接口来加载课程列表。

### 使用 fetch 的示例代码
```typescript
const fetchCourses = async () => {
  try {
    const response = await fetch('/api/courses');
    if (!response.ok) {
      throw new Error('Failed to fetch courses');
    }
    const data = await response.json();
    setCourses(data.courses || []);
  } catch (err) {
    setError(err instanceof Error ? err.message : 'Unknown error');
  } finally {
    setLoading(false);
  }
};
```

### 使用 cURL 的示例命令
```bash
curl -X GET http://localhost:8080/api/courses
```

**Section sources**
- [CourseList.tsx](file://src/pages/CourseList.tsx#L14-L36)

## 错误处理机制
API 提供了清晰的错误处理机制，返回标准的HTTP状态码和JSON格式的错误信息：

- **400 Bad Request**: 当请求参数无效时返回，例如 `GET /api/courses/` 后跟一个空的ID。这有助于前端开发者快速定位参数错误。
- **404 Not Found**: 当请求的资源不存在时返回，例如请求一个ID为 `non-existent` 的课程。前端可以据此显示“课程不存在”的友好提示。
- **500 Internal Server Error**: 当服务器内部发生意外错误时返回，例如无法读取磁盘上的课程文件。这表示问题出在服务端，需要管理员介入。

前端代码（如 `CourseList.tsx`）通过检查 `response.ok` 和捕获异常来处理这些错误，并向用户展示相应的加载状态或错误信息。

**Section sources**
- [routes.go](file://internal/api/routes.go#L132-L154)

## 缓存策略
当前API实现中，课程数据的缓存主要在服务端内存中完成，而非通过HTTP缓存头。

- **服务端缓存**: `course.Service` 结构体使用一个 `map[string]*Course` 来存储所有已加载的课程，并通过 `sync.RWMutex` 保证并发安全。`LoadCourses()` 方法在应用启动时被调用一次，将所有课程从文件系统（`courses` 目录下的 `index.yaml` 和 `.md` 文件）加载到内存中。后续的 `GET` 请求（`GetCourses` 和 `GetCourse`）都直接从这个内存缓存中读取数据，避免了频繁的磁盘I/O，极大地提升了响应速度。
- **HTTP缓存**: 当前接口未设置 `Cache-Control` 等HTTP缓存头。这意味着浏览器或代理服务器不会缓存这些响应，每次访问 `CourseList` 页面都会向服务器发起新的请求。对于课程元数据这种不频繁变更的数据，未来可以考虑添加适当的缓存头以优化性能。

**Section sources**
- [service.go](file://internal/course/service.go#L227-L237)
- [service.go](file://internal/course/service.go#L250-L256)

## 前端UI映射说明
`CourseList.tsx` 组件定义了一个与API响应结构相匹配的 `Course` TypeScript接口，并将获取到的课程数据直接映射到UI组件进行渲染。

- **数据映射**: API返回的 `courses` 数组被直接赋值给React组件的 `courses` 状态。组件通过 `map()` 函数遍历该数组，为每个课程创建一个卡片。
- **UI渲染**:
  - `title` 和 `description` 字段用于填充卡片的标题和描述文本。
  - `estimatedMinutes` 字段与一个时钟图标一起显示，告知用户学习时长。
  - `difficulty` 字段被转换为中文（“初级”、“中级”、“高级”），并应用不同的渐变背景色进行视觉区分。
  - `tags` 数组被渲染为一系列标签（Tag），每个标签都带有图标和样式。
  - `id` 字段用于构建“开始学习”按钮的链接（`/learn/${course.id}`）。

这种直接的数据到UI映射使得前端开发简洁高效。

**Section sources**
- [CourseList.tsx](file://src/pages/CourseList.tsx#L4-L12)
- [CourseList.tsx](file://src/pages/CourseList.tsx#L86-L110)

## 注意事项
- **仅提供元数据**: 此API仅负责提供课程的描述性信息和内容，不涉及任何Docker容器的创建、启动或管理。容器操作由 `POST /api/courses/:id/start` 等其他端点处理。
- **数据源**: 所有课程数据都来源于 `courses` 目录下的文件。添加新课程只需在该目录下创建新的子目录并包含 `index.yaml` 和相应的 `.md` 文件，然后重启服务即可。
- **安全性**: 当前API没有身份验证，所有课程对任何访问者都是公开的。在生产环境中，可能需要添加访问控制。