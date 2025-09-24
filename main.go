package main

import (
	"context"
	"embed"
	"fmt"
	"net/http"
	"os"
	"os/exec"
	"os/signal"
	"path/filepath"
	"strconv"
	"strings"
	"syscall"
	"time"

	"kwdb-playground/internal/api"
	"kwdb-playground/internal/config"
	"kwdb-playground/internal/course"
	"kwdb-playground/internal/docker"
	"kwdb-playground/internal/logger"
	"kwdb-playground/internal/websocket"

	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"
)

// staticFiles 嵌入前端构建产物，用于静态文件服务
//
//go:embed dist/* courses/*
var staticFiles embed.FS

// 守护进程相关默认路径（相对当前工作目录）
const (
	pidFilePath   = "tmp/kwdb-playground.pid" // PID 文件路径，用于确保唯一性
	daemonLogPath = "logs/daemon.log"        // 守护进程日志文件，重定向标准输出/错误
)

// containsDaemonFlag 检查命令行是否包含守护进程标志（-d 或 --daemon）
func containsDaemonFlag(args []string) bool {
	for _, a := range args[1:] { // 跳过程序名
		if a == "-d" || a == "--daemon" {
			return true
		}
	}
	return false
}

// filterDaemonFlags 过滤掉守护进程相关标志，避免子进程再次守护化
func filterDaemonFlags(args []string) []string {
	filtered := make([]string, 0, len(args))
	for _, a := range args[1:] { // 跳过程序名
		if a == "-d" || a == "--daemon" {
			continue
		}
		filtered = append(filtered, a)
	}
	return filtered
}

// ensureDirForFile 确保文件所在目录存在
func ensureDirForFile(filePath string) error {
	dir := filepath.Dir(filePath)
	return os.MkdirAll(dir, 0o755)
}

// readPIDFromFile 从 PID 文件读取进程号
func readPIDFromFile(filePath string) (int, bool) {
	data, err := os.ReadFile(filePath)
	if err != nil || len(data) == 0 {
		return 0, false
	}
	pid, err := strconv.Atoi(strings.TrimSpace(string(data)))
	if err != nil {
		return 0, false
	}
	return pid, true
}

// isProcessRunning 检查给定 PID 的进程是否仍在运行
func isProcessRunning(pid int) bool {
	// 在 Unix 系统上，向进程发送 0 信号可用于检查其是否存在
	if pid <= 0 {
		return false
	}
	err := syscall.Kill(pid, 0)
	return err == nil
}

// writePID 写入当前进程 PID 到指定文件
func writePID(filePath string, pid int) error {
	if err := ensureDirForFile(filePath); err != nil {
		return err
	}
	return os.WriteFile(filePath, []byte(strconv.Itoa(pid)), 0o644)
}

// removePIDFile 删除 PID 文件（忽略错误）
func removePIDFile(filePath string) {
	_ = os.Remove(filePath)
}

// runAsDaemon 以守护进程模式启动当前程序：
// - 过滤 -d/--daemon 参数避免子进程再次守护化
// - Setsid 脱离控制终端
// - 重定向子进程的标准输出/错误到日志文件
// - 写入 PID 文件确保唯一性
func runAsDaemon(pidFile, logFile string) error {
	// 获取当前可执行文件路径
	exePath, err := os.Executable()
	if err != nil {
		return fmt.Errorf("无法获取可执行文件路径: %w", err)
	}

	// 准备子进程参数（过滤守护标志）
	childArgs := filterDaemonFlags(os.Args)

	// 准备日志文件与 /dev/null
	if err := ensureDirForFile(logFile); err != nil {
		return fmt.Errorf("创建日志目录失败: %w", err)
	}
	logFH, err := os.OpenFile(logFile, os.O_CREATE|os.O_APPEND|os.O_WRONLY, 0o644)
	if err != nil {
		return fmt.Errorf("打开日志文件失败: %w", err)
	}
	defer logFH.Close()

	devNull, err := os.OpenFile(os.DevNull, os.O_RDWR, 0)
	if err != nil {
		return fmt.Errorf("打开 /dev/null 失败: %w", err)
	}
	defer devNull.Close()

	// 构造子进程命令
	cmd := exec.Command(exePath, childArgs...)
	cmd.Stdout = logFH
	cmd.Stderr = logFH
	cmd.Stdin = devNull
	cmd.SysProcAttr = &syscall.SysProcAttr{Setsid: true} // 脱离控制终端
	cmd.Env = append(os.Environ(), "DAEMON_MODE=1")      // 标记为守护子进程

	// 启动子进程
	if err := cmd.Start(); err != nil {
		return fmt.Errorf("守护子进程启动失败: %w", err)
	}

	// 写入 PID 文件（使用子进程 PID）
	if err := writePID(pidFile, cmd.Process.Pid); err != nil {
		return fmt.Errorf("写入 PID 文件失败: %w", err)
	}

	fmt.Printf("守护进程启动成功，PID=%d，日志=%s，PID文件=%s\n", cmd.Process.Pid, logFile, pidFile)
	return nil
}

