# KWDB Playground E2E测试套件

## 概述

本测试套件为KWDB Playground项目提供完整的端到端(E2E)测试，验证从前端用户界面到后端API服务的完整业务流程。

## 🎯 测试覆盖范围

### 核心业务流程
- ✅ **完整用户学习流程** - 从课程浏览到学习完成
- ✅ **API测试** - 验证后端API的功能和性能
- ✅ **WebSocket实时交互** - 验证终端实时响应

## 🚀 快速开始

### 1. 环境准备

```bash
# 安装测试环境
./scripts/setup_e2e_env.sh

# 启动应用服务
make dev
```

### 2. 执行测试

```bash
# 完整测试套件
./run_e2e_tests.sh

# 快速核心测试
./scripts/quick_e2e_test.sh

# 单独执行特定测试
source e2e_test_env/bin/activate
pytest tests/e2e/test_user_journey.py -v
```

### 3. 查看结果

```bash
# 查看HTML测试报告
open tests/reports/e2e_report.html

# 查看测试截图
ls tests/screenshots/
```

## 📁 项目结构

```
tests/
├── e2e/
│   ├── conftest.py                 # pytest配置和fixtures
│   ├── test_user_journey.py        # 完整用户流程测试
│   ├── test_api_endpoints.py       # API测试
│   ├── test_websocket.py           # WebSocket交互测试
│   └── utils/
│       ├── api_client.py           # API客户端封装
│       ├── websocket_client.py     # WebSocket客户端
│       ├── browser_helper.py       # 浏览器操作辅助
│       └── test_data_generator.py  # 测试数据生成器
├── reports/                        # 测试报告目录
└── screenshots/                    # 测试截图目录

scripts/
├── setup_e2e_env.sh               # 环境准备脚本
├── cleanup_e2e.sh                 # 环境清理脚本
├── quick_e2e_test.sh              # 快速测试脚本
└── generate_test_data.py          # 测试数据生成脚本

e2e_testdata/
├── config/
│   └── test_config.yaml           # 测试配置
└── fixtures/                      # 测试固件数据
```

## 🔧 配置说明

### 测试配置 (e2e_testdata/config/test_config.yaml)

```yaml
test_environment:
  backend_url: "http://localhost:3006"    # 后端API地址
  frontend_url: "http://localhost:3006"   # 前端页面地址
  websocket_url: "ws://localhost:3006/ws" # WebSocket地址

browser_config:
  headless: true          # 无头模式运行
  window_size: [1920, 1080]  # 浏览器窗口大小
  timeout: 30             # 元素等待超时时间

performance_thresholds:
  api_response_time: 2.0      # API响应时间阈值(秒)
  container_startup_time: 30.0 # 容器启动时间阈值(秒)
  websocket_latency: 0.1      # WebSocket延迟阈值(秒)
  memory_limit_mb: 512        # 内存使用限制(MB)
```

## 🧪 测试用例详解

### E2E001: 完整用户学习流程
- **目标**: 验证用户从进入系统到完成课程的全流程
- **步骤**: 访问首页 → 浏览课程 → 选择课程 → 启动学习 → 执行命令 → 完成课程
- **验证**: 每个步骤的UI响应和功能正确性

### E2E002: API测试
- **目标**: 验证后端API的功能和性能
- **方法**: 使用pytest和requests库测试API端点
- **验证**: 响应状态码、数据格式和业务逻辑正确性

### E2E003: WebSocket实时交互
- **目标**: 验证终端的实时交互性能
- **方法**: 直接测试WebSocket连接和命令执行
- **验证**: 命令响应时间和输出正确性

## 🛠 开发指南

### 添加新测试

1. 在 `tests/e2e/` 目录下创建新的测试文件
2. 使用现有的工具类和fixtures
3. 遵循命名规范: `test_*.py`
4. 添加适当的断言和错误处理

### 调试测试

```bash
# 非无头模式运行（可视化调试）
pytest tests/e2e/test_user_journey.py --capture=no -s

# 运行特定测试方法
pytest tests/e2e/test_user_journey.py::TestCompleteUserJourney::test_complete_user_journey -v

# 显示详细错误信息
pytest tests/e2e/ --tb=long -v
```

## 🔍 故障排查

### 常见问题

1. **服务连接失败**
   - 检查应用是否启动: `curl http://localhost:3006/health`
   - 确认端口未被占用: `lsof -i :3006`

2. **WebDriver错误**
   - 更新Chrome浏览器到最新版本
   - 重新安装WebDriver: `pip install --upgrade selenium webdriver-manager`

3. **容器启动失败**
   - 检查Docker服务: `docker ps`
   - 清理旧容器: `./scripts/cleanup_e2e.sh`

4. **测试超时**
   - 增加超时时间配置
   - 检查系统资源使用情况

### 日志查看

```bash
# 查看测试日志
pytest tests/e2e/ --log-cli-level=DEBUG

# 查看应用日志
make logs  # 如果Makefile支持

# 查看Docker容器日志
docker logs <container_id>
```

## 📊 测试报告

测试完成后会生成以下报告：

- **HTML报告**: `tests/reports/e2e_report.html` - 详细的测试执行报告
- **截图**: `tests/screenshots/` - 测试失败时的页面截图
- **监控数据**: `tests/reports/monitoring_report_*.json` - 系统性能监控数据

## 🔄 持续集成

### GitHub Actions配置

测试套件已配置为在以下情况自动执行：
- 代码推送到main/develop分支
- 创建Pull Request
- 每日定时执行
