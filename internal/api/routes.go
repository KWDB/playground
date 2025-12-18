package api

import (
	"context"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"sync"
	"time"

	"kwdb-playground/internal/check"
	"kwdb-playground/internal/config"
	"kwdb-playground/internal/course"
	"kwdb-playground/internal/docker"
	"kwdb-playground/internal/logger"
	sql "kwdb-playground/internal/sql"
	ws "kwdb-playground/internal/websocket"

	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
)

// Handler API处理器
// 封装所有HTTP请求处理逻辑，提供RESTful API接口
type Handler struct {
	// courseService 课程服务实例，用于处理课程相关操作
	courseService *course.Service
	// dockerController Docker控制器实例，用于容器管理
	dockerController docker.Controller
	// terminalManager WebSocket终端管理器实例，用于终端会话管理
	terminalManager *ws.TerminalManager
	// logger 日志记录器实例，用于统一日志管理
	logger *logger.Logger

	// cfg 全局配置，用于环境检查等场景
	cfg *config.Config

	// sqlDriver KWDB 连接驱动（SQL 终端使用）
	sqlDriver *sql.Driver

	// containerMutex 容器操作互斥锁，防止并发创建/删除容器
	containerMutex sync.Mutex
}

// NewHandler 创建新的API处理器
// 参数:
//
//	courseService: 课程服务实例
//	dockerController: Docker控制器实例
//	terminalManager: WebSocket终端管理器实例
//	logger: 日志记录器实例（从main函数传入，确保使用统一配置）
//
// 返回: 初始化的API处理器
func NewHandler(
	courseService *course.Service,
	dockerController docker.Controller,
	terminalManager *ws.TerminalManager,
	logger *logger.Logger,
	cfg *config.Config,
) *Handler {
	return &Handler{
		courseService:    courseService,
		dockerController: dockerController,
		terminalManager:  terminalManager,
		logger:           logger,
		cfg:              cfg,
		sqlDriver:        &sql.Driver{},
	}
}

// SetupRoutes 设置路由
// 配置所有HTTP路由和中间件，包括健康检查、课程管理、容器操作等API端点
// 参数:
//
//	r: Gin引擎实例
func (h *Handler) SetupRoutes(r *gin.Engine) {
	// 健康检查路由（根级别）
	r.GET("/health", h.healthCheck)

	api := r.Group("/api")
	{
		// 环境检测
		api.GET("/check", h.envCheck)

		// 课程相关路由
		courses := api.Group("/courses")
		{
			courses.GET("", h.getCourses)
			courses.GET("/:id", h.getCourse)
			courses.POST("/:id/start", h.startCourse)
			courses.POST("/:id/stop", h.stopCourse)
			// 端口冲突检查和容器清理接口
			courses.GET("/:id/check-port-conflict", h.checkPortConflict)
			courses.POST("/:id/cleanup-containers", h.cleanupCourseContainers)
		}

		// 容器相关路由
		containers := api.Group("/containers")
		{
			containers.GET("", h.getAllContainers)
			containers.DELETE("", h.cleanupAllContainers)
			containers.GET("/:id/status", h.getContainerStatus)
			containers.GET("/:id/logs", h.getContainerLogs)
			containers.POST("/:id/restart", h.restartContainer)
			containers.POST("/:id/stop", h.stopContainerByID)
		}

		// 镜像相关路由
		images := api.Group("/images")
		{
			images.POST("/check-availability", h.checkImageAvailability)
			images.GET("/sources", h.getImageSources)
		}

		// SQL 信息与健康（REST 信息类）
		api.GET("/sql/info", h.sqlInfo)
		api.GET("/sql/health", h.sqlHealth)
	}

	// WebSocket路由
	r.GET("/ws/terminal", h.handleTerminalWebSocket)
	// SQL WebSocket 路由（与Shell终端操作方式一致）
	r.GET("/ws/sql", h.handleSqlWebSocket)
}

// sqlInfo 返回KWDB连接信息（版本、端口、架构、编译时间、连接状态）
func (h *Handler) sqlInfo(c *gin.Context) {
	// 简化实现：依据课程ID获取端口并尝试连接
	courseID := c.Query("courseId")
	if courseID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "缺少 courseId"})
		return
	}
	courseObj, exists := h.courseService.GetCourse(courseID)
	if !exists {
		c.JSON(http.StatusNotFound, gin.H{"error": "课程不存在"})
		return
	}
	port := courseObj.Backend.Port
	if port <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "课程未配置 backend.port"})
		return
	}
	// 确保连接池就绪
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	if err := h.sqlDriver.EnsureReady(ctx, courseObj); err != nil {
		// 调整为返回200并标记未连接，避免前端出现“加载失败”红色错误
		c.JSON(http.StatusOK, gin.H{
			"connected": false,
			"port":      port,
			"version":   "",
			"arch":      "",
			"buildTime": "",
			"message":   fmt.Sprintf("KWDB未就绪: %v", err),
		})
		return
	}
	// 查询版本信息
	pool := h.sqlDriver.Pool()
	var version string
	var arch string
	var buildTime string
	// 优先 SELECT version()
	if err := pool.QueryRow(ctx, "SELECT version()").Scan(&version); err == nil {
		// 简化解析：不做复杂正则分解，直接返回完整字符串；前端可展示原始信息
	} else {
		// 兼容查询（如果支持）
		_ = err
	}
	c.JSON(http.StatusOK, gin.H{
		"version":   version,
		"port":      port,
		"arch":      arch,
		"buildTime": buildTime,
		"connected": true,
	})
}

// sqlHealth 返回连通性探测结果
func (h *Handler) sqlHealth(c *gin.Context) {
	courseID := c.Query("courseId")
	if courseID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "缺少 courseId"})
		return
	}
	courseObj, exists := h.courseService.GetCourse(courseID)
	if !exists {
		c.JSON(http.StatusNotFound, gin.H{"error": "课程不存在"})
		return
	}
	port := courseObj.Backend.Port
	if port <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "课程未配置 backend.port"})
		return
	}
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if err := h.sqlDriver.EnsureReady(ctx, courseObj); err != nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{"status": "down", "message": err.Error(), "port": port})
		return
	}
	start := time.Now()
	var one int
	if err := h.sqlDriver.Pool().QueryRow(ctx, "SELECT 1").Scan(&one); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"status": "error", "message": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"status": "ok", "latency": time.Since(start).String()})
}

