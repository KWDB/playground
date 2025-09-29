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
			// 修正：Gin 路径参数应为 `/:id`
			courses.GET("/:id", h.getCourse)
			courses.POST("/:id/start", h.startCourse)
			courses.POST("/:id/stop", h.stopCourse)
		}

		// 容器相关路由
		containers := api.Group("/containers")
		{
			// 修正：Gin 路径参数应为 `/:id`
			containers.GET("/:id/status", h.getContainerStatus)
			containers.GET("/:id/logs", h.getContainerLogs)
			containers.POST("/:id/restart", h.restartContainer)
			// 新增：按容器ID停止并删除容器
			containers.POST("/:id/stop", h.stopContainerByID)
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

	// 如果课程配置中指定了镜像，使用课程指定的镜像
	if course.Backend.ImageID != "" {
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
		cmd = course.Backend.Cmd
		h.logger.Debug("[startCourse] 使用课程配置的Cmd: %v", cmd)
	} else {
		h.logger.Debug("[startCourse] 使用默认Cmd: %v", cmd)
	}

	// 创建容器配置
	config := &docker.ContainerConfig{
		Image:      imageName,
		WorkingDir: workingDir,                // 使用配置的工作目录
		Cmd:        cmd,                       // 根据课程配置的Cmd启动容器
		Privileged: course.Backend.Privileged, // 根据课程配置的Privileged启动容器
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
		if err = conn.WriteJSON(map[string]interface{}{
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

// stopContainerByID 按容器ID停止并删除容器
// 路径参数:
//
//  id: 容器ID
//
// 响应:
//
//  200: {"message": "容器停止成功", "containerId": id} - 停止并删除成功
//  400: {"error": "容器ID不能为空"} - 容器ID为空
//  404: {"error": "容器不存在"} - 容器不存在
//  500: {"error": "容器操作失败: 错误信息"} - 停止或删除失败
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
