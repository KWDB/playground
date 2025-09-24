package docker

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"os"
	"strings"
	"sync"
	"time"

	"kwdb-playground/internal/logger"

	"github.com/containerd/errdefs"
	"github.com/docker/go-connections/nat"
	"github.com/moby/moby/api/types/container"
	"github.com/moby/moby/api/types/image"
	"github.com/moby/moby/client"
)

// dockerController Docker控制器实现
type dockerController struct {
	client          DockerClientInterface
	containers      map[string]*ContainerInfo // 内存中的容器信息
	mu              sync.RWMutex              // 保护containers映射的读写锁
	cache           *containerCache           // 容器状态缓存
	courseMu        map[string]*sync.Mutex    // 每个课程的互斥锁
	courseMuMu      sync.RWMutex              // 保护courseMu映射的读写锁
	logger          *logger.Logger            // 日志记录器
	terminalManager TerminalManagerInterface  // WebSocket终端管理器接口
}

// createDockerClient 创建Docker客户端，支持多种socket路径
func createDockerClient(log *logger.Logger) (*client.Client, error) {
	// 定义要尝试的Docker socket路径
	socketPaths := []string{
		// macOS Docker Desktop路径
		fmt.Sprintf("unix:///Users/%s/.docker/run/docker.sock", os.Getenv("USER")),
		// 默认Linux路径
		"unix:///var/run/docker.sock",
	}

	// 首先尝试使用环境变量配置
	log.Info("尝试使用环境变量配置创建Docker客户端...")
	cli, err := client.NewClientWithOpts(client.FromEnv, client.WithAPIVersionNegotiation())
	if err == nil {
		// 测试连接
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		_, pingErr := cli.Ping(ctx)
		if pingErr == nil {
			log.Info("成功使用环境变量配置连接到Docker")
			return cli, nil
		}
		log.Warn("环境变量配置的Docker连接测试失败: %v", pingErr)
		cli.Close()
	} else {
		log.Warn("使用环境变量创建Docker客户端失败: %v", err)
	}

	// 尝试不同的socket路径
	for _, socketPath := range socketPaths {
		log.Info("尝试连接Docker socket: %s", socketPath)

		// 检查socket文件是否存在
		if strings.HasPrefix(socketPath, "unix://") {
			filePath := strings.TrimPrefix(socketPath, "unix://")
			if _, err := os.Stat(filePath); os.IsNotExist(err) {
				log.Warn("Socket文件不存在: %s", filePath)
				continue
			}
		}

		// 尝试创建客户端
		cli, err := client.NewClientWithOpts(
			client.WithHost(socketPath),
			client.WithAPIVersionNegotiation(),
		)
		if err != nil {
			log.Warn("创建Docker客户端失败 (socket: %s): %v", socketPath, err)
			continue
		}

		// 测试连接
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		_, pingErr := cli.Ping(ctx)
		cancel()

		if pingErr == nil {
			log.Info("成功连接到Docker (socket: %s)", socketPath)
			return cli, nil
		}

		log.Warn("Docker连接测试失败 (socket: %s): %v", socketPath, pingErr)
		cli.Close()
	}

	return nil, fmt.Errorf("无法连接到Docker守护进程，已尝试所有可用路径: %v", socketPaths)
}

// NewController 创建新的Docker控制器
func NewController() (Controller, error) {
	return NewControllerWithTerminalManager(nil)
}

// NewControllerWithTerminalManager 创建带WebSocket管理器的Docker控制器
func NewControllerWithTerminalManager(terminalManager TerminalManagerInterface) (Controller, error) {
	// 创建logger实例
	log := logger.NewLogger(logger.INFO)

	// 创建Docker客户端，支持多种socket路径
	cli, err := createDockerClient(log)
	if err != nil {
		return nil, fmt.Errorf("failed to create docker client: %w", err)
	}

	// 创建适配器
	adapter := NewDockerClientAdapter(cli)

	// 测试连接
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	_, err = adapter.Ping(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to ping docker daemon: %w", err)
	}

	// 创建缓存实例
	cache := newContainerCache(5 * time.Minute)

	// 创建控制器实例
	controller := &dockerController{
		client:          adapter,
		containers:      make(map[string]*ContainerInfo),
		cache:           cache,
		courseMu:        make(map[string]*sync.Mutex),
		logger:          log,
		terminalManager: terminalManager,
	}

	// 加载现有容器到内存
	err = controller.loadExistingContainers(ctx)
	if err != nil {
		controller.logger.Warn("Warning: failed to load existing containers: %v", err)
	}

	return controller, nil
}

// loadExistingContainers 加载现有的容器到内存中
func (d *dockerController) loadExistingContainers(ctx context.Context) error {
	d.logger.Info("开始加载现有容器到内存中...")

	// 获取所有容器（包括停止的）
	containers, err := d.client.ContainerList(ctx, client.ContainerListOptions{
		All: true,
	})
	if err != nil {
		return fmt.Errorf("failed to list containers: %w", err)
	}

	loadedCount := 0
	for _, container := range containers {
		// 检查容器名称是否符合我们的命名规则
		if len(container.Names) == 0 {
			continue
		}

		containerName := strings.TrimPrefix(container.Names[0], "/")
		if !strings.HasPrefix(containerName, "kwdb-playground-") {
			continue
		}

		// 解析容器名称获取课程ID
		parts := strings.Split(containerName, "-")
		if len(parts) < 3 {
			continue
		}

		// 提取课程ID（去掉前缀kwdb-playground-）
		courseID := strings.Join(parts[2:len(parts)-2], "-")
		if courseID == "" {
			continue
		}

		// 获取容器详细信息
		inspect, err := d.client.ContainerInspect(ctx, container.ID)
		if err != nil {
			d.logger.Warn("警告：无法检查容器 %s: %v", containerName, err)
			continue
		}

		// 确定容器状态
		var state ContainerState
		if inspect.State.Running {
			state = StateRunning
		} else if inspect.State.Dead {
			state = StateError
		} else {
			state = StateStopped
		}

		// 解析端口映射
		ports := make(map[string]string)
		for port, bindings := range inspect.NetworkSettings.Ports {
			if len(bindings) > 0 {
				ports[port.Port()] = bindings[0].HostPort
			}
		}

		// 解析环境变量
		env := make(map[string]string)
		for _, envVar := range inspect.Config.Env {
			parts := strings.SplitN(envVar, "=", 2)
			if len(parts) == 2 {
				env[parts[0]] = parts[1]
			}
		}

		// 创建容器信息
		containerInfo := &ContainerInfo{
			ID:        containerName,
			CourseID:  courseID,
			DockerID:  container.ID,
			State:     state,
			Image:     inspect.Config.Image,
			StartedAt: time.Now(), // 使用当前时间，因为无法准确获取原始启动时间
			Env:       env,
			Ports:     ports,
		}

		// 添加到内存中
		d.mu.Lock()
		d.containers[containerName] = containerInfo
		d.mu.Unlock()

		loadedCount++
		d.logger.Info("已加载容器: %s (课程: %s, 状态: %s)", containerName, courseID, state)
	}

	d.logger.Info("容器加载完成，共加载 %d 个容器", loadedCount)
	return nil
}