// getAllContainers 获取所有 Playground 容器
func (h *Handler) getAllContainers(c *gin.Context) {
	ctx := c.Request.Context()
	containers, err := h.dockerController.ListContainers(ctx)
	if err != nil {
		h.logger.Error("获取容器列表失败: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("failed to list containers: %v", err)})
		return
	}

	c.JSON(http.StatusOK, containers)
}

// cleanupAllContainers 清理所有 Playground 容器
func (h *Handler) cleanupAllContainers(c *gin.Context) {
	ctx := c.Request.Context()

	// 使用互斥锁防止并发清理冲突
	h.containerMutex.Lock()
	defer h.containerMutex.Unlock()

	result, err := h.dockerController.CleanupAllContainers(ctx)
	if err != nil {
		h.logger.Error("清理所有容器失败: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("failed to cleanup containers: %v", err)})
		return
	}

	if !result.Success {
		c.JSON(http.StatusPartialContent, result)
		return
	}

	c.JSON(http.StatusOK, result)
}

// healthCheck 健康检查
// 提供服务健康状态检查接口，用于监控和负载均衡
// 响应: {"status": "ok", "message": "KWDB Playground is running"}
func (h *Handler) healthCheck(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"status":  "ok",
		"message": "KWDB Playground is running",
	})
}

// envCheck 环境检测，与 cmd/check 保持一致的检查逻辑但以 JSON 返回
func (h *Handler) envCheck(c *gin.Context) {
	if h.logger != nil {
		h.logger.Info("Handling /api/check request")
	}
	if h.cfg == nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "配置未初始化"})
		return
	}
	// 使用共享的检查包进行检查，复用课程服务
	items := make([]check.Item, 0, 4)

	// Docker
	dockerOK, dockerMsg := check.DockerEnv()
	items = append(items, check.Item{Name: "Docker 环境", OK: dockerOK, Message: dockerMsg})

	// 课程完整性（使用已加载的服务）
	coursesOK, coursesMsg := check.CoursesIntegrity(h.courseService)
	items = append(items, check.Item{Name: "课程加载与完整性", OK: coursesOK, Message: coursesMsg})

	// 服务健康
	serviceOK, serviceMsg := check.ServiceHealth(h.cfg.Server.Host, h.cfg.Server.Port)
	items = append(items, check.Item{Name: fmt.Sprintf("服务健康检查 (%s:%d)", h.cfg.Server.Host, h.cfg.Server.Port), OK: serviceOK, Message: serviceMsg})

	ok := true
	for _, it := range items {
		if !it.OK {
			ok = false
		}
	}
	c.JSON(http.StatusOK, check.Summary{OK: ok, Items: items})
}

// getCourses 获取所有课程
// 返回系统中所有可用课程的列表
// 响应: {"courses": [courseObject, ...]}
func (h *Handler) getCourses(c *gin.Context) {
	coursesMap := h.courseService.GetCourses()

	// 将map转换为数组格式，以便前端使用
	coursesList := make([]*course.Course, 0, len(coursesMap))
	for _, course := range coursesMap {
		coursesList = append(coursesList, course)
	}

	c.JSON(http.StatusOK, gin.H{
		"courses": coursesList,
	})
}

// getCourse 获取指定课程
// 根据课程ID获取课程详细信息，包括课程内容和步骤
// 路径参数:
//
//	id: 课程ID
//
// 响应:
//
//	200: {"course": courseObject} - 课程详细信息
//	400: {"error": "课程ID不能为空"} - 课程ID为空
//	404: {"error": "课程不存在"} - 课程不存在
func (h *Handler) getCourse(c *gin.Context) {
	id := c.Param("id")

	// 验证课程ID不能为空
	if strings.TrimSpace(id) == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "课程ID不能为空",
		})
		return
	}

	course, exists := h.courseService.GetCourse(id)
	if !exists {
		c.JSON(http.StatusNotFound, gin.H{
			"error": "课程不存在",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"course": course,
	})
}

