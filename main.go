package main

import (
	"context"
	"embed"
	"net/http"
	"os"
	"os/signal"
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
//go:embed dist/*
var staticFiles embed.FS

// main 是应用程序的入口函数
// 负责初始化所有组件并启动HTTP服务器，支持优雅关闭
func main() {
	// 加载.env文件
	if err := godotenv.Load(); err != nil {
		// .env文件不存在或加载失败时不中断程序，只记录警告
		// 因为环境变量也可以通过其他方式设置
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

	// 初始化课程服务，负责加载和管理课程内容
	courseService := course.NewService(cfg.Course.Dir)
	courseService.SetLogger(appLogger) // 设置统一的logger实例
	if err := courseService.LoadCourses(); err != nil {
		// 课程加载失败不应该阻止应用启动，但需要记录警告
		appLogger.Warn("Warning: failed to load courses from %s: %v", cfg.Course.Dir, err)
	}

	// 初始化Docker控制器
	dockerController, err := docker.NewController()
	if err != nil {
		// Docker服务不可用时记录警告但不阻止应用启动
		appLogger.Warn("Warning: Docker service not available: %v", err)
		dockerController = nil
	}

	// 初始化WebSocket终端管理器 - 简化版本，专注于docker exec -it /bin/bash
	terminalManager := websocket.NewTerminalManager()
	appLogger.Info("WebSocket终端管理器初始化完成")

	// 设置Gin为发布模式以提高性能并减少日志输出
	gin.SetMode(gin.ReleaseMode)
	r := gin.Default()

	// 添加全局中间件用于错误恢复和日志记录
	r.Use(gin.Recovery())

	// 静态文件服务 - 处理前端资源文件（JS、CSS、图片等）
	r.GET("/assets/*filepath", func(c *gin.Context) {
		filepath := c.Param("filepath")

		// 防止路径遍历攻击
		if strings.Contains(filepath, "..") {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid file path"})
			return
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

		// 设置缓存头以提高性能
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

		// 返回前端应用
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
	appLogger.Info("Courses directory: %s", cfg.Course.Dir)

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

	appLogger.Info("Server exited")
}

// getContentType 根据文件路径返回对应的Content-Type
// 用于设置HTTP响应的Content-Type头，支持常见的Web文件类型
// 参数:
//
//	filepath: 文件路径
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
