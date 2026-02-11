package docker

import (
	"archive/tar"
	"bufio"
	"bytes"
	"context"
	"fmt"
	"io"
	"net"
	"net/netip"
	"sync"
	"testing"
	"time"

	"kwdb-playground/internal/logger"

	"github.com/moby/moby/api/types/container"
	"github.com/moby/moby/api/types/image"
	"github.com/moby/moby/api/types/network"
	"github.com/moby/moby/client"
	v1 "github.com/opencontainers/image-spec/specs-go/v1"
)

// fakeDockerClient 用于单元测试的 DockerClientInterface 假实现
type fakeDockerClient struct {
	// CopyToContainer 控制
	copyToContainerFn func(ctx context.Context, containerID string, options client.CopyToContainerOptions) (client.CopyToContainerResult, error)
	copyCalls         []copyCall // 记录调用历史

	// ContainerInspect 控制
	inspectFn func(ctx context.Context, containerID string) (container.InspectResponse, error)

	// ContainerExecCreate 控制
	execCreateFn func(ctx context.Context, containerID string, config client.ExecCreateOptions) (client.ExecCreateResult, error)

	// ContainerExecAttach 控制
	execAttachFn func(ctx context.Context, execID string, config client.ExecAttachOptions) (client.HijackedResponse, error)
}

type copyCall struct {
	ContainerID     string
	DestinationPath string
	TarEntries      map[string][]byte // name -> content
}

// CopyToContainer 假实现，记录调用并委托给自定义函数
func (f *fakeDockerClient) CopyToContainer(ctx context.Context, containerID string, options client.CopyToContainerOptions) (client.CopyToContainerResult, error) {
	// 解析 tar 内容以记录
	call := copyCall{
		ContainerID:     containerID,
		DestinationPath: options.DestinationPath,
		TarEntries:      make(map[string][]byte),
	}
	if options.Content != nil {
		tr := tar.NewReader(options.Content)
		for {
			hdr, err := tr.Next()
			if err == io.EOF {
				break
			}
			if err != nil {
				break
			}
			data, _ := io.ReadAll(tr)
			call.TarEntries[hdr.Name] = data
		}
	}
	f.copyCalls = append(f.copyCalls, call)

	if f.copyToContainerFn != nil {
		return f.copyToContainerFn(ctx, containerID, options)
	}
	return client.CopyToContainerResult{}, nil
}

func (f *fakeDockerClient) ContainerInspect(ctx context.Context, containerID string) (container.InspectResponse, error) {
	if f.inspectFn != nil {
		return f.inspectFn(ctx, containerID)
	}
	return container.InspectResponse{
		State:  &container.State{Running: true, Status: container.StateRunning},
		Config: &container.Config{},
	}, nil
}

func (f *fakeDockerClient) ContainerExecCreate(ctx context.Context, containerID string, config client.ExecCreateOptions) (client.ExecCreateResult, error) {
	if f.execCreateFn != nil {
		return f.execCreateFn(ctx, containerID, config)
	}
	return client.ExecCreateResult{ID: "exec-123"}, nil
}

func (f *fakeDockerClient) ContainerExecAttach(ctx context.Context, execID string, config client.ExecAttachOptions) (client.HijackedResponse, error) {
	if f.execAttachFn != nil {
		return f.execAttachFn(ctx, execID, config)
	}
	serverConn, clientConn := net.Pipe()
	_ = serverConn // 测试中不需要服务端
	return client.HijackedResponse{
		Conn:   clientConn,
		Reader: bufio.NewReader(clientConn),
	}, nil
}