// startCourse 启动课程容器
// 为指定课程启动Docker容器环境，提供隔离的实验环境
// 路径参数:
//
//	id: 课程ID
//
// 响应:
//
//	200: {"message": "课程容器启动成功", "courseId": id, "containerId": containerId} - 启动成功
//	400: {"error": "课程ID不能为空"} - 课程ID为空
//	404: {"error": "课程不存在"} - 课程不存在
//	500: {"error": "容器启动失败: 错误信息"} - 容器启动失败
func (h *Handler) startCourse(c *gin.Context) {
	id := c.Param("id")
	h.logger.Debug("[startCourse] 开始启动课程容器，课程ID: %s", id)

	// 验证课程ID不能为空
	if strings.TrimSpace(id) == "" {
		h.logger.Error("[startCourse] 错误: 课程ID为空")
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "课程ID不能为空",
		})
		return
	}

	// 解析请求体，获取可选的镜像参数
	var requestBody struct {
		Image string `json:"image"`
	}
	// 尝试解析JSON，如果失败（例如空body）则忽略错误
	_ = c.ShouldBindJSON(&requestBody)

	// 使用互斥锁防止并发创建容器
	h.containerMutex.Lock()
	defer h.containerMutex.Unlock()
	h.logger.Debug("[startCourse] 获取容器操作锁，课程ID: %s", id)

	// 始终为每次调用创建一个新的容器实例，不再复用或跳过
	ctx := context.Background()

	// 获取课程信息
	course, exists := h.courseService.GetCourse(id)
	if !exists {
		h.logger.Error("[startCourse] 错误: 课程不存在，课程ID: %s", id)
		c.JSON(http.StatusNotFound, gin.H{
			"error": "课程不存在",
		})
		return
	}

	h.logger.Debug("[startCourse] 找到课程: %s，标题: %s", id, course.Title)

	// 构建容器配置
	imageName := "kwdb/kwdb:latest" // 默认镜像

	// 优先级：1. 请求体中的自定义镜像 2. 课程配置的镜像 3. 默认镜像
	if requestBody.Image != "" {
		imageName = requestBody.Image
		h.logger.Debug("[startCourse] 使用请求中指定的镜像: %s", imageName)
	} else if course.Backend.ImageID != "" {
		imageName = course.Backend.ImageID
		h.logger.Debug("[startCourse] 使用课程指定镜像: %s", imageName)
	} else {
		h.logger.Debug("[startCourse] 使用默认镜像: %s", imageName)
	}

	// 检查Docker控制器是否可用
	if h.dockerController == nil {
		h.logger.Error("[startCourse] 错误: Docker控制器未初始化")
		c.JSON(http.StatusServiceUnavailable, gin.H{
			"error": "Docker服务暂不可用",
		})
		return
	}

	// 设置工作目录，优先使用课程配置的workspace，否则使用默认值
	workingDir := "/root" // 默认工作目录
	if course.Backend.Workspace != "" {
		workingDir = course.Backend.Workspace
		h.logger.Debug("[startCourse] 使用课程配置的工作目录: %s", workingDir)
	} else {
		h.logger.Debug("[startCourse] 使用默认工作目录: %s", workingDir)
	}

	cmd := []string{"/bin/bash", "-c", "while true; do sleep 3600; done"} // 默认 Cmd
	if course.Backend.Cmd != nil {
		// 修复：当 YAML 中以单个字符串提供整行命令时（包含空格），Docker 会将其视为可执行文件路径，导致找不到文件。
		// 处理策略：若仅有一个元素且包含空格，则通过 /bin/bash -lc 包裹执行；否则按数组形式直接执行。
		if len(course.Backend.Cmd) == 1 {
			single := strings.TrimSpace(course.Backend.Cmd[0])
			if strings.Contains(single, " ") {
				cmd = []string{"/bin/bash", "-lc", single}
			} else {
				cmd = course.Backend.Cmd
			}
		} else {
			cmd = course.Backend.Cmd
		}
		h.logger.Debug("[startCourse] 使用课程配置的Cmd(规范化后): %v", cmd)
	} else {
		h.logger.Debug("[startCourse] 使用默认Cmd: %v", cmd)
	}

	// 解析并构建卷绑定（支持 YAML 中的列表形式 "host:container[:opts]"）
	volumes := make(map[string]string)
	if len(course.Backend.Volumes) > 0 {
		// 预先解析课程根目录为绝对路径
		baseDir := h.cfg.Course.Dir
		if !filepath.IsAbs(baseDir) {
			if absBase, err := filepath.Abs(baseDir); err == nil {
				baseDir = absBase
			} else {
				h.logger.Warn("[startCourse] 课程根目录解析绝对路径失败: %s, err: %v", baseDir, err)
			}
		}
		courseBase := filepath.Join(baseDir, course.ID)

		for _, bind := range course.Backend.Volumes {
			b := strings.TrimSpace(bind)
			if b == "" {
				continue
			}
			parts := strings.SplitN(b, ":", 3)
			if len(parts) < 2 {
				h.logger.Warn("[startCourse] 无效的卷绑定: %s，期望格式 host:container[:opts]", b)
				continue
			}

			hostPath := strings.TrimSpace(parts[0])
			containerPath := strings.TrimSpace(parts[1])
			if len(parts) == 3 && strings.TrimSpace(parts[2]) != "" {
				// 将选项拼接到容器路径（例如 :ro）
				containerPath = containerPath + ":" + strings.TrimSpace(parts[2])
			}

			// 展开 ~ 为用户主目录
			if hostPath == "~" || strings.HasPrefix(hostPath, "~/") {
				if home, herr := os.UserHomeDir(); herr == nil {
					hostPath = filepath.Join(home, strings.TrimPrefix(hostPath, "~"))
				} else {
					h.logger.Warn("[startCourse] 无法解析用户主目录用于卷绑定: %v", herr)
				}
			}

			// 将相对路径解析为课程目录下的绝对路径
			if !filepath.IsAbs(hostPath) {
				hostPath = filepath.Join(courseBase, hostPath)
			}
			// 规范化并最终转为绝对路径
			hostPath = filepath.Clean(hostPath)
			if absHost, err := filepath.Abs(hostPath); err == nil {
				hostPath = absHost
			}

			// 简单校验文件/目录是否存在（不存在也允许，Docker会创建目录；文件挂载需文件存在）
			if _, err := os.Stat(hostPath); os.IsNotExist(err) {
				h.logger.Warn("[startCourse] 主机路径不存在: %s (课程: %s)", hostPath, course.ID)
			}

			// 容器路径应为绝对路径，若不是则记录警告（仍允许）
			if !strings.HasPrefix(containerPath, "/") {
				h.logger.Warn("[startCourse] 容器路径不是绝对路径: %s，建议以/开始", containerPath)
			}

			volumes[hostPath] = containerPath
		}
		h.logger.Debug("[startCourse] 已解析卷绑定(绝对路径): %v", volumes)
	}

	// 解析并构建环境变量（支持 YAML 中的列表形式 "KEY=VALUE"）
	env := make(map[string]string)
	if len(course.Backend.Env) > 0 {
		for _, e := range course.Backend.Env {
			parts := strings.SplitN(e, "=", 2)
			if len(parts) == 2 {
				env[parts[0]] = parts[1]
			}
		}
		h.logger.Debug("[startCourse] 已解析环境变量: %v", env)
	}

	// 创建容器配置
	config := &docker.ContainerConfig{
		Image:      imageName,
		WorkingDir: workingDir,                // 使用配置的工作目录
		Cmd:        cmd,                       // 根据课程配置的Cmd启动容器
		Privileged: course.Backend.Privileged, // 根据课程配置的Privileged启动容器
		Ports:      map[string]string{"26257": fmt.Sprintf("%d", course.Backend.Port)},
		Volumes:    volumes, // 课程定义的卷绑定
		Env:        env,     // 课程定义的环境变量
	}

	h.logger.Debug("[startCourse] 创建容器配置完成，镜像: %s，工作目录: %s，Cmd: %v, Privileged: %v",
		config.Image, config.WorkingDir, config.Cmd, config.Privileged)

	// 创建WebSocket进度回调函数，用于广播镜像拉取进度
	progressCallback := func(progress docker.ImagePullProgress) {
		h.logger.Debug("[startCourse] 镜像拉取进度: %s - %s", progress.ImageName, progress.Status)
		// 通过terminalManager广播进度消息到所有WebSocket连接
		h.terminalManager.BroadcastImagePullProgress(progress)
	}

	// 创建容器 - 使用带进度回调的版本以支持镜像拉取进度显示
	h.logger.Debug("[startCourse] 开始创建容器...")

	containerInfo, err := h.dockerController.CreateContainerWithProgress(ctx, id, config, progressCallback)
	if err != nil {
		h.logger.Error("[startCourse] 容器创建失败: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": fmt.Sprintf("容器创建失败: %v", err),
		})
		return
	}

	h.logger.Info("[startCourse] 容器创建成功，容器ID: %s，DockerID: %s", containerInfo.ID, containerInfo.DockerID)

	// 启动容器
	h.logger.Debug("[startCourse] 开始启动容器: %s", containerInfo.ID)
	err = h.dockerController.StartContainer(ctx, containerInfo.ID)
	if err != nil {
		h.logger.Error("[startCourse] 容器启动失败: %v，开始清理容器", err)
		// 如果启动失败，尝试清理创建的容器
		if cleanupErr := h.dockerController.RemoveContainer(ctx, containerInfo.ID); cleanupErr != nil {
			h.logger.Warn("[startCourse] 清理容器失败: %v", cleanupErr)
		}
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": fmt.Sprintf("容器启动失败: %v", err),
		})
		return
	}

	h.logger.Info("[startCourse] 容器启动成功，课程ID: %s，容器ID: %s，镜像: %s", id, containerInfo.ID, imageName)
	c.JSON(http.StatusOK, gin.H{
		"message":     "课程容器启动成功",
		"courseId":    id,
		"containerId": containerInfo.ID,
		"image":       imageName,
	})
}

