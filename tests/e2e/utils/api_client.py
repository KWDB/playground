# tests/e2e/utils/api_client.py
import requests
import json
import time
from typing import Dict, Any, Optional

class APIClient:
    """API客户端封装，提供统一的API调用接口"""
    
    def __init__(self, base_url: str):
        self.base_url = base_url.rstrip('/')  # 移除末尾斜杠
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
    
    def get_courses(self) -> Dict[str, Any]:
        """获取课程列表"""
        response = self.session.get(f"{self.base_url}/api/courses")
        response.raise_for_status()
        return response.json()
    
    def get_course_detail(self, course_id: str) -> Dict[str, Any]:
        """获取课程详情"""
        response = self.session.get(f"{self.base_url}/api/courses/{course_id}")
        response.raise_for_status()
        return response.json()
    
    def start_course(self, course_id: str) -> Dict[str, Any]:
        """启动课程"""
        response = self.session.post(f"{self.base_url}/api/courses/{course_id}/start")
        response.raise_for_status()
        return response.json()
    
    def stop_course(self, course_id: str) -> Dict[str, Any]:
        """停止课程"""
        response = self.session.post(f"{self.base_url}/api/courses/{course_id}/stop")
        response.raise_for_status()
        return response.json()
    
    def get_container_status(self, container_id: str) -> Dict[str, Any]:
        """获取容器状态"""
        response = self.session.get(f"{self.base_url}/api/containers/{container_id}/status")
        response.raise_for_status()
        return response.json()
    
    def get_container_logs(self, container_id: str, lines: int = 50) -> str:
        """获取容器日志"""
        response = self.session.get(f"{self.base_url}/api/containers/{container_id}/logs?lines={lines}")
        response.raise_for_status()
        return response.text
    
    def restart_container(self, container_id: str) -> Dict[str, Any]:
        """重启容器"""
        response = self.session.post(f"{self.base_url}/api/containers/{container_id}/restart")
        response.raise_for_status()
        return response.json()
    
    def health_check(self) -> bool:
        """健康检查"""
        try:
            response = self.session.get(f"{self.base_url}/health", timeout=5)
            return response.status_code == 200
        except:
            return False
    
    def wait_for_container_ready(self, container_id: str, timeout: int = 30) -> bool:
        """等待容器就绪"""
        start_time = time.time()
        while time.time() - start_time < timeout:
            try:
                status = self.get_container_status(container_id)
                if status.get("status") == "running":
                    return True
            except:
                pass
            time.sleep(1)
        return False
    
    def measure_api_response_time(self, endpoint: str = "/api/courses") -> float:
        """测量API响应时间"""
        start_time = time.time()
        try:
            response = self.session.get(f"{self.base_url}{endpoint}", timeout=10)
            response.raise_for_status()
            return time.time() - start_time
        except:
            return -1.0