// 以下方法为 DockerClientInterface 所需但本测试不使用的空实现
func (f *fakeDockerClient) ContainerCreate(ctx context.Context, config *container.Config, hostConfig *container.HostConfig, networkingConfig *network.NetworkingConfig, platform *v1.Platform, containerName string) (container.CreateResponse, error) {
	return container.CreateResponse{}, nil
}
func (f *fakeDockerClient) ContainerStart(ctx context.Context, containerID string, options client.ContainerStartOptions) error {
	return nil
}
func (f *fakeDockerClient) ContainerStop(ctx context.Context, containerID string, options client.ContainerStopOptions) error {
	return nil
}
func (f *fakeDockerClient) ContainerPause(ctx context.Context, containerID string) error {
	return nil
}
func (f *fakeDockerClient) ContainerUnpause(ctx context.Context, containerID string) error {
	return nil
}
func (f *fakeDockerClient) ContainerRestart(ctx context.Context, containerID string, options client.ContainerStopOptions) error {
	return nil
}
func (f *fakeDockerClient) ContainerRemove(ctx context.Context, containerID string, options client.ContainerRemoveOptions) error {
	return nil
}
func (f *fakeDockerClient) ContainerList(ctx context.Context, options client.ContainerListOptions) ([]container.Summary, error) {
	return nil, nil
}
func (f *fakeDockerClient) ContainerLogs(ctx context.Context, containerID string, options client.ContainerLogsOptions) (io.ReadCloser, error) {
	return nil, nil
}
func (f *fakeDockerClient) ImagePull(ctx context.Context, refStr string, options client.ImagePullOptions) (io.ReadCloser, error) {
	return nil, nil
}
func (f *fakeDockerClient) ImageInspectWithRaw(ctx context.Context, imageID string) (image.InspectResponse, []byte, error) {
	return image.InspectResponse{}, nil, nil
}
func (f *fakeDockerClient) ContainerExecStart(ctx context.Context, execID string, config client.ExecStartOptions) error {
	return nil
}
func (f *fakeDockerClient) ContainerExecInspect(ctx context.Context, execID string) (client.ExecInspectResult, error) {
	return client.ExecInspectResult{}, nil
}
func (f *fakeDockerClient) ContainerExecResize(ctx context.Context, execID string, options client.ExecResizeOptions) error {
	return nil
}
func (f *fakeDockerClient) Ping(ctx context.Context) (client.PingResult, error) {
	return client.PingResult{}, nil
}
func (f *fakeDockerClient) Close() error { return nil }

// newTestController 创建用于测试的 dockerController 实例
func newTestController(fakeClient DockerClientInterface) *dockerController {
	return &dockerController{
		client:     fakeClient,
		containers: make(map[string]*ContainerInfo),
		cache:      newContainerCache(5 * time.Minute),
		courseMu:   make(map[string]*sync.Mutex),
		logger:     logger.NewLogger(logger.ERROR),
	}
}

// addTestContainer 向控制器添加测试用容器信息
func addTestContainer(ctrl *dockerController, id, dockerID, courseID string) {
	ctrl.mu.Lock()
	defer ctrl.mu.Unlock()
	ctrl.containers[id] = &ContainerInfo{
		ID:       id,
		DockerID: dockerID,
		CourseID: courseID,
		State:    StateRunning,
	}
}

// ========== CopyFilesToContainer 测试 ==========

func TestCopyFilesToContainer_Success(t *testing.T) {
	fake := &fakeDockerClient{}
	ctrl := newTestController(fake)
	addTestContainer(ctrl, "cont-1", "docker-abc", "quick-start")

	files := map[string][]byte{
		"/app/data/config.json": []byte(`{"key":"value"}`),
	}

	err := ctrl.CopyFilesToContainer(context.Background(), "cont-1", files)
	if err != nil {
		t.Fatalf("CopyFilesToContainer failed: %v", err)
	}

	// 验证调用次数
	if len(fake.copyCalls) != 1 {
		t.Fatalf("Expected 1 CopyToContainer call, got %d", len(fake.copyCalls))
	}

	// 验证 DestinationPath 为 "/"
	call := fake.copyCalls[0]
	if call.DestinationPath != "/" {
		t.Errorf("Expected DestinationPath '/', got '%s'", call.DestinationPath)
	}

	// 验证 tar entry name 为去掉前导 / 的完整路径
	content, ok := call.TarEntries["app/data/config.json"]
	if !ok {
		t.Errorf("Expected tar entry 'app/data/config.json', got entries: %v", keysOf(call.TarEntries))
	}
	if string(content) != `{"key":"value"}` {
		t.Errorf("Expected content '{\"key\":\"value\"}', got '%s'", string(content))
	}

	// 验证使用的是正确的 Docker ID
	if call.ContainerID != "docker-abc" {
		t.Errorf("Expected containerID 'docker-abc', got '%s'", call.ContainerID)
	}
}