// stopCourse 停止课程容器
// 停止指定课程的Docker容器，清理资源
// 路径参数:
//
//	id: 课程ID
//
// 响应:
//
//	200: {"message": "课程容器停止成功", "courseId": id} - 停止成功
//	400: {"error": "课程ID不能为空"} - 课程ID为空
//	404: {"error": "未找到课程对应的容器"} - 容器不存在
//	500: {"error": "容器停止失败: 错误信息"} - 容器停止失败
func (h *Handler) stopCourse(c *gin.Context) {
	id := c.Param("id")
	h.logger.Info("[stopCourse] 开始停止课程容器，课程ID: %s", id)

	if strings.TrimSpace(id) == "" {
		h.logger.Error("[stopCourse] 错误: 课程ID为空")
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "课程ID不能为空",
		})
		return
	}

	// 使用互斥锁防止并发操作容器
	h.containerMutex.Lock()
	defer h.containerMutex.Unlock()
	h.logger.Debug("[stopCourse] 获取容器操作锁，课程ID: %s", id)

	// 检查Docker控制器是否可用
	if h.dockerController == nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{
			"error": "Docker服务暂不可用",
		})
		return
	}

	// 查找课程对应的容器 - 使用精确的容器名称前缀（带连字符）
	coursePrefix := fmt.Sprintf("kwdb-playground-%s-", id)
	h.logger.Debug("[stopCourse] 查找容器前缀: %s", coursePrefix)
	ctx := context.Background()
	containers, err := h.dockerController.ListContainers(ctx)
	if err != nil {
		h.logger.Error("[stopCourse] 获取容器列表失败: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": fmt.Sprintf("获取容器列表失败: %v", err),
		})
		return
	}

	// 优先选择运行中的容器；如果没有，则选择最新的一个
	var target *docker.ContainerInfo
	for _, container := range containers {
		h.logger.Debug("[stopCourse] 检查容器: %s", container.ID)
		if strings.HasPrefix(container.ID, coursePrefix) {
			if container.State == docker.StateRunning || container.State == docker.StateStarting {
				target = container
				h.logger.Debug("[stopCourse] 找到匹配的运行中容器: %s (状态: %s)", container.ID, container.State)
				break
			}
			if target == nil || container.StartedAt.After(target.StartedAt) {
				target = container
				h.logger.Debug("[stopCourse] 找到候选容器: %s (状态: %s)", container.ID, container.State)
			}
		}
	}

	if target == nil {
		h.logger.Error("[stopCourse] 未找到课程 %s 的容器", id)
		c.JSON(http.StatusNotFound, gin.H{
			"error": "未找到课程对应的容器",
		})
		return
	}

	// 停止容器
	h.logger.Debug("[stopCourse] 正在停止容器: %s", target.ID)
	err = h.dockerController.StopContainer(ctx, target.ID)
	if err != nil {
		// 停止失败也继续尝试删除容器，处理“已停止”或“状态不明确”的场景
		h.logger.Warn("[stopCourse] 停止容器失败，将继续尝试删除容器: %v", err)
	} else {
		h.logger.Info("[stopCourse] 容器停止成功: %s", target.ID)
	}

	// 删除容器以彻底清理资源（无论停止是否成功都尝试删除）
	h.logger.Debug("[stopCourse] 正在删除容器: %s", target.ID)
	err = h.dockerController.RemoveContainer(ctx, target.ID)
	if err != nil {
		// 删除失败时记录日志并返回 500
		h.logger.Error("[stopCourse] 删除容器失败: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": fmt.Sprintf("容器删除失败: %v", err),
		})
		return
	}
	h.logger.Debug("[stopCourse] 容器删除成功: %s", target.ID)

	c.JSON(http.StatusOK, gin.H{
		"message":     "课程容器停止成功",
		"courseId":    id,
		"containerId": target.ID,
	})
}

// getContainerStatus 获取容器状态
// 获取指定容器的运行状态和基本信息
// 路径参数:
//
//	id: 容器名称或ID
//
// 响应:
//
//	200: {"status": "running", "containerId": id, "info": {...}} - 获取成功
//	400: {"error": "容器ID不能为空"} - 容器ID为空
//	404: {"error": "容器不存在"} - 容器不存在
//	500: {"error": "获取容器状态失败: 错误信息"} - 获取状态失败
func (h *Handler) getContainerStatus(c *gin.Context) {
	id := c.Param("id")
	h.logger.Debug("=== 获取容器状态请求 === 容器ID: %s", id)

	// 验证容器ID不能为空
	if strings.TrimSpace(id) == "" {
		h.logger.Error("容器ID为空，返回400错误")
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "容器ID不能为空",
		})
		return
	}

	// 检查Docker控制器是否可用
	if h.dockerController == nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{
			"error": "Docker服务暂不可用",
		})
		return
	}

	// 获取容器信息 - 先尝试直接查找，如果失败则通过列表查找（兜底：查询Docker守护进程）
	ctx := context.Background()
	h.logger.Debug("开始获取容器信息: %s", id)
	containerInfo, err := h.dockerController.GetContainer(ctx, id)
	if err != nil {
		h.logger.Debug("直接获取容器失败: %v，尝试通过列表查找并兜底", err)
		// 如果直接查找失败，尝试通过容器列表查找匹配的容器
		containers, listErr := h.dockerController.ListContainers(ctx)
		if listErr == nil {
			// 查找匹配的容器（通过容器名称前缀匹配）
			h.logger.Debug("在容器列表中查找匹配的容器，总数: %d", len(containers))
			var foundContainer *docker.ContainerInfo
			for _, container := range containers {
				h.logger.Debug("检查容器: ID=%s, 状态=%s", container.ID, container.State)
				if container.ID == id || strings.HasPrefix(container.ID, id) || strings.Contains(container.ID, id) {
					foundContainer = container
					h.logger.Debug("找到匹配的容器: %s", container.ID)
					break
				}
			}
			if foundContainer != nil {
				containerInfo = foundContainer
			}
		}
		if containerInfo == nil {
			// 进一步兜底：提示容器可能刚创建尚未注册到内存，返回明确的错误信息
			h.logger.Error("未找到匹配的容器，可能尚未注册到内存或已被清理: %s", id)
			c.JSON(http.StatusNotFound, gin.H{
				"error": "容器不存在或尚未就绪，请稍后重试",
			})
			return
		}
	} else {
		h.logger.Debug("直接获取容器成功: ID=%s, 状态=%s", containerInfo.ID, containerInfo.State)
	}

	h.logger.Debug("返回容器状态: ID=%s, 状态=%s", containerInfo.ID, containerInfo.State)
	c.JSON(http.StatusOK, gin.H{
		"status":      containerInfo.State,
		"containerId": id,
		"info": gin.H{
			"id":        containerInfo.ID,
			"courseId":  containerInfo.CourseID,
			"dockerId":  containerInfo.DockerID,
			"image":     containerInfo.Image,
			"startedAt": containerInfo.StartedAt,
			"ports":     containerInfo.Ports,
			"env":       containerInfo.Env,
		},
	})
}

