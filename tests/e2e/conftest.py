# tests/e2e/conftest.py
import pytest
import subprocess
import time
import requests
import os
import yaml
import json
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from webdriver_manager.chrome import ChromeDriverManager

@pytest.fixture(scope="session")
def test_config():
    """加载测试配置"""
    config_path = "e2e_testdata/config/test_config.yaml"
    if not os.path.exists(config_path):
        # 如果配置文件不存在，创建默认配置
        default_config = {
            "test_environment": {
                "backend_url": "http://localhost:3006",
                "frontend_url": "http://localhost:3006",
                "websocket_url": "ws://localhost:3006/ws"
            },
            "browser_config": {
                "headless": True,
                "window_size": [1920, 1080],
                "timeout": 30
            },
            "test_data": {
                "courses_dir": "./e2e_testdata/courses",
                "default_image": "ubuntu:20.04"
            },
            "performance_thresholds": {
                "api_response_time": 2.0,
                "container_startup_time": 30.0,
                "websocket_latency": 0.1,
                "memory_limit_mb": 512
            }
        }
        
        os.makedirs(os.path.dirname(config_path), exist_ok=True)
        with open(config_path, "w") as f:
            yaml.dump(default_config, f, default_flow_style=False, allow_unicode=True)
        
        return default_config
    
    with open(config_path, "r") as f:
        return yaml.safe_load(f)

@pytest.fixture(scope="session")
def services_running(test_config):
    """确保测试服务运行"""
    backend_url = test_config["test_environment"]["backend_url"]
    frontend_url = test_config["test_environment"]["frontend_url"]
    
    # 等待服务启动
    for url in [backend_url + "/health", frontend_url]:
        for _ in range(30):
            try:
                response = requests.get(url, timeout=2)
                if response.status_code == 200:
                    break
            except:
                pass
            time.sleep(1)
        else:
            raise Exception(f"服务 {url} 启动失败")
    
    yield
    
    # 测试完成后清理