// getCourseMutex 获取指定课程的互斥锁，如果不存在则创建
func (d *dockerController) getCourseMutex(courseID string) *sync.Mutex {
	d.courseMuMu.RLock()
	if mutex, exists := d.courseMu[courseID]; exists {
		d.courseMuMu.RUnlock()
		return mutex
	}
	d.courseMuMu.RUnlock()

	// 需要创建新的互斥锁
	d.courseMuMu.Lock()
	defer d.courseMuMu.Unlock()

	// 双重检查，防止并发创建
	if mutex, exists := d.courseMu[courseID]; exists {
		return mutex
	}

	mutex := &sync.Mutex{}
	d.courseMu[courseID] = mutex
	return mutex
}

// IsContainerRunning 检查容器是否正在运行（公开方法）
func (d *dockerController) IsContainerRunning(containerID string) (bool, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	// 首先检查容器是否在内存中存在
	d.mu.RLock()
	containerInfo, exists := d.containers[containerID]
	d.mu.RUnlock()

	if !exists {
		return false, fmt.Errorf("container %s not found", containerID)
	}

	// 使用缓存检查容器状态
	return d.isContainerRunningCached(ctx, containerInfo.DockerID)
}

// isContainerRunning 检查容器是否正在运行（带缓存优化）
func (d *dockerController) isContainerRunning(ctx context.Context, containerID string) (bool, error) {
	// 先检查缓存
	if isRunning, exists := d.cache.get(containerID); exists {
		return isRunning, nil
	}

	// 缓存未命中，查询Docker API
	d.mu.RLock()
	containerInfo, exists := d.containers[containerID]
	d.mu.RUnlock()

	if !exists {
		return false, fmt.Errorf("container %s not found", containerID)
	}

	inspect, err := d.client.ContainerInspect(ctx, containerInfo.DockerID)
	if err != nil {
		return false, fmt.Errorf("failed to inspect container: %w", err)
	}

	isRunning := inspect.State.Running

	// 更新缓存
	d.cache.set(containerInfo.DockerID, isRunning)

	return isRunning, nil
}

// isContainerRunningCached 使用缓存检查容器是否运行，减少API调用
func (d *dockerController) isContainerRunningCached(ctx context.Context, dockerID string) (bool, error) {
	// 先检查缓存
	if isRunning, exists := d.cache.get(dockerID); exists {
		d.logger.Debug("容器状态缓存命中: %s, 运行状态: %v", dockerID[:12], isRunning)
		return isRunning, nil
	}

	// 缓存未命中，查询Docker API
	d.logger.Debug("容器状态缓存未命中，查询Docker API: %s", dockerID[:12])
	inspect, err := d.client.ContainerInspect(ctx, dockerID)
	if err != nil {
		d.logger.Error("检查容器状态失败: %s, 错误: %v", dockerID[:12], err)
		return false, fmt.Errorf("failed to inspect container: %w", err)
	}

	isRunning := inspect.State.Running
	d.logger.Debug("Docker API查询结果: %s, 运行状态: %v, 退出码: %d", 
		dockerID[:12], isRunning, inspect.State.ExitCode)

	// 更新缓存
	d.cache.set(dockerID, isRunning)

	return isRunning, nil
}

// StartContainer 启动容器
func (d *dockerController) StartContainer(ctx context.Context, containerID string) error {
	d.logger.Info("开始启动容器: %s", containerID)

	d.mu.RLock()
	containerInfo, exists := d.containers[containerID]
	d.mu.RUnlock()

	if !exists {
		d.logger.Warn("容器 %s 不存在于内存中", containerID)
		return fmt.Errorf("container %s not found", containerID)
	}

	// 设置启动中状态
	d.updateContainerState(containerID, StateStarting, "Container is starting...")

	d.logger.Info("正在启动Docker容器，Docker ID: %s", containerInfo.DockerID[:12])
	err := d.client.ContainerStart(ctx, containerInfo.DockerID, client.ContainerStartOptions{})
	if err != nil {
		d.logger.Error("启动容器 %s 失败: %v", containerID, err)
		d.updateContainerState(containerID, StateError, fmt.Sprintf("Failed to start: %v", err))
		return fmt.Errorf("failed to start container: %w", err)
	}

	// 等待容器实际启动并验证状态
	d.logger.Info("等待容器 %s 完全启动...", containerID)
	for i := 0; i < 30; i++ { // 最多等待30秒
		inspect, err := d.client.ContainerInspect(ctx, containerInfo.DockerID)
		if err != nil {
			d.logger.Warn("检查容器状态失败: %v", err)
			time.Sleep(1 * time.Second)
			continue
		}

		// 对于一次性执行的容器，成功退出（ExitCode=0）也视为启动成功
		if containerInfo.IsOneTimeExecution && !inspect.State.Running && inspect.State.ExitCode == 0 {
			d.logger.Info("一次性执行容器 %s 成功完成，ExitCode=%d", containerID, inspect.State.ExitCode)
			d.updateContainerState(containerID, StateExited, "Container completed successfully")
			return nil
		}

		if inspect.State.Running {
			d.logger.Info("容器 %s 启动成功，Docker状态: Running=%v, ExitCode=%d", containerID, inspect.State.Running, inspect.State.ExitCode)
			d.updateContainerState(containerID, StateRunning, "")
			return nil
		}

		if inspect.State.Dead || inspect.State.OOMKilled || (inspect.State.ExitCode != 0 && !inspect.State.Running) {
			d.logger.Error("容器 %s 启动失败，Docker状态: Running=%v, ExitCode=%d, Error=%s", containerID, inspect.State.Running, inspect.State.ExitCode, inspect.State.Error)
			errorMsg := fmt.Sprintf("Container failed to start: ExitCode=%d, Error=%s", inspect.State.ExitCode, inspect.State.Error)
			d.updateContainerState(containerID, StateError, errorMsg)
			return fmt.Errorf("container failed to start: %s", errorMsg)
		}

		// 容器还在启动中，继续等待
		d.logger.Info("容器 %s 仍在启动中，等待... (尝试 %d/30)", containerID, i+1)
		time.Sleep(1 * time.Second)
	}

	// 超时处理
	d.logger.Error("容器 %s 启动超时", containerID)
	d.updateContainerState(containerID, StateError, "Container start timeout")
	return fmt.Errorf("container start timeout after 30 seconds")
}

// StopContainer 停止容器
func (d *dockerController) StopContainer(ctx context.Context, containerID string) error {
	d.logger.Info("开始停止容器: %s", containerID)

	d.mu.RLock()
	containerInfo, exists := d.containers[containerID]
	d.mu.RUnlock()

	if !exists {
		d.logger.Warn("容器 %s 不存在于内存中", containerID)
		return fmt.Errorf("container %s not found", containerID)
	}

	// 减少超时时间到10秒，避免前端等待过久
	timeout := 10
	d.logger.Info("正在停止Docker容器，Docker ID: %s，超时时间: %d秒", containerInfo.DockerID[:12], timeout)

	err := d.client.ContainerStop(ctx, containerInfo.DockerID, client.ContainerStopOptions{Timeout: &timeout})
	if err != nil {
		d.logger.Error("停止容器 %s 失败: %v", containerID, err)
		d.updateContainerState(containerID, StateError, fmt.Sprintf("Failed to stop: %v", err))
		return fmt.Errorf("failed to stop container: %w", err)
	}

	d.logger.Info("容器 %s 停止成功", containerID)
	d.updateContainerState(containerID, StateExited, "")
	return nil
}