func TestCopyFilesToContainer_MultipleFiles(t *testing.T) {
	fake := &fakeDockerClient{}
	ctrl := newTestController(fake)
	addTestContainer(ctrl, "cont-1", "docker-abc", "smart-meter")

	files := map[string][]byte{
		"/kaiwudb/bin/kwbase-data/extern/rdb.tar.gz":  []byte("rdb-content"),
		"/kaiwudb/bin/kwbase-data/extern/tsdb.tar.gz": []byte("tsdb-content"),
	}

	err := ctrl.CopyFilesToContainer(context.Background(), "cont-1", files)
	if err != nil {
		t.Fatalf("CopyFilesToContainer failed: %v", err)
	}

	// 每个文件一次调用
	if len(fake.copyCalls) != 2 {
		t.Fatalf("Expected 2 CopyToContainer calls, got %d", len(fake.copyCalls))
	}

	// 验证所有调用的 DestinationPath 都是 "/"
	for i, call := range fake.copyCalls {
		if call.DestinationPath != "/" {
			t.Errorf("Call %d: expected DestinationPath '/', got '%s'", i, call.DestinationPath)
		}
	}
}

func TestCopyFilesToContainer_EmptyFiles(t *testing.T) {
	fake := &fakeDockerClient{}
	ctrl := newTestController(fake)
	addTestContainer(ctrl, "cont-1", "docker-abc", "quick-start")

	// 空文件映射应直接返回 nil，不调用 Docker API
	err := ctrl.CopyFilesToContainer(context.Background(), "cont-1", map[string][]byte{})
	if err != nil {
		t.Fatalf("CopyFilesToContainer with empty files should succeed: %v", err)
	}
	if len(fake.copyCalls) != 0 {
		t.Errorf("Expected 0 CopyToContainer calls, got %d", len(fake.copyCalls))
	}
}

func TestCopyFilesToContainer_NilFiles(t *testing.T) {
	fake := &fakeDockerClient{}
	ctrl := newTestController(fake)
	addTestContainer(ctrl, "cont-1", "docker-abc", "quick-start")

	err := ctrl.CopyFilesToContainer(context.Background(), "cont-1", nil)
	if err != nil {
		t.Fatalf("CopyFilesToContainer with nil files should succeed: %v", err)
	}
	if len(fake.copyCalls) != 0 {
		t.Errorf("Expected 0 CopyToContainer calls, got %d", len(fake.copyCalls))
	}
}

func TestCopyFilesToContainer_ContainerNotFound(t *testing.T) {
	fake := &fakeDockerClient{}
	ctrl := newTestController(fake)
	// 不添加任何容器

	files := map[string][]byte{
		"/app/file.txt": []byte("data"),
	}
	err := ctrl.CopyFilesToContainer(context.Background(), "nonexistent", files)
	if err == nil {
		t.Fatal("Expected error for nonexistent container")
	}
	if !contains(err.Error(), "not found") {
		t.Errorf("Expected 'not found' in error, got: %s", err.Error())
	}
}

func TestCopyFilesToContainer_DockerAPIError(t *testing.T) {
	fake := &fakeDockerClient{
		copyToContainerFn: func(ctx context.Context, containerID string, options client.CopyToContainerOptions) (client.CopyToContainerResult, error) {
			return client.CopyToContainerResult{}, fmt.Errorf("permission denied")
		},
	}
	ctrl := newTestController(fake)
	addTestContainer(ctrl, "cont-1", "docker-abc", "quick-start")

	files := map[string][]byte{
		"/app/file.txt": []byte("data"),
	}
	err := ctrl.CopyFilesToContainer(context.Background(), "cont-1", files)
	if err == nil {
		t.Fatal("Expected error from Docker API")
	}
	if !contains(err.Error(), "permission denied") {
		t.Errorf("Expected 'permission denied' in error, got: %s", err.Error())
	}
}

