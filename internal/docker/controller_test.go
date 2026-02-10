package docker

import (
	"testing"
)

// TestParseCourseIDFromContainerName 测试从容器名称解析课程ID的功能
func TestParseCourseIDFromContainerName(t *testing.T) {
	tests := []struct {
		name          string
		containerName string
		wantCourseID  string
		wantValid     bool
	}{
		{
			name:          "标准课程ID不含连字符",
			containerName: "kwdb-playground-sql-1699999999999999999",
			wantCourseID:  "sql",
			wantValid:     true,
		},
		{
			name:          "课程ID包含连字符-quick-start",
			containerName: "kwdb-playground-quick-start-1699999999999999999",
			wantCourseID:  "quick-start",
			wantValid:     true,
		},
		{
			name:          "课程ID包含连字符-multi-mode",
			containerName: "kwdb-playground-multi-mode-1699999999999999999",
			wantCourseID:  "multi-mode",
			wantValid:     true,
		},
		{
			name:          "课程ID包含多个连字符",
			containerName: "kwdb-playground-advanced-sql-course-1699999999999999999",
			wantCourseID:  "advanced-sql-course",
			wantValid:     true,
		},
		{
			name:          "无效格式-缺少前缀",
			containerName: "some-other-container-1699999999999999999",
			wantCourseID:  "",
			wantValid:     false,
		},
		{
			name:          "无效格式-缺少时间戳",
			containerName: "kwdb-playground-sql",
			wantCourseID:  "",
			wantValid:     false,
		},
		{
			name:          "无效格式-时间戳不是数字",
			containerName: "kwdb-playground-sql-abc",
			wantCourseID:  "sql", // 无法识别时间戳，向后兼容处理
			wantValid:     true,  // 向后兼容时仍然返回true
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// 模拟 parseCourseIDFromContainerName 函数的逻辑
			courseID, valid := parseCourseIDFromContainerName(tt.containerName)

			if valid != tt.wantValid {
				t.Errorf("parseCourseIDFromContainerName() valid = %v, want %v", valid, tt.wantValid)
			}

			if courseID != tt.wantCourseID {
				t.Errorf("parseCourseIDFromContainerName() courseID = %v, want %v", courseID, tt.wantCourseID)
			}
		})
	}
}

// parseCourseIDFromContainerName 从容器名称解析课程ID
// 这是 loadExistingContainers 中解析逻辑的简化版本，用于测试
func parseCourseIDFromContainerName(containerName string) (string, bool) {
	if len(containerName) == 0 {
		return "", false
	}

	// 检查前缀
	prefix := "kwdb-playground-"
	if len(containerName) <= len(prefix) {
		return "", false
	}
	if containerName[:len(prefix)] != prefix {
		return "", false
	}

	// 解析容器名称获取课程ID
	// 格式: kwdb-playground-{courseID}-{timestamp}
	// 移除前缀
	withoutPrefix := containerName[len(prefix):]

	// 分割剩余部分
	parts := []string{}
	current := ""
	for _, c := range withoutPrefix {
		if c == '-' {
			if current != "" {
				parts = append(parts, current)
				current = ""
			}
		} else {
			current += string(c)
		}
	}
	if current != "" {
		parts = append(parts, current)
	}

	if len(parts) < 2 {
		return "", false
	}

	// 最后一部分应该是时间戳
	lastPart := parts[len(parts)-1]
	isTimestamp := true
	for _, c := range lastPart {
		if c < '0' || c > '9' {
			isTimestamp = false
			break
		}
	}

	if !isTimestamp {
		// 无法识别时间戳，使用旧逻辑（向后兼容但不准确）
		return joinParts(parts[0 : len(parts)-1]), true
	}

	// 中间部分都是课程ID
	return joinParts(parts[0 : len(parts)-1]), true
}

// joinParts 将字符串切片用连字符连接
func joinParts(parts []string) string {
	if len(parts) == 0 {
		return ""
	}
	result := parts[0]
	for i := 1; i < len(parts); i++ {
		result += "-" + parts[i]
	}
	return result
}

func TestJoinParts(t *testing.T) {
	tests := []struct {
		name   string
		parts  []string
		expect string
	}{
		{"empty", []string{}, ""},
		{"single", []string{"sql"}, "sql"},
		{"two", []string{"quick", "start"}, "quick-start"},
		{"three", []string{"a", "b", "c"}, "a-b-c"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := joinParts(tt.parts)
			if result != tt.expect {
				t.Errorf("joinParts(%v) = %s, want %s", tt.parts, result, tt.expect)
			}
		})
	}
}

func TestLabelConstants(t *testing.T) {
	if LabelAppName != "kwdb-playground.app" {
		t.Errorf("LabelAppName = %s, want kwdb-playground.app", LabelAppName)
	}
	if LabelCourseID != "kwdb-playground.course-id" {
		t.Errorf("LabelCourseID = %s, want kwdb-playground.course-id", LabelCourseID)
	}
	if LabelVersion != "kwdb-playground.version" {
		t.Errorf("LabelVersion = %s, want kwdb-playground.version", LabelVersion)
	}
	if LabelCreatedAt != "kwdb-playground.created-at" {
		t.Errorf("LabelCreatedAt = %s, want kwdb-playground.created-at", LabelCreatedAt)
	}
}
