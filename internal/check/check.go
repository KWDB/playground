package check

import (
	"context"
	"embed"
	"encoding/json"
	"fmt"
	"io"
	"net"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"sort"
	"strconv"
	"strings"
	"time"

	"kwdb-playground/internal/config"
	"kwdb-playground/internal/course"
	"kwdb-playground/internal/docker"
)

const (
	minDockerAPIVersion    = "1.41"
	minDockerEngineVersion = "20.10"
	progressFilePath       = "data/progress.json"
	processPIDFilePath     = "tmp/kwdb-playground.pid"
	ItemNameDockerEnv      = "Docker 环境"
	ItemNameImageSources   = "镜像源可用性"
	ItemNameCourses        = "课程加载与完整性"
	ItemNameProgress       = "进度文件"
	ItemNameProcessFile    = "进程文件 (tmp/kwdb-playground.pid)"
	ItemNameExecutablePath = "程序可执行文件位置"
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
	var svc *course.Service
	if cfg.Course.UseEmbed {
		svc = course.NewServiceFromFS(staticFiles, "courses")
	} else {
		svc = course.NewService(cfg.Course.Dir)
	}
	_ = svc.LoadCourses()
	return RunFromService(svc, cfg.Server.Host, cfg.Server.Port)
}

func RunFromService(svc *course.Service, host string, port int) Summary {
	items := make([]Item, 0, 8)

	dockerOK, dockerMsg, dockerDetails := DockerEnv()
	items = append(items, Item{Name: ItemNameDockerEnv, OK: dockerOK, Message: dockerMsg, Details: dockerDetails})

	imageOK, imageMsg, imageDetails := ImageSourcesAvailability()
	items = append(items, Item{Name: ItemNameImageSources, OK: imageOK, Message: imageMsg, Details: imageDetails})

	portOK, portMsg, procInfo := PortOccupation(host, port)
	details := ""
	if !portOK && procInfo != "" {
		details = procInfo
	}
	items = append(items, Item{Name: fmt.Sprintf("端口占用 (%s:%d)", host, port), OK: portOK, Message: portMsg, Details: details})

	coursesOK, coursesMsg := CoursesIntegrity(svc)
	items = append(items, Item{Name: ItemNameCourses, OK: coursesOK, Message: coursesMsg})

	progressOK, progressMsg, progressDetails := ProgressStoreHealth(svc, progressFilePath)
	items = append(items, Item{Name: ItemNameProgress, OK: progressOK, Message: progressMsg, Details: progressDetails})

	processOK, processMsg, processDetails := ProcessFileHealth(processPIDFilePath)
	items = append(items, Item{Name: ItemNameProcessFile, OK: processOK, Message: processMsg, Details: processDetails})

	exeOK, exeMsg, exeDetails := ExecutablePathHealth(processPIDFilePath, host, port)
	items = append(items, Item{Name: ItemNameExecutablePath, OK: exeOK, Message: exeMsg, Details: exeDetails})

	serviceOK, serviceMsg := ServiceHealth(host, port)
	items = append(items, Item{Name: fmt.Sprintf("服务健康检查 (%s:%d)", host, port), OK: serviceOK, Message: serviceMsg})

	ok := true
	for _, it := range items {
		if !it.OK {
			ok = false
		}
	}
	return Summary{OK: ok, Items: items}
}

func DockerEnv() (bool, string, string) {
	controller, err := docker.NewController()
	if err != nil {
		return false, fmt.Sprintf("Docker 不可用：%v", err), fmt.Sprintf("最低要求 Docker API v%s（Docker Engine %s+）", minDockerAPIVersion, minDockerEngineVersion)
	}
	_ = controller.Close()

	apiVersion, err := docker.DetectServerAPIVersion()
	if err != nil {
		return true, "Docker 客户端与守护进程连接正常（未获取到 API 版本）", fmt.Sprintf("最低要求 Docker API v%s（Docker Engine %s+），请手动执行 docker version 确认", minDockerAPIVersion, minDockerEngineVersion)
	}

	cmp, err := compareAPIVersion(apiVersion, minDockerAPIVersion)
	if err != nil {
		return true, fmt.Sprintf("Docker 客户端与守护进程连接正常（API 版本解析失败：%s）", apiVersion), fmt.Sprintf("最低要求 Docker API v%s（Docker Engine %s+），请手动执行 docker version 确认", minDockerAPIVersion, minDockerEngineVersion)
	}
	if cmp < 0 {
		return false,
			fmt.Sprintf("Docker API 版本过低：当前 v%s，最低要求 v%s", apiVersion, minDockerAPIVersion),
			fmt.Sprintf("请升级 Docker Engine 至 %s+，再重试", minDockerEngineVersion)
	}
	return true, fmt.Sprintf("Docker 客户端与守护进程连接正常（API v%s，要求 ≥ v%s）", apiVersion, minDockerAPIVersion), ""
}

