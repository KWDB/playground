package check

import (
	"embed"
	"encoding/json"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"sort"
	"strconv"
	"strings"
	"syscall"
	"time"

	"kwdb-playground/internal/config"
	"kwdb-playground/internal/course"
	dock "kwdb-playground/internal/docker"
)

type FixOptions struct {
	DryRun   bool
	FixScope string
}

type FixResult struct {
	Name    string
	Status  string
	Message string
	Details string
}

func ApplyFixes(staticFiles embed.FS, cfg *config.Config, summary Summary, opts FixOptions) ([]FixResult, error) {
	scopes, err := parseFixScope(opts.FixScope)
	if err != nil {
		return nil, err
	}
	var svc *course.Service
	if cfg.Course.UseEmbed {
		svc = course.NewServiceFromFS(staticFiles, "courses")
	} else {
		svc = course.NewService(cfg.Course.Dir)
	}
	_ = svc.LoadCourses()

	failed := make(map[string]bool, len(summary.Items))
	for _, item := range summary.Items {
		if !item.OK {
			failed[item.Name] = true
		}
	}

	results := make([]FixResult, 0, 8)
	if scopes["progress"] && failed[ItemNameProgress] {
		results = append(results, fixProgressStore(svc, progressFilePath, opts.DryRun))
	}
	if scopes["docker"] && failed[ItemNameDockerEnv] {
		results = append(results, dockerFixSuggestion(!opts.DryRun))
	}
	if scopes["image-sources"] && failed[ItemNameImageSources] {
		results = append(results, FixResult{
			Name:    ItemNameImageSources,
			Status:  "跳过",
			Message: "当前版本未启用镜像源自动修复",
			Details: "请根据镜像源检查详情切换网络、代理或镜像加速配置后重试。",
		})
	}
	if scopes["port"] && hasFailedItemByPrefix(failed, "端口占用 (") {
		results = append(results, fixPortOccupation(summary, cfg, !opts.DryRun))
	}
	if scopes["courses"] && failed[ItemNameCourses] {
		results = append(results, FixResult{
			Name:    ItemNameCourses,
			Status:  "跳过",
			Message: "当前版本未启用课程文件自动修复",
			Details: "请根据课程完整性详情修复课程目录后重试。",
		})
	}
	if scopes["process-file"] && shouldFixProcessFile(summary, failed) {
		results = append(results, fixProcessFile(cfg, processPIDFilePath, opts.DryRun))
	}
	if scopes["executable"] && shouldFixExecutable(summary, failed) {
		results = append(results, fixExecutablePath(cfg, processPIDFilePath, opts.DryRun))
	}
	if scopes["service"] && hasFailedItemByPrefix(failed, "服务健康检查 (") {
		results = append(results, FixResult{
			Name:    "服务健康检查",
			Status:  "跳过",
			Message: "当前版本未启用服务健康自动修复",
			Details: "请先启动服务并确保 /health 可访问后重试。",
		})
	}
	if len(results) == 0 {
		results = append(results, FixResult{
			Name:    "修复执行",
			Status:  "无需修复",
			Message: "未发现可修复失败项",
			Details: "",
		})
	}
	return results, nil
}

