package course

import "time"

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
	ImageID    string   `json:"imageid" yaml:"imageid"`
	Workspace  string   `json:"workspace" yaml:"workspace"`
	Cmd        []string `json:"cmd" yaml:"cmd"`
	Privileged bool     `json:"privileged" yaml:"privileged"`
	// Port KWDB服务端口（主机映射端口）
	Port int `json:"port" yaml:"port"`
	// Volumes 主机与容器的挂载绑定，例如:
	// - "./meta.sql:/kaiwudb/bin/meta.sql"
	// 采用列表形式便于在 YAML 中书写
	Volumes []string `json:"volumes" yaml:"volumes"`
	// Env 环境变量，例如:
	// - "KW_VERSION=3.0.0"
	Env []string `json:"env" yaml:"env"`
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
