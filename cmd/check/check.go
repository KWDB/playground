package check

import (
	"context"
	"embed"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net"
	"net/http"
	"os"
	"os/exec"
	"strconv"
	"strings"
	"time"

	"github.com/spf13/cobra"

	"kwdb-playground/internal/config"
	"kwdb-playground/internal/course"
	"kwdb-playground/internal/docker"
)

// NewCommand 创建 check 子命令：
// - Docker 环境检查
// - 端口占用检查
// - 课程加载与完整性检查
// - 服务健康检查（端口未监听不判失败）
func NewCommand(staticFiles embed.FS) *cobra.Command {
	// 不在命令构造阶段加载配置，避免在执行 help/-h 时触发配置加载
	// 通过 Flags 接收用户输入，实际运行时再加载配置并合并覆盖
	var (
		host       string
		port       int
		coursesDir string
		useEmbed   bool
	)

	cmd := &cobra.Command{
		Use:   "check",
		Short: "检查本地开发环境（Docker、端口占用、课程加载、服务健康）",
		Long:  "全面检查本地开发环境：\n1) Docker 环境是否可用\n2) 指定端口是否被占用\n3) 课程资源加载与数据完整性\n4) Playground 服务运行与健康状态",
		RunE: func(cmd *cobra.Command, args []string) error {
			// 静默模式：禁用标准库日志输出，避免内部模块在检查期间输出日志
			// 注意：仅影响该命令的执行周期，结束后通过 defer 恢复，避免影响其他命令
			log.SetOutput(io.Discard)
			defer log.SetOutput(os.Stderr)

			// 仅在实际运行时加载配置，避免 help/-h 加载配置
			cfg := config.Load()

			// 计算有效参数：优先使用用户通过 Flags 设置的值；否则回退到配置
			effectiveHost := cfg.Server.Host
			if cmd.Flags().Changed("host") && host != "" {
				effectiveHost = host
			}
			effectivePort := cfg.Server.Port
			if cmd.Flags().Changed("port") && port != 0 {
				effectivePort = port
			}
			effectiveCoursesDir := cfg.Course.Dir
			if cmd.Flags().Changed("courses-dir") && coursesDir != "" {
				effectiveCoursesDir = coursesDir
			}
			effectiveUseEmbed := cfg.Course.UseEmbed
			if cmd.Flags().Changed("courses-use-embed") {
				effectiveUseEmbed = useEmbed
			}

			fmt.Println("================ 环境检查开始 ================")

			// 1. Docker 环境检查
			dockerOK, dockerMsg := checkDockerEnv()
			printCheckResult("Docker 环境", dockerOK, dockerMsg)

			// 2. 端口占用检查
			portOK, portMsg, procInfo := checkPortOccupation(effectiveHost, effectivePort)
			printCheckResult("端口占用 ("+effectiveHost+":"+strconv.Itoa(effectivePort)+")", portOK, portMsg)
			if !portOK && procInfo != "" {
				fmt.Println("  - 占用进程信息:\n" + indent(procInfo, "    "))
			}

			// 3. 课程加载状态检查（支持嵌入或目录）
			coursesOK, coursesMsg := checkCoursesStatus(staticFiles, effectiveUseEmbed, effectiveCoursesDir)
			printCheckResult("课程加载与完整性", coursesOK, coursesMsg)

			// 4. 服务运行状态检查（/health）
			serviceOK, serviceMsg := checkServiceHealth(effectiveHost, effectivePort)
			printCheckResult("服务健康检查 ("+effectiveHost+":"+strconv.Itoa(effectivePort)+")", serviceOK, serviceMsg)

			fmt.Println("================ 环境检查结束 ================")

			// 如果任一检查失败，返回非零错误码
			if !(dockerOK && portOK && coursesOK && serviceOK) {
				return fmt.Errorf("环境检查存在失败项，请根据提示修复后重试")
			}
			return nil
		},
	}

	// Flags（仅在用户显式设置时覆盖配置）
	cmd.Flags().StringVar(&host, "host", "", "指定服务主机（默认从环境变量/配置读取）")
	cmd.Flags().IntVar(&port, "port", 0, "指定服务端口（默认从环境变量/配置读取）")
	cmd.Flags().StringVar(&coursesDir, "courses-dir", "", "课程目录（未设置时从配置读取）")
	cmd.Flags().BoolVar(&useEmbed, "courses-use-embed", false, "是否使用嵌入课程资源进行检查（未设置时从配置读取）")

	return cmd
}