func dockerFixSuggestion(autoApply bool) FixResult {
	lines := make([]string, 0, 16)
	startAttempted := false
	startSucceeded := false
	if dockerBin, err := exec.LookPath("docker"); err == nil {
		lines = append(lines, fmt.Sprintf("本机 docker 命令: %s", dockerBin))
	} else {
		lines = append(lines, "本机 docker 命令: 未检测到，请先安装 Docker Desktop")
	}
	dockerHost := strings.TrimSpace(os.Getenv("DOCKER_HOST"))
	if dockerHost == "" {
		lines = append(lines, "DOCKER_HOST: 未设置（默认使用本机 Unix Socket）")
	} else {
		lines = append(lines, fmt.Sprintf("DOCKER_HOST: %s", dockerHost))
	}
	socketCandidates := []string{"/var/run/docker.sock"}
	if home, err := os.UserHomeDir(); err == nil && strings.TrimSpace(home) != "" {
		socketCandidates = append([]string{filepath.Join(home, ".docker/run/docker.sock")}, socketCandidates...)
	}
	for _, sock := range socketCandidates {
		if info, err := os.Stat(sock); err == nil {
			lines = append(lines, fmt.Sprintf("Socket 可访问: %s (%s)", sock, info.Mode().String()))
		} else {
			lines = append(lines, fmt.Sprintf("Socket 不可用: %s (%v)", sock, err))
		}
	}
	if autoApply {
		startAttempted = true
		if runtime.GOOS != "darwin" {
			lines = append(lines, "自动修复未执行: 当前仅支持在 macOS 尝试启动 Docker Desktop")
		} else if _, err := detectDockerDesktopApp(); err != nil {
			lines = append(lines, fmt.Sprintf("自动修复未执行: 未检测到 Docker Desktop (%v)", err))
		} else if out, err := exec.Command("open", "-a", "Docker").CombinedOutput(); err != nil {
			lines = append(lines, fmt.Sprintf("自动修复执行失败: 启动 Docker Desktop 失败 (%v)", err))
			if strings.TrimSpace(string(out)) != "" {
				lines = append(lines, fmt.Sprintf("启动输出: %s", strings.TrimSpace(string(out))))
			}
		} else {
			lines = append(lines, "已触发启动 Docker Desktop")
			startSucceeded = waitDockerReady(25 * time.Second)
			if startSucceeded {
				lines = append(lines, "Docker Desktop 已就绪并可连接")
			} else {
				lines = append(lines, "Docker Desktop 启动中或尚未就绪，请稍后重试 doctor")
			}
		}
	}
	if apiVersion, err := dock.DetectServerAPIVersion(); err == nil {
		lines = append(lines, fmt.Sprintf("Docker Server API: v%s", apiVersion))
	} else {
		lines = append(lines, fmt.Sprintf("Docker API 探测失败: %v", err))
	}
	lines = append(lines, "建议操作: 启动 Docker Desktop 并等待 Engine 就绪")
	lines = append(lines, "建议操作: 执行 docker version / docker info 确认客户端与服务端可通信")
	lines = append(lines, "建议操作: 如使用自定义 DOCKER_HOST，请检查地址与权限配置")
	result := FixResult{
		Name:    ItemNameDockerEnv,
		Status:  "跳过",
		Message: "已生成 Docker 本地诊断建议",
		Details: strings.Join(lines, "\n"),
	}
	if startAttempted {
		if startSucceeded {
			result.Status = "已修复"
			result.Message = "已尝试启动 Docker Desktop，当前已可连接"
		} else {
			result.Status = "失败"
			result.Message = "已尝试启动 Docker Desktop，但尚未就绪"
		}
	}
	return result
}

func detectDockerDesktopApp() (string, error) {
	candidates := []string{
		"/Applications/Docker.app",
		"/System/Applications/Docker.app",
	}
	if home, err := os.UserHomeDir(); err == nil && strings.TrimSpace(home) != "" {
		candidates = append(candidates, filepath.Join(home, "Applications", "Docker.app"))
	}
	for _, path := range candidates {
		if info, err := os.Stat(path); err == nil && info.IsDir() {
			return path, nil
		}
	}
	return "", fmt.Errorf("未在标准路径找到 Docker.app")
}

func waitDockerReady(timeout time.Duration) bool {
	deadline := time.Now().Add(timeout)
	for time.Now().Before(deadline) {
		if _, err := dock.DetectServerAPIVersion(); err == nil {
			return true
		}
		time.Sleep(2 * time.Second)
	}
	return false
}

