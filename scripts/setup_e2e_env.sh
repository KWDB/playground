#!/bin/bash
# scripts/setup_e2e_env.sh
# E2E测试环境准备脚本

set -e

echo "🚀 准备端到端测试环境..."

# 1. 检查系统依赖
echo "检查系统依赖..."
command -v python3 >/dev/null 2>&1 || { echo "❌ Python3 未安装"; exit 1; }
command -v docker >/dev/null 2>&1 || { echo "❌ Docker 未安装"; exit 1; }
command -v go >/dev/null 2>&1 || { echo "❌ Go 未安装"; exit 1; }
command -v node >/dev/null 2>&1 || { echo "❌ Node.js 未安装"; exit 1; }
command -v pnpm >/dev/null 2>&1 || { echo "❌ pnpm 未安装，请运行: npm install -g pnpm"; exit 1; }

echo "✅ 系统依赖检查通过"

# 2. 创建Python虚拟环境
echo "创建Python虚拟环境..."
if [ ! -d "e2e_test_env" ]; then
    python3 -m venv e2e_test_env
    echo "✅ Python虚拟环境创建完成"
else
    echo "✅ Python虚拟环境已存在"
fi

# 激活虚拟环境
source e2e_test_env/bin/activate

# 3. 安装Python测试依赖
echo "安装Python测试依赖..."
pip install --upgrade pip
pip install -r requirements.txt
echo "✅ Python依赖安装完成"

# 4. 创建测试数据目录结构（如果不存在）
echo "创建测试数据目录..."

mkdir -p e2e_testdata/config
mkdir -p e2e_testdata/fixtures
mkdir -p tests/reports
mkdir -p tests/screenshots

# 5. 生成测试配置文件
echo "生成测试配置文件..."
cat > e2e_testdata/config/test_config.yaml << EOF
test_environment:
  backend_url: "http://localhost:3006"
  frontend_url: "http://localhost:3006"
  websocket_url: "ws://localhost:3006/ws"
  
browser_config:
  headless: true
  window_size: [1920, 1080]
  timeout: 30
  
test_data:
  courses_dir: "./courses"
  default_image: "kwdb/kwdb"
  
performance_thresholds:
  api_response_time: 2.0
  container_startup_time: 30.0
  websocket_latency: 0.1
  memory_limit_mb: 512
EOF

# 6. 拉取测试镜像
echo "拉取测试镜像..."
docker pull kwdb/kwdb
echo "✅ 测试镜像拉取完成"

# 7. 清理可能存在的测试容器
echo "清理旧的测试容器..."
docker ps -a | grep "kwdb-course" | awk '{print $1}' | xargs -r docker rm -f
docker ps -a | grep "e2e-test" | awk '{print $1}' | xargs -r docker rm -f
echo "✅ 旧容器清理完成"

# 8. 安装和配置Chrome WebDriver
echo "安装Chrome WebDriver..."
python -c "
import os
import platform
import subprocess
from webdriver_manager.chrome import ChromeDriverManager
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.chrome.service import Service

def get_real_architecture():
    '''获取真实的系统架构，支持本地Mac和GitHub Actions Linux环境'''
    # 首先检查环境变量，GitHub Actions会设置这些
    if os.environ.get('GITHUB_ACTIONS') == 'true':
        # GitHub Actions环境，通常是Linux x86_64
        runner_arch = os.environ.get('RUNNER_ARCH', 'X64').lower()
        if runner_arch == 'x64':
            print('检测到GitHub Actions Linux x86_64环境')
            return 'x86_64'
        elif runner_arch == 'arm64':
            print('检测到GitHub Actions Linux ARM64环境')
            return 'aarch64'
    
    # 检查操作系统类型
    system = platform.system().lower()
    
    if system == 'darwin':  # macOS
        try:
            # 检查是否为Apple Silicon Mac
            result = subprocess.run(['sysctl', '-n', 'hw.optional.arm64'], capture_output=True, text=True)
            if result.returncode == 0 and result.stdout.strip() == '1':
                print('检测到Apple Silicon (ARM64)架构')
                return 'arm64'
        except:
            pass
        
        try:
            # 使用uname -m命令获取架构
            result = subprocess.run(['uname', '-m'], capture_output=True, text=True)
            if result.returncode == 0:
                arch = result.stdout.strip().lower()
                print(f'通过uname检测到macOS架构: {arch}')
                # 如果uname返回x86_64但我们在Mac上，再次检查是否为ARM64
                if arch == 'x86_64':
                    try:
                        # 检查CPU品牌
                        brand_result = subprocess.run(['sysctl', '-n', 'machdep.cpu.brand_string'], capture_output=True, text=True)
                        if 'Apple' in brand_result.stdout:
                            print('检测到Apple处理器，修正架构为arm64')
                            return 'arm64'
                    except:
                        pass
                return arch
        except:
            pass
    
    elif system == 'linux':  # Linux (包括GitHub Actions)
        try:
            # 使用uname -m命令获取架构
            result = subprocess.run(['uname', '-m'], capture_output=True, text=True)
            if result.returncode == 0:
                arch = result.stdout.strip().lower()
                print(f'通过uname检测到Linux架构: {arch}')
                return arch
        except:
            pass
    
    # 备选方案：使用platform.machine()
    arch = platform.machine().lower()
    print(f'通过platform.machine()检测到架构: {arch}')
    return arch