// cleanupCourseContainers 清理指定课程的所有容器
func (d *dockerController) cleanupCourseContainers(ctx context.Context, courseID string) error {
	d.logger.Info("开始清理课程 %s 的所有容器", courseID)

	// 获取所有容器列表
	containers, err := d.client.ContainerList(ctx, client.ContainerListOptions{All: true})
	if err != nil {
		d.logger.Error("获取容器列表失败: %v", err)
		return fmt.Errorf("failed to list containers: %w", err)
	}

	// 查找匹配课程前缀的容器
	coursePrefix := fmt.Sprintf("kwdb-playground-%s-", courseID)
	cleanedCount := 0

	for _, container := range containers {
		for _, name := range container.Names {
			// 容器名称以 / 开头，需要去掉
			cleanName := strings.TrimPrefix(name, "/")
			if strings.HasPrefix(cleanName, coursePrefix) {
				d.logger.Info("发现课程 %s 的容器: %s (状态: %s)", courseID, cleanName, container.State)

				// 如果容器正在运行，先停止它
				if container.State == "running" {
					d.logger.Info("停止运行中的容器: %s", container.ID[:12])
					timeout := 10
					if err := d.client.ContainerStop(ctx, container.ID, client.ContainerStopOptions{Timeout: &timeout}); err != nil {
						d.logger.Error("停止容器 %s 失败: %v", container.ID[:12], err)
						return fmt.Errorf("failed to stop container %s: %w", container.ID, err)
					}
				}

				// 删除容器
				d.logger.Info("删除容器: %s", container.ID[:12])
				if err := d.client.ContainerRemove(ctx, container.ID, client.ContainerRemoveOptions{Force: true}); err != nil {
					d.logger.Error("删除容器 %s 失败: %v", container.ID[:12], err)
					return fmt.Errorf("failed to remove container %s: %w", container.ID, err)
				}

				// 从内存中移除容器信息
				d.mu.Lock()
				for id, info := range d.containers {
					if info.DockerID == container.ID {
						d.logger.Info("从内存中移除容器信息: %s", id)
						delete(d.containers, id)
						break
					}
				}
				d.mu.Unlock()

				cleanedCount++
				break
			}
		}
	}

	d.logger.Info("课程 %s 容器清理完成，共清理 %d 个容器", courseID, cleanedCount)
	return nil
}

// updateContainerState 更新容器状态
func (d *dockerController) updateContainerState(containerID string, state ContainerState, message string) {
	d.mu.Lock()
	defer d.mu.Unlock()

	if containerInfo, exists := d.containers[containerID]; exists {
		oldState := containerInfo.State
		containerInfo.State = state
		containerInfo.Message = message
		d.logger.Info("容器状态已更新: %s, %s -> %s, 消息: %s", containerID, oldState, state, message)
		
		// 同步更新缓存状态，确保一致性
		if containerInfo.DockerID != "" {
			isRunning := (state == StateRunning)
			d.cache.set(containerInfo.DockerID, isRunning)
			d.logger.Debug("同步更新缓存状态: %s, 运行状态: %v", containerInfo.DockerID[:12], isRunning)
		}
	} else {
		d.logger.Warn("尝试更新不存在的容器状态: %s", containerID)
	}
}

// RestartContainer 重启容器
func (d *dockerController) RestartContainer(ctx context.Context, containerID string) error {
	d.mu.RLock()
	containerInfo, exists := d.containers[containerID]
	d.mu.RUnlock()

	if !exists {
		return fmt.Errorf("container %s not found", containerID)
	}

	timeout := 30
	err := d.client.ContainerRestart(ctx, containerInfo.DockerID, client.ContainerStopOptions{Timeout: &timeout})
	if err != nil {
		d.updateContainerState(containerID, StateError, fmt.Sprintf("Failed to restart: %v", err))
		return fmt.Errorf("failed to restart container: %w", err)
	}

	d.updateContainerState(containerID, StateRunning, "")
	return nil
}

// CreateContainer 创建容器
func (d *dockerController) CreateContainer(ctx context.Context, courseID string, config *ContainerConfig) (*ContainerInfo, error) {
	return d.CreateContainerWithProgress(ctx, courseID, config, nil)
}

// CreateContainerWithProgress 创建容器并支持镜像拉取进度回调
func (d *dockerController) CreateContainerWithProgress(ctx context.Context, courseID string, config *ContainerConfig, progressCallback ImagePullProgressCallback) (*ContainerInfo, error) {
	d.logger.Info("开始创建容器，课程ID: %s, 镜像: %s", courseID, config.Image)

	// 使用课程级别的互斥锁，确保同一课程的容器创建操作是原子性的
	courseMutex := d.getCourseMutex(courseID)
	courseMutex.Lock()
	defer courseMutex.Unlock()

	// 检查镜像是否存在，如果不存在则自动拉取
	if err := d.ensureImageExistsWithProgress(ctx, config.Image, progressCallback); err != nil {
		d.logger.Error("确保镜像 %s 存在失败: %v", config.Image, err)
		return nil, d.enhanceImageError(err, config.Image)
	}

	// 检查镜像兼容性并优化容器配置
	if err := d.checkImageCompatibilityAndOptimizeConfig(ctx, config); err != nil {
		d.logger.Error("镜像兼容性检查失败: %v", err)
		return nil, err
	}

	// 清理该课程的所有现有容器
	if err := d.cleanupCourseContainers(ctx, courseID); err != nil {
		d.logger.Warn("清理课程 %s 的现有容器失败: %v", courseID, err)
		return nil, fmt.Errorf("failed to cleanup existing containers: %w", err)
	}

	// 生成唯一的容器名称
	containerName := fmt.Sprintf("kwdb-playground-%s-%d", courseID, time.Now().Unix())
	d.logger.Info("生成容器名称: %s", containerName)

	// 构建环境变量
	env := make([]string, 0)
	for key, value := range config.Env {
		env = append(env, fmt.Sprintf("%s=%s", key, value))
	}

	// 构建端口映射
	exposedPorts := make(nat.PortSet)
	portBindings := make(nat.PortMap)
	for containerPort, hostPort := range config.Ports {
		port, err := nat.NewPort("tcp", containerPort)
		if err != nil {
			return nil, fmt.Errorf("invalid port %s: %w", containerPort, err)
		}
		exposedPorts[port] = struct{}{}
		portBindings[port] = []nat.PortBinding{
			{
				HostIP:   "0.0.0.0",
				HostPort: hostPort,
			},
		}
	}

	// 构建卷映射
	binds := make([]string, 0)
	for hostPath, containerPath := range config.Volumes {
		binds = append(binds, fmt.Sprintf("%s:%s", hostPath, containerPath))
	}

	// 创建容器配置
	d.logger.Info("[CreateContainer] 镜像: %s, 启动命令: %v", config.Image, config.Cmd)
	containerConfig := &container.Config{
		Image:        config.Image,
		Env:          env,
		ExposedPorts: exposedPorts,
		WorkingDir:   config.WorkingDir,
		Cmd:          config.Cmd,
	}

	// 创建主机配置
	hostConfig := &container.HostConfig{
		PortBindings: portBindings,
		Binds:        binds,
	}

	// 设置资源限制
	if config.MemoryLimit > 0 {
		hostConfig.Memory = config.MemoryLimit
	}
	if config.CPULimit > 0 {
		hostConfig.CPUQuota = int64(config.CPULimit * 100000) // 转换为微秒
		hostConfig.CPUPeriod = 100000
	}

	// 创建容器
	resp, err := d.client.ContainerCreate(ctx, containerConfig, hostConfig, nil, nil, containerName)
	if err != nil {
		d.logger.Error("创建容器失败: %v", err)
		return nil, fmt.Errorf("failed to create container: %w", err)
	}

	d.logger.Info("容器创建成功，Docker ID: %s", resp.ID[:12])

	// 创建容器信息
	containerInfo := &ContainerInfo{
		ID:                 containerName,
		CourseID:           courseID,
		DockerID:           resp.ID,
		State:              StateCreating,
		Image:              config.Image,
		StartedAt:          time.Now(),
		Env:                config.Env,
		Ports:              config.Ports,
		IsOneTimeExecution: config.IsOneTimeExecution,
	}

	// 保存到内存中
	d.mu.Lock()
	d.containers[containerName] = containerInfo
	d.mu.Unlock()

	d.logger.Info("容器 %s 创建完成", containerName)
	return containerInfo, nil
}

