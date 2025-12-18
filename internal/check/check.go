package check

import (
	"context"
	"embed"
	"encoding/json"
	"fmt"
	"io"
	"net"
	"net/http"
	"os/exec"
	"strconv"
	"strings"
	"time"

	"kwdb-playground/internal/config"
	"kwdb-playground/internal/course"
	"kwdb-playground/internal/docker"
)

// Item 单项检查结果
type Item struct {
	Name    string `json:"name"`
	OK      bool   `json:"ok"`
	Message string `json:"message"`
	Details string `json:"details,omitempty"`
}

// Summary 检查汇总
type Summary struct {
	OK    bool   `json:"ok"`
	Items []Item `json:"items"`
}

// RunFromConfig 使用配置与课程来源（嵌入或磁盘）执行检查
func RunFromConfig(staticFiles embed.FS, cfg *config.Config) Summary {
	items := make([]Item, 0, 5)

	// 1) Docker
	dockerOK, dockerMsg := DockerEnv()
	items = append(items, Item{Name: "Docker 环境", OK: dockerOK, Message: dockerMsg})

	// 2) 镜像源可用性
	imageOK, imageMsg, imageDetails := ImageSourcesAvailability()
	items = append(items, Item{Name: "镜像源可用性", OK: imageOK, Message: imageMsg, Details: imageDetails})

	// 3) 端口占用
	portOK, portMsg, procInfo := PortOccupation(cfg.Server.Host, cfg.Server.Port)
	details := ""
	if !portOK && procInfo != "" {
		details = procInfo
	}
	items = append(items, Item{Name: fmt.Sprintf("端口占用 (%s:%d)", cfg.Server.Host, cfg.Server.Port), OK: portOK, Message: portMsg, Details: details})

	// 4) 课程加载与完整性
	var svc *course.Service
	if cfg.Course.UseEmbed {
		svc = course.NewServiceFromFS(staticFiles, "courses")
	} else {
		svc = course.NewService(cfg.Course.Dir)
	}
	_ = svc.LoadCourses()
	coursesOK, coursesMsg := CoursesIntegrity(svc)
	items = append(items, Item{Name: "课程加载与完整性", OK: coursesOK, Message: coursesMsg})

	// 5) 服务健康
	serviceOK, serviceMsg := ServiceHealth(cfg.Server.Host, cfg.Server.Port)
	items = append(items, Item{Name: fmt.Sprintf("服务健康检查 (%s:%d)", cfg.Server.Host, cfg.Server.Port), OK: serviceOK, Message: serviceMsg})

	ok := true
	for _, it := range items {
		if !it.OK {
			ok = false
		}
	}
	return Summary{OK: ok, Items: items}
}

// DockerEnv 检查 Docker 是否可用
func DockerEnv() (bool, string) {
	controller, err := docker.NewController()
	if err != nil {
		return false, fmt.Sprintf("Docker 不可用：%v", err)
	}
	_ = controller.Close()
	return true, "Docker 客户端与守护进程连接正常"
}

// PortOccupation 检查端口占用
func PortOccupation(host string, port int) (bool, string, string) {
	addr := net.JoinHostPort(host, strconv.Itoa(port))
	conn, err := net.DialTimeout("tcp", addr, 800*time.Millisecond)
	if err != nil {
		return true, "端口未被占用，可用", ""
	}
	_ = conn.Close()

	if IsPortUsedByCurrentService(host, port) {
		return true, "端口被本服务使用（正常）", ""
	}

	procInfo, lerr := ListPortProcesses(port)
	if lerr != nil {
		return false, "端口已被占用（进程信息获取失败，可能未安装 lsof）", ""
	}
	if procInfo == "" {
		return false, "端口已被占用（但未能获取到进程信息）", ""
	}
	return false, "端口已被占用", procInfo
}

// IsPortUsedByCurrentService 通过 /health 识别是否为本服务
func IsPortUsedByCurrentService(host string, port int) bool {
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
	var payload struct{ Status, Message string }
	if err := json.NewDecoder(resp.Body).Decode(&payload); err != nil {
		return false
	}
	return strings.ToLower(payload.Status) == "ok" && strings.Contains(payload.Message, "KWDB Playground")
}

