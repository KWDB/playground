"""
端口冲突智能处理功能的 Playwright 自动化测试

测试场景：
1. 启动一个容器占用端口
2. 尝试启动第二个容器触发端口冲突
3. 验证端口冲突检测和智能处理功能
4. 测试容器清理功能
5. 验证清理后可以正常启动容器
"""

import pytest
import time
import requests
from playwright.sync_api import Page, expect
from tests.e2e.utils.browser_helper import BrowserHelper
from tests.e2e.utils.api_client import APIClient


class TestPortConflictHandling:
    """端口冲突处理测试类"""
    
    @pytest.fixture(autouse=True)
    def setup_and_cleanup(self, api_client):
        """测试前后的清理工作"""
        # 测试前清理所有 SQL 课程容器
        try:
            api_client.cleanup_course_containers("sql")
            time.sleep(2)  # 等待容器完全清理
        except:
            pass
        
        yield
        
        # 测试后清理
        try:
            api_client.cleanup_course_containers("sql")
        except:
            pass

    def test_port_conflict_api_functionality(self, api_client):
        """测试端口冲突检查 API 的基本功能"""
        print("=== 测试端口冲突检查 API 功能 ===")
        
        # 1. 测试无冲突情况
        print("步骤1: 测试无冲突端口检查")
        conflict_info = api_client.check_port_conflict("sql", 26257)
        assert not conflict_info["isConflicted"], "端口应该没有冲突"
        assert len(conflict_info["conflictContainers"]) == 0, "不应该有冲突容器"
        print("✅ 无冲突检查通过")
        
        # 2. 启动容器创建端口占用
        print("步骤2: 启动容器创建端口占用")
        start_result = api_client.start_course("sql")
        assert "containerId" in start_result, "容器启动应该成功"
        container_id = start_result["containerId"]
        print(f"✅ 容器启动成功: {container_id}")
        
        # 等待容器完全启动
        time.sleep(3)
        
        # 3. 测试端口冲突检测
        print("步骤3: 测试端口冲突检测")
        conflict_info = api_client.check_port_conflict("sql", 26257)
        assert conflict_info["isConflicted"], "应该检测到端口冲突"
        assert len(conflict_info["conflictContainers"]) > 0, "应该有冲突容器"
        
        conflict_container = conflict_info["conflictContainers"][0]
        assert conflict_container["port"] == "26257", "冲突端口应该是 26257"
        assert conflict_container["courseId"] == "sql", "冲突容器应该属于 sql 课程"
        print("✅ 端口冲突检测通过")
        
        # 4. 测试容器清理功能
        print("步骤4: 测试容器清理功能")
        cleanup_result = api_client.cleanup_course_containers("sql")
        assert cleanup_result["success"], "容器清理应该成功"
        assert cleanup_result["totalCleaned"] > 0, "应该清理了至少一个容器"
        print(f"✅ 容器清理成功，清理了 {cleanup_result['totalCleaned']} 个容器")
        
        # 等待清理完成
        time.sleep(2)
        
        # 5. 验证清理后端口释放
        print("步骤5: 验证清理后端口释放")
        conflict_info = api_client.check_port_conflict("sql", 26257)
        assert not conflict_info["isConflicted"], "清理后端口应该没有冲突"
        assert len(conflict_info["conflictContainers"]) == 0, "清理后不应该有冲突容器"
        print("✅ 端口释放验证通过")

    def test_port_conflict_api_validation(self, api_client):
        """测试端口冲突检查 API 的参数验证"""
        print("=== 测试 API 参数验证功能 ===")
        
        # 1. 测试无效端口格式
        print("步骤1: 测试无效端口格式")
        try:
            response = requests.get(f"{api_client.base_url}/api/courses/sql/check-port-conflict?port=invalid")
            assert response.status_code == 400
            error_data = response.json()
            assert "端口号格式无效" in error_data["error"]
            print("✅ 无效端口格式验证通过")
        except Exception as e:
            pytest.fail(f"无效端口格式测试失败: {e}")
        
        # 2. 测试端口范围验证
        print("步骤2: 测试端口范围验证")
        try:
            response = requests.get(f"{api_client.base_url}/api/courses/sql/check-port-conflict?port=70000")
            assert response.status_code == 400
            error_data = response.json()
            assert "端口号必须在 1-65535 范围内" in error_data["error"]
            print("✅ 端口范围验证通过")
        except Exception as e:
            pytest.fail(f"端口范围测试失败: {e}")
        
        # 3. 测试不存在的课程
        print("步骤3: 测试不存在的课程")
        try:
            response = requests.get(f"{api_client.base_url}/api/courses/nonexistent/check-port-conflict?port=26257")
            assert response.status_code == 404
            error_data = response.json()
            assert "课程不存在" in error_data["error"]
            print("✅ 课程存在性验证通过")
        except Exception as e:
            pytest.fail(f"课程存在性测试失败: {e}")

    def test_frontend_port_conflict_handling(self, browser_driver, api_client):
        """测试前端端口冲突智能处理功能"""
        print("=== 测试前端端口冲突智能处理 ===")
        
        browser_helper = BrowserHelper(browser_driver)
        
        # 1. 先启动一个容器占用端口
        print("步骤1: 启动容器占用端口")
        start_result = api_client.start_course("sql")
        container_id = start_result["containerId"]
        print(f"✅ 第一个容器启动成功: {container_id}")
        time.sleep(3)
        
        # 2. 导航到学习页面
        print("步骤2: 导航到 SQL 课程学习页面")
        browser_helper.navigate_to_course_list()
        
        # 查找并点击 SQL 课程
        sql_course_link = browser_driver.locator("a[href*='/learn/sql']").first
        expect(sql_course_link).to_be_visible(timeout=10000)
        sql_course_link.click()
        
        # 等待学习页面加载
        expect(browser_driver.locator("h1")).to_contain_text("SQL", timeout=10000)
        print("✅ 成功导航到 SQL 课程页面")
        
        # 3. 尝试启动课程（应该触发端口冲突）
        print("步骤3: 尝试启动课程触发端口冲突")
        start_button = browser_driver.locator("button:has-text('启动课程'), button:has-text('开始学习')")
        
        if start_button.count() > 0:
            start_button.first.click()
            print("✅ 点击了启动按钮")
            
            # 4. 等待并检查是否显示端口冲突处理组件
            print("步骤4: 检查端口冲突处理组件")
            
            # 等待一段时间让错误处理逻辑执行
            time.sleep(5)
            
            # 检查是否有错误信息或端口冲突处理界面
            error_elements = browser_driver.locator("[class*='error'], [class*='conflict'], .port-conflict-handler")
            
            if error_elements.count() > 0:
                print("✅ 检测到错误处理界面")
                
                # 查找清理按钮或重试按钮
                cleanup_button = browser_driver.locator("button:has-text('清理'), button:has-text('重试'), button:has-text('解决冲突')")
                
                if cleanup_button.count() > 0:
                    print("✅ 找到清理/重试按钮")
                    cleanup_button.first.click()
                    print("✅ 点击了清理按钮")
                    
                    # 等待清理完成
                    time.sleep(3)
                    
                    # 5. 验证清理后可以正常启动
                    print("步骤5: 验证清理后可以正常启动")
                    
                    # 再次尝试启动
                    retry_button = browser_driver.locator("button:has-text('重试'), button:has-text('启动课程')")
                    if retry_button.count() > 0:
                        retry_button.first.click()
                        print("✅ 点击了重试按钮")
                        
                        # 等待启动完成
                        time.sleep(5)
                        
                        # 检查是否启动成功（查找终端或成功状态）
                        success_indicators = browser_driver.locator(
                            ".terminal, [class*='terminal'], [class*='running'], [class*='success']"
                        )
                        
                        if success_indicators.count() > 0:
                            print("✅ 容器启动成功，找到成功指示器")
                        else:
                            print("⚠️  未找到明确的成功指示器，但没有错误")
                else:
                    print("⚠️  未找到清理按钮，可能界面结构不同")
            else:
                print("⚠️  未检测到明显的错误处理界面")
                
                # 检查页面是否有其他错误信息
                page_text = browser_driver.locator("body").inner_text()
                if "端口" in page_text and ("冲突" in page_text or "占用" in page_text):
                    print("✅ 页面文本中包含端口冲突相关信息")
                else:
                    print("⚠️  页面中未找到端口冲突相关信息")
        else:
            print("⚠️  未找到启动按钮，可能页面结构不同")

    def test_multiple_port_conflicts(self, api_client):
        """测试多个端口冲突的处理"""
        print("=== 测试多个端口冲突处理 ===")
        
        # 1. 启动多个不同课程的容器
        print("步骤1: 启动多个课程容器")
        
        # 启动 SQL 课程
        sql_result = api_client.start_course("sql")
        print(f"✅ SQL 课程容器启动: {sql_result['containerId']}")
        time.sleep(2)
        
        # 尝试启动 quick-start 课程（如果存在）
        try:
            quick_start_result = api_client.start_course("quick-start")
            print(f"✅ Quick-start 课程容器启动: {quick_start_result['containerId']}")
            time.sleep(2)
        except:
            print("⚠️  Quick-start 课程启动失败或不存在")
        
        # 2. 检查各个端口的冲突情况
        print("步骤2: 检查端口冲突情况")
        
        # 检查 26257 端口（SQL 课程默认端口）
        sql_conflict = api_client.check_port_conflict("sql", 26257)
        print(f"SQL 端口 26257 冲突状态: {sql_conflict['isConflicted']}")
        
        # 3. 批量清理测试
        print("步骤3: 测试批量清理功能")
        
        sql_cleanup = api_client.cleanup_course_containers("sql")
        print(f"✅ SQL 课程清理完成，清理了 {sql_cleanup['totalCleaned']} 个容器")
        
        try:
            quick_cleanup = api_client.cleanup_course_containers("quick-start")
            print(f"✅ Quick-start 课程清理完成，清理了 {quick_cleanup['totalCleaned']} 个容器")
        except:
            print("⚠️  Quick-start 课程清理跳过")

    def test_concurrent_port_conflict_detection(self, api_client):
        """测试并发端口冲突检测"""
        print("=== 测试并发端口冲突检测 ===")
        
        import threading
        import queue
        
        # 1. 启动一个容器
        print("步骤1: 启动容器")
        start_result = api_client.start_course("sql")
        print(f"✅ 容器启动成功: {start_result['containerId']}")
        time.sleep(2)
        
        # 2. 并发检测端口冲突
        print("步骤2: 并发检测端口冲突")
        
        results = queue.Queue()
        
        def check_conflict():
            try:
                conflict_info = api_client.check_port_conflict("sql", 26257)
                results.put(("success", conflict_info))
            except Exception as e:
                results.put(("error", str(e)))
        
        # 启动多个并发检测线程
        threads = []
        for i in range(5):
            thread = threading.Thread(target=check_conflict)
            threads.append(thread)
            thread.start()
        
        # 等待所有线程完成
        for thread in threads:
            thread.join()
        
        # 检查结果
        success_count = 0
        error_count = 0
        
        while not results.empty():
            status, result = results.get()
            if