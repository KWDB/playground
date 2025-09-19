# tests/e2e/utils/websocket_client.py
import websocket
import json
import threading
import time
from queue import Queue, Empty
from typing import Dict, Any, Optional

class WebSocketClient:
    """WebSocket客户端封装，用于终端交互测试"""
    
    def __init__(self, base_url: str):
        self.base_url = base_url.replace('http', 'ws').replace('https', 'wss')
        self.ws = None
        self.messages = Queue()
        self.connected = threading.Event()
        self.error = None
        self.ws_thread = None
    
    def connect(self, container_id: str) -> bool:
        """连接到容器终端"""
        ws_url = f"{self.base_url}/terminal?container_id={container_id}"
        
        def on_message(ws, message):
            """处理接收到的消息"""
            try:
                data = json.loads(message)
                self.messages.put(data)
                if data.get("type") == "connected":
                    self.connected.set()
            except json.JSONDecodeError:
                # 处理非JSON消息
                self.messages.put({"type": "raw", "data": message})
        
        def on_error(ws, error):
            """处理WebSocket错误"""
            self.error = error
            print(f"WebSocket错误: {error}")
        
        def on_close(ws, close_status_code, close_msg):
            """处理连接关闭"""
            self.connected.clear()
            print(f"WebSocket连接关闭: {close_status_code} - {close_msg}")
        
        def on_open(ws):
            """连接建立时的回调"""
            print("WebSocket连接已建立")
        
        self.ws = websocket.WebSocketApp(
            ws_url,
            on_message=on_message,
            on_error=on_error,
            on_close=on_close,
            on_open=on_open
        )
        
        # 在后台线程中运行WebSocket
        self.ws_thread = threading.Thread(target=self.ws.run_forever)
        self.ws_thread.daemon = True
        self.ws_thread.start()
        
        # 等待连接建立
        if self.connected.wait(timeout=10):
            return True
        else:
            raise Exception("WebSocket连接超时")
    
    def send_command(self, command: str) -> bool:
        """发送命令到终端"""
        if not self.ws:
            raise Exception("WebSocket未连接")
        
        message = {
            "type": "input",
            "data": command + "\n"
        }
        
        try:
            self.ws.send(json.dumps(message))
            return True
        except Exception as e:
            print(f"发送命令失败: {e}")
            return False
    
    def get_output(self, timeout: int = 5) -> Optional[Dict[str, Any]]:
        """获取终端输出"""
        try:
            return self.messages.get(timeout=timeout)
        except Empty:
            return None
    
    def wait_for_output(self, expected_text: str, timeout: int = 10) -> bool:
        """等待包含特定文本的输出"""
        start_time = time.time()
        while time.time() - start_time < timeout:
            message = self.get_output(timeout=1)
            if message and expected_text in str(message.get("data", "")):
                return True
        return False
    
    def execute_command_and_wait(self, command: str, expected_output: str = None, timeout: int = 10) -> Dict[str, Any]:
        """执行命令并等待结果"""
        # 清空消息队列
        while not self.messages.empty():
            try:
                self.messages.get_nowait()
            except Empty:
                break
        
        # 发送命令
        if not self.send_command(command):
            raise Exception(f"发送命令失败: {command}")
        
        # 等待输出
        start_time = time.time()
        outputs = []
        
        while time.time() - start_time < timeout:
            message = self.get_output(timeout=1)
            if message:
                outputs.append(message)
                if expected_output and expected_output in str(message.get("data", "")):
                    break
        
        return {
            "command": command,
            "outputs": outputs,
            "success": len(outputs) > 0
        }
    
    def close(self):
        """关闭WebSocket连接"""
        if self.ws:
            self.ws.close()
        if self.ws_thread and self.ws_thread.is_alive():
            self.ws_thread.join(timeout=5)
    
    def is_connected(self) -> bool:
        """检查连接状态"""
        return self.connected.is_set()