def download_chromedriver_manually(arch, system_type='linux'):
    '''手动下载正确架构的ChromeDriver，支持多平台'''
    import urllib.request
    import zipfile
    import tempfile
    
    # 获取Chrome版本
    version = '140'  # 默认版本
    
    if system_type == 'darwin':  # macOS
        try:
            chrome_version_result = subprocess.run(
                ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '--version'],
                capture_output=True, text=True
            )
            if chrome_version_result.returncode == 0:
                version_str = chrome_version_result.stdout.strip()
                # 提取主版本号
                version = version_str.split()[2].split('.')[0]
                print(f'检测到Chrome版本: {version}')
        except:
            print(f'Chrome版本检测失败，使用默认版本: {version}')
    else:  # Linux (GitHub Actions)
        # 在CI环境中，使用固定版本避免版本检测问题
        print(f'CI环境使用默认Chrome版本: {version}')
    
    # 根据系统和架构选择下载URL
    if system_type == 'darwin':  # macOS
        if arch in ['arm64', 'aarch64']:
            platform_suffix = 'mac-arm64'
        else:
            platform_suffix = 'mac-x64'
    else:  # Linux
        if arch in ['arm64', 'aarch64']:
            platform_suffix = 'linux64'  # GitHub Actions ARM64暂时使用linux64
        else:
            platform_suffix = 'linux64'
    
    # 构建下载URL
    base_url = f'https://storage.googleapis.com/chrome-for-testing-public/{version}.0.7339.185/{platform_suffix}/chromedriver-{platform_suffix}.zip'
    
    # 创建目标目录
    target_dir = os.path.expanduser(f'~/.wdm/drivers/chromedriver/{platform_suffix}/{version}.0.7339.185')
    os.makedirs(target_dir, exist_ok=True)
    
    driver_path = os.path.join(target_dir, 'chromedriver')
    
    # 如果已存在且是可执行文件，验证架构
    if os.path.exists(driver_path) and os.access(driver_path, os.X_OK):
        try:
            # 验证文件不是文档文件
            if not driver_path.endswith('.chromedriver') and 'THIRD_PARTY' not in driver_path:
                file_result = subprocess.run(['file', driver_path], capture_output=True, text=True)
                print(f'找到现有ChromeDriver: {driver_path}, 类型: {file_result.stdout.strip()}')
                return driver_path
        except:
            pass
    
    print(f'手动下载ChromeDriver for {platform_suffix}...')
    
    try:
        # 下载ChromeDriver
        with tempfile.NamedTemporaryFile(suffix='.zip', delete=False) as tmp_file:
            print(f'下载URL: {base_url}')
            urllib.request.urlretrieve(base_url, tmp_file.name)
            
            # 解压
            with zipfile.ZipFile(tmp_file.name, 'r') as zip_ref:
                zip_ref.extractall(target_dir)
            
            # 查找chromedriver可执行文件（排除文档文件）
            for root, dirs, files in os.walk(target_dir):
                for file in files:
                    if file == 'chromedriver' and not file.endswith('.chromedriver'):
                        extracted_path = os.path.join(root, file)
                        # 验证这是一个可执行文件而不是文档
                        try:
                            file_result = subprocess.run(['file', extracted_path], capture_output=True, text=True)
                            if 'executable' in file_result.stdout.lower() or 'elf' in file_result.stdout.lower():
                                # 移动到目标位置
                                if extracted_path != driver_path:
                                    import shutil
                                    shutil.move(extracted_path, driver_path)
                                # 设置执行权限
                                os.chmod(driver_path, 0o755)
                                print(f'ChromeDriver下载完成: {driver_path}')
                                return driver_path
                        except:
                            # 如果file命令失败，检查文件大小（可执行文件通常较大）
                            if os.path.getsize(extracted_path) > 1024:  # 大于1KB
                                if extracted_path != driver_path:
                                    import shutil
                                    shutil.move(extracted_path, driver_path)
                                os.chmod(driver_path, 0o755)
                                print(f'ChromeDriver下载完成: {driver_path}')
                                return driver_path
        
        raise Exception('下载的文件中未找到chromedriver可执行文件')
        
    except Exception as e:
        print(f'手动下载失败: {e}')
        return None
    finally:
        # 清理临时文件
        try:
            os.unlink(tmp_file.name)
        except:
            pass

