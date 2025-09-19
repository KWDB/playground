#!/bin/bash
# scripts/cleanup_e2e.sh
# E2E测试环境清理脚本

set -e

echo "🧹 清理E2E测试环境..."

# 1. 停止应用服务
echo "停止应用服务..."
if [ -f ".app_pid" ]; then
    APP_PID=$(cat .app_pid)
    if kill -0 $APP_PID 2>/dev/null; then
        kill $APP_PID
        echo "✅ 应用服务已停止 (PID: $APP_PID)"
    fi
    rm -f .app_pid
fi

# 通过进程名清理
pkill -f "kwdb-playground" || true
pkill -f "make dev" || true

# 2. 清理Docker容器
# echo "清理Docker容器..."

# 清理所有相关容器
# docker ps -a | grep -E "(kwdb-course|e2e-test)" | awk '{print $1}' | xargs -r docker rm -f || true

# 清理悬空容器
# docker container prune -f || true

# echo "✅ Docker容器清理完成"

# 3. 清理测试数据
echo "清理测试数据..."

# 清理生成的测试数据（保留配置）
# rm -rf e2e_testdata/courses/e2e-* || true
rm -rf tests/screenshots/*.png || true
rm -rf tests/reports/*.html || true

# 清理临时文件
rm -f .backend_pid .frontend_pid .test_pid || true

echo "✅ 测试数据清理完成"

# 4. 清理Python环境（可选）
if [ "$1" = "--full" ]; then
    echo "执行完整清理..."
    
    # 清理Python虚拟环境
    if [ -d "e2e_test_env" ]; then
        rm -rf e2e_test_env
        echo "✅ Python虚拟环境已删除"
    fi
    
    # 清理所有测试数据
    rm -rf e2e_testdata || true
    echo "✅ 所有测试数据已清理"
fi

# 5. 清理Chrome用户数据
echo "清理Chrome用户数据..."
rm -rf /tmp/chrome_user_* || true

# 6. 检查端口占用
echo "检查端口占用..."
if lsof -i :3006 >/dev/null 2>&1; then
    echo "⚠️  端口3006仍被占用，可能需要手动清理"
    lsof -i :3006
else
    echo "✅ 端口3006已释放"
fi

echo ""
echo "🎉 E2E测试环境清理完成！"
echo ""

if [ "$1" = "--full" ]; then
    echo "📋 完整清理已执行，如需重新测试请运行:"
    echo "  ./scripts/setup_e2e_env.sh"
else
    echo "📋 基础清理已完成，如需完整清理请运行:"
    echo "  ./scripts/cleanup_e2e.sh --full"
fi

echo ""
echo "💡 提示:"
echo "  - 重新运行测试: ./run_e2e_tests.sh"
echo "  - 启动应用服务: make dev"
echo "  - 查看测试报告: open tests/reports/e2e_report.html"