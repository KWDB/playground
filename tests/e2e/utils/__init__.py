# tests/e2e/utils/__init__.py
"""
E2E测试工具包

提供端到端测试所需的各种工具类和辅助函数
"""

from .api_client import APIClient
from .websocket_client import WebSocketClient
from .browser_helper import BrowserHelper
from .test_data_generator import E2ETestDataGenerator

__all__ = [
    'APIClient',
    'WebSocketClient', 
    'BrowserHelper',
    'E2ETestDataGenerator'
]