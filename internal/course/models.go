package course

import "time"

// Course 课程模型
type Course struct {
	ID               string            `json:"id" yaml:"id"`
	Title            string            `json:"title" yaml:"title"`
	Description      string            `json:"description" yaml:"description"`
	Details          CourseDetail      `json:"details" yaml:"details"`
	Backend          Backend           `json:"backend" yaml:"backend"`
	Difficulty       string            `json:"difficulty" yaml:"difficulty"`
	EstimatedMinutes int               `json:"estimatedMinutes" yaml:"estimatedMinutes"`
	Tags             []string          `json:"tags" yaml:"tags"`
	DockerImage      string            `json:"dockerImage" yaml:"dockerImage"`
	DockerEnv        map[string]string `json:"dockerEnv,omitempty" yaml:"dockerEnv,omitempty"`
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
	ImageID   string `json:"imageid" yaml:"imageid"`
	Workspace string `json:"workspace" yaml:"workspace"` // 容器工作目录
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
