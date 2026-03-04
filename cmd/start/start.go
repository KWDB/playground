package start

import (
	"context"
	"embed"
	"fmt"
	"net/http"
	"net/url"
	"os"
	"os/exec"
	"os/signal"
	"path/filepath"
	"runtime"
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
	"github.com/spf13/cobra"
)

// 守护进程相关默认路径（相对当前工作目录）
const (
	pidFilePath   = "tmp/kwdb-playground.pid" // PID 文件路径，用于确保唯一性
	daemonLogPath = "logs/daemon.log"         // 守护进程日志文件，重定向标准输出/错误
)

// Run 是 start 子命令的入口
func Run(staticFiles embed.FS, args []string) error {
	// 1) 处理帮助
	if hasHelpFlag(args) {
		printHelp()
		return nil
	}

	// 2) 加载 .env（不强制）
	_ = godotenv.Load()

	// 3) 守护进程分支（仅父进程执行）
	if containsDaemonFlag(args) && os.Getenv("DAEMON_MODE") != "1" {
		// 检查重复实例
		if pid, ok := readPIDFromFile(pidFilePath); ok && isProcessRunning(pid) {
			fmt.Printf("已有守护进程在运行(PID=%d)，若需重启，请先停止或清理PID文件: %s\n", pid, pidFilePath)
			os.Exit(1)
		}
		removePIDFile(pidFilePath)
		if err := runAsDaemon(pidFilePath, daemonLogPath, args); err != nil {
			fmt.Printf("守护进程启动失败: %v\n", err)
			os.Exit(1)
		}
		return nil
	}

	// 4) 业务主流程：加载配置、构建依赖、启动 HTTP 服务
	cfg, err := config.Load()
	if err != nil {
		tempLogger := logger.NewLogger(logger.ERROR)
		tempLogger.Error("Failed to load configuration: %v", err)
		os.Exit(1)
	}

	appLogger := logger.NewLogger(logger.ParseLogLevel(cfg.Log.Level))

	// 初始化课程服务（嵌入/磁盘双模式）
	var courseService *course.Service
	if cfg.Course.UseEmbed {
		courseService = course.NewServiceFromFS(staticFiles, "courses")
		appLogger.Info("Course service initialized in embedded FS mode")
	} else {
		courseService = course.NewService(cfg.Course.Dir)
		appLogger.Info("Course service initialized in disk mode: %s", cfg.Course.Dir)
	}
	courseService.SetLogger(appLogger)
	if err := courseService.LoadCourses(); err != nil {
		appLogger.Warn("Warning: failed to load courses: %v", err)
	}

	// 初始化 WebSocket 终端管理器
	terminalManager := websocket.NewTerminalManager()
	terminalManager.SetLogger(appLogger)

	// 初始化 Docker 控制器
	dockerController, err := docker.NewControllerWithTerminalManager(terminalManager)
	if err != nil {
		appLogger.Warn("Warning: Docker service not available: %v", err)
		dockerController = nil
	}
	if dockerController != nil && cfg.Course.DockerNetwork != "" {
		dockerController.SetNetworkName(cfg.Course.DockerNetwork)
		appLogger.Info("Docker 网络已配置: %s", cfg.Course.DockerNetwork)
	}
	appLogger.Info("WebSocket终端管理器初始化完成")

	// GIN_MODE=release 设置 Gin 为发布模式
	gin.SetMode(gin.ReleaseMode)
	r := gin.Default()
	if os.Getenv("GIN_MODE") == "release" {
		r = gin.New()
	}
	r.Use(gin.Recovery())

	// 静态文件服务（优先磁盘，回退嵌入）
	r.GET("/assets/*filepath", func(c *gin.Context) {
		p := c.Param("filepath")
		if strings.Contains(p, "..") {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid file path"})
			return
		}
		if !cfg.Course.UseEmbed {
			if data, err := os.ReadFile("dist/assets" + p); err == nil {
				contentType := getContentType(p)
				c.Header("Cache-Control", "no-cache")
				c.Data(http.StatusOK, contentType, data)
				return
			}
		}
		data, err := staticFiles.ReadFile("dist/assets" + p)
		if err != nil {
			appLogger.Debug("Static file not found: %s, error: %v", p, err)
			c.Status(http.StatusNotFound)
			return
		}
		contentType := getContentType(p)
		c.Header("Cache-Control", "public, max-age=31536000")
		c.Data(http.StatusOK, contentType, data)
	})

	// 兼容根级静态文件
	r.GET("/favicon.ico", func(c *gin.Context) {
		if !cfg.Course.UseEmbed {
			if data, err := os.ReadFile("dist/favicon.ico"); err == nil {
				c.Header("Cache-Control", "public, max-age=31536000")
				c.Data(http.StatusOK, "image/x-icon", data)
				return
			}
		}
		if data, err := staticFiles.ReadFile("dist/favicon.ico"); err == nil {
			c.Header("Cache-Control", "public, max-age=31536000")
			c.Data(http.StatusOK, "image/x-icon", data)
			return
		}
		c.Status(http.StatusNotFound)
	})

	r.GET("/favicon.svg", func(c *gin.Context) {
		if !cfg.Course.UseEmbed {
			if data, err := os.ReadFile("dist/favicon.svg"); err == nil {
				c.Header("Cache-Control", "public, max-age=31536000")
				c.Data(http.StatusOK, "image/svg+xml", data)
				return
			}
		}
		if data, err := staticFiles.ReadFile("dist/favicon.svg"); err == nil {
			c.Header("Cache-Control", "public, max-age=31536000")
			c.Data(http.StatusOK, "image/svg+xml", data)
			return
		}
		c.Status(http.StatusNotFound)
	})

	// API 路由
	codeManager := websocket.NewCodeManager()

	apiHandler := api.NewHandler(courseService, dockerController, terminalManager, codeManager, appLogger, cfg)
	apiHandler.SetupRoutes(r)

	// 前端路由（index.html）
	r.NoRoute(func(c *gin.Context) {
		if strings.HasPrefix(c.Request.URL.Path, "/api/") {
			c.JSON(http.StatusNotFound, gin.H{"error": "API endpoint not found"})
			return
		}
		if !cfg.Course.UseEmbed {
			if data, err := os.ReadFile("dist/index.html"); err == nil {
				c.Header("Cache-Control", "no-cache")
				c.Data(http.StatusOK, "text/html; charset=utf-8", data)
				return
			}
		}
		data, err := staticFiles.ReadFile("dist/index.html")
		if err != nil {
			c.String(http.StatusInternalServerError, "Error loading page")
			return
		}
		c.Data(http.StatusOK, "text/html; charset=utf-8", data)
	})

	addr := cfg.Server.Host + ":" + strconv.Itoa(cfg.Server.Port)
	srv := &http.Server{Addr: addr, Handler: r, ReadTimeout: 15 * time.Second, WriteTimeout: 15 * time.Second, IdleTimeout: 60 * time.Second}

	appLogger.Info("KWDB Playground starting on %s", addr)
	if cfg.Course.UseEmbed {
		appLogger.Info("Courses served from embedded FS")
	} else {
		appLogger.Info("Courses directory: %s", cfg.Course.Dir)
	}

	go func() {
		serveWithRetry(srv, appLogger)
	}()

	// 自动打开浏览器（仅在非守护进程模式且需要打开浏览器时）
	if os.Getenv("DAEMON_MODE") != "1" && !containsNoOpenFlag(args) {
		time.Sleep(500 * time.Millisecond)
		openBrowser(addr)
	}

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit
	appLogger.Info("Shutting down server...")

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	_ = srv.Shutdown(ctx)

	if os.Getenv("DAEMON_MODE") == "1" {
		removePIDFile(pidFilePath)
	}
	appLogger.Info("Server exited")
	return nil
}