func parseFixScope(raw string) (map[string]bool, error) {
	scope := strings.TrimSpace(strings.ToLower(raw))
	if scope == "" || scope == "all" {
		return map[string]bool{
			"docker":        true,
			"image-sources": true,
			"port":          true,
			"courses":       true,
			"progress":      true,
			"process-file":  true,
			"executable":    true,
			"service":       true,
		}, nil
	}
	valid := map[string]bool{
		"docker":        true,
		"image-sources": true,
		"port":          true,
		"courses":       true,
		"progress":      true,
		"process-file":  true,
		"executable":    true,
		"service":       true,
	}
	parts := strings.Split(scope, ",")
	result := map[string]bool{}
	for _, part := range parts {
		p := strings.TrimSpace(part)
		if p == "" {
			continue
		}
		if !valid[p] {
			return nil, fmt.Errorf("无效 --fix-scope: %s（可选值：docker|image-sources|port|courses|progress|process-file|executable|service|all）", p)
		}
		result[p] = true
	}
	if len(result) == 0 {
		return nil, fmt.Errorf("无效 --fix-scope: %s", raw)
	}
	return result, nil
}

func hasFailedItemByPrefix(failed map[string]bool, prefix string) bool {
	for name, isFailed := range failed {
		if isFailed && strings.HasPrefix(name, prefix) {
			return true
		}
	}
	return false
}

func shouldFixProcessFile(summary Summary, failed map[string]bool) bool {
	if failed[ItemNameProcessFile] {
		return true
	}
	processItem, processFound := findItemByName(summary, ItemNameProcessFile)
	if processFound && strings.Contains(processItem.Message, "PID 文件记录已过期") {
		return true
	}
	execItem, execFound := findItemByName(summary, ItemNameExecutablePath)
	if execFound && strings.Contains(execItem.Details, "PID 文件内容:") && strings.Contains(execItem.Details, "已过期") {
		return true
	}
	return false
}

func shouldFixExecutable(summary Summary, failed map[string]bool) bool {
	if failed[ItemNameExecutablePath] {
		return true
	}
	processItem, processFound := findItemByName(summary, ItemNameProcessFile)
	if processFound && strings.Contains(processItem.Message, "PID 文件记录已过期") {
		return true
	}
	execItem, execFound := findItemByName(summary, ItemNameExecutablePath)
	if execFound && strings.Contains(execItem.Details, "PID 文件内容:") && strings.Contains(execItem.Details, "已过期") {
		return true
	}
	return false
}

func findItemByName(summary Summary, name string) (Item, bool) {
	for _, item := range summary.Items {
		if item.Name == name {
			return item, true
		}
	}
	return Item{}, false
}

