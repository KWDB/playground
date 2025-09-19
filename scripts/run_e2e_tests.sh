#!/bin/bash
# run_e2e_tests.sh
# KWDB Playground E2E测试主执行脚本

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 打印带颜色的消息
print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

# 检查服务状态
check_service() {
    local url=$1
    local service_name=$2
    
    print_info "检查${service_name}状态..."
    
    for i in {1..30}; do
        if curl -f "$url" >/dev/null 2>&1; then
            print_success "${service_name}运行正常"
            return 0
        fi
        
        if [ $i -eq 30 ]; then
            print_error "${service_name}不可用，请检查服务是否启动"
            return 1
        fi
        
        sleep 1
    done
}

# 清理函数
cleanup() {
    print_info "清理测试环境..."
    
    # 清理测试容器
    docker ps -a | grep -E "(kwdb-course|e2e-test)" | awk '{print $1}' | xargs -r docker rm -f >/dev/null 2>&1 || true
    
    # 清理临时文件
    rm -f .app_pid .test_pid >/dev/null 2>&1 || true
    
    print_success "环境清理完成"
}

# 设置清理陷阱
trap cleanup EXIT

echo ""
echo "🧪 KWDB Playground 端到端测试执行器"
echo "=================================="
echo ""

# 1. 检查环境准备
print_info "检查测试环境..."

if [ ! -d "e2e_test_env" ]; then
    print_warning "测试环境未准备，正在自动准备..."
    chmod +x scripts/setup_e2e_env.sh
    ./scripts/setup_e2e_env.sh
fi

if [ ! -f "requirements.txt" ]; then
    print_error "缺少依赖配置文件 requirements.txt"
    exit 1
fi

print_success "测试环境检查完成"

# 2. 检查服务状态
print_info "检查应用服务状态..."

if ! check_service "http://localhost:3006/health" "应用服务"; then
    print_warning "应用服务未运行，尝试启动..."
    
    # 检查是否有Makefile
    if [ ! -f "Makefile" ]; then
        print_error "未找到Makefile，无法启动服务"
        exit 1
    fi
    
    # 启动服务
    print_info "启动应用服务 (make dev)..."
    make dev &
    APP_PID=$!
    echo $APP_PID > .app_pid
    
    # 等待服务启动
    sleep 15
    
    if ! check_service "http://localhost:3006/health" "应用服务"; then
        print_error "服务启动失败"
        exit 1
    fi
fi

# 3. 激活Python环境
print_info "激活Python测试环境..."
source e2e_test_env/bin/activate

# 4. 生成测试数据
print_info "生成测试数据..."
python scripts/generate_test_data.py

# 5. 创建报告目录
mkdir -p tests/reports tests/screenshots

# 6. 执行测试套件
echo ""
print_info "开始执行E2E测试套件..."
echo ""

# 执行各个测试模块
total_tests=0
passed_tests=0

# 定义测试模块列表
test_modules=(
    "test_api_integration.py:API集成测试"
    "test_user_journey.py:完整用户流程测试"
    "test_websocket.py:WebSocket交互测试"
)

for test_item in "${test_modules[@]}"; do
    # 分割模块名和描述
    module="${test_item%%:*}"
    description="${test_item##*:}"
    
    print_info "执行 ${description}..."
    
    # 临时禁用set -e，确保测试失败不会终止整个脚本
    set +e
    pytest "tests/e2e/$module" -v --tb=short --quiet
    test_exit_code=$?
    set -e
    
    if [ $test_exit_code -eq 0 ]; then
        print_success "${description} 通过"
        ((passed_tests++))
    else
        print_error "${description} 失败 (退出码: $test_exit_code)"
    fi
    
    ((total_tests++))
    echo ""
done

# 7. 生成完整测试报告
print_info "生成完整测试报告..."
pytest tests/e2e/ \
    --html=tests/reports/e2e_report.html \
    --self-contained-html \
    --tb=short \
    --quiet || true

# 8. 显示测试结果摘要
echo ""
echo "📊 测试结果摘要"
echo "==============="
echo "总测试模块: $total_tests"
echo "通过模块: $passed_tests"
echo "失败模块: $((total_tests - passed_tests))"

# 避免除零错误
if [ $total_tests -gt 0 ]; then
    success_rate=$(( passed_tests * 100 / total_tests ))
    echo "成功率: ${success_rate}%"
else
    echo "成功率: 0% (无测试执行)"
fi
echo ""

if [ -f "tests/reports/e2e_report.html" ]; then
    print_success "测试报告已生成: tests/reports/e2e_report.html"
    echo "查看报告: open tests/reports/e2e_report.html"
else
    print_warning "测试报告生成失败"
fi

# 9. 显示截图信息
if [ -d "tests/screenshots" ] && [ "$(ls -A tests/screenshots)" ]; then
    screenshot_count=$(ls tests/screenshots/*.png 2>/dev/null | wc -l)
    print_info "生成了 $screenshot_count 张测试截图"
fi

echo ""
if [ $passed_tests -eq $total_tests ]; then
    print_success "🎉 所有E2E测试通过！"
    exit 0
else
    print_error "❌ 部分E2E测试失败，请查看详细报告"
    exit 1
fi