try:
    # 检测系统架构和类型
    system_arch = get_real_architecture()
    system_type = platform.system().lower()
    
    print(f'系统类型: {system_type}, 架构: {system_arch}')
    
    # 清理可能存在的错误架构缓存
    import shutil
    cache_dir = os.path.expanduser('~/.wdm/drivers/chromedriver')
    if os.path.exists(cache_dir):
        print('清理旧的ChromeDriver缓存以确保下载正确架构版本')
        shutil.rmtree(cache_dir)
    
    # 首先尝试手动下载正确架构的ChromeDriver
    driver_path = None
    
    # 对于所有架构都尝试手动下载，因为这样更可靠
    print(f'尝试手动下载{system_arch}架构的ChromeDriver')
    driver_path = download_chromedriver_manually(system_arch, system_type)
    
    # 如果手动下载失败，回退到webdriver-manager
    if not driver_path:
        print('手动下载失败，回退到webdriver-manager')
        # 根据架构选择合适的ChromeDriver版本
        if system_arch in ['arm64', 'aarch64']:
            print('使用webdriver-manager下载ARM64版本的ChromeDriver')
            if system_type == 'darwin':
                os.environ['WDM_ARCH'] = 'arm64'
            else:
                os.environ['WDM_ARCH'] = 'x64'  # Linux ARM64使用x64版本
            chrome_driver_manager = ChromeDriverManager()
        elif system_arch in ['x86_64', 'amd64']:
            print('使用webdriver-manager下载x86_64版本的ChromeDriver')
            os.environ['WDM_ARCH'] = 'x64'
            chrome_driver_manager = ChromeDriverManager()
        else:
            print(f'未知架构: {system_arch}，使用默认配置')
            chrome_driver_manager = ChromeDriverManager()
        
        # 安装ChromeDriver并缓存
        driver_path = chrome_driver_manager.install()
    
    print(f'ChromeDriver安装路径: {driver_path}')
    
    # 修正路径：webdriver-manager有时返回错误的文件路径
    def find_valid_chromedriver(search_path):
        '''查找有效的chromedriver可执行文件，排除文档文件'''
        for root, dirs, files in os.walk(search_path):
            for file in files:
                if file == 'chromedriver':
                    potential_path = os.path.join(root, file)
                    # 排除文档文件
                    if 'THIRD_PARTY' in potential_path or file.endswith('.chromedriver'):
                        continue
                    
                    # 检查是否为可执行文件
                    if os.access(potential_path, os.X_OK):
                        try:
                            # 验证文件类型
                            file_result = subprocess.run(['file', potential_path], capture_output=True, text=True)
                            if ('executable' in file_result.stdout.lower() or 
                                'elf' in file_result.stdout.lower() or
                                'mach-o' in file_result.stdout.lower()):
                                return potential_path
                        except:
                            # 如果file命令失败，检查文件大小
                            if os.path.getsize(potential_path) > 1024:  # 大于1KB
                                return potential_path
        return None
    
    if not driver_path or not driver_path.endswith('chromedriver') or 'THIRD_PARTY' in driver_path:
        # 查找实际的chromedriver可执行文件
        if driver_path:
            driver_dir = os.path.dirname(driver_path)
        else:
            driver_dir = os.path.expanduser('~/.wdm/drivers/chromedriver')
        
        found_path = find_valid_chromedriver(driver_dir)
        if found_path:
            driver_path = found_path
            print(f'修正ChromeDriver路径: {driver_path}')
        else:
            # 如果还是没找到，尝试在父目录查找
            parent_dir = os.path.dirname(driver_dir)
            found_path = find_valid_chromedriver(parent_dir)
            if found_path:
                driver_path = found_path
                print(f'在父目录找到ChromeDriver: {driver_path}')
    
    # 最终验证ChromeDriver文件
    if not driver_path:
        raise Exception('无法找到有效的ChromeDriver可执行文件')
    
    # 确保不是文档文件
    if 'THIRD_PARTY' in driver_path or driver_path.endswith('.chromedriver'):
        raise Exception(f'找到的文件是文档文件而非可执行文件: {driver_path}')
    
    # 检查下载的文件是否为可执行文件
    if os.path.isfile(driver_path) and os.access(driver_path, os.X_OK):
        print('✅ ChromeDriver文件检查通过')
        # 验证架构是否匹配
        try:
            file_result = subprocess.run(['file', driver_path], capture_output=True, text=True)
            file_info = file_result.stdout.strip()
            print(f'✅ ChromeDriver文件信息: {file_info}')
            
            # 对于GitHub Actions Linux环境，不强制要求架构匹配
            if os.environ.get('GITHUB_ACTIONS') != 'true':
                if system_arch == 'arm64' and 'arm64' not in file_info:
                    print(f'⚠️  架构不匹配: 期望arm64，实际为{file_info}')
        except Exception as e:
            print(f'文件类型检查失败: {e}')
    else:
        print(f'⚠️  ChromeDriver文件权限问题，尝试修复: {driver_path}')
        if os.path.isfile(driver_path):
            os.chmod(driver_path, 0o755)
        else:
            raise Exception(f'ChromeDriver文件不存在: {driver_path}')
    
    # 验证ChromeDriver是否可用
    options = Options()
    options.add_argument('--headless')
    options.add_argument('--no-sandbox')
    options.add_argument('--disable-dev-shm-usage')
    options.add_argument('--disable-gpu')
    options.add_argument('--disable-extensions')
    
    # GitHub Actions环境的额外配置
    if os.environ.get('GITHUB_ACTIONS') == 'true':
        options.add_argument('--disable-background-timer-throttling')
        options.add_argument('--disable-backgrounding-occluded-windows')
        options.add_argument('--disable-renderer-backgrounding')
        options.add_argument('--disable-features=TranslateUI')
        options.add_argument('--disable-ipc-flooding-protection')
    
    try:
        service = Service(driver_path)
        driver = webdriver.Chrome(service=service, options=options)
        driver.quit()
        print('✅ Chrome WebDriver 安装并验证完成')
    except Exception as e:
        print(f'ChromeDriver验证失败: {e}')
        # 在CI环境中，如果验证失败但文件存在，仍然继续
        if os.environ.get('GITHUB_ACTIONS') == 'true' and os.path.isfile(driver_path):
            print('⚠️  CI环境中ChromeDriver验证失败，但文件存在，继续执行')
        else:
            raise