func TestCopyFilesToContainer_TarEntryPath(t *testing.T) {
	// 验证各种路径格式的 tar entry name 生成
	tests := []struct {
		name            string
		destPath        string
		expectedTarName string
	}{
		{
			name:            "绝对路径去掉前导斜杠",
			destPath:        "/opt/app/config.json",
			expectedTarName: "opt/app/config.json",
		},
		{
			name:            "深层路径",
			destPath:        "/kaiwudb/bin/kwbase-data/extern/rdb.tar.gz",
			expectedTarName: "kaiwudb/bin/kwbase-data/extern/rdb.tar.gz",
		},
		{
			name:            "根目录文件",
			destPath:        "/file.txt",
			expectedTarName: "file.txt",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			fake := &fakeDockerClient{}
			ctrl := newTestController(fake)
			addTestContainer(ctrl, "cont-1", "docker-abc", "test")

			files := map[string][]byte{
				tt.destPath: []byte("content"),
			}
			err := ctrl.CopyFilesToContainer(context.Background(), "cont-1", files)
			if err != nil {
				t.Fatalf("CopyFilesToContainer failed: %v", err)
			}

			if len(fake.copyCalls) != 1 {
				t.Fatalf("Expected 1 call, got %d", len(fake.copyCalls))
			}

			_, ok := fake.copyCalls[0].TarEntries[tt.expectedTarName]
			if !ok {
				t.Errorf("Expected tar entry '%s', got entries: %v", tt.expectedTarName, keysOf(fake.copyCalls[0].TarEntries))
			}
		})
	}
}

// ========== GetContainerIP 测试 ==========

func TestGetContainerIP_BridgeNetwork(t *testing.T) {
	fake := &fakeDockerClient{
		inspectFn: func(ctx context.Context, containerID string) (container.InspectResponse, error) {
			return container.InspectResponse{
				NetworkSettings: &container.NetworkSettings{
					Networks: map[string]*network.EndpointSettings{
						"bridge": {
							IPAddress: netip.MustParseAddr("172.17.0.2"),
						},
					},
				},
			}, nil
		},
	}
	ctrl := newTestController(fake)
	addTestContainer(ctrl, "cont-1", "docker-abc", "quick-start")

	ip, err := ctrl.GetContainerIP(context.Background(), "cont-1")
	if err != nil {
		t.Fatalf("GetContainerIP failed: %v", err)
	}
	if ip != "172.17.0.2" {
		t.Errorf("Expected IP '172.17.0.2', got '%s'", ip)
	}
}

func TestGetContainerIP_NonBridgeNetwork(t *testing.T) {
	fake := &fakeDockerClient{
		inspectFn: func(ctx context.Context, containerID string) (container.InspectResponse, error) {
			return container.InspectResponse{
				NetworkSettings: &container.NetworkSettings{
					Networks: map[string]*network.EndpointSettings{
						"custom-net": {
							IPAddress: netip.MustParseAddr("10.0.0.5"),
						},
					},
				},
			}, nil
		},
	}
	ctrl := newTestController(fake)
	addTestContainer(ctrl, "cont-1", "docker-abc", "quick-start")

	ip, err := ctrl.GetContainerIP(context.Background(), "cont-1")
	if err != nil {
		t.Fatalf("GetContainerIP failed: %v", err)
	}
	if ip != "10.0.0.5" {
		t.Errorf("Expected IP '10.0.0.5', got '%s'", ip)
	}
}

