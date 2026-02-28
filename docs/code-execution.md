# 代码执行功能文档

KWDB Playground 新增代码执行功能，支持在课程中编写和运行 Python 代码。

## 功能概述

代码执行功能允许用户在课程页面中：
- 阅读包含 Python 代码块的课程内容
- 点击「Run」按钮直接执行代码
- 查看代码执行结果（输出、错误、退出码）

## 快速开始

### 1. 启动课程

在课程列表中选择标记为「Python」的课程，点击进入学习页面。

### 2. 启动容器

点击「启动容器」按钮，等待容器状态变为「运行中」。

### 3. 执行代码

页面中的 Python 代码块会显示「Run」按钮，点击即可执行代码，结果将显示在右侧的代码终端面板中。

## 课程配置

### 创建代码课程

在课程 YAML 文件中添加 `codeTerminal: true` 字段：

```yaml
title: Python 入门
description: 学习 Python 基础语法
details:
  intro:
    text: intro.md
  steps:
    - title: Hello World
      text: step1.md
  finish:
    text: finish.md
backend:
  imageid: python:3.11-slim
codeTerminal: true  # 启用代码执行功能
estimatedMinutes: 10
difficulty: beginner
tags:
  - Python
```

### 可执行代码块

在 Markdown 中使用 ` ```python ` 标记代码块：

````markdown
```python
print("Hello, World!")
name = "小明"
age = 18
print(f"姓名: {name}, 年龄: {age}")
```
````

渲染后将显示：
- 代码编辑器（只读）
- Run 执行按钮
- 可点击 Run 直接运行

## 技术架构

### 前端组件

| 组件 | 路径 | 说明 |
|------|------|------|
| CodeEditor | `src/components/business/CodeEditor.tsx` | 基于 CodeMirror 的代码编辑器 |
| CodeExecutionResult | `src/components/business/CodeExecutionResult.tsx` | 执行结果展示 |
| CodeTerminal | `src/components/business/CodeTerminal.tsx` | WebSocket 客户端，负责代码执行 |

### 后端实现

| 模块 | 路径 | 说明 |
|------|------|------|
| WebSocket Handler | `internal/websocket/code.go` | 处理代码执行 WebSocket 连接 |
| Docker Controller | `internal/docker/controller.go` | ExecCode 方法执行容器内代码 |
| API Routes | `internal/api/routes.go` | `/ws/code` 路由注册 |

### WebSocket 协议

**连接地址**: `ws://host:port/ws/code`

**客户端发送 (ExecuteRequest)**:
```json
{
  "type": "execute",
  "data": {
    "containerId": "容器ID",
    "language": "python",
    "code": "print('Hello')",
    "timeout": 30
  }
}
```

**服务端响应**:
```json
{
  "type": "done",
  "executionId": "exec_1234567890",
  "output": "Hello\n",
  "error": "",
  "exitCode": 0,
  "duration": 150
}
```

### 执行流程

```
用户点击 Run
    ↓
Learn.tsx 提取 Python 代码
    ↓
调用 CodeTerminal.executeCode()
    ↓
WebSocket 发送 execute 消息到 /ws/code
    ↓
CodeSession.handleExecute()
    ↓
DockerController.ExecCode()
    ↓
在容器中执行: python3 -c "code"
    ↓
返回执行结果
    ↓
CodeTerminal 显示结果
```

## 安全限制

| 限制 | 值 | 说明 |
|------|-----|------|
| 超时时间 | 30 秒 | 代码执行最大时长 |
| 内存限制 | 512 MB | 容器内存上限 |
| 支持语言 | python, bash, node | 当前支持的语言 |

## 现有课程

已创建的示例课程：

- **Python 入门** (`courses/python-hello/`) - 基础 Python 语法学习

## 常见问题

### Q: 代码执行失败怎么办？

A: 检查以下几点：
1. 容器是否处于「运行中」状态
2. 代码是否有语法错误
3. 是否超过 30 秒超时限制

### Q: 如何添加新的编程语言？

A: 需要修改：
1. `internal/docker/controller.go` - 添加新语言的执行方法
2. `src/components/business/CodeTerminal.tsx` - 添加语言选项

### Q: 代码执行是否安全？

A: 代码在隔离的 Docker 容器中执行，有 30 秒超时和 512MB 内存限制。

## 开发指南

### 添加新语言支持

1. **后端**: 在 `docker/controller.go` 的 `ExecCode` 方法中添加语言分支
2. **前端**: 在 `CodeTerminal.tsx` 的语言选择器中添加选项

### 修改超时限制

- 前端: `CodeTerminal.tsx` 中的 `timeout: 30`
- 后端: `websocket/code.go` 中的 `defaultCodeTimeout`

### 测试

运行开发服务器后，访问 Python 课程即可测试功能。

```bash
make dev
# 访问 http://localhost:3006
# 选择 "Python 入门" 课程
```
