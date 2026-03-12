package docker

import "time"

// 容器标签常量定义
const (
	// LabelCourseID 课程ID标签键
	LabelCourseID = "kwdb-playground.course-id"
	// LabelAppName 应用名称标签键
	LabelAppName = "kwdb-playground.app"
	// LabelVersion 版本标签键
	LabelVersion = "kwdb-playground.version"
	// LabelCreatedAt 创建时间标签键
	LabelCreatedAt = "kwdb-playground.created-at"
)

// ContainerState 定义容器状态枚举
type ContainerState string

const (
	StateCreating ContainerState = "creating"
	StateStarting ContainerState = "starting"
	StateRunning  ContainerState = "running"
	StatePaused   ContainerState = "paused"
	StateStopped  ContainerState = "stopped"
	StateExited   ContainerState = "exited"
	StateError    ContainerState = "error"
)

// ContainerInfo 容器信息结构体
type ContainerInfo struct {
	ID         string            `json:"id"`
	CourseID   string            `json:"courseId"`
	DockerID   string            `json:"dockerId"`
	State      ContainerState    `json:"state"`
	Image      string            `json:"image"`
	StartedAt  time.Time         `json:"startedAt"`
	ExitCode   *int              `json:"exitCode,omitempty"`
	Message    string            `json:"message,omitempty"`
	Env        map[string]string `json:"env,omitempty"`
	Ports      map[string]string `json:"ports,omitempty"`
	Privileged bool              `json:"privileged,omitempty"`
	Name       string            `json:"name,omitempty"` // 容器名称
	Port       int               `json:"port,omitempty"` // 占用的端口号
}

// ContainerConfig 容器配置结构体
type ContainerConfig struct {
	Image       string            `json:"image"`
	Env         map[string]string `json:"env,omitempty"`
	Ports       map[string]string `json:"ports,omitempty"`
	Volumes     map[string]string `json:"volumes,omitempty"`
	WorkingDir  string            `json:"workingDir,omitempty"`
	Cmd         []string          `json:"cmd,omitempty"`
	MemoryLimit int64             `json:"memoryLimit,omitempty"`
	CPULimit    float64           `json:"cpuLimit,omitempty"`
	Privileged  bool              `json:"privileged,omitempty"`
}

// PortConflictInfo 端口冲突信息结构体
type PortConflictInfo struct {
	HasConflict       bool           `json:"hasConflict"`                 // 是否存在端口冲突
	IsCourseContainer bool           `json:"isCourseContainer"`           // 是否为课程容器占用
	ConflictContainer *ContainerInfo `json:"conflictContainer,omitempty"` // 冲突容器信息
}

// CleanupResult 清理结果结构体
type CleanupResult struct {
	Success           bool             `json:"success"`           // 清理是否成功
	Message           string           `json:"message"`           // 清理结果消息
	CleanedContainers []*ContainerInfo `json:"cleanedContainers"` // 已清理的容器列表
}

type LocalImageCleanupItem struct {
	ImageName    string   `json:"imageName"`
	Status       string   `json:"status"`
	Message      string   `json:"message"`
	CourseIDs    []string `json:"courseIds"`
	CourseTitles []string `json:"courseTitles"`
}

type LocalImageCleanupResult struct {
	Success      bool                    `json:"success"`
	Message      string                  `json:"message"`
	Total        int                     `json:"total"`
	SuccessCount int                     `json:"successCount"`
	FailureCount int                     `json:"failureCount"`
	Results      []LocalImageCleanupItem `json:"results"`
}

// containerStateCache 缓存容器状态信息以减少API调用
type containerStateCache struct {
	isRunning   bool
	lastChecked time.Time
	cacheTTL    time.Duration
}

// ImageAvailability 镜像可用性检查结果
type ImageAvailability struct {
	Available    bool      `json:"available"` // 镜像是否可用
	LocalCached  bool      `json:"localCached"`
	ImageName    string    `json:"imageName"`    // 镜像名称
	Message      string    `json:"message"`      // 状态消息
	CheckedAt    time.Time `json:"checkedAt"`    // 检查时间
	ResponseTime int64     `json:"responseTime"` // 响应时间（毫秒）
}

// CodeLanguage 定义支持的代码执行语言
type CodeLanguage string

const (
	// LanguagePython Python语言
	LanguagePython CodeLanguage = "python"
	// LanguageBash Bash脚本
	LanguageBash CodeLanguage = "bash"
	// LanguageNode JavaScript/Node.js
	LanguageNode CodeLanguage = "node"
	// LanguageJava Java语言
	LanguageJava CodeLanguage = "java"
)

// ExecCodeResult 代码执行结果
type ExecCodeResult struct {
	Stdout   string `json:"stdout"`          // 标准输出
	Stderr   string `json:"stderr"`          // 标准错误
	ExitCode int    `json:"exitCode"`        // 退出码
	Error    string `json:"error,omitempty"` // 错误信息（如果有）
	Duration int64  `json:"duration"`        // 执行时长（毫秒）
}

// ExecCodeOptions 代码执行选项
type ExecCodeOptions struct {
	Language CodeLanguage  // 代码语言
	Code     string        // 要执行的代码
	Timeout  time.Duration // 执行超时时间（默认30秒）
}