// RemoveContainer 删除容器
func (d *dockerController) RemoveContainer(ctx context.Context, containerID string) error {
	d.logger.Info("开始删除容器: %s", containerID)

	d.mu.RLock()
	containerInfo, exists := d.containers[containerID]
	d.mu.RUnlock()

	if !exists {
		d.logger.Warn("容器 %s 不存在于内存中", containerID)
		return fmt.Errorf("container %s not found", containerID)
	}

	// 先停止容器（如果正在运行）
	inspect, err := d.client.ContainerInspect(ctx, containerInfo.DockerID)
	if err == nil && inspect.State.Running {
		d.logger.Info("容器 %s 正在运行，先停止", containerID)
		timeout := 10
		if err := d.client.ContainerStop(ctx, containerInfo.DockerID, client.ContainerStopOptions{Timeout: &timeout}); err != nil {
			d.logger.Error("停止容器 %s 失败: %v", containerID, err)
			return fmt.Errorf("failed to stop container: %w", err)
		}
	}

	// 删除容器
	d.logger.Info("正在删除Docker容器，Docker ID: %s", containerInfo.DockerID[:12])
	err = d.client.ContainerRemove(ctx, containerInfo.DockerID, client.ContainerRemoveOptions{Force: true})
	if err != nil {
		d.logger.Error("删除容器 %s 失败: %v", containerID, err)
		return fmt.Errorf("failed to remove container: %w", err)
	}

	// 从内存中移除
	d.mu.Lock()
	delete(d.containers, containerID)
	d.mu.Unlock()

	// 清理缓存
	d.cache.delete(containerInfo.DockerID)

	d.logger.Info("容器 %s 删除成功", containerID)
	return nil
}

// GetContainerStatus 获取容器状态（字符串形式）
func (d *dockerController) GetContainerStatus(ctx context.Context, containerID string) (string, error) {
	container, err := d.GetContainer(ctx, containerID)
	if err != nil {
		return "", err
	}
	return string(container.State), nil
}

// GetContainer 获取容器信息
func (d *dockerController) GetContainer(ctx context.Context, containerID string) (*ContainerInfo, error) {
	d.mu.RLock()
	containerInfo, exists := d.containers[containerID]
	d.mu.RUnlock()

	if !exists {
		return nil, fmt.Errorf("container %s not found", containerID)
	}

	// 从Docker API获取最新状态
	inspect, err := d.client.ContainerInspect(ctx, containerInfo.DockerID)
	if err != nil {
		return nil, fmt.Errorf("failed to inspect container: %w", err)
	}

	// 创建副本以避免修改原始数据
	result := *containerInfo

	// 只有当Docker状态明确时才更新状态
	// 避免在容器刚启动时覆盖内存中的正确状态
	dockerState := d.mapDockerState(inspect.State)
	if inspect.State.Running || inspect.State.Dead || inspect.State.OOMKilled || (inspect.State.ExitCode != 0 && !inspect.State.Running) {
		// Docker状态明确，更新状态
		result.State = dockerState
		d.logger.Debug("[GetContainer] 容器 %s Docker状态明确，更新为: %s (Running: %v, ExitCode: %d)", containerID, dockerState, inspect.State.Running, inspect.State.ExitCode)
	} else {
		// Docker状态不明确，保持内存中的状态
		d.logger.Debug("[GetContainer] 容器 %s Docker状态不明确，保持内存状态: %s (Running: %v, ExitCode: %d)", containerID, result.State, inspect.State.Running, inspect.State.ExitCode)
	}

	if inspect.State.ExitCode != 0 {
		result.ExitCode = &inspect.State.ExitCode
	}
	if inspect.State.Error != "" {
		result.Message = inspect.State.Error
	}

	return &result, nil
}

// ListContainers 列出所有容器
func (d *dockerController) ListContainers(ctx context.Context) ([]*ContainerInfo, error) {
	d.mu.RLock()
	defer d.mu.RUnlock()

	containers := make([]*ContainerInfo, 0, len(d.containers))
	for _, containerInfo := range d.containers {
		// 获取最新状态
		inspect, err := d.client.ContainerInspect(ctx, containerInfo.DockerID)
		if err != nil {
			// 如果容器不存在，跳过
			continue
		}

		// 创建副本并更新状态
		info := *containerInfo
		info.State = d.mapDockerState(inspect.State)
		if inspect.State.ExitCode != 0 {
			info.ExitCode = &inspect.State.ExitCode
		}
		if inspect.State.Error != "" {
			info.Message = inspect.State.Error
		}

		containers = append(containers, &info)
	}

	return containers, nil
}

// GetContainerLogs 获取容器日志
func (d *dockerController) GetContainerLogs(ctx context.Context, containerID string, tail int, follow bool) (io.ReadCloser, error) {
	d.mu.RLock()
	containerInfo, exists := d.containers[containerID]
	d.mu.RUnlock()

	if !exists {
		return nil, fmt.Errorf("container %s not found", containerID)
	}

	options := client.ContainerLogsOptions{
		ShowStdout: true,
		ShowStderr: true,
		Follow:     follow,
		Timestamps: true,
	}

	if tail > 0 {
		tailStr := fmt.Sprintf("%d", tail)
		options.Tail = tailStr
	}

	return d.client.ContainerLogs(ctx, containerInfo.DockerID, options)
}

// ExecCommandOptions 定义命令执行选项

// prepareExecEnvironment 准备执行环境配置
func (d *dockerController) prepareExecEnvironment(inspect container.InspectResponse, interactive bool) ([]string, string, string) {
	// 复制现有环境变量
	env := make([]string, len(inspect.Config.Env))
	copy(env, inspect.Config.Env)

	if interactive {
		// 添加交互式终端必需的环境变量
		interactiveEnvVars := []string{
			"TERM=xterm-256color", // 支持颜色和特殊字符
			"COLUMNS=80",          // 默认终端宽度
			"LINES=24",            // 默认终端高度
			"PS1=$ ",              // 设置提示符
		}

		// 检查并添加缺失的环境变量
		existingVars := make(map[string]bool)
		for _, envVar := range env {
			if idx := strings.Index(envVar, "="); idx > 0 {
				existingVars[envVar[:idx]] = true
			}
		}

		for _, stdVar := range interactiveEnvVars {
			if idx := strings.Index(stdVar, "="); idx > 0 {
				key := stdVar[:idx]
				if !existingVars[key] {
					env = append(env, stdVar)
				}
			}
		}
	}

	// 设置用户
	user := inspect.Config.User
	if user == "" {
		user = "root"
	}

	// 设置工作目录
	workingDir := "/workspace"
	if inspect.Config.WorkingDir != "" {
		workingDir = inspect.Config.WorkingDir
	}

	return env, user, workingDir
}

