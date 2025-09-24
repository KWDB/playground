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

// dockerClientAdapter Docker客户端适配器实现
type dockerClientAdapter struct {
	client *client.Client
}

// NewDockerClientAdapter 创建新的Docker客户端适配器
func NewDockerClientAdapter(cli *client.Client) DockerClientInterface {
	return &dockerClientAdapter{
		client: cli,
	}
}

// ContainerCreate 创建容器
func (d *dockerClientAdapter) ContainerCreate(ctx context.Context, config *container.Config, hostConfig *container.HostConfig, networkingConfig *network.NetworkingConfig, platform *v1.Platform, containerName string) (container.CreateResponse, error) {
	return d.client.ContainerCreate(ctx, config, hostConfig, networkingConfig, platform, containerName)
}

// ContainerStart 启动容器
func (d *dockerClientAdapter) ContainerStart(ctx context.Context, containerID string, options client.ContainerStartOptions) error {
	return d.client.ContainerStart(ctx, containerID, options)
}

// ContainerStop 停止容器
func (d *dockerClientAdapter) ContainerStop(ctx context.Context, containerID string, options client.ContainerStopOptions) error {
	return d.client.ContainerStop(ctx, containerID, options)
}

// ContainerRestart 重启容器
func (d *dockerClientAdapter) ContainerRestart(ctx context.Context, containerID string, options client.ContainerStopOptions) error {
	return d.client.ContainerRestart(ctx, containerID, options)
}

// ContainerRemove 删除容器
func (d *dockerClientAdapter) ContainerRemove(ctx context.Context, containerID string, options client.ContainerRemoveOptions) error {
	return d.client.ContainerRemove(ctx, containerID, options)
}

// ContainerInspect 检查容器
func (d *dockerClientAdapter) ContainerInspect(ctx context.Context, containerID string) (container.InspectResponse, error) {
	return d.client.ContainerInspect(ctx, containerID)
}

// ContainerList 列出容器
func (d *dockerClientAdapter) ContainerList(ctx context.Context, options client.ContainerListOptions) ([]container.Summary, error) {
	return d.client.ContainerList(ctx, options)
}

// ContainerLogs 获取容器日志
func (d *dockerClientAdapter) ContainerLogs(ctx context.Context, containerID string, options client.ContainerLogsOptions) (io.ReadCloser, error) {
	return d.client.ContainerLogs(ctx, containerID, options)
}

// ImagePull 拉取镜像
func (d *dockerClientAdapter) ImagePull(ctx context.Context, refStr string, options client.ImagePullOptions) (io.ReadCloser, error) {
	return d.client.ImagePull(ctx, refStr, options)
}

// ImageInspectWithRaw 检查镜像详细信息
func (d *dockerClientAdapter) ImageInspectWithRaw(ctx context.Context, imageID string) (image.InspectResponse, []byte, error) {
	// 使用ImageInspect方法，因为新版本API中没有ImageInspectWithRaw
	inspect, err := d.client.ImageInspect(ctx, imageID)
	return inspect, nil, err
}

// ContainerExecCreate 创建执行实例
func (d *dockerClientAdapter) ContainerExecCreate(ctx context.Context, containerID string, config container.ExecOptions) (container.ExecCreateResponse, error) {
	return d.client.ContainerExecCreate(ctx, containerID, config)
}

// ContainerExecAttach 附加到执行实例
func (d *dockerClientAdapter) ContainerExecAttach(ctx context.Context, execID string, config container.ExecAttachOptions) (client.HijackedResponse, error) {
	return d.client.ContainerExecAttach(ctx, execID, config)
}

// ContainerExecStart 启动执行实例
func (d *dockerClientAdapter) ContainerExecStart(ctx context.Context, execID string, config container.ExecStartOptions) error {
	return d.client.ContainerExecStart(ctx, execID, config)
}

// ContainerExecInspect 检查执行实例
func (d *dockerClientAdapter) ContainerExecInspect(ctx context.Context, execID string) (container.ExecInspect, error) {
	return d.client.ContainerExecInspect(ctx, execID)
}

// ContainerExecResize 调整执行实例终端大小
func (d *dockerClientAdapter) ContainerExecResize(ctx context.Context, execID string, options client.ContainerResizeOptions) error {
	return d.client.ContainerExecResize(ctx, execID, options)
}

// Ping 检查Docker守护进程连接
func (d *dockerClientAdapter) Ping(ctx context.Context) (types.Ping, error) {
	return d.client.Ping(ctx)
}

// Close 关闭客户端连接
func (d *dockerClientAdapter) Close() error {
	return d.client.Close()
}
