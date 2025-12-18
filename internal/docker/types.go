package docker

import "time"

// ContainerState 定义容器状态枚举
type ContainerState string

const (
	StateCreating ContainerState = "creating"
	StateStarting ContainerState = "starting"
	StateRunning  ContainerState = "running"
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

// containerStateCache 缓存容器状态信息以减少API调用
type containerStateCache struct {
	isRunning   bool
	lastChecked time.Time
	cacheTTL    time.Duration
}

// ImageAvailability 镜像可用性检查结果
type ImageAvailability struct {
	Available    bool      `json:"available"`    // 镜像是否可用
	ImageName    string    `json:"imageName"`    // 镜像名称
	Message      string    `json:"message"`      // 状态消息
	CheckedAt    time.Time `json:"checkedAt"`    // 检查时间
	ResponseTime int64     `json:"responseTime"` // 响应时间（毫秒）
}