@pytest.fixture
def browser_driver(test_config):
    """创建浏览器驱动"""
    options = Options()
    
    browser_config = test_config["browser_config"]
    if browser_config["headless"]:
        options.add_argument("--headless")
    
    # 添加稳定性选项（保留E2E测试必需的功能）
    options.add_argument("--no-sandbox")
    options.add_argument("--disable-dev-shm-usage")
    options.add_argument("--disable-gpu")
    options.add_argument("--disable-web-security")
    options.add_argument("--allow-running-insecure-content")
    options.add_argument("--disable-extensions")
    options.add_argument("--disable-plugins")
    options.add_argument("--disable-images")  # 禁用图片加载以提高性能
    # 注意：不禁用JavaScript，因为E2E测试需要JavaScript
    options.add_argument(f"--window-size={browser_config['window_size'][0]},{browser_config['window_size'][1]}")
    
    # 自动管理ChromeDriver - 改进版本
    driver = None
    
    try:
        # 方法1: 优先使用缓存的ChromeDriver，避免重复下载
        from selenium.webdriver.chrome.service import Service
        from webdriver_manager.chrome import ChromeDriverManager
        import platform
        import os
        
        # 检测系统架构
        system_arch = platform.machine().lower()
        
        # 检查是否已有缓存的ChromeDriver
        chrome_driver_manager = ChromeDriverManager()
        
        # 尝试获取缓存的驱动路径，避免重复下载
        try:
            # 先尝试获取已缓存的驱动
            driver_path = chrome_driver_manager.install()
            
            # 修复webdriver-manager路径问题
            if driver_path and ('THIRD_PARTY_NOTICES' in driver_path or not os.path.basename(driver_path) == 'chromedriver'):
                # webdriver-manager可能返回错误的路径，需要找到实际的chromedriver可执行文件
                base_dir = os.path.dirname(driver_path)
                # 检查是否有chromedriver-mac-x64目录
                mac_x64_dir = os.path.join(base_dir, 'chromedriver-mac-x64')
                if os.path.exists(mac_x64_dir):
                    chromedriver_path = os.path.join(mac_x64_dir, 'chromedriver')
                    if os.path.exists(chromedriver_path):
                        # 确保chromedriver有执行权限
                        os.chmod(chromedriver_path, 0o755)
                        driver_path = chromedriver_path
                        print(f"修正ChromeDriver路径: {driver_path}")
                else:
                    # 在当前目录查找chromedriver文件
                    for file in os.listdir(base_dir):
                        if file == 'chromedriver':
                            driver_path = os.path.join(base_dir, file)
                            os.chmod(driver_path, 0o755)
                            break
            
            # 验证驱动是否可用
            if os.path.exists(driver_path) and os.access(driver_path, os.X_OK):
                print(f"✅ 使用缓存的ChromeDriver: {driver_path}")
            else:
                print("缓存的ChromeDriver不可用，重新下载...")
                driver_path = chrome_driver_manager.install()
                print(f"✅ 重新下载ChromeDriver: {driver_path}")
        except:
            print("正在下载匹配的ChromeDriver...")
            print(f"检测到系统架构: {system_arch}")
            driver_path = chrome_driver_manager.install()
            print(f"ChromeDriver路径: {driver_path}")
        
        service = Service(driver_path)
        driver = webdriver.Chrome(service=service, options=options)
        print("✅ ChromeDriver配置成功")
        
    except Exception as e:
        print(f"webdriver-manager失败: {e}")
        
        try:
            # 方法2: 尝试手动下载最新的ChromeDriver
            print("尝试手动下载最新ChromeDriver...")
            import requests
            import zipfile
            import tempfile
            import shutil
            import stat
            
            # 获取Chrome版本
            chrome_version = None
            try:
                import subprocess
                result = subprocess.run([
                    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", 
                    "--version"
                ], capture_output=True, text=True)
                if result.returncode == 0:
                    chrome_version = result.stdout.strip().split()[-1]
                    print(f"检测到Chrome版本: {chrome_version}")
            except:
                pass
            
            if chrome_version:
                # 获取主版本号
                major_version = chrome_version.split('.')[0]
                
                # 下载对应的ChromeDriver
                system_arch = platform.machine().lower()
                if system_arch == 'arm64':
                    platform_suffix = 'mac-arm64'
                else:
                    platform_suffix = 'mac-x64'
                
                # 使用Chrome for Testing API获取最新的ChromeDriver
                api_url = f"https://googlechromelabs.github.io/chrome-for-testing/known-good-versions-with-downloads.json"
                response = requests.get(api_url, timeout=10)
                
                if response.status_code == 200:
                    data = response.json()
                    # 查找匹配的版本
                    matching_version = None
                    for version_info in reversed(data['versions']):
                        if version_info['version'].startswith(major_version + '.'):
                            if 'downloads' in version_info and 'chromedriver' in version_info['downloads']:
                                for download in version_info['downloads']['chromedriver']:
                                    if download['platform'] == platform_suffix:
                                        matching_version = version_info
                                        download_url = download['url']
                                        break
                                if matching_version:
                                    break
                    
                    if matching_version:
                        print(f"找到匹配版本: {matching_version['version']}")
                        print(f"下载URL: {download_url}")
                        
                        # 下载并解压
                        with tempfile.TemporaryDirectory() as temp_dir:
                            zip_path = os.path.join(temp_dir, "chromedriver.zip")
                            
                            # 下载文件
                            with requests.get(download_url, stream=True) as r:
                                r.raise_for_status()
                                with open(zip_path, 'wb') as f:
                                    shutil.copyfileobj(r.raw, f)
                            
                            # 解压
                            with zipfile.ZipFile(zip_path, 'r') as zip_ref:
                                zip_ref.extractall(temp_dir)
                            
                            # 查找chromedriver可执行文件
                            chromedriver_path = None
                            for root, dirs, files in os.walk(temp_dir):
                                for file in files:
                                    if file == 'chromedriver':
                                        chromedriver_path = os.path.join(root, file)
                                        break
                                if chromedriver_path:
                                    break
                            
                            if chromedriver_path:
                                # 设置执行权限
                                os.chmod(chromedriver_path, stat.S_IRWXU | stat.S_IRGRP | stat.S_IXGRP | stat.S_IROTH | stat.S_IXOTH)
                                
                                service = Service(chromedriver_path)
                                driver = webdriver.Chrome(service=service, options=options)
                                print("✅ 手动下载ChromeDriver成功")
            
        except Exception as e2:
            print(f"手动下载ChromeDriver失败: {e2}")
            
            try:
                # 方法3: 降级使用系统ChromeDriver（可能版本不匹配，但至少能运行）
                print("尝试使用系统ChromeDriver...")
                driver = webdriver.Chrome(options=options)
                print("✅ 系统ChromeDriver配置成功")
            except Exception as e3:
                print(f"系统Chrome也失败: {e3}")
                # 最后的降级方案：跳过浏览器测试
                raise Exception("无法配置ChromeDriver，请手动安装匹配的ChromeDriver或跳过浏览器测试")
    
    # 确保driver已成功创建
    if driver is None:
        raise Exception("无法创建ChromeDriver实例")
    
    driver.implicitly_wait(browser_config["timeout"])
    
    yield driver
    
    # 清理
    driver.quit()

@pytest.fixture
def api_client(test_config):
    """API客户端"""
    from .utils.api_client import APIClient
    return APIClient(test_config["test_environment"]["backend_url"])

@pytest.fixture
def websocket_client(test_config):
    """WebSocket客户端"""
    from .utils.websocket_client import WebSocketClient
    return WebSocketClient(test_config["test_environment"]["websocket_url"])

@pytest.fixture(autouse=True)
def cleanup_containers():
    """自动清理测试容器"""
    yield
    
    # 测试完成后清理容器
    import docker
    try:
        client = docker.from_env()
        containers = client.containers.list(all=True)
        for container in containers:
            if "kwdb-course-e2e" in container.name or "e2e-test" in container.name:
                try:
                    container.remove(force=True)
                    print(f"清理测试容器: {container.name}")
                except:
                    pass
    except:
        pass

@pytest.fixture
def screenshot_on_failure(request, browser_driver):
    """测试失败时自动截图"""
    yield
    
    if request.node.rep_call.failed:
        # 创建截图目录
        screenshot_dir = "tests/screenshots"
        os.makedirs(screenshot_dir, exist_ok=True)
        
        # 生成截图文件名
        test_name = request.node.name
        timestamp = int(time.time())
        screenshot_path = os.path.join(screenshot_dir, f"{test_name}_{timestamp}.png")
        
        # 保存截图
        browser_driver.save_screenshot(screenshot_path)
        print(f"测试失败截图保存至: {screenshot_path}")

@pytest.hookimpl(tryfirst=True, hookwrapper=True)
def pytest_runtest_makereport(item, call):
    """为每个测试创建报告，用于失败检测"""
    outcome = yield
    rep = outcome.get_result()
    setattr(item, "rep_" + rep.when, rep)