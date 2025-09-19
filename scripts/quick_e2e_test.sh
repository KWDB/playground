#!/bin/bash
# scripts/quick_e2e_test.sh
# 快速E2E测试脚本，用于开发过程中的快速验证

set -e

echo "⚡ 快速E2E测试"
echo "=============="

# 检查服务状态
if ! curl -f http://localhost:3006/health >/dev/null 2>&1; then
    echo "❌ 应用服务未运行"
    echo "请先启动服务: make dev"
    exit 1
fi

echo "✅ 应用服务运行正常"

# 激活Python环境
if [ ! -d "e2e_test_env" ]; then
    echo "❌ 测试环境未准备，请先运行: ./scripts/setup_e2e_env.sh"
    exit 1
fi

source e2e_test_env/bin/activate

# 创建报告目录
mkdir -p tests/reports tests/screenshots

# 执行核心测试（API测试，不依赖浏览器）
echo ""
echo "🧪 执行核心API测试..."

# 测试API集成
pytest tests/e2e/test_api_integration.py -v --tb=short --capture=no

echo ""
echo "✅ 快速E2E测试完成"
echo ""
echo "💡 说明:"
echo "  - 此快速测试主要验证API功能"
echo "  - 如需完整测试（包括浏览器测试），请运行: ./run_e2e_tests.sh"
echo "  - 如遇到浏览器相关问题，请确保Chrome浏览器已正确安装"