func fixPortOccupation(summary Summary, cfg *config.Config, autoApply bool) FixResult {
	portItem, ok := findFailedItemByPrefix(summary, "端口占用 (")
	if !ok {
		return FixResult{
			Name:    "端口占用",
			Status:  "跳过",
			Message: "未找到可处理的端口占用项",
		}
	}
	rawProcInfo := strings.TrimSpace(portItem.Details)
	if rawProcInfo == "" {
		if procInfo, err := ListPortProcesses(cfg.Server.Port); err == nil {
			rawProcInfo = strings.TrimSpace(procInfo)
		}
	}
	processes := parsePortProcesses(rawProcInfo)
	if !autoApply {
		lines := []string{
			fmt.Sprintf("冲突端口: %s", strings.TrimPrefix(portItem.Name, "端口占用 ")),
		}
		if len(processes) > 0 {
			lines = append(lines, "占用进程:")
			for _, p := range processes {
				lines = append(lines, fmt.Sprintf("PID=%d COMMAND=%s", p.PID, p.Command))
			}
		} else if rawProcInfo != "" {
			lines = append(lines, "占用信息:")
			lines = append(lines, rawProcInfo)
		} else {
			lines = append(lines, "占用进程信息获取失败，可使用 lsof 手动确认")
		}
		lines = append(lines, "追加 --fix --dry-run 可仅预览，不执行终止操作")
		return FixResult{
			Name:    "端口占用",
			Status:  "跳过",
			Message: "检测到端口占用进程，已给出占用明细",
			Details: strings.Join(lines, "\n"),
		}
	}
	if len(processes) == 0 {
		return FixResult{
			Name:    "端口占用",
			Status:  "失败",
			Message: "端口占用进程识别失败，无法自动终止",
			Details: rawProcInfo,
		}
	}
	actions := []string{
		fmt.Sprintf("冲突端口: %s", strings.TrimPrefix(portItem.Name, "端口占用 ")),
	}
	currentPID := os.Getpid()
	for _, p := range processes {
		if p.PID == currentPID || p.PID <= 1 {
			actions = append(actions, fmt.Sprintf("跳过 PID=%d（当前进程或系统保留进程）", p.PID))
			continue
		}
		proc, err := os.FindProcess(p.PID)
		if err != nil {
			actions = append(actions, fmt.Sprintf("处理 PID=%d 失败：%v", p.PID, err))
			continue
		}
		if err := proc.Signal(syscall.SIGTERM); err != nil {
			actions = append(actions, fmt.Sprintf("发送 SIGTERM 到 PID=%d 失败：%v", p.PID, err))
			continue
		}
		actions = append(actions, fmt.Sprintf("已发送 SIGTERM 到 PID=%d (%s)", p.PID, p.Command))
	}
	time.Sleep(1200 * time.Millisecond)
	portOK, _, _ := PortOccupation(cfg.Server.Host, cfg.Server.Port)
	if !portOK {
		for _, p := range processes {
			if p.PID == currentPID || p.PID <= 1 {
				continue
			}
			proc, err := os.FindProcess(p.PID)
			if err != nil {
				continue
			}
			if err := proc.Signal(syscall.SIGKILL); err == nil {
				actions = append(actions, fmt.Sprintf("已发送 SIGKILL 到 PID=%d (%s)", p.PID, p.Command))
			}
		}
		time.Sleep(800 * time.Millisecond)
		portOK, _, _ = PortOccupation(cfg.Server.Host, cfg.Server.Port)
	}
	if portOK {
		return FixResult{
			Name:    "端口占用",
			Status:  "已修复",
			Message: "占用进程已终止，端口已释放",
			Details: strings.Join(actions, "\n"),
		}
	}
	return FixResult{
		Name:    "端口占用",
		Status:  "失败",
		Message: "已尝试终止占用进程，但端口仍被占用",
		Details: strings.Join(actions, "\n"),
	}
}

type portProcess struct {
	PID     int
	Command string
}

func parsePortProcesses(raw string) []portProcess {
	lines := strings.Split(strings.TrimSpace(raw), "\n")
	result := make([]portProcess, 0, len(lines))
	seen := map[int]bool{}
	for _, line := range lines {
		fields := strings.Fields(line)
		if len(fields) < 2 {
			continue
		}
		if strings.EqualFold(fields[0], "COMMAND") {
			continue
		}
		pid, err := strconv.Atoi(fields[1])
		if err != nil || pid <= 0 || seen[pid] {
			continue
		}
		seen[pid] = true
		result = append(result, portProcess{
			PID:     pid,
			Command: fields[0],
		})
	}
	return result
}

func findFailedItemByPrefix(summary Summary, prefix string) (Item, bool) {
	for _, item := range summary.Items {
		if !item.OK && strings.HasPrefix(item.Name, prefix) {
			return item, true
		}
	}
	return Item{}, false
}