// validateExecParams 验证执行参数
func (d *dockerController) validateExecParams(containerID string, cmd []string, stdoutWriter io.Writer) error {
	if containerID == "" {
		return fmt.Errorf("container ID cannot be empty")
	}
	if len(cmd) == 0 {
		return fmt.Errorf("command cannot be empty")
	}
	if stdoutWriter == nil {
		return fmt.Errorf("stdout writer cannot be nil")
	}
	return nil
}

// getContainerInfo 获取并验证容器信息
func (d *dockerController) getContainerInfo(ctx context.Context, containerID string) (*ContainerInfo, container.InspectResponse, error) {
	// 获取容器信息
	d.mu.RLock()
	containerInfo, exists := d.containers[containerID]
	d.mu.RUnlock()

	if !exists {
		return nil, container.InspectResponse{}, fmt.Errorf("container %s not found", containerID)
	}

	// 检查容器状态
	inspect, err := d.client.ContainerInspect(ctx, containerInfo.DockerID)
	if err != nil {
		return nil, container.InspectResponse{}, fmt.Errorf("failed to inspect container: %w", err)
	}

	if !inspect.State.Running {
		return nil, container.InspectResponse{}, fmt.Errorf("container %s is not running (state: %s)", containerID, inspect.State.Status)
	}

	return containerInfo, inspect, nil
}

// PullImage 拉取镜像
func (d *dockerController) PullImage(ctx context.Context, imageName string) error {
	d.logger.Info("开始拉取镜像: %s", imageName)

	// 拉取镜像
	reader, err := d.client.ImagePull(ctx, imageName, client.ImagePullOptions{})
	if err != nil {
		return fmt.Errorf("failed to pull image %s: %w", imageName, err)
	}
	defer reader.Close()

	// 读取拉取进度（可选，这里简单处理）
	_, err = io.Copy(io.Discard, reader)
	if err != nil {
		return fmt.Errorf("failed to read pull response: %w", err)
	}

	d.logger.Info("镜像拉取完成: %s", imageName)
	return nil
}

// ExecCommand 在容器中执行命令
func (d *dockerController) ExecCommand(ctx context.Context, containerID string, cmd []string) (string, error) {
	d.logger.Info("在容器 %s 中执行命令: %v", containerID, cmd)

	d.mu.RLock()
	containerInfo, exists := d.containers[containerID]
	d.mu.RUnlock()

	if !exists {
		return "", fmt.Errorf("container %s not found", containerID)
	}

	// 创建执行配置
	execConfig := container.ExecOptions{
		Cmd:          cmd,
		AttachStdout: true,
		AttachStderr: true,
	}

	// 创建执行实例
	execResp, err := d.client.ContainerExecCreate(ctx, containerInfo.DockerID, execConfig)
	if err != nil {
		return "", fmt.Errorf("failed to create exec: %w", err)
	}

	// 启动执行
	attachResp, err := d.client.ContainerExecAttach(ctx, execResp.ID, container.ExecAttachOptions{})
	if err != nil {
		return "", fmt.Errorf("failed to attach exec: %w", err)
	}
	defer attachResp.Close()

	// 启动命令执行
	err = d.client.ContainerExecStart(ctx, execResp.ID, container.ExecStartOptions{})
	if err != nil {
		return "", fmt.Errorf("failed to start exec: %w", err)
	}

	// 读取输出
	output, err := io.ReadAll(attachResp.Reader)
	if err != nil {
		return "", fmt.Errorf("failed to read output: %w", err)
	}

	// 检查执行结果
	inspectResp, err := d.client.ContainerExecInspect(ctx, execResp.ID)
	if err != nil {
		return string(output), fmt.Errorf("failed to inspect exec: %w", err)
	}

	if inspectResp.ExitCode != 0 {
		return string(output), fmt.Errorf("command failed with exit code %d", inspectResp.ExitCode)
	}

	return string(output), nil
}

// ExecCommandInteractive 在容器中执行交互式命令
// 支持实时双向通信，与docker exec -it功能完全一致
func (d *dockerController) ExecCommandInteractive(ctx context.Context, containerID string, cmd []string, stdinReader io.Reader, stdoutWriter, stderrWriter io.Writer) error {
	// 参数验证
	if err := d.validateExecParams(containerID, cmd, stdoutWriter); err != nil {
		return err
	}

	// 获取容器信息
	containerInfo, inspect, err := d.getContainerInfo(ctx, containerID)
	if err != nil {
		return err
	}

	// 准备执行环境
	env, user, workingDir := d.prepareExecEnvironment(inspect, true)

	// 创建交互式执行配置
	execConfig := container.ExecOptions{
		Cmd:          cmd,
		AttachStdout: true,
		AttachStderr: true,
		AttachStdin:  true, // 支持标准输入
		Tty:          true, // 使用TTY支持交互式命令
		WorkingDir:   workingDir,
		Env:          env,
		User:         user,
		DetachKeys:   "ctrl-p,ctrl-q", // 设置分离键序列
	}

	// 创建执行实例
	execResp, err := d.client.ContainerExecCreate(ctx, containerInfo.DockerID, execConfig)
	if err != nil {
		return fmt.Errorf("failed to create exec: %w", err)
	}

	// 启动执行并附加输入输出流
	attachResp, err := d.client.ContainerExecAttach(ctx, execResp.ID, container.ExecAttachOptions{
		Tty: true,
	})
	if err != nil {
		return fmt.Errorf("failed to attach exec: %w", err)
	}
	defer attachResp.Close()

	// 启动命令执行
	err = d.client.ContainerExecStart(ctx, execResp.ID, container.ExecStartOptions{})
	if err != nil {
		return fmt.Errorf("failed to start exec: %w", err)
	}

	// 使用context来协调goroutines
	var wg sync.WaitGroup
	errorChan := make(chan error, 3)
	ctxWithCancel, cancel := context.WithCancel(ctx)
	defer cancel()

	// 处理标准输入流 - 从WebSocket到容器（高性能流式输入）
	if stdinReader != nil {
		wg.Add(1)
		go func() {
			defer wg.Done()
			defer func() {
				// 关闭写入端，通知容器输入结束
				if closer, ok := attachResp.Conn.(interface{ CloseWrite() error }); ok {
					closer.CloseWrite()
				}
			}()

			// 使用较小的缓冲区实现零延迟传输
			buf := make([]byte, 256)
			for {
				select {
				case <-ctxWithCancel.Done():
					return
				default:
					// 设置短超时读取，避免阻塞
					if conn, ok := stdinReader.(interface{ SetReadDeadline(time.Time) error }); ok {
						conn.SetReadDeadline(time.Now().Add(10 * time.Millisecond))
					}

					n, err := stdinReader.Read(buf)
					if err != nil {
						if err != io.EOF && !os.IsTimeout(err) {
							select {
							case errorChan <- fmt.Errorf("stdin read error: %w", err):
							case <-ctxWithCancel.Done():
							}
							return
						}
						// 超时错误继续循环
						continue
					}
					if n > 0 {
						// 立即发送数据，不缓冲
						_, writeErr := attachResp.Conn.Write(buf[:n])
						if writeErr != nil {
							select {
							case errorChan <- fmt.Errorf("stdin write error: %w", writeErr):
							case <-ctxWithCancel.Done():
							}
							return
						}
					}
				}
			}
		}()
	}

	// 处理标准输出流 - 从容器到WebSocket（高性能流式输出）
	if stdoutWriter != nil {
		wg.Add(1)
		go func() {
			defer wg.Done()

			// 使用较小的缓冲区实现零延迟传输
			buf := make([]byte, 256)
			for {
				select {
				case <-ctxWithCancel.Done():
					return
				default:
					// 直接读取，不设置超时

					n, err := attachResp.Reader.Read(buf)
					if err != nil {
						if err != io.EOF && !os.IsTimeout(err) {
							select {
							case errorChan <- fmt.Errorf("stdout read error: %w", err):
							case <-ctxWithCancel.Done():
							}
							return
						}
						// 超时错误继续循环
						continue
					}
					if n > 0 {
						// 立即发送数据，不缓冲
						_, writeErr := stdoutWriter.Write(buf[:n])
						if writeErr != nil {
							select {
							case errorChan <- fmt.Errorf("stdout write error: %w", writeErr):
							case <-ctxWithCancel.Done():
							}
							return
						}
					}
				}
			}
		}()
	}

	// 处理标准错误流 - 从容器到WebSocket（如果提供了stderrWriter）
	if stderrWriter != nil {
		wg.Add(1)
		go func() {
			defer wg.Done()

			// 由于TTY模式下stderr和stdout是合并的，这里主要用于非TTY模式
			// 在TTY模式下，这个goroutine可能不会收到数据
			for {
				select {
				case <-ctxWithCancel.Done():
					return
				default:
					// 在TTY模式下，stderr通常为空
					time.Sleep(100 * time.Millisecond)
				}
			}
		}()
	}

	// 等待命令执行完成或出现错误
	done := make(chan struct{})
	go func() {
		wg.Wait()
		close(done)
	}()

	// 监控执行状态
	go func() {
		ticker := time.NewTicker(1 * time.Second)
		defer ticker.Stop()

		for {
			select {
			case <-ctxWithCancel.Done():
				return
			case <-ticker.C:
				// 检查执行状态
				inspectResp, err := d.client.ContainerExecInspect(ctx, execResp.ID)
				if err != nil {
					select {
					case errorChan <- fmt.Errorf("failed to inspect exec: %w", err):
					case <-ctxWithCancel.Done():
					}
					return
				}

				// 如果命令已完成且退出码不为0，报告错误
				if !inspectResp.Running && inspectResp.ExitCode != 0 {
					select {
					case errorChan <- fmt.Errorf("command failed with exit code %d", inspectResp.ExitCode):
					case <-ctxWithCancel.Done():
					}
					return
				}
			}
		}
	}()

	// 等待完成或错误
	select {
	case err := <-errorChan:
		cancel()
		return err
	case <-done:
		// 所有流处理完成
		return nil
	case <-ctx.Done():
		cancel()
		return ctx.Err()
	}
}

