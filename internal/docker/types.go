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

// containerStateCache 缓存容器状态信息以减少API调用
type containerStateCache struct {
	isRunning   bool
	lastChecked time.Time
	cacheTTL    time.Duration
}