func TestGetContainerIP_PrefersConfiguredNetwork(t *testing.T) {
	fake := &fakeDockerClient{
		inspectFn: func(ctx context.Context, containerID string) (container.InspectResponse, error) {
			return container.InspectResponse{
				NetworkSettings: &container.NetworkSettings{
					Networks: map[string]*network.EndpointSettings{
						"bridge": {
							IPAddress: netip.MustParseAddr("172.17.0.2"),
						},
						"kwdb-playground-net": {
							IPAddress: netip.MustParseAddr("192.168.100.5"),
						},
					},
				},
			}, nil
		},
	}
	ctrl := newTestController(fake)
	ctrl.networkName = "kwdb-playground-net"
	addTestContainer(ctrl, "cont-1", "docker-abc", "quick-start")

	ip, err := ctrl.GetContainerIP(context.Background(), "cont-1")
	if err != nil {
		t.Fatalf("GetContainerIP failed: %v", err)
	}
	if ip != "192.168.100.5" {
		t.Errorf("Expected IP '192.168.100.5' from configured network, got '%s'", ip)
	}
}

func TestGetContainerIP_FallbackWhenConfiguredNetworkMissing(t *testing.T) {
	fake := &fakeDockerClient{
		inspectFn: func(ctx context.Context, containerID string) (container.InspectResponse, error) {
			return container.InspectResponse{
				NetworkSettings: &container.NetworkSettings{
					Networks: map[string]*network.EndpointSettings{
						"bridge": {
							IPAddress: netip.MustParseAddr("172.17.0.2"),
						},
					},
				},
			}, nil
		},
	}
	ctrl := newTestController(fake)
	ctrl.networkName = "nonexistent-net"
	addTestContainer(ctrl, "cont-1", "docker-abc", "quick-start")

	ip, err := ctrl.GetContainerIP(context.Background(), "cont-1")
	if err != nil {
		t.Fatalf("GetContainerIP failed: %v", err)
	}
	if ip != "172.17.0.2" {
		t.Errorf("Expected fallback IP '172.17.0.2', got '%s'", ip)
	}
}

func TestSetNetworkName(t *testing.T) {
	fake := &fakeDockerClient{}
	ctrl := newTestController(fake)

	if ctrl.networkName != "" {
		t.Errorf("Expected empty networkName initially, got '%s'", ctrl.networkName)
	}

	ctrl.SetNetworkName("kwdb-playground-net")
	if ctrl.networkName != "kwdb-playground-net" {
		t.Errorf("Expected networkName 'kwdb-playground-net', got '%s'", ctrl.networkName)
	}
}

func TestGetContainerIP_ContainerNotFound(t *testing.T) {
	fake := &fakeDockerClient{}
	ctrl := newTestController(fake)

	_, err := ctrl.GetContainerIP(context.Background(), "nonexistent")
	if err == nil {
		t.Fatal("Expected error for nonexistent container")
	}
	if !contains(err.Error(), "not found") {
		t.Errorf("Expected 'not found' in error, got: %s", err.Error())
	}
}

func TestGetContainerIP_NoNetworkSettings(t *testing.T) {
	fake := &fakeDockerClient{
		inspectFn: func(ctx context.Context, containerID string) (container.InspectResponse, error) {
			return container.InspectResponse{
				NetworkSettings: nil,
			}, nil
		},
	}
	ctrl := newTestController(fake)
	addTestContainer(ctrl, "cont-1", "docker-abc", "quick-start")

	_, err := ctrl.GetContainerIP(context.Background(), "cont-1")
	if err == nil {
		t.Fatal("Expected error for container without network settings")
	}
	if !contains(err.Error(), "no network settings") {
		t.Errorf("Expected 'no network settings' in error, got: %s", err.Error())
	}
}

func TestGetContainerIP_EmptyNetworks(t *testing.T) {
	fake := &fakeDockerClient{
		inspectFn: func(ctx context.Context, containerID string) (container.InspectResponse, error) {
			return container.InspectResponse{
				NetworkSettings: &container.NetworkSettings{
					Networks: map[string]*network.EndpointSettings{},
				},
			}, nil
		},
	}
	ctrl := newTestController(fake)
	addTestContainer(ctrl, "cont-1", "docker-abc", "quick-start")

	_, err := ctrl.GetContainerIP(context.Background(), "cont-1")
	if err == nil {
		t.Fatal("Expected error for empty networks")
	}
}