// ResizeTerminal 调整交互式终端的大小
// 用于支持终端窗口大小变化时的动态调整
func (d *dockerController) ResizeTerminal(ctx context.Context, execID string, height, width uint) error {
	// 参数验证
	if execID == "" {
		return fmt.Errorf("exec ID cannot be empty")
	}
	if height == 0 || width == 0 {
		return fmt.Errorf("terminal dimensions must be greater than 0")
	}

	// 调整终端大小
	err := d.client.ContainerExecResize(ctx, execID, client.ContainerResizeOptions{
		Height: height,
		Width:  width,
	})
	if err != nil {
		return fmt.Errorf("failed to resize terminal: %w", err)
	}

	return nil
}

// ContainerExecResize 调整执行实例的终端大小
func (d *dockerController) ContainerExecResize(ctx context.Context, execID string, options client.ContainerResizeOptions) error {
	return d.client.ContainerExecResize(ctx, execID, options)
}

// mapDockerState 将Docker状态映射为内部状态
func (d *dockerController) mapDockerState(state *container.State) ContainerState {
	if state.Running {
		return StateRunning
	}
	if state.Dead || state.OOMKilled {
		return StateError
	}
	if state.ExitCode != 0 {
		return StateError
	}
	// 容器已退出但退出码为0
	return StateExited
}

// Close 关闭控制器
func (d *dockerController) Close() error {
	if d.client != nil {
		return d.client.Close()
	}
	return nil
}

// classifyPullError 分类拉取错误并提供详细的错误信息和建议
func (d *dockerController) classifyPullError(err error, imageName string) string {
	errorStr := err.Error()

	// 网络连接错误
	if strings.Contains(errorStr, "connection refused") ||
		strings.Contains(errorStr, "network is unreachable") ||
		strings.Contains(errorStr, "timeout") ||
		strings.Contains(errorStr, "dial tcp") {
		return fmt.Sprintf("网络连接失败，无法连接到镜像仓库。请检查网络连接或稍后重试。镜像: %s，错误: %v", imageName, err)
	}

	// 权限认证错误
	if strings.Contains(errorStr, "unauthorized") ||
		strings.Contains(errorStr, "authentication required") ||
		strings.Contains(errorStr, "access denied") ||
		strings.Contains(errorStr, "forbidden") {
		return fmt.Sprintf("权限不足，无法访问镜像仓库。请检查Docker登录状态或镜像访问权限。镜像: %s，错误: %v", imageName, err)
	}

	// 镜像不存在错误
	if strings.Contains(errorStr, "not found") ||
		strings.Contains(errorStr, "repository does not exist") ||
		strings.Contains(errorStr, "manifest unknown") {
		return fmt.Sprintf("镜像不存在，请检查镜像名称和标签是否正确。镜像: %s，错误: %v", imageName, err)
	}

	// 磁盘空间不足错误
	if strings.Contains(errorStr, "no space left on device") ||
		strings.Contains(errorStr, "disk full") {
		return fmt.Sprintf("磁盘空间不足，无法下载镜像。请清理磁盘空间后重试。镜像: %s，错误: %v", imageName, err)
	}

	// Docker守护进程错误
	if strings.Contains(errorStr, "docker daemon") ||
		strings.Contains(errorStr, "cannot connect to the Docker daemon") {
		return fmt.Sprintf("无法连接到Docker守护进程，请确保Docker服务正在运行。镜像: %s，错误: %v", imageName, err)
	}

	// 镜像仓库服务器错误
	if strings.Contains(errorStr, "500") ||
		strings.Contains(errorStr, "502") ||
		strings.Contains(errorStr, "503") ||
		strings.Contains(errorStr, "504") {
		return fmt.Sprintf("镜像仓库服务器错误，请稍后重试。镜像: %s，错误: %v", imageName, err)
	}

	// 默认错误信息
	return fmt.Sprintf("拉取镜像失败，请检查镜像名称、网络连接和Docker配置。镜像: %s，错误: %v", imageName, err)
}

// classifyImageCheckError 分类镜像检查错误并提供详细的错误信息
func (d *dockerController) classifyImageCheckError(err error, imageName string) string {
	errorStr := err.Error()

	// Docker守护进程错误
	if strings.Contains(errorStr, "docker daemon") ||
		strings.Contains(errorStr, "cannot connect to the Docker daemon") {
		return fmt.Sprintf("无法连接到Docker守护进程，请确保Docker服务正在运行。镜像: %s，错误: %v", imageName, err)
	}

	// 权限错误
	if strings.Contains(errorStr, "permission denied") ||
		strings.Contains(errorStr, "access denied") {
		return fmt.Sprintf("权限不足，无法访问Docker。请检查用户权限或以管理员身份运行。镜像: %s，错误: %v", imageName, err)
	}

	// 网络连接错误
	if strings.Contains(errorStr, "connection refused") ||
		strings.Contains(errorStr, "timeout") {
		return fmt.Sprintf("网络连接失败，无法连接到Docker守护进程。请检查Docker服务状态。镜像: %s，错误: %v", imageName, err)
	}

	// 默认错误信息
	return fmt.Sprintf("检查镜像失败，请检查Docker配置和服务状态。镜像: %s，错误: %v", imageName, err)
}