// getContainerLogs 获取容器日志
// 获取指定容器的运行日志
// 路径参数:
//
//	id: 容器ID
//
// 查询参数:
//
//	lines: 日志行数限制 (默认100)
//	follow: 是否持续跟踪日志 (默认false)
//
// 响应:
//
//	200: {"logs": "日志内容"} - 获取成功
//	400: {"error": "容器ID不能为空"} - 容器ID为空
//	404: {"error": "容器不存在"} - 容器不存在
//	500: {"error": "获取容器日志失败: 错误信息"} - 获取日志失败
func (h *Handler) getContainerLogs(c *gin.Context) {
	id := c.Param("id")
	h.logger.Debug("[getContainerLogs] 获取容器日志，容器ID: %s", id)

	// 验证容器ID不能为空
	if strings.TrimSpace(id) == "" {
		h.logger.Error("[getContainerLogs] 错误: 容器ID为空")
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "容器ID不能为空",
		})
		return
	}

	// 解析查询参数
	linesStr := c.DefaultQuery("lines", "100")
	lines, err := strconv.Atoi(linesStr)
	if err != nil || lines <= 0 {
		lines = 100
	}

	follow := c.DefaultQuery("follow", "false") == "true"

	// 检查Docker控制器是否可用
	if h.dockerController == nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{
			"error": "Docker服务暂不可用",
		})
		return
	}

	// 获取容器日志
	ctx := context.Background()
	logs, err := h.dockerController.GetContainerLogs(ctx, id, lines, follow)
	if err != nil {
		h.logger.Error("[getContainerLogs] 获取容器日志失败: %v", err)
		if strings.Contains(err.Error(), "No such container") {
			c.JSON(http.StatusNotFound, gin.H{
				"error": "容器不存在",
			})
		} else {
			c.JSON(http.StatusInternalServerError, gin.H{
				"error": fmt.Sprintf("获取容器日志失败: %v", err),
			})
		}
		return
	}

	h.logger.Debug("[getContainerLogs] 容器日志获取成功")

	c.JSON(http.StatusOK, gin.H{
		"logs":        logs,
		"containerId": id,
		"lines":       lines,
		"follow":      follow,
	})
}

// restartContainer 重启容器
// 重启指定的Docker容器
// 路径参数:
//
//	id: 容器ID
//
// 响应:
//
//	200: {"message": "容器重启成功", "containerId": id} - 重启成功
//	400: {"error": "容器ID不能为空"} - 容器ID为空
//	404: {"error": "容器不存在"} - 容器不存在
//	500: {"error": "容器重启失败: 错误信息"} - 重启失败
func (h *Handler) restartContainer(c *gin.Context) {
	id := c.Param("id")
	h.logger.Info("[restartContainer] 重启容器，容器ID: %s", id)

	// 验证容器ID不能为空
	if strings.TrimSpace(id) == "" {
		h.logger.Error("[restartContainer] 错误: 容器ID为空")
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "容器ID不能为空",
		})
		return
	}

	// 检查Docker控制器是否可用
	if h.dockerController == nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{
			"error": "Docker服务暂不可用",
		})
		return
	}

	// 重启容器
	ctx := context.Background()
	err := h.dockerController.RestartContainer(ctx, id)
	if err != nil {
		h.logger.Error("[restartContainer] 重启容器失败: %v", err)
		if strings.Contains(err.Error(), "No such container") {
			c.JSON(http.StatusNotFound, gin.H{
				"error": "容器不存在",
			})
		} else {
			c.JSON(http.StatusInternalServerError, gin.H{
				"error": fmt.Sprintf("容器重启失败: %v", err),
			})
		}
		return
	}

	h.logger.Info("[restartContainer] 容器重启成功，容器ID: %s", id)
	c.JSON(http.StatusOK, gin.H{
		"message":     "容器重启成功",
		"containerId": id,
	})
}

// handleTerminalWebSocket 处理终端WebSocket连接 - 支持终端和镜像拉取进度
// 查询参数:
//
//	container_id: 容器ID（终端模式必需，进度模式可选）
//	session_id: 会话ID（可选）
//	progress_only: 是否仅用于接收镜像拉取进度（可选，true/false）
//
// 响应:
//
//	101: WebSocket连接建立成功
//	400: {"error": "容器ID不能为空"} - 终端模式下参数错误
//	500: {"error": "启动终端会话失败"} - 会话创建失败
func (h *Handler) handleTerminalWebSocket(c *gin.Context) {
	sessionID := c.Query("session_id")
	containerID := c.Query("container_id")
	progressOnly := c.Query("progress_only") == "true"

	// 生成会话ID（如果未提供）
	if sessionID == "" {
		sessionID = fmt.Sprintf("session_%d", time.Now().UnixNano())
	}

	// 验证容器ID（仅在非进度模式下必需）
	if !progressOnly && containerID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "容器ID不能为空"})
		return
	}

	// 检查终端管理器
	if h.terminalManager == nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "终端管理器不可用"})
		return
	}

	// 升级WebSocket连接
	upgrader := websocket.Upgrader{
		CheckOrigin: func(r *http.Request) bool {
			return true // 允许所有来源
		},
	}

	conn, err := upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		h.logger.Error("WebSocket升级失败: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "WebSocket连接升级失败"})
		return
	}
	defer conn.Close()

	// 创建会话
	session := h.terminalManager.CreateSession(sessionID, containerID, conn)
	defer h.terminalManager.RemoveSession(sessionID)

	if progressOnly {
		// 进度模式：仅用于接收镜像拉取进度，不启动终端会话
		h.logger.Info("WebSocket连接已建立（进度模式），会话: %s", sessionID)

		session.StartProgressSession()

		// 保持连接直到会话结束
		select {
		case <-c.Request.Context().Done():
			h.logger.Info("客户端断开连接（进度模式），会话: %s", sessionID)
		case <-session.Done():
			h.logger.Info("进度会话结束: %s", sessionID)
		}
	} else {
		// 终端模式：启动交互式bash会话
		err = session.StartInteractiveSession()
		if err != nil {
			h.logger.Error("启动终端会话失败: %v", err)
			return
		}

		h.logger.Info("终端会话 %s 已启动，容器: %s", sessionID, containerID)

		// 保持连接直到会话结束
		select {
		case <-c.Request.Context().Done():
			h.logger.Info("客户端断开连接，会话: %s", sessionID)
		case <-session.Done():
			h.logger.Info("终端会话结束: %s", sessionID)
		}
	}
}