// ListPortProcesses 使用 lsof 列出监听进程（最佳努力）
func ListPortProcesses(port int) (string, error) {
	cmd := exec.Command("lsof", "-i", fmt.Sprintf(":%d", port), "-sTCP:LISTEN", "-n", "-P")
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()
	cmd = exec.CommandContext(ctx, cmd.Path, cmd.Args[1:]...)
	out, _ := cmd.CombinedOutput()
	if ctx.Err() == context.DeadlineExceeded {
		return "", fmt.Errorf("查询端口占用超时")
	}
	if len(out) == 0 {
		return "", nil
	}
	return string(out), nil
}

// CoursesIntegrity 基础完整性检查
func CoursesIntegrity(svc *course.Service) (bool, string) {
	courses := svc.GetCourses()
	if len(courses) == 0 {
		return false, "未找到任何课程，请检查课程目录或嵌入资源"
	}
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
		return false, "课程加载成功，但存在数据完整性问题：\n" + strings.Join(problems, "\n")
	}
	return true, fmt.Sprintf("课程加载成功，共 %d 门，数据完整性检查通过", len(courses))
}

// ServiceHealth 调用 /health 检查服务状态
func ServiceHealth(host string, port int) (bool, string) {
	addr := net.JoinHostPort(host, strconv.Itoa(port))
	conn, err := net.DialTimeout("tcp", addr, 800*time.Millisecond)
	if err != nil {
		return true, "服务未运行"
	}
	_ = conn.Close()

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

func ImageSourcesAvailability() (bool, string, string) {
	type registry struct {
		label string
		url   string
	}

	registries := []registry{
		{label: "Docker Hub", url: "https://registry-1.docker.io/v2/"},
		{label: "ghcr.io", url: "https://ghcr.io/v2/"},
		{label: "Aliyun ACR", url: "https://registry.cn-hangzhou.aliyuncs.com/v2/"},
	}

	type probeResult struct {
		label      string
		url        string
		statusCode int
		ok         bool
		err        error
	}

	results := make([]probeResult, 0, len(registries))
	for _, r := range registries {
		code, ok, err := probeRegistryV2(r.url)
		results = append(results, probeResult{
			label:      r.label,
			url:        r.url,
			statusCode: code,
			ok:         ok,
			err:        err,
		})
	}

	okCount := 0
	lines := make([]string, 0, len(results))
	available := make([]string, 0, len(results))
	unavailable := make([]string, 0, len(results))
	for _, r := range results {
		if r.ok {
			okCount++
			available = append(available, r.label)
			lines = append(lines, fmt.Sprintf("%s: 可用", r.label))
		} else {
			unavailable = append(unavailable, r.label)
			if r.statusCode > 0 {
				lines = append(lines, fmt.Sprintf("%s: 不可用（HTTP %d）", r.label, r.statusCode))
			} else if r.err != nil {
				lines = append(lines, fmt.Sprintf("%s: 不可用（%v）", r.label, r.err))
			} else {
				lines = append(lines, fmt.Sprintf("%s: 不可用", r.label))
			}
		}
	}

	if okCount == 0 {
		return false, "未检测到可用镜像源（至少需要一个可访问的 registry）", strings.Join(lines, "\n")
	}

	msg := ""
	if len(unavailable) == 0 {
		msg = fmt.Sprintf("镜像源可用（%d/%d）", okCount, len(results))
	} else {
		msg = fmt.Sprintf("可用：%s；不可用：%s", strings.Join(available, ", "), strings.Join(unavailable, ", "))
	}
	return true, msg, strings.Join(lines, "\n")
}

func probeRegistryV2(url string) (int, bool, error) {
	client := &http.Client{Timeout: 2 * time.Second}
	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return 0, false, err
	}
	req.Header.Set("User-Agent", "kwdb-playground-check")
	resp, err := client.Do(req)
	if err != nil {
		return 0, false, err
	}
	defer resp.Body.Close()

	_, _ = io.Copy(io.Discard, io.LimitReader(resp.Body, 1024))
	if resp.StatusCode >= 500 {
		return resp.StatusCode, false, nil
	}
	return resp.StatusCode, true, nil
}