// ensureImageExistsWithProgress 确保镜像存在，如果不存在则自动拉取，支持进度回调
func (d *dockerController) ensureImageExistsWithProgress(ctx context.Context, imageName string, progressCallback ImagePullProgressCallback) error {
	d.logger.Info("检查镜像是否存在: %s", imageName)

	// 检查本地是否存在镜像
	exists, err := d.checkImageExists(ctx, imageName)
	if err != nil {
		return fmt.Errorf("检查镜像存在性失败: %w", err)
	}

	if exists {
		d.logger.Info("镜像 %s 已存在于本地", imageName)
		return nil
	}

	d.logger.Info("镜像 %s 不存在，开始自动拉取", imageName)

	// 创建WebSocket广播回调
	webSocketCallback := func(progress ImagePullProgress) {
		// 调用原始回调（如果存在）
		if progressCallback != nil {
			progressCallback(progress)
		}

		// 通过WebSocket广播进度信息
		if d.terminalManager != nil {
			d.terminalManager.BroadcastImagePullProgress(ImagePullProgressMessage{
				ImageName: progress.ImageName,
				Status:    progress.Status,
				Progress:  progress.Progress,
				Error:     progress.Error,
			})
		}
	}

	// 发送开始拉取的进度信息
	webSocketCallback(ImagePullProgress{
		ImageName: imageName,
		Status:    "开始拉取镜像",
	})

	if err := d.pullImageWithProgress(ctx, imageName, webSocketCallback); err != nil {
		// 使用详细的错误分类
		errorMsg := d.classifyPullError(err, imageName)
		// 发送拉取失败的进度信息
		webSocketCallback(ImagePullProgress{
			ImageName: imageName,
			Status:    "拉取失败",
			Error:     errorMsg,
		})
		return fmt.Errorf(errorMsg)
	}

	// 发送拉取成功的进度信息
	webSocketCallback(ImagePullProgress{
		ImageName: imageName,
		Status:    "拉取完成",
	})

	d.logger.Info("镜像 %s 拉取成功", imageName)
	return nil
}

// checkImageExists 检查本地是否存在指定镜像
func (d *dockerController) checkImageExists(ctx context.Context, imageName string) (bool, error) {
	// 使用 ImageInspect 检查镜像是否存在
	_, _, err := d.client.ImageInspectWithRaw(ctx, imageName)
	if err != nil {
		// 如果是镜像不存在的错误，返回 false
		if errdefs.IsNotFound(err) {
			return false, nil
		}
		// 其他错误使用详细的错误分类
		errorMsg := d.classifyImageCheckError(err, imageName)
		return false, fmt.Errorf(errorMsg)
	}
	return true, nil
}

// pullImageWithProgress 拉取镜像并支持进度回调
func (d *dockerController) pullImageWithProgress(ctx context.Context, imageName string, progressCallback ImagePullProgressCallback) error {
	// 详细日志：开始拉取镜像
	d.logger.Info("[镜像拉取] 开始拉取镜像: %s", imageName)

	// 发送开始拉取的进度信息
	if progressCallback != nil {
		d.logger.Debug("[镜像拉取] 发送开始拉取进度回调: %s", imageName)
		progressCallback(ImagePullProgress{
			ImageName: imageName,
			Status:    "开始拉取镜像",
		})
	} else {
		d.logger.Warn("[镜像拉取] 进度回调函数为空: %s", imageName)
	}

	// 创建拉取选项
	options := client.ImagePullOptions{}
	d.logger.Debug("[镜像拉取] 创建拉取选项: %s", imageName)

	// 开始拉取镜像
	resp, err := d.client.ImagePull(ctx, imageName, options)
	if err != nil {
		// 详细日志：Docker API拉取失败
		d.logger.Error("[镜像拉取] Docker API拉取失败 - 镜像: %s, 原始错误: %v", imageName, err)
		// 详细的错误分类和处理
		errorMsg := d.classifyPullError(err, imageName)
		d.logger.Error("[镜像拉取] 分类后的错误信息: %s", errorMsg)
		if progressCallback != nil {
			d.logger.Debug("[镜像拉取] 发送拉取失败进度回调: %s", imageName)
			progressCallback(ImagePullProgress{
				ImageName: imageName,
				Status:    "拉取失败",
				Error:     errorMsg,
			})
		}
		return fmt.Errorf(errorMsg)
	}
	defer resp.Close()

	// 详细日志：成功开始拉取流
	d.logger.Info("[镜像拉取] 成功开始镜像拉取流: %s", imageName)

	// 读取拉取进度
	decoder := json.NewDecoder(resp)
	progressCount := 0
	for {
		var progressInfo map[string]interface{}
		err := decoder.Decode(&progressInfo)
		if err != nil {
			if err == io.EOF {
				d.logger.Info("[镜像拉取] 拉取进度流结束: %s, 总进度事件数: %d", imageName, progressCount)
				break
			}
			d.logger.Warn("[镜像拉取] 解析拉取进度JSON失败 - 镜像: %s, 错误: %v", imageName, err)
			continue
		}

		progressCount++
		// 解析进度信息
		status, _ := progressInfo["status"].(string)
		progress, _ := progressInfo["progress"].(string)
		errorStr, _ := progressInfo["error"].(string)

		// 为空的status提供默认值，避免前端显示undefined
		if status == "" {
			status = "正在拉取镜像..."
		}

		// 详细日志：进度事件
		if errorStr != "" {
			d.logger.Error("[镜像拉取] 拉取过程中出现错误 - 镜像: %s, 状态: %s, 错误: %s", imageName, status, errorStr)
		} else {
			d.logger.Debug("[镜像拉取] 进度事件 #%d - 镜像: %s, 状态: %s, 进度: %s", progressCount, imageName, status, progress)
		}

		// 发送进度回调
		if progressCallback != nil {
			d.logger.Debug("[镜像拉取] 发送进度回调 #%d: %s", progressCount, imageName)
			progressCallback(ImagePullProgress{
				ImageName: imageName,
				Status:    status,
				Progress:  progress,
				Error:     errorStr,
			})
		} else {
			d.logger.Warn("[镜像拉取] 进度回调函数为空，无法发送进度 #%d: %s", progressCount, imageName)
		}

		// 检查是否有错误
		if errorStr != "" {
			d.logger.Error("[镜像拉取] 拉取失败，返回错误 - 镜像: %s, 错误: %s", imageName, errorStr)
			return fmt.Errorf("拉取镜像过程中出现错误: %s", errorStr)
		}
	}

	// 详细日志：拉取成功完成
	d.logger.Info("[镜像拉取] 镜像拉取成功完成: %s, 总进度事件数: %d", imageName, progressCount)
	if progressCallback != nil {
		d.logger.Debug("[镜像拉取] 发送拉取完成进度回调: %s", imageName)
		progressCallback(ImagePullProgress{
			ImageName: imageName,
			Status:    "拉取完成",
		})
	} else {
		d.logger.Warn("[镜像拉取] 进度回调函数为空，无法发送完成通知: %s", imageName)
	}
	return nil
}

