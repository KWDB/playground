package docker

import (
	"context"
	"io"

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
	result, err := d.client.ContainerCreate(ctx, client.ContainerCreateOptions{
		Config:           config,
		HostConfig:       hostConfig,
		NetworkingConfig: networkingConfig,
		Platform:         platform,
		Name:             containerName,
	})
	if err != nil {
		return container.CreateResponse{}, err
	}
	return container.CreateResponse{
		ID:       result.ID,
		Warnings: result.Warnings,
	}, nil
}

// ContainerStart 启动容器
func (d *dockerClientAdapter) ContainerStart(ctx context.Context, containerID string, options client.ContainerStartOptions) error {
	_, err := d.client.ContainerStart(ctx, containerID, options)
	return err
}

// ContainerStop 停止容器
func (d *dockerClientAdapter) ContainerStop(ctx context.Context, containerID string, options client.ContainerStopOptions) error {
	_, err := d.client.ContainerStop(ctx, containerID, options)
	return err
}

// ContainerRestart 重启容器
func (d *dockerClientAdapter) ContainerRestart(ctx context.Context, containerID string, options client.ContainerStopOptions) error {
	_, err := d.client.ContainerRestart(ctx, containerID, client.ContainerRestartOptions{
		Timeout: options.Timeout,
	})
	return err
}

// ContainerRemove 删除容器
func (d *dockerClientAdapter) ContainerRemove(ctx context.Context, containerID string, options client.ContainerRemoveOptions) error {
	_, err := d.client.ContainerRemove(ctx, containerID, options)
	return err
}

// ContainerInspect 检查容器
func (d *dockerClientAdapter) ContainerInspect(ctx context.Context, containerID string) (container.InspectResponse, error) {
	result, err := d.client.ContainerInspect(ctx, containerID, client.ContainerInspectOptions{})
	if err != nil {
		return container.InspectResponse{}, err
	}
	return result.Container, nil
}

// ContainerList 列出容器
func (d *dockerClientAdapter) ContainerList(ctx context.Context, options client.ContainerListOptions) ([]container.Summary, error) {
	result, err := d.client.ContainerList(ctx, options)
	if err != nil {
		return nil, err
	}
	return result.Items, nil
}

// ContainerLogs 获取容器日志
func (d *dockerClientAdapter) ContainerLogs(ctx context.Context, containerID string, options client.ContainerLogsOptions) (io.ReadCloser, error) {
	// ContainerLogsResult implements io.ReadCloser
	return d.client.ContainerLogs(ctx, containerID, options)
}

// ImagePull 拉取镜像
func (d *dockerClientAdapter) ImagePull(ctx context.Context, refStr string, options client.ImagePullOptions) (io.ReadCloser, error) {
	// 在新版本API中，ImagePull返回一个ImagePullResponse接口，它实现了io.ReadCloser
	return d.client.ImagePull(ctx, refStr, options)
}

// ImageInspectWithRaw 检查镜像详细信息
func (d *dockerClientAdapter) ImageInspectWithRaw(ctx context.Context, imageID string) (image.InspectResponse, []byte, error) {
	// 使用ImageInspect方法，在新版本API中返回被包装在结构体中
	result, err := d.client.ImageInspect(ctx, imageID)
	if err != nil {
		return image.InspectResponse{}, nil, err
	}
	// ImageInspectResult embeds image.InspectResponse, so we can return it directly
	return result.InspectResponse, nil, nil
}

// ContainerExecCreate 创建执行实例
func (d *dockerClientAdapter) ContainerExecCreate(ctx context.Context, containerID string, config client.ExecCreateOptions) (client.ExecCreateResult, error) {
	return d.client.ExecCreate(ctx, containerID, config)
}

// ContainerExecAttach 附加到执行实例
func (d *dockerClientAdapter) ContainerExecAttach(ctx context.Context, execID string, config client.ExecAttachOptions) (client.HijackedResponse, error) {
	result, err := d.client.ExecAttach(ctx, execID, config)
	if err != nil {
		return client.HijackedResponse{}, err
	}
	return result.HijackedResponse, nil
}

// ContainerExecStart 启动执行实例
func (d *dockerClientAdapter) ContainerExecStart(ctx context.Context, execID string, config client.ExecStartOptions) error {
	_, err := d.client.ExecStart(ctx, execID, config)
	return err
}

// ContainerExecInspect 检查执行实例
func (d *dockerClientAdapter) ContainerExecInspect(ctx context.Context, execID string) (client.ExecInspectResult, error) {
	return d.client.ExecInspect(ctx, execID, client.ExecInspectOptions{})
}

// ContainerExecResize 调整执行实例终端大小
func (d *dockerClientAdapter) ContainerExecResize(ctx context.Context, execID string, options client.ExecResizeOptions) error {
	_, err := d.client.ExecResize(ctx, execID, options)
	return err
}

// Ping 检查Docker守护进程连接
func (d *dockerClientAdapter) Ping(ctx context.Context) (client.PingResult, error) {
	return d.client.Ping(ctx, client.PingOptions{})
}

// Close 关闭客户端连接
func (d *dockerClientAdapter) Close() error {
	return d.client.Close()
}
