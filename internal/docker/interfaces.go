package docker

import (
	"context"
	"io"

	"github.com/moby/moby/api/types"
	"github.com/moby/moby/api/types/container"
	"github.com/moby/moby/api/types/image"
	"github.com/moby/moby/api/types/network"
	"github.com/moby/moby/client"
	v1 "github.com/opencontainers/image-spec/specs-go/v1"
)

// DockerClientInterface Docker客户端接口
type DockerClientInterface interface {
	ContainerCreate(ctx context.Context, config *container.Config, hostConfig *container.HostConfig, networkingConfig *network.NetworkingConfig, platform *v1.Platform, containerName string) (container.CreateResponse, error)
	ContainerStart(ctx context.Context, containerID string, options client.ContainerStartOptions) error
	ContainerStop(ctx context.Context, containerID string, options client.ContainerStopOptions) error
	ContainerRestart(ctx context.Context, containerID string, options client.ContainerStopOptions) error
	ContainerRemove(ctx context.Context, containerID string, options client.ContainerRemoveOptions) error
	ContainerInspect(ctx context.Context, containerID string) (container.InspectResponse, error)
	ContainerList(ctx context.Context, options client.ContainerListOptions) ([]container.Summary, error)
	ContainerLogs(ctx context.Context, containerID string, options client.ContainerLogsOptions) (io.ReadCloser, error)
	ImagePull(ctx context.Context, refStr string, options client.ImagePullOptions) (io.ReadCloser, error)
	ImageInspectWithRaw(ctx context.Context, imageID string) (image.InspectResponse, []byte, error)
	ContainerExecCreate(ctx context.Context, containerID string, config container.ExecOptions) (container.ExecCreateResponse, error)
	ContainerExecAttach(ctx context.Context, execID string, config container.ExecAttachOptions) (client.HijackedResponse, error)
	ContainerExecStart(ctx context.Context, execID string, config container.ExecStartOptions) error
	ContainerExecInspect(ctx context.Context, execID string) (container.ExecInspect, error)
	ContainerExecResize(ctx context.Context, execID string, options client.ContainerResizeOptions) error
	Ping(ctx context.Context) (types.Ping, error)
	Close() error
}

// ImagePullProgressCallback 镜像拉取进度回调函数类型
type ImagePullProgressCallback func(progress ImagePullProgress)

// ImagePullProgress 镜像拉取进度信息
type ImagePullProgress struct {
	ImageName string `json:"imageName"`
	Status    string `json:"status"`
	Progress  string `json:"progress,omitempty"`
	Error     string `json:"error,omitempty"`
}

// TerminalManagerInterface WebSocket终端管理器接口
type TerminalManagerInterface interface {
	BroadcastImagePullProgress(progress ImagePullProgress)
	GetActiveSessionCount() int
}

// Controller Docker控制器接口
type Controller interface {
	// CreateContainer 创建容器
	CreateContainer(ctx context.Context, courseID string, config *ContainerConfig) (*ContainerInfo, error)
	// CreateContainerWithProgress 创建容器并支持镜像拉取进度回调
	CreateContainerWithProgress(ctx context.Context, courseID string, config *ContainerConfig, progressCallback ImagePullProgressCallback) (*ContainerInfo, error)
	// StartContainer 启动容器
	StartContainer(ctx context.Context, containerID string) error
	// StopContainer 停止容器
	StopContainer(ctx context.Context, containerID string) error
	// RestartContainer 重启容器
	RestartContainer(ctx context.Context, containerID string) error
	// RemoveContainer 删除容器
	RemoveContainer(ctx context.Context, containerID string) error
	// GetContainer 获取容器信息
	GetContainer(ctx context.Context, containerID string) (*ContainerInfo, error)
	// ListContainers 列出所有容器
	ListContainers(ctx context.Context) ([]*ContainerInfo, error)
	// GetContainerLogs 获取容器日志
	GetContainerLogs(ctx context.Context, containerID string, tail int, follow bool) (io.ReadCloser, error)
	// PullImage 拉取镜像
	PullImage(ctx context.Context, imageName string) error
	// ExecCommand 在容器中执行命令
	ExecCommand(ctx context.Context, containerID string, cmd []string) (string, error)
	// ExecCommandInteractive 在容器中执行交互式命令
	// 支持实时双向通信，与docker exec -it功能完全一致
	ExecCommandInteractive(ctx context.Context, containerID string, cmd []string, stdinReader io.Reader, stdoutWriter, stderrWriter io.Writer) error

	// ResizeTerminal 调整终端大小
	// 用于支持终端窗口大小变化时的动态调整
	ResizeTerminal(ctx context.Context, execID string, height, width uint) error

	// ContainerExecResize 调整执行实例的终端大小
	ContainerExecResize(ctx context.Context, execID string, options client.ContainerResizeOptions) error

	// IsContainerRunning 检查容器是否正在运行
	IsContainerRunning(containerID string) (bool, error)

	// CheckPortConflict 检查端口冲突
	// 检查指定端口是否被其他容器占用，并判断是否为课程容器
	CheckPortConflict(ctx context.Context, courseID string, port int) (*PortConflictInfo, error)

	// CleanupCourseContainers 清理课程容器
	// 停止并删除指定课程的所有容器
	CleanupCourseContainers(ctx context.Context, courseID string) (*CleanupResult, error)

	// CleanupAllContainers 清理所有Playground容器
	// 停止并删除所有kwdb-playground相关的容器
	CleanupAllContainers(ctx context.Context) (*CleanupResult, error)

	// Close 关闭控制器
	Close() error
}