// stopContainerByID 按容器ID停止并删除容器
// 路径参数:
//
//	id: 容器ID
//
// 响应:
//
//	200: {"message": "容器停止成功", "containerId": id} - 停止并删除成功
//	400: {"error": "容器ID不能为空"} - 容器ID为空
//	404: {"error": "容器不存在"} - 容器不存在
//	500: {"error": "容器操作失败: 错误信息"} - 停止或删除失败
func (h *Handler) stopContainerByID(c *gin.Context) {
	id := c.Param("id")
	h.logger.Info("[stopContainerByID] 开始停止容器，容器ID: %s", id)

	if strings.TrimSpace(id) == "" {
		h.logger.Error("[stopContainerByID] 错误: 容器ID为空")
		c.JSON(http.StatusBadRequest, gin.H{"error": "容器ID不能为空"})
		return
	}

	// 使用互斥锁防止并发操作容器
	h.containerMutex.Lock()
	defer h.containerMutex.Unlock()

	if h.dockerController == nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "Docker服务暂不可用"})
		return
	}

	ctx := context.Background()
	// 尝试停止容器
	if err := h.dockerController.StopContainer(ctx, id); err != nil {
		h.logger.Warn("[stopContainerByID] 停止容器失败，继续删除: %v", err)
	}

	// 删除容器
	if err := h.dockerController.RemoveContainer(ctx, id); err != nil {
		h.logger.Error("[stopContainerByID] 删除容器失败: %v", err)
		// 针对不存在的容器返回404
		if strings.Contains(err.Error(), "not found") || strings.Contains(err.Error(), "No such container") {
			c.JSON(http.StatusNotFound, gin.H{"error": "容器不存在"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("容器操作失败: %v", err)})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "容器停止成功", "containerId": id})
}

// isSelectQuery 判断 SQL 语句是否为查询操作
// 支持跳过各种类型的注释（单行注释 --、多行注释 /* */）
// 能够识别：SELECT、SHOW、DESCRIBE、DESC、EXPLAIN、WITH（CTE）
func isSelectQuery(sqlText string) bool {
	// 移除所有注释并获取第一个有效的 SQL 关键词
	cleanSQL := removeComments(sqlText)

	// 去除空白字符并转为大写
	cleanSQL = strings.TrimSpace(strings.ToUpper(cleanSQL))

	if cleanSQL == "" {
		return false
	}

	// 检查是否为查询操作
	queryKeywords := []string{"SELECT", "SHOW", "DESCRIBE", "DESC", "EXPLAIN", "WITH"}

	for _, keyword := range queryKeywords {
		if strings.HasPrefix(cleanSQL, keyword) {
			// 确保关键词后面是空白字符或结束，避免误匹配（如 SELECTALL）
			if len(cleanSQL) == len(keyword) ||
				(len(cleanSQL) > len(keyword) && isWhitespace(rune(cleanSQL[len(keyword)]))) {
				return true
			}
		}
	}

	return false
}

// removeComments 移除 SQL 语句中的注释
// 支持单行注释（--）和多行注释（/* */）
func removeComments(sql string) string {
	var result strings.Builder
	runes := []rune(sql)
	i := 0

	for i < len(runes) {
		// 检查单行注释 --
		if i < len(runes)-1 && runes[i] == '-' && runes[i+1] == '-' {
			// 跳过到行尾
			for i < len(runes) && runes[i] != '\n' && runes[i] != '\r' {
				i++
			}
			// 保留换行符
			if i < len(runes) && (runes[i] == '\n' || runes[i] == '\r') {
				result.WriteRune(' ') // 用空格替换换行，保持语句结构
				i++
			}
			continue
		}

		// 检查多行注释 /* */
		if i < len(runes)-1 && runes[i] == '/' && runes[i+1] == '*' {
			i += 2 // 跳过 /*
			// 寻找注释结束 */
			for i < len(runes)-1 {
				if runes[i] == '*' && runes[i+1] == '/' {
					i += 2 // 跳过 */
					break
				}
				i++
			}
			result.WriteRune(' ') // 用空格替换注释
			continue
		}

		// 检查字符串字面量，避免在字符串内误判注释
		if runes[i] == '\'' || runes[i] == '"' {
			quote := runes[i]
			result.WriteRune(runes[i])
			i++

			// 处理字符串内容，直到找到匹配的引号
			for i < len(runes) {
				if runes[i] == quote {
					result.WriteRune(runes[i])
					i++
					break
				}
				// 处理转义字符
				if runes[i] == '\\' && i < len(runes)-1 {
					result.WriteRune(runes[i])
					i++
					if i < len(runes) {
						result.WriteRune(runes[i])
						i++
					}
				} else {
					result.WriteRune(runes[i])
					i++
				}
			}
			continue
		}

		// 普通字符
		result.WriteRune(runes[i])
		i++
	}

	return result.String()
}

// isWhitespace 检查字符是否为空白字符
func isWhitespace(r rune) bool {
	return r == ' ' || r == '\t' || r == '\n' || r == '\r' || r == '\f' || r == '\v'
}