// printCheckResult 统一输出检查结果（带图标与详细描述）
func printCheckResult(name string, ok bool, msg string) {
	if ok {
		fmt.Printf("[✅] %s：%s\n", name, msg)
	} else {
		fmt.Printf("[❌] %s：%s\n", name, msg)
	}
}

// indent 将多行文本缩进，便于在 CLI 中更清晰展示
func indent(s, prefix string) string {
	lines := []byte(s)
	res := make([]byte, 0, len(lines)+len(prefix))
	prevNL := true
	for _, b := range lines {
		if prevNL {
			res = append(res, []byte(prefix)...)
			prevNL = false
		}
		res = append(res, b)
		if b == '\n' {
			prevNL = true
		}
	}
	return string(res)
}

// checkDockerEnv 检查 Docker 是否安装并且守护进程可连接
// 复用内部 docker 控制器的创建逻辑以确保与业务一致
func checkDockerEnv() (bool, string) {
	controller, err := docker.NewController()
	if err != nil {
		return false, fmt.Sprintf("Docker 不可用：%v", err)
	}
	// 确保释放资源
	_ = controller.Close()
	return true, "Docker 客户端与守护进程连接正常"
}

// checkPortOccupation 检查端口是否被占用，并尽可能列出占用进程
func checkPortOccupation(host string, port int) (bool, string, string) {
	addr := net.JoinHostPort(host, strconv.Itoa(port))
	// 尝试建立 TCP 连接判断端口监听状态
	conn, err := net.DialTimeout("tcp", addr, 800*time.Millisecond)
	if err != nil {
		// 连接失败通常意味着端口没有被监听（或网络不可达），视为可用
		return true, "端口未被占用，可用", ""
	}
	// 连接成功则说明端口被占用
	_ = conn.Close()

	// 新增：进一步判断是否为本服务占用（通过 /health 识别）
	if isPortUsedByCurrentService(host, port) {
		// 端口由本服务占用，属于正常情况，不视为冲突
		return true, "端口被本服务使用（正常）", ""
	}

	// 尝试使用 lsof 列出占用进程（macOS 默认可用）
	procInfo, lerr := listPortProcesses(port)
	if lerr != nil {
		return false, "端口已被占用（进程信息获取失败，可能未安装 lsof）", ""
	}
	if procInfo == "" {
		return false, "端口已被占用（但未能获取到进程信息）", ""
	}
	return false, "端口已被占用", procInfo
}

