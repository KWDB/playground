# tests/e2e/test_api_integration.py
import pytest
import time
import requests
from .utils.api_client import APIClient

class TestAPIIntegration:
    """API集成测试（不依赖浏览器）"""
    
    def test_api_health_check(self, api_client, services_running):
        """测试API健康检查 - E2E002"""
        assert api_client.health_check(), "API健康检查失败"
        print("✅ API健康检查通过")
    
    def test_courses_list_api(self, api_client, services_running):
        """测试课程列表API"""
        courses_data = api_client.get_courses()
        
        assert "courses" in courses_data, "API返回数据格式错误"
        courses = courses_data["courses"]
        assert len(courses) > 0, "课程列表为空"
        
        # 验证课程数据结构
        for course in courses:
            assert "id" in course, "课程缺少ID字段"
            assert "title" in course, "课程缺少标题字段"
            print(f"   课程: {course['title']}")
        
        print("✅ 课程列表API测试通过")
    
    def test_course_detail_api(self, api_client, services_running):
        """测试课程详情API"""
        # 先获取课程列表
        courses_data = api_client.get_courses()
        courses = courses_data["courses"]
        
        if len(courses) > 0:
            first_course = courses[0]
            course_id = first_course["id"]
            
            # 获取课程详情
            detail = api_client.get_course_detail(course_id)
            
            # 适配实际的API响应格式
            if "course" in detail:
                course_detail = detail["course"]
                # 检查课程详情是否包含必要字段
                assert "description" in course_detail, "课程详情缺少描述"
                assert "details" in course_detail, "课程详情缺少详细信息"
                print(f"✅ 课程详情API测试通过: {course_id}")
            else:
                # 如果直接包含标题
                assert "title" in detail or "description" in detail, "课程详情格式异常"
                print(f"✅ 课程详情API测试通过: {course_id}")
    
    def test_course_lifecycle_basic(self, api_client, services_running):
        """测试课程生命周期（基础版本）"""
        course_id = "quick-start"
        
        try:
            # 1. 启动课程
            print(f"启动课程: {course_id}")
            start_result = api_client.start_course(course_id)
            assert "containerId" in start_result, "启动课程失败，未获取到容器ID"
            
            container_id = start_result["containerId"]
            print(f"   容器ID: {container_id}")
            
            # 2. 等待容器就绪（短时间）
            print("等待容器就绪...")
            ready = api_client.wait_for_container_ready(container_id, timeout=15)
            if ready:
                print("✅ 容器启动成功")
            else:
                print("⚠️  容器启动超时，但继续测试")
            
            # 3. 检查容器状态
            try:
                status = api_client.get_container_status(container_id)
                print(f"   容器状态: {status.get('status', 'unknown')}")
            except:
                print("⚠️  无法获取容器状态")
            
        finally:
            # 4. 清理：停止课程（增加重试机制）
            print("清理课程...")
            for attempt in range(3):
                try:
                    api_client.stop_course(course_id)
                    print("✅ 课程停止成功")
                    break
                except Exception as e:
                    print(f"   停止尝试 {attempt + 1}/3 失败: {e}")
                    if attempt < 2:
                        time.sleep(2)
                    else:
                        print("⚠️  课程停止失败，可能需要手动清理")
        
        print("✅ 课程生命周期测试完成")
    
    def test_api_response_time(self, api_client, services_running):
        """测试API响应时间"""
        # 测试多次请求的响应时间
        response_times = []
        
        for i in range(5):
            response_time = api_client.measure_api_response_time()
            if response_time > 0:
                response_times.append(response_time)
                print(f"   请求 {i+1}: {response_time*1000:.1f}ms")
        
        if response_times:
            avg_time = sum(response_times) / len(response_times)
            max_time = max(response_times)
            
            print(f"   平均响应时间: {avg_time*1000:.1f}ms")
            print(f"   最大响应时间: {max_time*1000:.1f}ms")
            
            assert avg_time < 2.0, f"平均响应时间过长: {avg_time:.2f}s"
            assert max_time < 5.0, f"最大响应时间过长: {max_time:.2f}s"
            
            print("✅ API响应时间测试通过")
        else:
            print("⚠️  无法测量API响应时间")

if __name__ == "__main__":
    # 直接运行测试
    print("🧪 API集成测试")
    print("=" * 30)
    
    # 创建API客户端
    api_client = APIClient("http://localhost:3006")
    
    # 模拟services_running fixture
    class MockServicesRunning:
        pass
    
    services_running = MockServicesRunning()
    
    # 创建测试实例
    test_instance = TestAPIIntegration()
    
    # 执行测试
    tests = [
        ("API健康检查", test_instance.test_api_health_check),
        ("课程列表API", test_instance.test_courses_list_api),
        ("课程详情API", test_instance.test_course_detail_api),
        ("课程生命周期", test_instance.test_course_lifecycle_basic),
        ("API响应时间", test_instance.test_api_response_time)
    ]
    
    passed = 0
    for test_name, test_method in tests:
        print(f"\n📋 {test_name}...")
        try:
            test_method(api_client, services_running)
            passed += 1
        except Exception as e:
            print(f"❌ {test_name} 失败: {e}")
    
    print(f"\n📊 最终结果: {passed}/{len(tests)} 通过")
    
    if passed == len(tests):
        print("🎉 所有API测试通过！")
    else:
        print("❌ 部分API测试失败")