// main 是应用程序的入口函数
// 负责初始化所有组件并启动HTTP服务器，支持优雅关闭
func main() {
	// 加载.env文件
	if err := godotenv.Load(); err != nil {
		// .env文件不存在或加载失败时不中断程序，只记录警告
		// 因为环境变量也可以通过其他方式设置
	}

	// 守护进程模式处理：仅在父进程执行（避免子进程再次守护化）
	if containsDaemonFlag(os.Args) && os.Getenv("DAEMON_MODE") != "1" {
		// 检查是否已有守护进程实例在运行
		if pid, ok := readPIDFromFile(pidFilePath); ok && isProcessRunning(pid) {
			fmt.Printf("已有守护进程在运行(PID=%d)，若需重启，请先停止或清理PID文件: %s\n", pid, pidFilePath)
			os.Exit(1)
		}
		// 移除可能存在的陈旧 PID 文件
		removePIDFile(pidFilePath)

		// 以守护进程模式启动并退出父进程
		if err := runAsDaemon(pidFilePath, daemonLogPath); err != nil {
			fmt.Printf("守护进程启动失败: %v\n", err)
			os.Exit(1)
		}
		return
	}

	// 加载应用程序配置，包括服务器、Docker、课程等配置项
	cfg := config.Load()
	if cfg == nil {
		// 创建临时logger用于配置加载失败的错误输出
		tempLogger := logger.NewLogger(logger.ERROR)
		tempLogger.Error("Failed to load configuration")
		os.Exit(1)
	}

	// 创建logger实例，使用配置的日志级别
	appLogger := logger.NewLogger(logger.ParseLogLevel(cfg.Log.Level))

	// 初始化课程服务，负责加载和管理课程内容（双模式）
	var courseService *course.Service
	if cfg.Course.UseEmbed {
		// 发布模式：从嵌入式FS读取课程
		courseService = course.NewServiceFromFS(staticFiles, "courses")
		appLogger.Info("Course service initialized in embedded FS mode")
	} else {
		// 开发模式：从磁盘读取课程目录
		courseService = course.NewService(cfg.Course.Dir)
		appLogger.Info("Course service initialized in disk mode: %s", cfg.Course.Dir)
	}
	courseService.SetLogger(appLogger) // 设置统一的logger实例
	if err := courseService.LoadCourses(); err != nil {
		// 课程加载失败不应该阻止应用启动，但需要记录警告
		appLogger.Warn("Warning: failed to load courses: %v", err)
	}

	// 初始化WebSocket终端管理器 - 简化版本，专注于docker exec -it /bin/bash
	terminalManager := websocket.NewTerminalManager()

	// 初始化Docker控制器，传入WebSocket管理器
	dockerController, err := docker.NewControllerWithTerminalManager(terminalManager)
	if err != nil {
		// Docker服务不可用时记录警告但不阻止应用启动
		appLogger.Warn("Warning: Docker service not available: %v", err)
		dockerController = nil
	}
	terminalManager.SetLogger(appLogger) // 设置统一的logger实例
	appLogger.Info("WebSocket终端管理器初始化完成")

	// 设置Gin为发布模式以提高性能并减少日志输出
	gin.SetMode(gin.ReleaseMode)
	r := gin.Default()

	// 添加全局中间件用于错误恢复和日志记录
	r.Use(gin.Recovery())

	// 静态文件服务 - 处理前端资源文件（JS、CSS、图片等）
	// 双模式：优先从嵌入式FS读取，如需开发从磁盘读取可在下方扩展
	r.GET("/assets/*filepath", func(c *gin.Context) {
		filepath := c.Param("filepath")

		// 防止路径遍历攻击
		if strings.Contains(filepath, "..") {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid file path"})
			return
		}

		// 当使用磁盘模式时，直接从磁盘读取以便本地开发热更新
		if !cfg.Course.UseEmbed {
			data, err := os.ReadFile("dist/assets" + filepath)
			if err == nil {
				contentType := getContentType(filepath)
				c.Header("Cache-Control", "no-cache")
				c.Data(http.StatusOK, contentType, data)
				return
			}
			// 如果磁盘读取失败，回退到嵌入式FS（用于某些构建缺失的情况）
		}

		// 从嵌入的文件系统中读取静态资源
		data, err := staticFiles.ReadFile("dist/assets" + filepath)
		if err != nil {
			// 记录文件未找到的详细信息用于调试
			appLogger.Debug("Static file not found: %s, error: %v", filepath, err)
			c.Status(http.StatusNotFound)
			return
		}

		// 根据文件扩展名设置正确的Content-Type
		contentType := getContentType(filepath)

		// 设置缓存头以提高性能（嵌入模式可长缓存）
		c.Header("Cache-Control", "public, max-age=31536000") // 1年缓存
		c.Data(http.StatusOK, contentType, data)
	})

	// 设置API路由
	apiHandler := api.NewHandler(courseService, dockerController, terminalManager, appLogger)
	apiHandler.SetupRoutes(r)

	// 前端路由 - 所有非API路由都返回index.html
	r.NoRoute(func(c *gin.Context) {
		// 如果是API路由但没有匹配到，返回404
		if strings.HasPrefix(c.Request.URL.Path, "/api/") {
			c.JSON(http.StatusNotFound, gin.H{
				"error": "API endpoint not found",
			})
			return
		}

		// 开发模式优先读取磁盘，以便前端热更新与调试
		if !cfg.Course.UseEmbed {
			if data, err := os.ReadFile("dist/index.html"); err == nil {
				c.Header("Cache-Control", "no-cache")
				c.Data(http.StatusOK, "text/html; charset=utf-8", data)
				return
			}
		}

		// 返回嵌入的前端应用
		data, err := staticFiles.ReadFile("dist/index.html")
		if err != nil {
			c.String(http.StatusInternalServerError, "Error loading page")
			return
		}
		c.Data(http.StatusOK, "text/html; charset=utf-8", data)
	})

	// 创建HTTP服务器
	addr := cfg.Server.Host + ":" + strconv.Itoa(cfg.Server.Port)
	srv := &http.Server{
		Addr:    addr,
		Handler: r,
		// 设置合理的超时时间防止资源泄漏
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 15 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	appLogger.Info("KWDB Playground starting on %s", addr)
	if cfg.Course.UseEmbed {
		appLogger.Info("Courses served from embedded FS")
	} else {
		appLogger.Info("Courses directory: %s", cfg.Course.Dir)
	}

	// 在goroutine中启动服务器
	go func() {
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			appLogger.Error("Failed to start server: %v", err)
			os.Exit(1)
		}
	}()

	// 等待中断信号以优雅关闭服务器
	quit := make(chan os.Signal, 1)
	// 监听SIGINT和SIGTERM信号
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit
	appLogger.Info("Shutting down server...")

	// 给服务器5秒时间完成现有请求
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if err := srv.Shutdown(ctx); err != nil {
		appLogger.Error("Server forced to shutdown: %v", err)
	}

	// 守护子进程退出时清理 PID 文件
	if os.Getenv("DAEMON_MODE") == "1" {
		removePIDFile(pidFilePath)
	}

	appLogger.Info("Server exited")
}

// getContentType 根据文件路径返回对应的Content-Type
// 用于设置HTTP响应的Content-Type头，支持常见的Web文件类型
// 参数:
//
//  filepath: 文件路径
//
// 返回: 对应的MIME类型字符串
func getContentType(filepath string) string {
	switch {
	case strings.HasSuffix(filepath, ".js"):
		return "application/javascript"
	case strings.HasSuffix(filepath, ".css"):
		return "text/css"
	case strings.HasSuffix(filepath, ".svg"):
		return "image/svg+xml"
	case strings.HasSuffix(filepath, ".png"):
		return "image/png"
	case strings.HasSuffix(filepath, ".jpg"), strings.HasSuffix(filepath, ".jpeg"):
		return "image/jpeg"
	case strings.HasSuffix(filepath, ".gif"):
		return "image/gif"
	case strings.HasSuffix(filepath, ".ico"):
		return "image/x-icon"
	case strings.HasSuffix(filepath, ".woff"), strings.HasSuffix(filepath, ".woff2"):
		return "font/woff"
	case strings.HasSuffix(filepath, ".ttf"):
		return "font/ttf"
	default:
		return "text/plain"
	}
}
