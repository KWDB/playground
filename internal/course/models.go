package course

import (
	"fmt"
	"strconv"
	"strings"
	"time"

	"gopkg.in/yaml.v3"
)

// Course 课程模型
type Course struct {
	ID               string       `json:"id" yaml:"id"`
	Title            string       `json:"title" yaml:"title"`
	Description      string       `json:"description" yaml:"description"`
	Details          CourseDetail `json:"details" yaml:"details"`
	Backend          Backend      `json:"backend" yaml:"backend"`
	Difficulty       string       `json:"difficulty" yaml:"difficulty"`
	EstimatedMinutes int          `json:"estimatedMinutes" yaml:"estimatedMinutes"`
	Tags             []string     `json:"tags" yaml:"tags"`
	// SqlTerminal 是否启用SQL终端（互斥显示）
	SqlTerminal bool `json:"sqlTerminal" yaml:"sqlTerminal"`
	// CodeTerminal 是否启用代码终端（与SqlTerminal互斥）
	CodeTerminal bool `json:"codeTerminal" yaml:"codeTerminal"`
	// TotalSteps 课程总步骤数
	TotalSteps int `json:"totalSteps" yaml:"-"`
}

// CourseDetail 课程详细信息
type CourseDetail struct {
	Intro  CourseFile   `json:"intro" yaml:"intro"`
	Steps  []CourseStep `json:"steps" yaml:"steps"`
	Finish CourseFile   `json:"finish" yaml:"finish"`
}

// CourseStep 课程步骤
type CourseStep struct {
	Title   string `json:"title" yaml:"title"`
	Text    string `json:"text" yaml:"text"`
	Content string `json:"content,omitempty"`
}

// CourseFile 课程文件
type CourseFile struct {
	Text    string `json:"text" yaml:"text"`
	Content string `json:"content,omitempty"`
}

// Backend 后端配置
type Backend struct {
	ImageID     string   `json:"imageid" yaml:"imageid"`
	Workspace   string   `json:"workspace" yaml:"workspace"`
	Cmd         []string `json:"cmd" yaml:"cmd"`
	Privileged  bool     `json:"privileged" yaml:"privileged"`
	MemoryLimit int64    `json:"memoryLimit,omitempty" yaml:"-"`
	CPULimit    float64  `json:"cpuLimit,omitempty" yaml:"-"`
	// Port KWDB服务端口（主机映射端口）
	Port          int `json:"port" yaml:"-"`
	ContainerPort int `json:"containerPort,omitempty" yaml:"-"`
	// Volumes 主机与容器的挂载绑定，例如:
	// - "./meta.sql:/kaiwudb/bin/meta.sql"
	// 采用列表形式便于在 YAML 中书写
	Volumes []string `json:"volumes" yaml:"volumes"`
	// Env 环境变量，例如:
	// - "KW_VERSION=3.0.0"
	Env []string `json:"env" yaml:"env"`
}

func (b *Backend) UnmarshalYAML(value *yaml.Node) error {
	type backendAlias struct {
		ImageID    string      `yaml:"imageid"`
		Workspace  string      `yaml:"workspace"`
		Cmd        []string    `yaml:"cmd"`
		Privileged bool        `yaml:"privileged"`
		Port       interface{} `yaml:"port"`
		Volumes    []string    `yaml:"volumes"`
		Env        []string    `yaml:"env"`
	}

	var raw backendAlias
	if err := value.Decode(&raw); err != nil {
		return err
	}

	b.ImageID = raw.ImageID
	b.Workspace = raw.Workspace
	b.Cmd = raw.Cmd
	b.Privileged = raw.Privileged
	b.Volumes = raw.Volumes
	b.Env = raw.Env
	b.Port = 0
	b.ContainerPort = 0

	hostPort, containerPort, err := parseBackendPort(raw.Port)
	if err != nil {
		return err
	}
	b.Port = hostPort
	b.ContainerPort = containerPort
	return nil
}

func parseBackendPort(portRaw interface{}) (int, int, error) {
	if portRaw == nil {
		return 0, 0, nil
	}

	parsePortInt := func(value string) (int, error) {
		v := strings.TrimSpace(value)
		if v == "" {
			return 0, fmt.Errorf("端口不能为空")
		}
		n, err := strconv.Atoi(v)
		if err != nil {
			return 0, fmt.Errorf("无效端口 %q", value)
		}
		if n <= 0 || n > 65535 {
			return 0, fmt.Errorf("端口 %d 超出范围", n)
		}
		return n, nil
	}

	switch v := portRaw.(type) {
	case int:
		if v <= 0 || v > 65535 {
			return 0, 0, fmt.Errorf("端口 %d 超出范围", v)
		}
		return v, 26257, nil
	case int64:
		if v <= 0 || v > 65535 {
			return 0, 0, fmt.Errorf("端口 %d 超出范围", v)
		}
		return int(v), 26257, nil
	case float64:
		n := int(v)
		if float64(n) != v {
			return 0, 0, fmt.Errorf("端口必须是整数")
		}
		if n <= 0 || n > 65535 {
			return 0, 0, fmt.Errorf("端口 %d 超出范围", n)
		}
		return n, 26257, nil
	case string:
		trimmed := strings.TrimSpace(v)
		if trimmed == "" {
			return 0, 0, nil
		}
		if strings.Contains(trimmed, ":") {
			parts := strings.Split(trimmed, ":")
			if len(parts) != 2 {
				return 0, 0, fmt.Errorf("端口映射格式无效: %q", trimmed)
			}
			hostPort, err := parsePortInt(parts[0])
			if err != nil {
				return 0, 0, err
			}
			containerPort, err := parsePortInt(parts[1])
			if err != nil {
				return 0, 0, err
			}
			return hostPort, containerPort, nil
		}

		hostPort, err := parsePortInt(trimmed)
		if err != nil {
			return 0, 0, err
		}
		return hostPort, 26257, nil
	default:
		return 0, 0, fmt.Errorf("不支持的端口类型: %T", portRaw)
	}
}

// UserProgress 用户课程进度
type UserProgress struct {
	UserID      string     `json:"user_id"`
	CourseID    string     `json:"course_id"`
	CurrentStep int        `json:"current_step"`
	Completed   bool       `json:"completed"`
	StartedAt   time.Time  `json:"started_at"`
	CompletedAt *time.Time `json:"completed_at,omitempty"`
	UpdatedAt   time.Time  `json:"updated_at"`
}

// ExecutionCommand 可执行命令
type ExecutionCommand struct {
	Command   string `json:"command"`
	StepIndex int    `json:"step_index"`
	CourseID  string `json:"course_id"`
}