func TestGetContainerIP_InspectError(t *testing.T) {
	fake := &fakeDockerClient{
		inspectFn: func(ctx context.Context, containerID string) (container.InspectResponse, error) {
			return container.InspectResponse{}, fmt.Errorf("Docker daemon error")
		},
	}
	ctrl := newTestController(fake)
	addTestContainer(ctrl, "cont-1", "docker-abc", "quick-start")

	_, err := ctrl.GetContainerIP(context.Background(), "cont-1")
	if err == nil {
		t.Fatal("Expected error from inspect failure")
	}
	if !contains(err.Error(), "failed to inspect") {
		t.Errorf("Expected 'failed to inspect' in error, got: %s", err.Error())
	}
}

// ========== CreateInteractiveExec 测试 ==========

func TestCreateInteractiveExec_Success(t *testing.T) {
	serverConn, clientConn := net.Pipe()
	defer serverConn.Close()
	defer clientConn.Close()

	fake := &fakeDockerClient{
		inspectFn: func(ctx context.Context, containerID string) (container.InspectResponse, error) {
			return container.InspectResponse{
				State: &container.State{Running: true, Status: container.StateRunning},
				Config: &container.Config{
					WorkingDir: "/app",
					User:       "root",
				},
			}, nil
		},
		execCreateFn: func(ctx context.Context, containerID string, config client.ExecCreateOptions) (client.ExecCreateResult, error) {
			// 验证 exec 配置
			if !config.AttachStdin {
				t.Error("Expected AttachStdin=true")
			}
			if !config.AttachStdout {
				t.Error("Expected AttachStdout=true")
			}
			if !config.TTY {
				t.Error("Expected TTY=true")
			}
			return client.ExecCreateResult{ID: "exec-456"}, nil
		},
		execAttachFn: func(ctx context.Context, execID string, config client.ExecAttachOptions) (client.HijackedResponse, error) {
			if execID != "exec-456" {
				t.Errorf("Expected execID 'exec-456', got '%s'", execID)
			}
			return client.HijackedResponse{
				Conn:   clientConn,
				Reader: bufio.NewReader(clientConn),
			}, nil
		},
	}
	ctrl := newTestController(fake)
	addTestContainer(ctrl, "cont-1", "docker-abc", "quick-start")

	result, err := ctrl.CreateInteractiveExec(context.Background(), "cont-1", []string{"/bin/bash"})
	if err != nil {
		t.Fatalf("CreateInteractiveExec failed: %v", err)
	}

	if result.ExecID != "exec-456" {
		t.Errorf("Expected ExecID 'exec-456', got '%s'", result.ExecID)
	}
	if result.Conn == nil {
		t.Error("Expected non-nil Conn")
	}
	if result.Reader == nil {
		t.Error("Expected non-nil Reader")
	}
}

func TestCreateInteractiveExec_EmptyContainerID(t *testing.T) {
	fake := &fakeDockerClient{}
	ctrl := newTestController(fake)

	_, err := ctrl.CreateInteractiveExec(context.Background(), "", []string{"/bin/bash"})
	if err == nil {
		t.Fatal("Expected error for empty container ID")
	}
	if !contains(err.Error(), "cannot be empty") {
		t.Errorf("Expected 'cannot be empty' in error, got: %s", err.Error())
	}
}

func TestCreateInteractiveExec_EmptyCommand(t *testing.T) {
	fake := &fakeDockerClient{}
	ctrl := newTestController(fake)

	_, err := ctrl.CreateInteractiveExec(context.Background(), "cont-1", []string{})
	if err == nil {
		t.Fatal("Expected error for empty command")
	}
	if !contains(err.Error(), "cannot be empty") {
		t.Errorf("Expected 'cannot be empty' in error, got: %s", err.Error())
	}
}