func fixProgressStore(svc *course.Service, path string, dryRun bool) FixResult {
	if svc == nil {
		return FixResult{Name: ItemNameProgress, Status: "失败", Message: "课程服务未初始化"}
	}
	actions := make([]string, 0, 6)
	courses := svc.GetCourses()
	if dryRun {
		actions = append(actions, "将确保 data 目录存在")
		actions = append(actions, "将备份已有 progress.json（若存在）")
		actions = append(actions, "将重建并清理异常进度记录")
		return FixResult{Name: ItemNameProgress, Status: "预览", Message: "已生成 progress 修复计划", Details: strings.Join(actions, "\n")}
	}
	if err := os.MkdirAll(filepath.Dir(path), 0755); err != nil {
		return FixResult{Name: ItemNameProgress, Status: "失败", Message: fmt.Sprintf("创建 data 目录失败：%v", err)}
	}
	actions = append(actions, "已确保 data 目录存在")
	original, readErr := os.ReadFile(path)
	if readErr == nil {
		backupPath, err := backupFile(path, original)
		if err == nil {
			actions = append(actions, fmt.Sprintf("已备份原文件：%s", backupPath))
		}
	}
	store := &course.ProgressStore{
		Version:   "1.0",
		UpdatedAt: time.Now(),
		Progress:  map[string]course.UserProgress{},
	}
	if readErr == nil && len(strings.TrimSpace(string(original))) > 0 {
		var parsed course.ProgressStore
		if err := json.Unmarshal(original, &parsed); err == nil {
			sanitized, changed := sanitizeProgressStore(&parsed, courses)
			store = sanitized
			if changed {
				actions = append(actions, "已清理并修复 progress 语义异常记录")
			}
		} else {
			actions = append(actions, "原 progress.json 解析失败，已按标准结构重建")
		}
	} else if os.IsNotExist(readErr) {
		actions = append(actions, "progress.json 不存在，已初始化标准文件")
	} else if readErr != nil {
		return FixResult{Name: ItemNameProgress, Status: "失败", Message: fmt.Sprintf("读取 progress 文件失败：%v", readErr)}
	}

	data, err := json.MarshalIndent(store, "", "  ")
	if err != nil {
		return FixResult{Name: ItemNameProgress, Status: "失败", Message: fmt.Sprintf("序列化 progress 失败：%v", err)}
	}
	if err := os.WriteFile(path, data, 0644); err != nil {
		return FixResult{Name: ItemNameProgress, Status: "失败", Message: fmt.Sprintf("写入 progress 文件失败：%v", err)}
	}
	actions = append(actions, "已写入修复后的 progress.json")
	return FixResult{Name: ItemNameProgress, Status: "已修复", Message: "progress 文件修复完成", Details: strings.Join(actions, "\n")}
}

func fixProcessFile(cfg *config.Config, path string, dryRun bool) FixResult {
	port := cfg.Server.Port
	pid, source, err := resolveRunningPIDByPort(port)
	if err != nil || pid <= 0 {
		return FixResult{
			Name:    ItemNameProcessFile,
			Status:  "失败",
			Message: "未识别到可回写的运行进程 PID",
			Details: fmt.Sprintf("PID 文件路径: %s\n监听端口: %d\n错误: %v", path, port, err),
		}
	}

	existingPID := 0
	existingRaw, readErr := os.ReadFile(path)
	if readErr == nil {
		if parsed, parseErr := strconv.Atoi(strings.TrimSpace(string(existingRaw))); parseErr == nil && parsed > 0 {
			existingPID = parsed
		}
	}

	details := []string{
		fmt.Sprintf("PID 文件路径: %s", path),
		fmt.Sprintf("监听端口: %d", port),
		fmt.Sprintf("识别到运行 PID: %d", pid),
		fmt.Sprintf("PID 来源: %s", source),
	}
	if existingPID > 0 {
		details = append(details, fmt.Sprintf("PID 文件当前值: %d", existingPID))
	} else if readErr == nil {
		details = append(details, "PID 文件当前值: 非法或为空")
	} else {
		details = append(details, fmt.Sprintf("PID 文件当前值: 不可读（%v）", readErr))
	}

	if existingPID == pid {
		return FixResult{
			Name:    ItemNameProcessFile,
			Status:  "无需修复",
			Message: "PID 文件已是最新值",
			Details: strings.Join(details, "\n"),
		}
	}

	if dryRun {
		details = append(details, fmt.Sprintf("计划写入 PID: %d", pid))
		return FixResult{
			Name:    ItemNameProcessFile,
			Status:  "预览",
			Message: "已生成 PID 文件修复计划",
			Details: strings.Join(details, "\n"),
		}
	}

	if err := os.MkdirAll(filepath.Dir(path), 0755); err != nil {
		return FixResult{
			Name:    ItemNameProcessFile,
			Status:  "失败",
			Message: fmt.Sprintf("创建 PID 目录失败：%v", err),
			Details: strings.Join(details, "\n"),
		}
	}
	if err := os.WriteFile(path, []byte(strconv.Itoa(pid)), 0644); err != nil {
		return FixResult{
			Name:    ItemNameProcessFile,
			Status:  "失败",
			Message: fmt.Sprintf("回写 PID 文件失败：%v", err),
			Details: strings.Join(details, "\n"),
		}
	}
	details = append(details, fmt.Sprintf("已回写 PID 文件: %d", pid))
	return FixResult{
		Name:    ItemNameProcessFile,
		Status:  "已修复",
		Message: "PID 文件已回写为当前运行进程",
		Details: strings.Join(details, "\n"),
	}
}

