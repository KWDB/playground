# 代码终端（Code Terminal）功能文档

本文档基于当前代码实现，说明学习页 Code Terminal 的能力、协议和扩展方式。

## 功能概述

Code Terminal 用于在课程页面直接编辑并执行代码，当前支持：

- 语言：`python`、`bash`、`node`、`java`
- 触发方式：
  - 右侧代码面板点击「运行」
  - 课程 Markdown 代码块上的「Run」按钮
  - 通过 `CodeTerminalRef.executeCode()` 程序化调用
- 结果展示：标准输出、错误输出、退出码、耗时（毫秒）
- 运行控制：执行中可点击「停止」发送取消请求
- 连接状态：显示 WebSocket 已连接/未连接状态
- 容器启动阶段：通过进度专用 WebSocket 展示镜像拉取进度覆盖层

## 使用说明

### 1. 课程启用

在课程 YAML 中启用代码终端：

```yaml
title: Python 入门
backend:
  imageid: python:3.11-slim
codeTerminal: true
```

### 2. 进入课程并启动容器

容器状态为 `running` 后，Code Terminal 会建立代码执行 WebSocket 连接。  
容器状态为 `starting` 时，会建立进度专用连接显示镜像拉取进度。

### 3. 执行代码

- 在代码编辑区输入代码后点击「运行」
- 或点击课程内容中可执行代码块的「Run」
- 执行完成后在输出区查看 stdout/stderr、退出码与耗时

## 界面与交互

Code Terminal 采用上下分区布局：

- 上半区（55%）：代码编辑器 + 语言切换 + 清空/运行或停止按钮
- 下半区（45%）：输出区 + 运行状态 + 结果摘要（退出码/耗时）

行为细节：

- 运行按钮禁用条件：WebSocket 未连接或代码为空
- 执行中按钮切换为「停止」
- 语言列表会按课程 ID 做约束：
  - `python-kwdb`：`python`、`bash`
  - `java-kwdb`：`java`、`bash`
  - 其他课程：显示全部语言选项

## 课程 Markdown 执行规则

以下代码块会显示「Run」按钮：

- `python`
- `bash`
- `java`
- 或带 `{{exec}}` 元信息的 fenced code block / inline code

示例：

````markdown
```python
print("hello")
```
````

点击后，学习页会把代码注入 Code Terminal 并按按钮上的 `data-language` 执行。

## 技术架构

### 前端

| 组件 | 路径 | 说明 |
|------|------|------|
| CodeTerminal | `src/components/business/CodeTerminal.tsx` | 代码终端主组件（编辑、执行、结果展示） |
| CodeEditor | `src/components/business/CodeEditor.tsx` | 编辑器 |
| CodeExecutionResult | `src/components/business/CodeExecutionResult.tsx` | 输出渲染 |
| MarkdownCodeBlock | `src/pages/learn/markdown/MarkdownCodeBlock.tsx` | 课程代码块 Run 按钮生成 |
| useExecCommand | `src/pages/learn/hooks/useExecCommand.ts` | Run 点击后路由到 CodeTerminal |

`CodeTerminalRef`：

```typescript
interface CodeTerminalRef {
  executeCode: (code: string, language?: string) => void
  cancelExecution: () => void
  getCode: () => string
  setCode: (code: string) => void
}
```

### 后端

| 模块 | 路径 | 说明 |
|------|------|------|
| WebSocket 路由 | `internal/api/routes.go` | 注册 `GET /ws/code` |
| Code 会话管理 | `internal/websocket/code.go` | 处理 execute/cancel/ping 等消息 |
| 代码执行引擎 | `internal/docker/controller.go` | `ExecCode` 写入文件并在容器内执行 |
| 类型定义 | `internal/docker/types.go` | `CodeLanguage`、`ExecCodeOptions`、`ExecCodeResult` |

## WebSocket 协议

连接地址：

```text
ws://{host}/ws/code
```

说明：后端支持可选 `session_id` 查询参数；不传时后端自动生成会话 ID。

客户端消息：

### execute

```json
{
  "type": "execute",
  "data": {
    "containerId": "container_xxx",
    "language": "python",
    "code": "print('Hello')",
    "timeout": 30
  },
  "sessionId": "exec_1740000000000"
}
```

### cancel

```json
{
  "type": "cancel",
  "data": {
    "executionId": "exec_1740000000000"
  }
}
```

### ping

```json
{
  "type": "ping"
}
```

服务端消息：

### done（执行完成）

```json
{
  "type": "done",
  "executionId": "exec_1740000000000",
  "output": "Hello\n",
  "error": "",
  "exitCode": 0,
  "duration": 35
}
```

### error（请求或执行失败）

```json
{
  "type": "error",
  "executionId": "exec_1740000000000",
  "error": "execution failed: code execution timed out after 30s",
  "duration": 30000
}
```

### pong（心跳响应）

```json
{
  "type": "pong"
}
```

## 执行模型（文件模式）

后端采用“先写文件，再执行”的模式：

1. 根据语言选择目标文件路径
2. 将代码写入容器 `/tmp` 路径
3. 调用容器内命令执行
4. 采集 stdout/stderr 和退出码并返回

当前语言映射：

| 语言 | 文件路径 | 执行命令 |
|------|----------|----------|
| python | `/tmp/user_code.py` | `python3 /tmp/user_code.py` |
| bash | `/tmp/user_code.sh` | `bash /tmp/user_code.sh` |
| node | `/tmp/user_code.js` | `node /tmp/user_code.js` |
| java | `/tmp/user_code.java` | `sh -lc "... java -cp \"$JDBC_JAR:/tmp\" /tmp/user_code.java"` |

Java 分支会尝试定位或下载 `kaiwudb-jdbc`，并以 UTF-8 编码参数执行。

## 约束与注意事项

- 默认执行超时：30 秒（前端请求与后端默认值均为 30）
- `input` 消息当前不支持交互式 stdin，会返回错误
- 文档不再声明固定 512MB 内存限制，实际资源上限由课程容器配置决定
- 执行取消通过会话上下文取消实现，正在执行的任务会尽快中断

## 常见问题

### 为什么「运行」按钮是灰色？

常见原因：

- 容器未处于 `running`
- 代码内容为空
- WebSocket 还未连接成功

### 课程里如何标记可执行代码？

- 直接使用 `python` / `bash` / `java` fenced code block
- 或使用 `{{exec}}` 元信息标记代码块/行内命令

### 如何新增语言支持？

至少需要同步修改以下位置：

1. `internal/docker/types.go`：新增 `CodeLanguage` 枚举
2. `internal/docker/controller.go`：在 `ExecCode` 中新增文件路径与命令映射
3. `src/components/business/CodeTerminal.tsx`：新增语言选项与课程映射策略
4. 课程镜像：确保运行时具备对应语言解释器或编译执行环境