func TestCreateInteractiveExec_ContainerNotFound(t *testing.T) {
	fake := &fakeDockerClient{}
	ctrl := newTestController(fake)

	_, err := ctrl.CreateInteractiveExec(context.Background(), "nonexistent", []string{"/bin/bash"})
	if err == nil {
		t.Fatal("Expected error for nonexistent container")
	}
	if !contains(err.Error(), "not found") {
		t.Errorf("Expected 'not found' in error, got: %s", err.Error())
	}
}

func TestCreateInteractiveExec_ContainerNotRunning(t *testing.T) {
	fake := &fakeDockerClient{
		inspectFn: func(ctx context.Context, containerID string) (container.InspectResponse, error) {
			return container.InspectResponse{
				State:  &container.State{Running: false, Status: container.StateExited},
				Config: &container.Config{},
			}, nil
		},
	}
	ctrl := newTestController(fake)
	addTestContainer(ctrl, "cont-1", "docker-abc", "quick-start")

	_, err := ctrl.CreateInteractiveExec(context.Background(), "cont-1", []string{"/bin/bash"})
	if err == nil {
		t.Fatal("Expected error for non-running container")
	}
	if !contains(err.Error(), "not running") {
		t.Errorf("Expected 'not running' in error, got: %s", err.Error())
	}
}

func TestCreateInteractiveExec_ExecCreateError(t *testing.T) {
	fake := &fakeDockerClient{
		inspectFn: func(ctx context.Context, containerID string) (container.InspectResponse, error) {
			return container.InspectResponse{
				State:  &container.State{Running: true, Status: container.StateRunning},
				Config: &container.Config{},
			}, nil
		},
		execCreateFn: func(ctx context.Context, containerID string, config client.ExecCreateOptions) (client.ExecCreateResult, error) {
			return client.ExecCreateResult{}, fmt.Errorf("exec create failed")
		},
	}
	ctrl := newTestController(fake)
	addTestContainer(ctrl, "cont-1", "docker-abc", "quick-start")

	_, err := ctrl.CreateInteractiveExec(context.Background(), "cont-1", []string{"/bin/bash"})
	if err == nil {
		t.Fatal("Expected error from exec create")
	}
	if !contains(err.Error(), "failed to create exec") {
		t.Errorf("Expected 'failed to create exec' in error, got: %s", err.Error())
	}
}

func TestCreateInteractiveExec_ExecAttachError(t *testing.T) {
	fake := &fakeDockerClient{
		inspectFn: func(ctx context.Context, containerID string) (container.InspectResponse, error) {
			return container.InspectResponse{
				State:  &container.State{Running: true, Status: container.StateRunning},
				Config: &container.Config{},
			}, nil
		},
		execCreateFn: func(ctx context.Context, containerID string, config client.ExecCreateOptions) (client.ExecCreateResult, error) {
			return client.ExecCreateResult{ID: "exec-789"}, nil
		},
		execAttachFn: func(ctx context.Context, execID string, config client.ExecAttachOptions) (client.HijackedResponse, error) {
			return client.HijackedResponse{}, fmt.Errorf("attach failed")
		},
	}
	ctrl := newTestController(fake)
	addTestContainer(ctrl, "cont-1", "docker-abc", "quick-start")

	_, err := ctrl.CreateInteractiveExec(context.Background(), "cont-1", []string{"/bin/bash"})
	if err == nil {
		t.Fatal("Expected error from exec attach")
	}
	if !contains(err.Error(), "failed to attach exec") {
		t.Errorf("Expected 'failed to attach exec' in error, got: %s", err.Error())
	}
}

// ========== 辅助函数 ==========

func contains(s, substr string) bool {
	return len(s) >= len(substr) && bytes.Contains([]byte(s), []byte(substr))
}

func keysOf(m map[string][]byte) []string {
	keys := make([]string, 0, len(m))
	for k := range m {
		keys = append(keys, k)
	}
	return keys
}