func serveWithRetry(srv *http.Server, appLogger *logger.Logger) {
	if os.Getenv("KWDB_UPGRADE_RESTART") != "1" {
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			appLogger.Error("Failed to start server: %v", err)
			os.Exit(1)
		}
		return
	}

	deadline := time.Now().Add(20 * time.Second)
	for {
		err := srv.ListenAndServe()
		if err == nil || err == http.ErrServerClosed {
			return
		}
		if !strings.Contains(strings.ToLower(err.Error()), "address already in use") || time.Now().After(deadline) {
			appLogger.Error("Failed to start server after upgrade restart: %v", err)
			os.Exit(1)
		}
		time.Sleep(300 * time.Millisecond)
	}
}

// ----------------------------
// 子命令参数与帮助
// ----------------------------

func hasHelpFlag(args []string) bool {
	for _, a := range args {
		if a == "-h" || a == "--help" || a == "help" {
			return true
		}
	}
	return false
}

func printHelp() {
	fmt.Println("用法: kwdb-playground start [选项]")
	fmt.Println("选项:")
	fmt.Println("  -d, --daemon        以守护进程模式运行（默认）")
	fmt.Println("      --no-daemon     前台运行（不进入守护进程）")
	fmt.Println("  -o, --open         启动后自动在浏览器中打开 (默认)")
	fmt.Println("      --no-open      禁止自动打开浏览器")
	fmt.Println("  -h, --help         显示此帮助")
	fmt.Println("\n环境变量(常用):")
	fmt.Println("  SERVER_HOST        服务器监听地址 (默认: 0.0.0.0)")
	fmt.Println("  SERVER_PORT        服务器端口 (默认: 3006)")
}