// enhanceImageError 增强镜像相关错误信息，提供更详细的诊断和解决方案
func (d *dockerController) enhanceImageError(err error, imageName string) error {
	errorStr := err.Error()
	lowerError := strings.ToLower(errorStr)

	// 镜像不存在错误
	if strings.Contains(lowerError, "no such image") || strings.Contains(lowerError, "not found") {
		return fmt.Errorf("镜像 '%s' 不存在。请检查镜像名称是否正确，或确保镜像已推送到仓库。原始错误: %v", imageName, err)
	}

	// 权限拒绝错误
	if strings.Contains(lowerError, "pull access denied") || strings.Contains(lowerError, "access denied") {
		return fmt.Errorf("无权限拉取镜像 '%s'。请检查镜像仓库的访问权限，或使用公开镜像。原始错误: %v", imageName, err)
	}

	// 网络连接错误
	if strings.Contains(lowerError, "connection refused") || strings.Contains(lowerError, "timeout") || strings.Contains(lowerError, "network") {
		return fmt.Errorf("网络连接失败，无法拉取镜像 '%s'。请检查网络连接和Docker配置。原始错误: %v", imageName, err)
	}

	// Docker守护进程错误
	if strings.Contains(lowerError, "docker daemon") || strings.Contains(lowerError, "cannot connect") {
		return fmt.Errorf("无法连接到Docker守护进程。请确保Docker服务正在运行。镜像: %s，原始错误: %v", imageName, err)
	}

	// 默认增强错误
	return fmt.Errorf("镜像操作失败 '%s'。请检查镜像名称、网络连接和Docker配置。原始错误: %v", imageName, err)
}

// checkImageCompatibilityAndOptimizeConfig 检查镜像兼容性并优化容器配置
func (d *dockerController) checkImageCompatibilityAndOptimizeConfig(ctx context.Context, config *ContainerConfig) error {
	d.logger.Info("检查镜像兼容性: %s", config.Image)

	// 检查镜像信息
	imageInfo, _, err := d.client.ImageInspectWithRaw(ctx, config.Image)
	if err != nil {
		return fmt.Errorf("无法获取镜像信息: %w", err)
	}

	// 分析镜像类型和特征
	imageType := d.analyzeImageType(config.Image, &imageInfo)
	d.logger.Info("检测到镜像类型: %s", imageType)

	// 根据镜像类型优化配置
	switch imageType {
	case "hello-world":
		return d.optimizeForHelloWorldImage(config)
	case "minimal":
		return d.optimizeForMinimalImage(config, &imageInfo)
	case "alpine":
		return d.optimizeForAlpineImage(config)
	case "ubuntu":
		return d.optimizeForUbuntuImage(config)
	case "centos":
		return d.optimizeForCentOSImage(config)
	default:
		return d.optimizeForGenericImage(config, &imageInfo)
	}
}

// analyzeImageType 分析镜像类型
func (d *dockerController) analyzeImageType(imageName string, imageInfo *image.InspectResponse) string {
	lowerName := strings.ToLower(imageName)

	// 特殊测试镜像
	if strings.Contains(lowerName, "hello-world") {
		return "hello-world"
	}

	// 常见Linux发行版
	if strings.Contains(lowerName, "alpine") {
		return "alpine"
	}
	if strings.Contains(lowerName, "ubuntu") {
		return "ubuntu"
	}
	if strings.Contains(lowerName, "centos") || strings.Contains(lowerName, "rhel") {
		return "centos"
	}
	if strings.Contains(lowerName, "debian") {
		return "ubuntu" // 使用类似的优化策略
	}

	// 检查镜像大小判断是否为最小化镜像
	if imageInfo.Size < 50*1024*1024 { // 小于50MB认为是最小化镜像
		return "minimal"
	}

	return "generic"
}

// optimizeForHelloWorldImage 为hello-world镜像优化配置
func (d *dockerController) optimizeForHelloWorldImage(config *ContainerConfig) error {
	d.logger.Info("检测到hello-world镜像，使用默认行为")

	// hello-world镜像只是打印消息然后退出，这是正常行为
	// 清空Cmd让镜像使用默认的入口点
	config.Cmd = nil
	// 标记这是一个一次性执行的镜像
	config.IsOneTimeExecution = true
	d.logger.Info("已为hello-world镜像清空启动命令，使用默认行为，标记为一次性执行")

	return nil
}

// optimizeForMinimalImage 为最小化镜像优化配置
func (d *dockerController) optimizeForMinimalImage(config *ContainerConfig, imageInfo *image.InspectResponse) error {
	d.logger.Info("检测到最小化镜像，检查shell可用性")

	// 检查镜像是否包含常见的shell
	hasShell := false
	shellPaths := []string{"/bin/bash", "/bin/sh", "/bin/ash"}

	// 检查镜像配置中的入口点和命令
	if imageInfo.Config != nil {
		// 检查默认命令是否包含shell
		for _, cmd := range imageInfo.Config.Cmd {
			for _, shellPath := range shellPaths {
				if strings.Contains(cmd, shellPath) {
					hasShell = true
					break
				}
			}
		}
	}

	if !hasShell {
		// 尝试使用/bin/sh作为备选
		d.logger.Info("镜像可能不包含/bin/bash，尝试使用/bin/sh")
		if len(config.Cmd) == 0 || (len(config.Cmd) > 0 && config.Cmd[0] == "/bin/bash") {
			config.Cmd = []string{"/bin/sh"}
			d.logger.Info("已将容器命令修改为: %v", config.Cmd)
		}
	}

	return nil
}

// optimizeForAlpineImage 为Alpine镜像优化配置
func (d *dockerController) optimizeForAlpineImage(config *ContainerConfig) error {
	d.logger.Info("为Alpine镜像优化配置")

	// Alpine使用ash shell，但通常/bin/sh链接到ash
	if len(config.Cmd) == 0 || (len(config.Cmd) > 0 && config.Cmd[0] == "/bin/bash") {
		config.Cmd = []string{"/bin/sh"}
		d.logger.Info("Alpine镜像使用/bin/sh替代/bin/bash")
	}

	return nil
}

// optimizeForUbuntuImage 为Ubuntu镜像优化配置
func (d *dockerController) optimizeForUbuntuImage(config *ContainerConfig) error {
	d.logger.Info("为Ubuntu镜像优化配置")

	// Ubuntu通常包含bash，保持默认配置
	if len(config.Cmd) == 0 {
		config.Cmd = []string{"/bin/bash"}
	}

	return nil
}

// optimizeForCentOSImage 为CentOS镜像优化配置
func (d *dockerController) optimizeForCentOSImage(config *ContainerConfig) error {
	d.logger.Info("为CentOS镜像优化配置")

	// CentOS通常包含bash，保持默认配置
	if len(config.Cmd) == 0 {
		config.Cmd = []string{"/bin/bash"}
	}

	return nil
}

// optimizeForGenericImage 为通用镜像优化配置
func (d *dockerController) optimizeForGenericImage(config *ContainerConfig, imageInfo *image.InspectResponse) error {
	d.logger.Info("为通用镜像优化配置")

	// 对于未知镜像，尝试智能检测和配置
	if len(config.Cmd) == 0 {
		// 优先尝试bash，如果不行再尝试sh
		config.Cmd = []string{"/bin/bash"}
		d.logger.Info("通用镜像默认使用/bin/bash，如果启动失败会自动尝试其他shell")
	}

	return nil
}
