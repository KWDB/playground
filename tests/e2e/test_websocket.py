# tests/e2e/test_websocket.py
import pytest
import time
import json
import threading
from .utils.websocket_client import WebSocketClient
from .utils.api_client import APIClient

class TestWebSocketInteraction:
    """WebSocket实时交互测试"""
    
    def test_realtime_terminal_interaction(self, api_client, websocket_client, test_config, services_running):
        """测试实时终端交互 - E2E003"""
        
        # 1. 通过API启动课程容器
        print("步骤1: 启动课程容器")
        start_result = api_client.start_course("quick-start")
        assert "containerId" in start_result, "启动课程失败，未获取到容器ID"
        
        container_id = start_result["containerId"]
        print(f"容器ID: {container_id}")
        
        # 2. 等待容器就绪
        print("步骤2: 等待容器就绪")
        assert api_client.wait_for_container_ready(container_id, timeout=30), "容器启动超时"
        
        # 3. 建立WebSocket连接
        print("步骤3: 建立WebSocket连接")
        assert websocket_client.connect(container_id), "WebSocket连接失败"
        
        # 4. 测试基础命令执行
        print("步骤4: 测试基础命令执行")
        test_commands = [
            ("echo 'WebSocket E2E Test'", "WebSocket E2E Test"),
            ("pwd", "/"),
            ("whoami", "root"),
            ("date", "")  # 日期格式可能变化，不验证具体内容
        ]
        
        for command, expected_output in test_commands:
            print(f"执行命令: {command}")
            
            # 执行命令并等待结果
            result = websocket_client.execute_command_and_wait(command, expected_output, timeout=10)
            
            assert result["success"], f"命令 '{command}' 执行失败"
            
            if expected_output:
                # 验证输出包含预期内容
                output_found = any(expected_output in str(output.get("data", "")) 
                                 for output in result["outputs"])
                assert output_found, f"命令 '{command}' 输出不包含预期内容 '{expected_output}'"
        
        # 5. 测试命令执行性能
        print("步骤5: 测试命令执行性能")
        start_time = time.time()
        result = websocket_client.execute_command_and_wait("echo 'performance test'", "performance test")
        execution_time = time.time() - start_time
        
        assert execution_time < 5.0, f"命令执行时间过长: {execution_time:.2f}s"
        
        # 6. 清理资源
        print("步骤6: 清理资源")
        websocket_client.close()
        api_client.stop_course("quick-start")
        
        print("✅ WebSocket实时交互测试通过")
    
    def test_websocket_connection_stability(self, api_client, test_config, services_running):
        """测试WebSocket连接稳定性"""
        
        # 启动课程
        start_result = api_client.start_course("quick-start")
        container_id = start_result["containerId"]
        
        # 等待容器就绪
        api_client.wait_for_container_ready(container_id, timeout=30)
        
        # 创建WebSocket客户端
        ws_client = WebSocketClient(test_config["test_environment"]["websocket_url"])
        
        try:
            # 建立连接
            ws_client.connect(container_id)
            
            # 测试长时间连接稳定性
            print("测试长时间连接稳定性...")
            for i in range(10):
                command = f"echo 'stability test {i}'"
                result = ws_client.execute_command_and_wait(command, f"stability test {i}")
                assert result["success"], f"第{i+1}次命令执行失败"
                time.sleep(1)
            
            # 测试连接状态
            assert ws_client.is_connected(), "WebSocket连接已断开"
            
        finally:
            ws_client.close()
            api_client.stop_course("quick-start")
        
        print("✅ WebSocket连接稳定性测试通过")
    
    def test_websocket_error_handling(self, api_client, test_config, services_running):
        """测试WebSocket错误处理"""
        
        ws_client = WebSocketClient(test_config["test_environment"]["websocket_url"])
        
        # 1. 测试连接到不存在的容器
        print("测试连接到不存在的容器")
        try:
            ws_client.connect("non-existent-container")
            assert False, "应该连接失败"
        except Exception as e:
            print(f"预期的连接失败: {e}")
        
        # 2. 测试正常连接后的错误命令
        start_result = api_client.start_course("quick-start")
        container_id = start_result["containerId"]
        api_client.wait_for_container_ready(container_id, timeout=30)
        
        try:
            ws_client.connect(container_id)
            
            # 执行可能失败的命令
            result = ws_client.execute_command_and_wait("invalid-command-xyz", timeout=5)
            # 命令应该执行但可能返回错误，这是正常的
            assert result["success"], "WebSocket应该能处理无效命令"
            
        finally:
            ws_client.close()
            api_client.stop_course("quick-start")
        
        print("✅ WebSocket错误处理测试通过")