// ----------------------------
// 守护进程相关工具函数
// ----------------------------

func containsDaemonFlag(args []string) bool {
	for _, a := range args {
		if a == "-d" || a == "--daemon" {
			return true
		}
	}
	return false
}

func containsNoOpenFlag(args []string) bool {
	for _, a := range args {
		if a == "--no-open" {
			return true
		}
	}
	return false
}

func filterDaemonFlags(args []string) []string {
	filtered := make([]string, 0, len(args))
	for _, a := range args {
		if a == "-d" || a == "--daemon" {
			continue
		}
		filtered = append(filtered, a)
	}
	return filtered
}

func ensureDirForFile(filePath string) error {
	dir := filepath.Dir(filePath)
	return os.MkdirAll(dir, 0o755)
}

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

func writePID(filePath string, pid int) error {
	if err := ensureDirForFile(filePath); err != nil {
		return err
	}
	return os.WriteFile(filePath, []byte(strconv.Itoa(pid)), 0o644)
}

func removePIDFile(filePath string) { _ = os.Remove(filePath) }

func openBrowser(addr string) {
	u := url.URL{
		Scheme: "http",
		Host:   addr,
	}
	urlStr := u.String()

	var err error
	switch runtime.GOOS {
	case "linux":
		err = exec.Command("xdg-open", urlStr).Start()
	case "darwin":
		err = exec.Command("open", urlStr).Start()
	case "windows":
		err = exec.Command("cmd", "/c", "start", urlStr).Start()
	default:
		err = exec.Command("xdg-open", urlStr).Start()
		if err != nil {
			err = exec.Command("gio", "open", urlStr).Start()
		}
	}
	if err != nil {
		fmt.Printf("无法自动打开浏览器: %v\n", err)
	} else {
		fmt.Printf("已在浏览器中打开: %s\n", urlStr)
	}
}

// ----------------------------
// 静态工具函数
// ----------------------------

func getContentType(p string) string {
	switch {
	case strings.HasSuffix(p, ".js"):
		return "application/javascript"
	case strings.HasSuffix(p, ".css"):
		return "text/css"
	case strings.HasSuffix(p, ".svg"):
		return "image/svg+xml"
	case strings.HasSuffix(p, ".png"):
		return "image/png"
	case strings.HasSuffix(p, ".jpg") || strings.HasSuffix(p, ".jpeg"):
		return "image/jpeg"
	case strings.HasSuffix(p, ".gif"):
		return "image/gif"
	case strings.HasSuffix(p, ".ico"):
		return "image/x-icon"
	case strings.HasSuffix(p, ".woff") || strings.HasSuffix(p, ".woff2"):
		return "font/woff"
	case strings.HasSuffix(p, ".ttf"):
		return "font/ttf"
	default:
		return "text/plain"
	}
}

// NewCommand 定义 start 子命令
func NewCommand(staticFiles embed.FS) *cobra.Command {
	cmd := &cobra.Command{
		Use:   "start",
		Short: "启动 KWDB Playground",
		Long:  "以守护进程模式启动 KWDB Playground 并在浏览器中打开",
		RunE: func(cmd *cobra.Command, _ []string) error {
			if cmd.Flags().Changed("host") {
				h, _ := cmd.Flags().GetString("host")
				_ = os.Setenv("SERVER_HOST", h)
			}
			if cmd.Flags().Changed("port") {
				p, _ := cmd.Flags().GetInt("port")
				_ = os.Setenv("SERVER_PORT", strconv.Itoa(p))
			}
			if cmd.Flags().Changed("log-level") {
				ll, _ := cmd.Flags().GetString("log-level")
				_ = os.Setenv("LOG_LEVEL", ll)
			}
			if cmd.Flags().Changed("log-format") {
				lf, _ := cmd.Flags().GetString("log-format")
				_ = os.Setenv("LOG_FORMAT", lf)
			}

			// 默认以守护进程模式运行，除非用户明确指定 --no-daemon
			passArgs := []string{}
			if noDaemon, _ := cmd.Flags().GetBool("no-daemon"); !noDaemon {
				passArgs = append(passArgs, "--daemon")
			}
			if noOpen, _ := cmd.Flags().GetBool("no-open"); noOpen {
				passArgs = append(passArgs, "--no-open")
			}
			return Run(staticFiles, passArgs)
		},
	}

	cmd.Flags().Bool("no-daemon", false, "前台运行（不进入守护进程）")
	cmd.Flags().BoolP("no-open", "n", false, "禁止自动打开浏览器")
	cmd.Flags().String("host", "", "服务器监听地址")
	cmd.Flags().Int("port", 0, "服务器端口")
	cmd.Flags().String("log-level", "warn", "日志级别: debug|info|warn|error")
	cmd.Flags().String("log-format", "text", "日志格式: json|text")

	return cmd
}