// isPortUsedByCurrentService 判断端口是否由本服务占用：
// 通过请求 http://host:port/health 并校验返回JSON的特征来识别
func isPortUsedByCurrentService(host string, port int) bool {
	url := fmt.Sprintf("http://%s:%d/health", host, port)
	client := &http.Client{Timeout: 800 * time.Millisecond}
	resp, err := client.Get(url)
	if err != nil {
		return false
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return false
	}
	// 解析返回体，验证 status 与 message
	var payload struct {
		Status  string `json:"status"`
		Message string `json:"message"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&payload); err != nil {
		return false
	}
	if strings.ToLower(payload.Status) == "ok" && strings.Contains(payload.Message, "KWDB Playground") {
		return true
	}
	return false
}

// listPortProcesses 使用 lsof 检查指定端口的监听进程
func listPortProcesses(port int) (string, error) {
	cmd := exec.Command("lsof", "-i", fmt.Sprintf(":%d", port), "-sTCP:LISTEN", "-n", "-P")
	// 为了避免阻塞，设置一个超时上下文
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()
	cmd = exec.CommandContext(ctx, cmd.Path, cmd.Args[1:]...)
	out, _ := cmd.CombinedOutput()
	if ctx.Err() == context.DeadlineExceeded {
		return "", fmt.Errorf("查询端口占用超时")
	}
	// lsof 在无结果时可能返回非零退出码，但我们仍可使用输出内容判断
	if len(out) == 0 {
		return "", nil
	}
	return string(out), nil
}

// checkCoursesStatus 检查课程是否可加载以及基本数据完整性
func checkCoursesStatus(staticFiles embed.FS, useEmbed bool, dir string) (bool, string) {
	var svc *course.Service
	if useEmbed {
		// 使用嵌入式课程资源
		svc = course.NewServiceFromFS(staticFiles, "courses")
	} else {
		// 使用本地目录课程资源
		svc = course.NewService(dir)
	}

	if err := svc.LoadCourses(); err != nil {
		return false, fmt.Sprintf("课程加载失败：%v", err)
	}

	courses := svc.GetCourses()
	if len(courses) == 0 {
		return false, "未找到任何课程，请检查课程目录或嵌入资源"
	}

	// 基础完整性检查：标题、步骤、Intro/Finish 文本等
	problems := make([]string, 0)
	for id, c := range courses {
		if strings.TrimSpace(c.Title) == "" {
			problems = append(problems, fmt.Sprintf("课程 %s 缺少标题", id))
		}
		if len(c.Details.Steps) == 0 {
			problems = append(problems, fmt.Sprintf("课程 %s 不包含任何步骤", id))
		} else {
			for i, step := range c.Details.Steps {
				if strings.TrimSpace(step.Title) == "" {
					problems = append(problems, fmt.Sprintf("课程 %s 的第 %d 步缺少标题", id, i+1))
				}
				if strings.TrimSpace(step.Text) == "" {
					problems = append(problems, fmt.Sprintf("课程 %s 的第 %d 步缺少说明文本", id, i+1))
				}
			}
		}
		if strings.TrimSpace(c.Details.Intro.Text) == "" {
			problems = append(problems, fmt.Sprintf("课程 %s 缺少 Intro 文本", id))
		}
		if strings.TrimSpace(c.Details.Finish.Text) == "" {
			problems = append(problems, fmt.Sprintf("课程 %s 缺少 Finish 文本", id))
		}
	}

	if len(problems) > 0 {
		return false, "课程加载成功，但存在数据完整性问题：\n" + indent(strings.Join(problems, "\n"), "  - ")
	}
	return true, fmt.Sprintf("课程加载成功，共 %d 门，数据完整性检查通过", len(courses))
}

// checkServiceHealth 通过 /health 端点检查服务运行状态
func checkServiceHealth(host string, port int) (bool, string) {
	// 先检查端口是否在监听；如果未监听，说明服务未运行（这是允许的场景），返回提示但不作为失败
	addr := net.JoinHostPort(host, strconv.Itoa(port))
	conn, err := net.DialTimeout("tcp", addr, 800*time.Millisecond)
	if err != nil {
		return true, "服务未运行"
	}
	_ = conn.Close()

	// 端口已监听，再调用 /health 进行健康检查
	url := fmt.Sprintf("http://%s:%d/health", host, port)
	client := &http.Client{Timeout: 2 * time.Second}
	resp, err := client.Get(url)
	if err != nil {
		return false, fmt.Sprintf("服务已监听，但健康端点访问失败：%v", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return false, fmt.Sprintf("服务已监听，但健康端点返回非 200 状态码：%d", resp.StatusCode)
	}
	return true, "服务正在运行且健康（/health 返回 200）"
}