// handleSqlWebSocket 处理 SQL 终端的 WebSocket 通道
// 协议：
//   - 客户端发送 {type:"init", courseId:"..."} 进行初始化
//   - 客户端发送 {type:"query", queryId:"uuid", sql:"SELECT 1"} 执行查询（简版，返回完整结果）
//   - 客户端发送 {type:"ping"} 保活
//   - 服务端返回 ready/info/result/complete/error/pong
func (h *Handler) handleSqlWebSocket(c *gin.Context) {
	upgrader := websocket.Upgrader{CheckOrigin: func(r *http.Request) bool { return true }}
	conn, err := upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		h.logger.Error("SQL WebSocket升级失败: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "WebSocket连接升级失败"})
		return
	}
	defer conn.Close()

	var courseObj *course.Course
	ctx := context.Background()

	for {
		var msg map[string]interface{}
		if err := conn.ReadJSON(&msg); err != nil {
			h.logger.Debug("SQL WebSocket读取结束或错误: %v", err)
			return
		}
		t, _ := msg["type"].(string)
		switch t {
		case "init":
			courseID, _ := msg["courseId"].(string)
			if strings.TrimSpace(courseID) == "" {
				_ = conn.WriteJSON(map[string]interface{}{"type": "error", "message": "缺少 courseId"})
				continue
			}
			if co, ok := h.courseService.GetCourse(courseID); ok {
				courseObj = co
			} else {
				_ = conn.WriteJSON(map[string]interface{}{"type": "error", "message": "课程不存在"})
				continue
			}
			// 确保连接池就绪
			if err := h.sqlDriver.EnsureReady(ctx, courseObj); err != nil {
				_ = conn.WriteJSON(map[string]interface{}{"type": "error", "message": fmt.Sprintf("KWDB未就绪: %v", err)})
				continue
			}
			// ready + info
			_ = conn.WriteJSON(map[string]interface{}{"type": "ready"})
			_ = conn.WriteJSON(map[string]interface{}{"type": "info", "port": courseObj.Backend.Port, "connected": true})
		case "query":
			if courseObj == nil || h.sqlDriver.Pool() == nil {
				_ = conn.WriteJSON(map[string]interface{}{"type": "error", "message": "连接未初始化"})
				continue
			}
			sqlText, _ := msg["sql"].(string)
			qid, _ := msg["queryId"].(string)
			if strings.TrimSpace(sqlText) == "" {
				_ = conn.WriteJSON(map[string]interface{}{"type": "error", "queryId": qid, "message": "SQL不能为空"})
				continue
			}

			// 判断 SQL 语句类型：使用优化的函数检查是否为查询操作
			// 支持跳过注释，能处理以注释开头的 SQL 语句
			if isSelectQuery(sqlText) {
				// 查询操作：使用 Query() 方法
				rows, err := h.sqlDriver.Pool().Query(ctx, sqlText)
				if err != nil {
					_ = conn.WriteJSON(map[string]interface{}{"type": "error", "queryId": qid, "message": err.Error()})
					continue
				}
				defer rows.Close()

				// 获取列信息
				fieldDescs := rows.FieldDescriptions()
				cols := make([]string, 0, len(fieldDescs))
				for _, f := range fieldDescs {
					cols = append(cols, string(f.Name))
				}

				// 获取行数据
				outRows := make([][]interface{}, 0, 128)
				for rows.Next() {
					vals, err := rows.Values()
					if err != nil {
						_ = conn.WriteJSON(map[string]interface{}{"type": "error", "queryId": qid, "message": err.Error()})
						break
					}

					// 格式化时间戳数据，确保时区信息一致
					formattedVals := make([]interface{}, len(vals))
					for i, val := range vals {
						if t, ok := val.(time.Time); ok {
							// 将时间戳格式化为RFC3339，保留原始时区信息
							formattedVals[i] = t.Format(time.RFC3339)
						} else {
							formattedVals[i] = val
						}
					}

					outRows = append(outRows, formattedVals)
				}

				h.logger.Debug("[handleSqlWebSocket] 查询结果，列: %v, 行: %v", cols, outRows)

				// 返回查询结果（包含列和行数据）
				_ = conn.WriteJSON(map[string]interface{}{
					"type":     "result",
					"queryId":  qid,
					"columns":  cols,
					"rows":     outRows,
					"rowCount": len(outRows),
					"hasMore":  false,
				})
			} else {
				// 数据修改操作：使用 Exec() 方法
				commandTag, err := h.sqlDriver.Pool().Exec(ctx, sqlText)
				if err != nil {
					_ = conn.WriteJSON(map[string]interface{}{"type": "error", "queryId": qid, "message": err.Error()})
					continue
				}

				// 获取受影响的行数
				rowsAffected := commandTag.RowsAffected()

				// 返回执行结果（无列数据，但包含受影响的行数）
				_ = conn.WriteJSON(map[string]interface{}{
					"type":     "result",
					"queryId":  qid,
					"columns":  []string{},
					"rows":     [][]interface{}{},
					"rowCount": int(rowsAffected),
					"hasMore":  false,
				})
			}

			_ = conn.WriteJSON(map[string]interface{}{"type": "complete", "queryId": qid})
		case "ping":
			_ = conn.WriteJSON(map[string]interface{}{"type": "pong"})
		default:
			_ = conn.WriteJSON(map[string]interface{}{"type": "error", "message": "未知消息类型"})
		}
	}
}

// checkPortConflict 检查端口冲突
// 检查指定课程的端口是否被其他容器占用
// 路径参数:
//
//	id: 课程ID
//
// 查询参数:
//
//	port: 要检查的端口号
//
// 响应:
//
//	200: 端口冲突检查结果
//	400: 参数错误
//	404: 课程不存在
//	500: 检查失败
func (h *Handler) checkPortConflict(c *gin.Context) {
	courseID := c.Param("id")
	port := c.Query("port")

	h.logger.Info("[checkPortConflict] 开始检查端口冲突，课程ID: %s, 端口: %s", courseID, port)

	// 验证参数
	if strings.TrimSpace(courseID) == "" {
		h.logger.Error("[checkPortConflict] 错误: 课程ID为空")
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "课程ID不能为空",
		})
		return
	}

	if strings.TrimSpace(port) == "" {
		h.logger.Error("[checkPortConflict] 错误: 端口号为空")
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "端口号不能为空",
		})
		return
	}

	// 将端口字符串转换为整数并验证格式
	portInt, err := strconv.Atoi(strings.TrimSpace(port))
	if err != nil {
		h.logger.Error("[checkPortConflict] 错误: 端口号格式无效，端口: %s, 错误: %v", port, err)
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "端口号格式无效，必须是有效的整数",
		})
		return
	}

	// 验证端口号范围
	if portInt <= 0 || portInt > 65535 {
		h.logger.Error("[checkPortConflict] 错误: 端口号超出有效范围，端口: %d", portInt)
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "端口号必须在 1-65535 范围内",
		})
		return
	}

	// 验证课程是否存在
	_, exists := h.courseService.GetCourse(courseID)
	if !exists {
		h.logger.Error("[checkPortConflict] 错误: 课程不存在，课程ID: %s", courseID)
		c.JSON(http.StatusNotFound, gin.H{
			"error": "课程不存在",
		})
		return
	}

	// 检查Docker控制器是否可用
	if h.dockerController == nil {
		h.logger.Error("[checkPortConflict] 错误: Docker控制器未初始化")
		c.JSON(http.StatusServiceUnavailable, gin.H{
			"error": "Docker服务暂不可用",
		})
		return
	}

	// 调用Docker控制器检查端口冲突（使用整数类型的端口）
	ctx := context.Background()
	conflictInfo, err := h.dockerController.CheckPortConflict(ctx, courseID, portInt)
	if err != nil {
		h.logger.Error("[checkPortConflict] 端口冲突检查失败: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": fmt.Sprintf("端口冲突检查失败: %v", err),
		})
		return
	}

	h.logger.Info("[checkPortConflict] 端口冲突检查完成，课程ID: %s, 端口: %d, 是否冲突: %v",
		courseID, portInt, conflictInfo.HasConflict)

	// 构建前端期望的响应格式
	var conflictContainers []map[string]interface{}
	if conflictInfo.ConflictContainer != nil {
		conflictContainers = []map[string]interface{}{
			{
				"id":       conflictInfo.ConflictContainer.ID,
				"name":     conflictInfo.ConflictContainer.Name,
				"courseId": conflictInfo.ConflictContainer.CourseID,
				"port":     fmt.Sprintf("%d", conflictInfo.ConflictContainer.Port),
				"state":    string(conflictInfo.ConflictContainer.State),
			},
		}
	} else {
		conflictContainers = []map[string]interface{}{}
	}

	// 返回检查结果
	c.JSON(http.StatusOK, gin.H{
		"courseId":           courseID,
		"port":               fmt.Sprintf("%d", portInt),
		"isConflicted":       conflictInfo.HasConflict,
		"conflictContainers": conflictContainers,
	})
}

