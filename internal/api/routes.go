package api

import (
	"context"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"sync"
	"time"

	"kwdb-playground/internal/course"
	"kwdb-playground/internal/docker"
	"kwdb-playground/internal/logger"
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
) *Handler {
	return &Handler{
		courseService:    courseService,
		dockerController: dockerController,
		terminalManager:  terminalManager,
		logger:           logger,
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

		// 课程相关路由
		courses := api.Group("/courses")
		{
			courses.GET("", h.getCourses)
			courses.GET("/:id", h.getCourse)
			courses.POST("/:id/start", h.startCourse)
			courses.POST("/:id/stop", h.stopCourse)
		}

		// 容器相关路由
		containers := api.Group("/containers")
		{
			containers.GET("/:id/status", h.getContainerStatus)
			containers.GET("/:id/logs", h.getContainerLogs)
			containers.POST("/:id/restart", h.restartContainer)
		}

	}

	// WebSocket路由
	r.GET("/ws/terminal", h.handleTerminalWebSocket)
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

	// 使用互斥锁防止并发创建容器
	h.containerMutex.Lock()
	defer h.containerMutex.Unlock()
	h.logger.Debug("[startCourse] 获取容器操作锁，课程ID: %s", id)

	// 防重复调用：检查是否已有该课程的运行中容器
	ctx := context.Background()
	if h.dockerController != nil {
		containers, err := h.dockerController.ListContainers(ctx)
		if err == nil {
			// 使用更精确的容器名称匹配
			expectedContainerName := fmt.Sprintf("kwdb-course-%s", id)
			for _, container := range containers {
				// 检查容器ID是否完全匹配课程容器名称，并且状态为运行中
				if container.ID == expectedContainerName && (container.State == "running" || container.State == "starting") {
					h.logger.Debug("[startCourse] 课程 %s 已有运行中的容器: %s (状态: %s)，跳过重复启动", id, container.ID, container.State)
					c.JSON(http.StatusOK, gin.H{
						"message":     "课程容器已在运行中",
						"courseId":    id,
						"containerId": container.ID,
						"status":      "already_running",
					})
					return
				}
			}
			h.logger.Debug("[startCourse] 未发现课程 %s 的运行中容器，继续创建新容器", id)
		} else {
			h.logger.Warn("[startCourse] 警告: 无法获取容器列表进行重复检查: %v", err)
		}
	}

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

	// 如果课程配置中指定了镜像，使用课程指定的镜像
	if course.Backend.ImageID != "" {
		imageName = course.Backend.ImageID
		h.logger.Debug("[startCourse] 使用课程指定镜像: %s", imageName)
	} else if course.DockerImage != "" {
		// 兼容旧的DockerImage字段
		imageName = course.DockerImage
		h.logger.Debug("[startCourse] 使用兼容镜像字段: %s", imageName)
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
	workingDir := "/workspace" // 默认工作目录
	if course.Backend.Workspace != "" {
		workingDir = course.Backend.Workspace
		h.logger.Debug("[startCourse] 使用课程配置的工作目录: %s", workingDir)
	} else {
		h.logger.Debug("[startCourse] 使用默认工作目录: %s", workingDir)
	}

	// 创建容器配置，使用智能镜像适配
	optimalCmd := h.getOptimalContainerCommand(imageName)
	h.logger.Info("[startCourse] 智能适配命令: %v", optimalCmd)
	config := &docker.ContainerConfig{
		Image:      imageName,
		WorkingDir: workingDir, // 使用配置的工作目录
		Cmd:        optimalCmd, // 根据镜像类型选择最佳启动命令
	}

	h.logger.Debug("[startCourse] 创建容器配置完成，镜像: %s，工作目录: %s", config.Image, config.WorkingDir)

	// 创建容器 - 使用带进度回调的版本以支持镜像拉取进度显示
	// ctx := context.Background()
	h.logger.Debug("[startCourse] 开始创建容器...")
	
	// 创建WebSocket进度回调函数，用于广播镜像拉取进度
	progressCallback := func(progress docker.ImagePullProgress) {
		// 将ImagePullProgress转换为ImagePullProgressMessage
		message := docker.ImagePullProgressMessage{
			ImageName: progress.ImageName,
			Status:    progress.Status,
			Progress:  progress.Progress,
			Error:     progress.Error,
		}
		h.logger.Debug("[startCourse] 镜像拉取进度: %s - %s", progress.ImageName, progress.Status)
		// 通过terminalManager广播进度消息到所有WebSocket连接
		h.terminalManager.BroadcastImagePullProgress(message)
	}
	
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

	// 查找课程对应的容器 - 使用正确的容器名称前缀
	coursePrefix := fmt.Sprintf("kwdb-playground-%s", id)
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

	// 查找匹配的容器
	var targetContainerID string
	for _, container := range containers {
		h.logger.Debug("[stopCourse] 检查容器: %s", container.ID)
		// 检查容器ID是否以课程容器名称前缀开头
		if strings.HasPrefix(container.ID, coursePrefix) {
			targetContainerID = container.ID
			h.logger.Debug("[stopCourse] 找到匹配容器: %s (状态: %s)", container.ID, container.State)
			break
		}
	}

	if targetContainerID == "" {
		h.logger.Error("[stopCourse] 未找到课程 %s 的容器", id)
		c.JSON(http.StatusNotFound, gin.H{
			"error": "未找到课程对应的容器",
		})
		return
	}

	// 停止容器
	h.logger.Debug("[stopCourse] 正在停止容器: %s", targetContainerID)
	err = h.dockerController.StopContainer(ctx, targetContainerID)
	if err != nil {
		h.logger.Error("[stopCourse] 停止容器失败: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": fmt.Sprintf("容器停止失败: %v", err),
		})
		return
	}

	h.logger.Info("[stopCourse] 容器停止成功: %s", targetContainerID)

	// 删除容器以彻底清理资源
	h.logger.Debug("[stopCourse] 正在删除容器: %s", targetContainerID)
	err = h.dockerController.RemoveContainer(ctx, targetContainerID)
	if err != nil {
		// 删除失败时记录日志但不影响停止操作的成功响应
		h.logger.Warn("[stopCourse] 删除容器失败，但停止操作已成功: %v", err)
	} else {
		h.logger.Debug("[stopCourse] 容器删除成功: %s", targetContainerID)
	}

	c.JSON(http.StatusOK, gin.H{
		"message":     "课程容器停止成功",
		"courseId":    id,
		"containerId": targetContainerID,
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

	// 获取容器信息 - 先尝试直接查找，如果失败则通过列表查找
	ctx := context.Background()
	h.logger.Debug("开始获取容器信息: %s", id)
	containerInfo, err := h.dockerController.GetContainer(ctx, id)
	if err != nil {
		h.logger.Debug("直接获取容器失败: %v，尝试通过列表查找", err)
		// 如果直接查找失败，尝试通过容器列表查找匹配的容器
		containers, listErr := h.dockerController.ListContainers(ctx)
		if listErr != nil {
			h.logger.Error("获取容器列表失败: %v", listErr)
			c.JSON(http.StatusInternalServerError, gin.H{
				"error": "获取容器列表失败",
			})
			return
		}

		// 查找匹配的容器（通过容器名称或ID匹配）
		h.logger.Debug("在容器列表中查找匹配的容器，总数: %d", len(containers))
		var foundContainer *docker.ContainerInfo
		for _, container := range containers {
			h.logger.Debug("检查容器: ID=%s, 状态=%s", container.ID, container.State)
			if container.ID == id || strings.Contains(container.ID, id) {
				foundContainer = container
				h.logger.Debug("找到匹配的容器: %s", container.ID)
				break
			}
		}

		if foundContainer == nil {
			h.logger.Error("未找到匹配的容器: %s", id)
			c.JSON(http.StatusNotFound, gin.H{
				"error": "容器不存在",
			})
			return
		}

		containerInfo = foundContainer
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

		// 发送连接成功消息
		if err := conn.WriteJSON(map[string]interface{}{
			"type": "connected",
			"data": "等待容器启动...",
		}); err != nil {
			h.logger.Error("发送连接确认消息失败: %v", err)
		}

		// 保持连接直到客户端断开
		<-c.Request.Context().Done()
		h.logger.Info("客户端断开连接（进度模式），会话: %s", sessionID)
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

// getOptimalContainerCommand 根据镜像类型选择最佳的容器启动命令
// 实现智能镜像适配，为不同类型的镜像提供合适的启动方式
func (h *Handler) getOptimalContainerCommand(imageName string) []string {
	h.logger.Debug("[getOptimalContainerCommand] 分析镜像类型: %s", imageName)

	// 将镜像名称转换为小写以便匹配
	lowerImageName := strings.ToLower(imageName)

	// 检测特殊镜像类型并提供适配方案
	switch {
	case strings.Contains(lowerImageName, "hello-world"):
		// hello-world镜像：这是一个最小化测试镜像，只包含一个可执行文件
		// 不包含shell，需要使用特殊的保持运行命令
		h.logger.Info("[getOptimalContainerCommand] 检测到hello-world镜像，使用sleep保持运行")
		return []string{"sleep", "infinity"}

	case strings.Contains(lowerImageName, "scratch"):
		// scratch镜像：完全空白的镜像，通常用作基础镜像
		// 不包含任何文件系统或shell
		h.logger.Info("[getOptimalContainerCommand] 检测到scratch镜像，使用sleep保持运行")
		return []string{"sleep", "infinity"}

	case strings.Contains(lowerImageName, "busybox"):
		// busybox镜像：包含基本的Unix工具，但shell路径可能不同
		h.logger.Info("[getOptimalContainerCommand] 检测到busybox镜像，使用sh shell")
		return []string{"sh", "-c", "while true; do sleep 30; done"}

	case strings.Contains(lowerImageName, "alpine"):
		// Alpine Linux：轻量级Linux发行版，使用sh而不是bash
		h.logger.Info("[getOptimalContainerCommand] 检测到Alpine镜像，使用sh shell")
		return []string{"sh", "-c", "while true; do sleep 30; done"}

	case strings.Contains(lowerImageName, "distroless"):
		// Distroless镜像：不包含包管理器、shell等，只有应用运行时
		h.logger.Info("[getOptimalContainerCommand] 检测到distroless镜像，使用sleep保持运行")
		return []string{"sleep", "infinity"}

	case strings.Contains(lowerImageName, "nginx"):
		// Nginx镜像：Web服务器，有自己的启动方式
		h.logger.Info("[getOptimalContainerCommand] 检测到nginx镜像，使用daemon模式")
		return []string{"nginx", "-g", "daemon off;"}

	case strings.Contains(lowerImageName, "redis"):
		// Redis镜像：数据库服务
		h.logger.Info("[getOptimalContainerCommand] 检测到redis镜像，启动redis服务")
		return []string{"redis-server"}

	case strings.Contains(lowerImageName, "mysql") || strings.Contains(lowerImageName, "mariadb"):
		// MySQL/MariaDB镜像：数据库服务
		h.logger.Info("[getOptimalContainerCommand] 检测到MySQL/MariaDB镜像，启动数据库服务")
		return []string{"mysqld"}

	case strings.Contains(lowerImageName, "postgres"):
		// PostgreSQL镜像：数据库服务
		h.logger.Info("[getOptimalContainerCommand] 检测到PostgreSQL镜像，启动数据库服务")
		return []string{"postgres"}

	case strings.Contains(lowerImageName, "node"):
		// Node.js镜像：通常包含bash
		h.logger.Info("[getOptimalContainerCommand] 检测到Node.js镜像，使用bash shell")
		return []string{"/bin/bash", "-c", "while true; do sleep 30; done"}

	case strings.Contains(lowerImageName, "python"):
		// Python镜像：通常包含bash
		h.logger.Info("[getOptimalContainerCommand] 检测到Python镜像，使用bash shell")
		return []string{"/bin/bash", "-c", "while true; do sleep 30; done"}

	case strings.Contains(lowerImageName, "ubuntu") || strings.Contains(lowerImageName, "debian"):
		// Ubuntu/Debian镜像：标准Linux发行版，包含bash
		h.logger.Info("[getOptimalContainerCommand] 检测到Ubuntu/Debian镜像，使用bash shell")
		return []string{"/bin/bash", "-c", "while true; do sleep 30; done"}

	case strings.Contains(lowerImageName, "centos") || strings.Contains(lowerImageName, "rhel") || strings.Contains(lowerImageName, "fedora"):
		// CentOS/RHEL/Fedora镜像：Red Hat系列，包含bash
		h.logger.Info("[getOptimalContainerCommand] 检测到Red Hat系列镜像，使用bash shell")
		return []string{"/bin/bash", "-c", "while true; do sleep 30; done"}

	default:
		// 默认情况：尝试使用bash，如果失败会由错误处理机制处理
		h.logger.Info("[getOptimalContainerCommand] 未识别的镜像类型，使用默认bash命令")
		return []string{"/bin/bash", "-c", "while true; do sleep 30; done"}
	}
}
