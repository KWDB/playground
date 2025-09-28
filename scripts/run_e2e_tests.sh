#!/bin/bash
# scripts/run_e2e_tests.sh
# E2E测试执行脚本

set -e

echo "🧪 开始执行端到端测试..."

# 检查服务是否运行
if ! curl -f http://localhost:3006/health >/dev/null 2>&1; then
    echo "❌ 服务未运行，请先启动服务: make dev"
    exit 1
fi

# 激活Python虚拟环境
source e2e_test_env/bin/activate

# 创建报告目录
mkdir -p tests/reports tests/screenshots

# 执行测试套件
echo "执行E2E测试套件..."

# API 测试
echo "🔗 执行API测试..."
pytest tests/e2e/test_api_integration.py -v --tb=short

# 基础功能测试
echo "📋 执行基础功能测试..."
pytest tests/e2e/test_user_journey.py -v --tb=short

# WebSocket交互测试
echo "🔌 执行WebSocket交互测试..."
pytest tests/e2e/test_websocket.py -v --tb=short

# 生成完整测试报告
echo "📊 生成测试报告..."
pytest tests/e2e/ --html=tests/reports/e2e_report.html --self-contained-html -v

echo "✅ E2E测试执行完成"
echo "📄 测试报告: tests/reports/e2e_report.html"