except Exception as e:
    print(f'⚠️  Chrome WebDriver 安装失败: {e}')
    print('请确保Chrome浏览器已安装并检查网络连接')
    # 尝试使用系统ChromeDriver作为备选
    try:
        import subprocess
        result = subprocess.run(['chromedriver', '--version'], capture_output=True, text=True)
        if result.returncode == 0:
            print('✅ 系统ChromeDriver可用作备选')
        else:
            print('❌ 系统ChromeDriver不可用')
    except:
        print('❌ 未找到系统ChromeDriver')
"

# 9. 验证项目配置
echo "验证项目配置..."
if [ ! -f "Makefile" ]; then
    echo "⚠️  警告: 未找到Makefile，请确保项目根目录正确"
fi

if [ ! -f "go.mod" ]; then
    echo "⚠️  警告: 未找到go.mod，请确保在Go项目根目录"
fi

if [ ! -f "package.json" ]; then
    echo "⚠️  警告: 未找到package.json，请确保前端配置正确"
fi

# 10. 创建测试执行脚本
echo "创建测试执行脚本..."
cat > scripts/run_e2e_tests.sh << 'EOF'
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
EOF

chmod +x scripts/run_e2e_tests.sh

echo ""
echo "🎉 E2E测试环境准备完成！"
echo ""
echo "📋 下一步操作："
echo "1. 启动应用服务: make dev"
echo "2. 执行E2E测试: ./scripts/run_e2e_tests.sh"
echo "3. 查看测试报告: open tests/reports/e2e_report.html"
echo ""
echo "⚠️  注意: 项目前后端统一运行在端口3006"