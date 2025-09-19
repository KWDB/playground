#!/usr/bin/env python3
# scripts/test_chromedriver.py
# ChromeDriver配置测试脚本

import sys
import os

# 添加项目路径
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))

def test_chromedriver():
    """测试ChromeDriver配置"""
    try:
        from selenium import webdriver
        from selenium.webdriver.chrome.options import Options
        from webdriver_manager.chrome import ChromeDriverManager
        from selenium.webdriver.chrome.service import Service
        
        print("🔧 测试ChromeDriver配置...")
        
        # 配置Chrome选项
        options = Options()
        options.add_argument("--headless")  # 无头模式
        options.add_argument("--no-sandbox")
        options.add_argument("--disable-dev-shm-usage")
        options.add_argument("--disable-gpu")
        options.add_argument("--window-size=1920,1080")
        
        print("📥 正在下载匹配的ChromeDriver...")
        
        # 使用webdriver-manager自动下载匹配的ChromeDriver
        service = Service(ChromeDriverManager().install())
        
        print("🚀 启动Chrome浏览器...")
        driver = webdriver.Chrome(service=service, options=options)
        
        # 测试基本功能
        print("🌐 测试页面访问...")
        driver.get("http://localhost:3006")
        
        title = driver.title
        print(f"📄 页面标题: {title}")
        
        # 关闭浏览器
        driver.quit()
        
        print("✅ ChromeDriver配置测试成功！")
        return True
        
    except Exception as e:
        print(f"❌ ChromeDriver配置测试失败: {e}")
        return False

def main():
    """主函数"""
    print("🧪 ChromeDriver配置测试")
    print("=" * 40)
    
    success = test_chromedriver()
    
    if success:
        print("\n🎉 ChromeDriver已正确配置，可以运行浏览器测试")
        return 0
    else:
        print("\n💡 建议:")
        print("1. 确保Chrome浏览器已安装")
        print("2. 检查网络连接（需要下载ChromeDriver）")
        print("3. 或者运行API测试: ./scripts/quick_e2e_test.sh")
        return 1

if __name__ == "__main__":
    sys.exit(main())