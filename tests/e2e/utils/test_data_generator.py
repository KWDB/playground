# tests/e2e/utils/test_data_generator.py
import os
import yaml
import json
from datetime import datetime
from typing import Dict, List, Any

class E2ETestDataGenerator:
    """测试数据生成器，用于创建测试课程和配置"""
    
    def __init__(self, base_dir: str = "e2e_testdata"):
        self.base_dir = base_dir
        
    def generate_test_config(self):
        """生成测试配置文件"""
        config = {
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
        
        config_file = os.path.join(self.base_dir, "config", "test_config.yaml")
        os.makedirs(os.path.dirname(config_file), exist_ok=True)
        
        with open(config_file, "w", encoding='utf-8') as f:
            yaml.dump(config, f, default_flow_style=False, allow_unicode=True)
        
        return config