func fixExecutablePath(cfg *config.Config, pidFilePath string, dryRun bool) FixResult {
	processFix := fixProcessFile(cfg, pidFilePath, dryRun)
	healthOK, healthMsg, healthDetails := ExecutablePathHealth(pidFilePath, cfg.Server.Host, cfg.Server.Port)
	details := []string{
		fmt.Sprintf("前置修复状态: %s", processFix.Status),
		fmt.Sprintf("前置修复结果: %s", processFix.Message),
	}
	if strings.TrimSpace(processFix.Details) != "" {
		details = append(details, "前置修复详情:")
		details = append(details, processFix.Details)
	}
	details = append(details, fmt.Sprintf("路径校验结果: %s", healthMsg))
	if strings.TrimSpace(healthDetails) != "" {
		details = append(details, "路径校验详情:")
		details = append(details, healthDetails)
	}

	if dryRun {
		return FixResult{
			Name:    ItemNameExecutablePath,
			Status:  "预览",
			Message: "已生成可执行文件路径修复计划",
			Details: strings.Join(details, "\n"),
		}
	}
	if !healthOK {
		return FixResult{
			Name:    ItemNameExecutablePath,
			Status:  "失败",
			Message: "已尝试修复 PID 文件，但可执行文件路径仍不可用",
			Details: strings.Join(details, "\n"),
		}
	}
	return FixResult{
		Name:    ItemNameExecutablePath,
		Status:  "已修复",
		Message: "可执行文件路径已恢复并完成校验",
		Details: strings.Join(details, "\n"),
	}
}

func sanitizeProgressStore(store *course.ProgressStore, courses map[string]*course.Course) (*course.ProgressStore, bool) {
	if store == nil {
		return &course.ProgressStore{
			Version:   "1.0",
			UpdatedAt: time.Now(),
			Progress:  map[string]course.UserProgress{},
		}, true
	}
	changed := false
	if strings.TrimSpace(store.Version) == "" {
		store.Version = "1.0"
		changed = true
	}
	if store.Progress == nil {
		store.Progress = map[string]course.UserProgress{}
		changed = true
	}
	keys := make([]string, 0, len(store.Progress))
	for k := range store.Progress {
		keys = append(keys, k)
	}
	sort.Strings(keys)
	for _, key := range keys {
		p := store.Progress[key]
		c, exists := courses[p.CourseID]
		if !exists || strings.TrimSpace(p.CourseID) == "" {
			delete(store.Progress, key)
			changed = true
			continue
		}
		maxStep := len(c.Details.Steps) - 1
		if maxStep >= 0 {
			if p.CurrentStep < 0 {
				p.CurrentStep = 0
				changed = true
			}
			if p.CurrentStep > maxStep {
				p.CurrentStep = maxStep
				changed = true
			}
		} else if p.CurrentStep != 0 {
			p.CurrentStep = 0
			changed = true
		}
		if p.Completed && p.CompletedAt == nil {
			now := time.Now()
			p.CompletedAt = &now
			changed = true
		}
		if !p.Completed && p.CompletedAt != nil {
			p.CompletedAt = nil
			changed = true
		}
		store.Progress[key] = p
	}
	store.UpdatedAt = time.Now()
	return store, changed
}

func backupFile(path string, content []byte) (string, error) {
	backup := fmt.Sprintf("%s.bak.%s", path, time.Now().Format("20060102150405"))
	if err := os.WriteFile(backup, content, 0644); err != nil {
		return "", err
	}
	return backup, nil
}
