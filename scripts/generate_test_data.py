#!/usr/bin/env python3
# scripts/generate_test_data.py
# 测试数据生成脚本

import os
import sys
import yaml
import json

# 添加项目路径到Python路径
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))

from tests.e2e.utils.test_data_generator import E2ETestDataGenerator

def main():
    """生成所有测试数据"""
    print("🔧 生成E2E测试数据...")
    
    # 创建测试数据生成器
    generator = E2ETestDataGenerator("e2e_testdata")
    
    # 1. 生成测试配置
    print("生成测试配置...")
    config = generator.generate_test_config()
    print("✅ 测试配置生成完成")
    
    # 4. 生成预期响应数据
    print("生成预期响应数据...")
    expected_responses = {
        "health_check": {
            "status": "ok",
            "timestamp": "2024-01-01T00:00:00Z"
        },
        "courses_list": {
            "courses": [
                {
                    "id": "quick-start",
                    "title": "快速开始",
                    "description": "KWDB Playground 快速入门课程"
                },
                {
                    "id": "test",
                    "title": "测试课程",
                    "description": "用于测试的示例课程"
                }
            ]
        },
        "course_start": {
            "containerId": "kwdb-course-{course_id}",
            "status": "starting",
            "message": "课程容器正在启动..."
        },
        "container_status": {
            "status": "running",
            "uptime": "00:05:30",
            "memory_usage": "45MB",
            "cpu_usage": "2.5%"
        }
    }
    
    expected_file = os.path.join("e2e_testdata", "fixtures", "expected_responses.json")
    with open(expected_file, "w", encoding='utf-8') as f:
        json.dump(expected_responses, f, indent=2, ensure_ascii=False)
    
    print("✅ 预期响应数据生成完成")
    
    # 5. 生成测试报告模板
    print("生成测试报告模板...")
    report_template = """# KWDB Playground E2E测试报告

## 测试概要
- 测试时间: {test_time}
- 测试环境: {test_env}
- 测试版本: {version}
- 执行者: {executor}

## 测试结果统计
- 总测试场景: {total_tests}
- 通过场景: {passed_tests}
- 失败场景: {failed_tests}
- 跳过场景: {skipped_tests}
- 成功率: {success_rate}%

## 详细测试结果

### 核心业务流程测试
{core_business_results}

### 系统交互测试
{system_interaction_results}

### 性能测试
{performance_results}

## 性能指标
- 平均API响应时间: {avg_api_time}ms
- 平均页面加载时间: {avg_page_load}ms
- WebSocket平均延迟: {avg_ws_latency}ms
- 峰值内存使用: {peak_memory}MB

## 发现的问题
{issues_found}

## 改进建议
{recommendations}

## 测试结论
{conclusion}
"""
    
    template_file = os.path.join("e2e_testdata", "fixtures", "report_template.md")
    with open(template_file, "w", encoding='utf-8') as f:
        f.write(report_template)
    
    print("✅ 测试报告模板生成完成")
    
    print("")
    print("🎉 测试数据生成完成！")
    print("")
    print("📁 生成的文件:")
    print("  - e2e_testdata/config/test_config.yaml")
    print("  - e2e_testdata/fixtures/user_scenarios.json")
    print("  - e2e_testdata/fixtures/expected_responses.json")
    print("  - e2e_testdata/fixtures/report_template.md")

if __name__ == "__main__":
    main()