// cleanupCourseContainers 清理课程容器
// 清理指定课程的所有容器
// 路径参数:
//
//	id: 课程ID
//
// 响应:
//
//	200: 清理结果
//	400: 参数错误
//	404: 课程不存在
//	500: 清理失败
func (h *Handler) cleanupCourseContainers(c *gin.Context) {
	courseID := c.Param("id")

	h.logger.Info("[cleanupCourseContainers] 开始清理课程容器，课程ID: %s", courseID)

	// 验证参数
	if strings.TrimSpace(courseID) == "" {
		h.logger.Error("[cleanupCourseContainers] 错误: 课程ID为空")
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "课程ID不能为空",
		})
		return
	}

	// 验证课程是否存在
	_, exists := h.courseService.GetCourse(courseID)
	if !exists {
		h.logger.Error("[cleanupCourseContainers] 错误: 课程不存在，课程ID: %s", courseID)
		c.JSON(http.StatusNotFound, gin.H{
			"error": "课程不存在",
		})
		return
	}

	// 检查Docker控制器是否可用
	if h.dockerController == nil {
		h.logger.Error("[cleanupCourseContainers] 错误: Docker控制器未初始化")
		c.JSON(http.StatusServiceUnavailable, gin.H{
			"error": "Docker服务暂不可用",
		})
		return
	}

	// 使用互斥锁防止并发操作容器
	h.containerMutex.Lock()
	defer h.containerMutex.Unlock()
	h.logger.Debug("[cleanupCourseContainers] 获取容器操作锁，课程ID: %s", courseID)

	// 调用Docker控制器清理容器
	ctx := context.Background()
	cleanupResult, err := h.dockerController.CleanupCourseContainers(ctx, courseID)
	if err != nil {
		h.logger.Error("[cleanupCourseContainers] 容器清理失败: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": fmt.Sprintf("容器清理失败: %v", err),
		})
		return
	}

	h.logger.Info("[cleanupCourseContainers] 容器清理完成，课程ID: %s, 成功: %v, 清理数量: %d",
		courseID, cleanupResult.Success, len(cleanupResult.CleanedContainers))

	// 返回清理结果
	c.JSON(http.StatusOK, gin.H{
		"courseId":          courseID,
		"success":           cleanupResult.Success,
		"totalCleaned":      len(cleanupResult.CleanedContainers),
		"cleanedContainers": cleanupResult.CleanedContainers,
		"errors":            []string{}, // 错误信息现在包含在 Message 中
		"message":           cleanupResult.Message,
	})
}

// checkImageAvailability 检查镜像可用性
// POST /api/images/check-availability
// 请求体: {"imageName": "kwdb/kwdb:latest"}
// 响应:
//
//	200: 镜像可用性检查结果
//	400: 参数错误
//	500: 检查失败
func (h *Handler) checkImageAvailability(c *gin.Context) {
	var req struct {
		ImageName string `json:"imageName" binding:"required"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		h.logger.Error("[checkImageAvailability] 参数解析失败: %v", err)
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "镜像名称不能为空",
		})
		return
	}

	h.logger.Info("[checkImageAvailability] 检查镜像可用性: %s", req.ImageName)

	// 检查Docker控制器是否可用
	if h.dockerController == nil {
		h.logger.Error("[checkImageAvailability] Docker控制器未初始化")
		c.JSON(http.StatusServiceUnavailable, gin.H{
			"error": "Docker服务暂不可用",
		})
		return
	}

	// 调用Docker控制器检查镜像可用性
	ctx := context.Background()
	availability, err := h.dockerController.CheckImageAvailability(ctx, req.ImageName)
	if err != nil {
		h.logger.Error("[checkImageAvailability] 检查失败: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": fmt.Sprintf("检查镜像可用性失败: %v", err),
		})
		return
	}

	h.logger.Info("[checkImageAvailability] 检查完成: %s, 可用: %v", req.ImageName, availability.Available)

	c.JSON(http.StatusOK, availability)
}

// getImageSources 获取可用的镜像源列表
// GET /api/images/sources
// 响应:
//
//	200: 镜像源列表
func (h *Handler) getImageSources(c *gin.Context) {
	h.logger.Info("[getImageSources] 获取镜像源列表")

	// 定义常用的镜像源
	sources := []gin.H{
		{
			"id":          "docker-hub",
			"name":        "Docker Hub (官方)",
			"prefix":      "",
			"description": "Docker官方镜像仓库",
			"example":     "kwdb/kwdb:latest",
		},
		{
			"id":          "ghcr",
			"name":        "GitHub Container Registry",
			"prefix":      "ghcr.io/",
			"description": "GitHub容器镜像仓库",
			"example":     "ghcr.io/kwdb/kwdb:latest",
		},
		{
			"id":          "custom",
			"name":        "自定义源",
			"prefix":      "",
			"description": "使用自定义的镜像仓库地址",
			"example":     "your-registry.com/kwdb/kwdb:latest",
		},
	}

	c.JSON(http.StatusOK, gin.H{
		"sources": sources,
	})
}
