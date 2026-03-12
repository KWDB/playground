package api

import (
	"context"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"sync"
	"time"

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
	codeManager     *ws.CodeManager
	// logger 日志记录器实例，用于统一日志管理
	logger *logger.Logger

	// cfg 全局配置，用于环境检查等场景
	cfg *config.Config

	// sqlDriverManager KWDB 连接驱动管理器（按课程隔离）
	sqlDriverManager *sql.DriverManager

	upgradeMu             sync.Mutex
	upgradeInProgress     bool
	courseStartMu         sync.Mutex
	courseStartInProgress map[string]bool
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
	codeManager *ws.CodeManager,
	logger *logger.Logger,
	cfg *config.Config,
) *Handler {
	return &Handler{
		courseService:         courseService,
		dockerController:      dockerController,
		terminalManager:       terminalManager,
		codeManager:           codeManager,
		logger:                logger,
		cfg:                   cfg,
		sqlDriverManager:      sql.NewDriverManager(),
		courseStartInProgress: map[string]bool{},
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
		api.GET("/doctor", h.envCheck)
		api.GET("/check", h.envCheck)

		// 版本信息
		api.GET("/version", h.getVersion)

		// 升级
		api.GET("/upgrade/check", h.checkUpgrade)
		api.POST("/upgrade", h.upgrade)

		// 课程相关路由
		courses := api.Group("/courses")
		{
			courses.GET("", h.getCourses)
			courses.GET("/:id", h.getCourse)
			courses.POST("/:id/start", h.startCourse)
			courses.POST("/:id/stop", h.stopCourse)
			courses.POST("/:id/pause", h.pauseCourse)
			courses.POST("/:id/resume", h.resumeCourse)
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
			containers.POST("/:id/pause", h.pauseContainer)
			containers.POST("/:id/unpause", h.unpauseContainer)
		}

		// 镜像相关路由
		images := api.Group("/images")
		{
			images.POST("/check-availability", h.checkImageAvailability)
			images.GET("/sources", h.getImageSources)
			images.GET("/course-diagnostics", h.getCourseImageDiagnostics)
			images.POST("/preload", h.preloadCourseImages)
			images.POST("/cleanup", h.cleanupCourseImages)
			images.POST("/cleanup-all", h.cleanupAllCourseImages)
		}

		// 用户进度相关路由
		progress := api.Group("/progress")
		{
			progress.POST("/reset-all", h.resetAllProgress)
			progress.GET("/:courseId", h.getProgress)
			progress.POST("/:courseId", h.saveProgress)
			progress.POST("/:courseId/reset", h.resetProgress)
		}

		// SQL 信息与健康（REST 信息类）
		api.GET("/sql/info", h.sqlInfo)
		api.GET("/sql/health", h.sqlHealth)
	}

	// WebSocket路由
	r.GET("/ws/terminal", h.handleTerminalWebSocket)
	// SQL WebSocket 路由（与Shell终端操作方式一致）
	r.GET("/ws/sql", h.handleSqlWebSocket)
	r.GET("/ws/code", h.handleCodeWebSocket)
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
	session := h.terminalManager.CreateSession(sessionID, containerID, conn, h.dockerController)
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

// handleCodeWebSocket 处理代码执行WebSocket连接
func (h *Handler) handleCodeWebSocket(c *gin.Context) {
	sessionID := c.Query("session_id")
	if sessionID == "" {
		sessionID = fmt.Sprintf("code_session_%d", time.Now().UnixNano())
	}

	if h.codeManager == nil {
		h.logger.Error("代码执行管理器不可用")
		c.JSON(http.StatusInternalServerError, gin.H{"error": "代码执行管理器不可用"})
		return
	}

	upgrader := websocket.Upgrader{
		CheckOrigin: func(r *http.Request) bool {
			return true
		},
	}

	conn, err := upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		h.logger.Error("WebSocket升级失败: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "WebSocket连接升级失败"})
		return
	}
	defer conn.Close()

	session := h.codeManager.CreateSession(sessionID, conn, h.dockerController)
	defer h.codeManager.RemoveSession(sessionID)
	session.SetLogger(h.logger)

	err = session.StartSession()
	if err != nil {
		h.logger.Error("启动代码执行会话失败: %v", err)
		return
	}

	h.logger.Info("代码执行会话 %s 已启动", sessionID)

	select {
	case <-c.Request.Context().Done():
		h.logger.Info("客户端断开连接，会话: %s", sessionID)
	case <-session.Done():
		h.logger.Info("代码执行会话结束: %s", sessionID)
	}
}