func compareAPIVersion(current, minimum string) (int, error) {
	parse := func(v string) (int, int, error) {
		parts := strings.Split(strings.TrimSpace(v), ".")
		if len(parts) != 2 {
			return 0, 0, fmt.Errorf("invalid version: %s", v)
		}
		major, err := strconv.Atoi(parts[0])
		if err != nil {
			return 0, 0, fmt.Errorf("invalid major version: %w", err)
		}
		minor, err := strconv.Atoi(parts[1])
		if err != nil {
			return 0, 0, fmt.Errorf("invalid minor version: %w", err)
		}
		return major, minor, nil
	}

	curMajor, curMinor, err := parse(current)
	if err != nil {
		return 0, err
	}
	minMajor, minMinor, err := parse(minimum)
	if err != nil {
		return 0, err
	}

	if curMajor > minMajor {
		return 1, nil
	}
	if curMajor < minMajor {
		return -1, nil
	}
	if curMinor > minMinor {
		return 1, nil
	}
	if curMinor < minMinor {
		return -1, nil
	}
	return 0, nil
}

// PortOccupation 检查端口占用
func PortOccupation(host string, port int) (bool, string, string) {
	addr := net.JoinHostPort(host, strconv.Itoa(port))
	conn, err := net.DialTimeout("tcp", addr, 800*time.Millisecond)
	if err != nil {
		return true, "端口未被占用，可用", ""
	}
	_ = conn.Close()

	// 先尝试通过进程名判断是否为 kwdb-playground
	procInfo, lerr := ListPortProcesses(port)
	if lerr == nil && procInfo != "" {
		// 检查进程名是否包含 kwdb-playground
		if strings.Contains(procInfo, "kwdb-playground") || strings.Contains(procInfo, "kwdb") {
			return true, "服务已启动（kwdb-playground）", ""
		}
	}

	// 如果不是 kwdb-playground，尝试通过 /health 端点判断
	if IsPortUsedByCurrentService(host, port) {
		return true, "端口被本服务使用（正常）", ""
	}

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
	hosts := healthProbeHosts(host)
	client := &http.Client{Timeout: 800 * time.Millisecond}
	for _, probeHost := range hosts {
		url := fmt.Sprintf("http://%s/health", net.JoinHostPort(probeHost, strconv.Itoa(port)))
		resp, err := client.Get(url)
		if err != nil {
			continue
		}
		defer resp.Body.Close()
		if resp.StatusCode != http.StatusOK {
			continue
		}
		var payload struct{ Status, Message string }
		if err := json.NewDecoder(resp.Body).Decode(&payload); err != nil {
			continue
		}
		if strings.ToLower(payload.Status) == "ok" && strings.Contains(payload.Message, "KWDB Playground") {
			return true
		}
	}
	return false
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
	if svc == nil {
		return false, "课程服务未初始化"
	}
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

func ProgressStoreHealth(svc *course.Service, path string) (bool, string, string) {
	if svc == nil {
		return false, "课程服务未初始化", ""
	}
	if _, err := os.Stat("data"); err != nil {
		if os.IsNotExist(err) {
			return false, "data 目录不存在", "请执行 doctor --fix --fix-scope progress 自动创建并初始化 progress.json"
		}
		return false, fmt.Sprintf("访问 data 目录失败：%v", err), ""
	}
	if _, err := os.Stat(path); err != nil {
		if os.IsNotExist(err) {
			return false, "progress.json 不存在", "请执行 doctor --fix --fix-scope progress 自动创建标准文件"
		}
		return false, fmt.Sprintf("访问 progress.json 失败：%v", err), ""
	}
	file, err := os.OpenFile(path, os.O_APPEND|os.O_WRONLY, 0644)
	if err != nil {
		return false, fmt.Sprintf("progress.json 不可写：%v", err), ""
	}
	_ = file.Close()

	raw, err := os.ReadFile(path)
	if err != nil {
		return false, fmt.Sprintf("读取 progress.json 失败：%v", err), ""
	}
	if len(strings.TrimSpace(string(raw))) == 0 {
		return false, "progress.json 为空", "请执行 doctor --fix --fix-scope progress 自动重建文件"
	}

	var store course.ProgressStore
	if err := json.Unmarshal(raw, &store); err != nil {
		return false, fmt.Sprintf("progress.json JSON 解析失败：%v", err), "请执行 doctor --fix --fix-scope progress 自动备份并重建"
	}
	issues := make([]string, 0)
	if strings.TrimSpace(store.Version) == "" {
		issues = append(issues, "version 为空")
	}
	if store.Progress == nil {
		issues = append(issues, "progress 字段缺失或非对象")
	}
	courses := svc.GetCourses()
	keys := make([]string, 0, len(store.Progress))
	for key := range store.Progress {
		keys = append(keys, key)
	}
	sort.Strings(keys)
	for _, key := range keys {
		p := store.Progress[key]
		if strings.TrimSpace(p.CourseID) == "" {
			issues = append(issues, fmt.Sprintf("%s: course_id 为空", key))
			continue
		}
		c, exists := courses[p.CourseID]
		if !exists {
			issues = append(issues, fmt.Sprintf("%s: 课程不存在 (%s)", key, p.CourseID))
			continue
		}
		maxStep := len(c.Details.Steps) - 1
		if p.CurrentStep < 0 || (maxStep >= 0 && p.CurrentStep > maxStep) {
			issues = append(issues, fmt.Sprintf("%s: current_step 越界 (%d, 最大 %d)", key, p.CurrentStep, maxStep))
		}
		if p.Completed && p.CompletedAt == nil {
			issues = append(issues, fmt.Sprintf("%s: completed=true 但 completed_at 缺失", key))
		}
		if !p.Completed && p.CompletedAt != nil {
			issues = append(issues, fmt.Sprintf("%s: completed=false 但 completed_at 非空", key))
		}
	}
	if len(issues) > 0 {
		return false, fmt.Sprintf("progress.json 存在 %d 个问题", len(issues)), strings.Join(issues, "\n")
	}
	return true, fmt.Sprintf("progress.json 校验通过，共 %d 条进度记录", len(store.Progress)), ""
}

func ProcessFileHealth(pidFilePath string) (bool, string, string) {
	pidAbs, pidAbsErr := filepath.Abs(pidFilePath)
	if pidAbsErr != nil {
		pidAbs = pidFilePath
	}
	baseDetails := []string{
		fmt.Sprintf("PID 文件路径: %s", pidAbs),
	}

	info, err := os.Stat(pidFilePath)
	if err != nil {
		if os.IsNotExist(err) {
			return true, "PID 文件不存在（服务未以守护进程运行或尚未启动）", strings.Join(baseDetails, "\n")
		}
		return false, fmt.Sprintf("访问 PID 文件失败：%v", err), strings.Join(baseDetails, "\n")
	}
	if info.IsDir() {
		return false, "PID 路径异常：当前位置是目录而非文件", strings.Join(baseDetails, "\n")
	}

	content, err := os.ReadFile(pidFilePath)
	if err != nil {
		return false, fmt.Sprintf("读取 PID 文件失败：%v", err), strings.Join(baseDetails, "\n")
	}
	pidText := strings.TrimSpace(string(content))
	if pidText == "" {
		return false, "PID 文件为空", strings.Join(baseDetails, "\n")
	}
	pid, err := strconv.Atoi(pidText)
	if err != nil || pid <= 0 {
		return false, fmt.Sprintf("PID 文件内容非法：%q", pidText), strings.Join(baseDetails, "\n")
	}
	baseDetails = append(baseDetails, fmt.Sprintf("PID 文件内容: %d", pid))
	return true, fmt.Sprintf("PID 文件格式正常（PID=%d）", pid), strings.Join(baseDetails, "\n")
}

func ExecutablePathHealth(pidFilePath, host string, port int) (bool, string, string) {
	pidAbs, pidAbsErr := filepath.Abs(pidFilePath)
	if pidAbsErr != nil {
		pidAbs = pidFilePath
	}
	raw, err := os.ReadFile(pidFilePath)
	pid := 0
	pidSource := ""
	if err == nil {
		pidText := strings.TrimSpace(string(raw))
		if parsed, parseErr := strconv.Atoi(pidText); parseErr == nil && parsed > 0 {
			pid = parsed
			pidSource = "PID 文件"
		}
	}
	if pid == 0 {
		listenPID, source, findErr := resolveRunningPIDByPort(port)
		if findErr != nil {
			currentExe, currentExeSource := resolveCurrentExecutablePath()
			return true, "未检测到运行中的 kwdb-playground 进程", fmt.Sprintf("PID 文件路径: %s\n监听地址: %s:%d\n程序可执行文件: %s\n定位来源: %s", pidAbs, host, port, currentExe, currentExeSource)
		}
		pid = listenPID
		pidSource = source
	}

	exePath, source, resolveErr := resolveRunningExecutableByPID(pid)
	if resolveErr != nil {
		return false, fmt.Sprintf("无法定位 PID=%d 的可执行文件：%v", pid, resolveErr), fmt.Sprintf("PID 文件路径: %s\nPID: %d\nPID 来源: %s", pidAbs, pid, pidSource)
	}
	return true, "已定位运行中 kwdb-playground 的可执行文件", fmt.Sprintf("PID 文件路径: %s\nPID: %d\nPID 来源: %s\n程序可执行文件: %s\n定位来源: %s", pidAbs, pid, pidSource, exePath, source)
}

func resolveCurrentExecutablePath() (string, string) {
	exe, err := os.Executable()
	if err == nil && strings.TrimSpace(exe) != "" {
		if abs, absErr := filepath.Abs(exe); absErr == nil {
			return abs, "os.Executable"
		}
		return exe, "os.Executable"
	}
	if len(os.Args) > 0 && strings.TrimSpace(os.Args[0]) != "" {
		if filepath.IsAbs(os.Args[0]) {
			return os.Args[0], "os.Args[0]"
		}
		if found, lookErr := exec.LookPath(os.Args[0]); lookErr == nil {
			return found, "os.Args[0] + PATH 解析"
		}
		return os.Args[0], "os.Args[0]（原始）"
	}
	return "unknown", "fallback"
}

func resolveRunningExecutableByPID(pid int) (string, string, error) {
	pidStr := strconv.Itoa(pid)
	lsofCmd := exec.Command("lsof", "-p", pidStr, "-Fn", "-a", "-d", "txt")
	if out, err := lsofCmd.CombinedOutput(); err == nil {
		for _, line := range strings.Split(string(out), "\n") {
			line = strings.TrimSpace(line)
			if strings.HasPrefix(line, "n") && len(line) > 1 {
				return strings.TrimSpace(line[1:]), "lsof -d txt", nil
			}
		}
	}

	psCmd := exec.Command("ps", "-p", pidStr, "-o", "command=")
	out, err := psCmd.CombinedOutput()
	if err != nil {
		return "", "", fmt.Errorf("ps 查询失败: %v", err)
	}
	cmdline := strings.TrimSpace(string(out))
	if cmdline == "" {
		return "", "", fmt.Errorf("目标进程不存在或无命令行信息")
	}
	fields := strings.Fields(cmdline)
	if len(fields) == 0 {
		return "", "", fmt.Errorf("命令行为空")
	}
	exe := fields[0]
	if filepath.IsAbs(exe) {
		return exe, "ps -o command", nil
	}
	found, lookErr := exec.LookPath(exe)
	if lookErr == nil {
		return found, "ps -o command + PATH 解析", nil
	}
	return exe, "ps -o command（原始）", nil
}

func resolveRunningPIDByPort(port int) (int, string, error) {
	out, err := exec.Command("lsof", "-i", fmt.Sprintf(":%d", port), "-sTCP:LISTEN", "-n", "-P", "-Fp", "-Fc").CombinedOutput()
	if err != nil {
		return 0, "", fmt.Errorf("lsof 查询监听进程失败: %v", err)
	}
	pid, cmd := parseListenerPIDAndCommand(string(out))
	if pid <= 0 {
		return 0, "", fmt.Errorf("未在端口 %d 上发现监听进程", port)
	}
	if strings.Contains(strings.ToLower(cmd), "kwdb") {
		return pid, "监听端口进程（kwdb）", nil
	}
	return pid, fmt.Sprintf("监听端口进程（%s）", cmd), nil
}

func parseListenerPIDAndCommand(raw string) (int, string) {
	lines := strings.Split(raw, "\n")
	currentPID := 0
	currentCmd := ""
	fallbackPID := 0
	fallbackCmd := ""
	for _, line := range lines {
		line = strings.TrimSpace(line)
		if strings.HasPrefix(line, "p") && len(line) > 1 {
			if currentPID > 0 {
				if strings.Contains(strings.ToLower(currentCmd), "kwdb") {
					return currentPID, currentCmd
				}
				if fallbackPID == 0 {
					fallbackPID, fallbackCmd = currentPID, currentCmd
				}
			}
			p, err := strconv.Atoi(strings.TrimSpace(line[1:]))
			if err != nil || p <= 0 {
				currentPID = 0
				currentCmd = ""
				continue
			}
			currentPID = p
			currentCmd = ""
			continue
		}
		if strings.HasPrefix(line, "c") && len(line) > 1 {
			currentCmd = strings.TrimSpace(line[1:])
		}
	}
	if currentPID > 0 {
		if strings.Contains(strings.ToLower(currentCmd), "kwdb") {
			return currentPID, currentCmd
		}
		if fallbackPID == 0 {
			return currentPID, currentCmd
		}
	}
	return fallbackPID, fallbackCmd
}

// ServiceHealth 调用 /health 检查服务状态
func ServiceHealth(host string, port int) (bool, string) {
	addr := net.JoinHostPort(host, strconv.Itoa(port))
	conn, err := net.DialTimeout("tcp", addr, 800*time.Millisecond)
	if err != nil {
		return true, "服务未运行"
	}
	_ = conn.Close()
	probeHosts := healthProbeHosts(host)

	// 检查是否有 kwdb-playground 进程在运行
	procInfo, lerr := ListPortProcesses(port)
	if lerr == nil && procInfo != "" && (strings.Contains(procInfo, "kwdb-playground") || strings.Contains(procInfo, "kwdb")) {
		statusCode, usedHost, probeErr := probeHealthStatus(probeHosts, port, 2*time.Second)
		if probeErr != nil {
			return true, fmt.Sprintf("服务已启动（kwdb-playground 正在运行，/health 访问失败：%v）", probeErr)
		}
		if statusCode != http.StatusOK {
			return true, fmt.Sprintf("服务已启动（kwdb-playground 正在运行，/health 返回非 200：%d，探测地址 %s）", statusCode, usedHost)
		}
		return true, "服务正在运行且健康（/health 返回 200）"
	}

	statusCode, usedHost, probeErr := probeHealthStatus(probeHosts, port, 2*time.Second)
	if probeErr != nil {
		return false, fmt.Sprintf("服务已监听，但健康端点访问失败：%v", probeErr)
	}
	if statusCode != http.StatusOK {
		return false, fmt.Sprintf("服务已监听，但健康端点返回非 200 状态码：%d（探测地址 %s）", statusCode, usedHost)
	}
	return true, "服务正在运行且健康（/health 返回 200）"
}

func healthProbeHosts(host string) []string {
	h := normalizeProbeHost(host)
	hosts := make([]string, 0, 4)
	appendHost := func(candidate string) {
		candidate = normalizeProbeHost(candidate)
		if candidate == "" {
			return
		}
		for _, existing := range hosts {
			if existing == candidate {
				return
			}
		}
		hosts = append(hosts, candidate)
	}
	appendHost(h)
	if h == "" || h == "0.0.0.0" || h == "::" {
		appendHost("127.0.0.1")
		appendHost("localhost")
		appendHost("::1")
	}
	if h == "localhost" {
		appendHost("127.0.0.1")
	}
	if h == "127.0.0.1" {
		appendHost("localhost")
	}
	if len(hosts) == 0 {
		appendHost("127.0.0.1")
	}
	return hosts
}

func normalizeProbeHost(host string) string {
	trimmed := strings.TrimSpace(host)
	if strings.HasPrefix(trimmed, "[") && strings.HasSuffix(trimmed, "]") && len(trimmed) > 2 {
		return trimmed[1 : len(trimmed)-1]
	}
	return trimmed
}

func probeHealthStatus(hosts []string, port int, timeout time.Duration) (int, string, error) {
	client := &http.Client{Timeout: timeout}
	lastErr := error(nil)
	for _, probeHost := range hosts {
		url := fmt.Sprintf("http://%s/health", net.JoinHostPort(probeHost, strconv.Itoa(port)))
		resp, err := client.Get(url)
		if err != nil {
			lastErr = err
			continue
		}
		statusCode := resp.StatusCode
		_ = resp.Body.Close()
		return statusCode, probeHost, nil
	}
	if lastErr != nil {
		return 0, "", lastErr
	}
	return 0, "", fmt.Errorf("无可用探测主机")
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
