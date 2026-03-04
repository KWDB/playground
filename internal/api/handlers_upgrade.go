package api

import (
	"bufio"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"sort"
	"strings"
	"time"

	"kwdb-playground/internal/config"

	"github.com/gin-gonic/gin"
	"github.com/moby/moby/api/types/container"
	"github.com/moby/moby/api/types/network"
	"github.com/moby/moby/client"
)

type githubAsset struct {
	Name               string `json:"name"`
	BrowserDownloadURL string `json:"browser_download_url"`
}

type githubRelease struct {
	TagName string        `json:"tag_name"`
	Assets  []githubAsset `json:"assets"`
}

type upgradeCheckResponse struct {
	CurrentVersion string `json:"currentVersion"`
	LatestVersion  string `json:"latestVersion"`
	HasUpdate      bool   `json:"hasUpdate"`
	CanUpgrade     bool   `json:"canUpgrade"`
	Message        string `json:"message"`
	DockerDeploy   bool   `json:"dockerDeploy"`
}

func (h *Handler) setUpgradeInProgress(value bool) {
	h.upgradeMu.Lock()
	defer h.upgradeMu.Unlock()
	h.upgradeInProgress = value
}

func (h *Handler) upgrade(c *gin.Context) {
	h.upgradeMu.Lock()
	if h.upgradeInProgress {
		h.upgradeMu.Unlock()
		c.JSON(http.StatusConflict, gin.H{"error": "升级进行中，请稍后再试"})
		return
	}
	h.upgradeInProgress = true
	h.upgradeMu.Unlock()

	if isDockerDeploy() {
		h.upgradeDocker(c)
		return
	}

	if runtime.GOOS == "windows" {
		h.setUpgradeInProgress(false)
		c.JSON(http.StatusConflict, gin.H{"error": "Windows 暂不支持在线升级"})
		return
	}

	currentVersion := strings.TrimPrefix(config.Version, "v")
	if currentVersion == "dev" {
		h.setUpgradeInProgress(false)
		c.JSON(http.StatusConflict, gin.H{"error": "开发模式不支持在线升级"})
		return
	}

	exePath, err := resolveExecutablePath()
	if err != nil {
		h.setUpgradeInProgress(false)
		c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("获取当前可执行文件失败: %v", err)})
		return
	}

	if isBrewInstall(exePath) {
		if !isBrewAvailable() {
			h.setUpgradeInProgress(false)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "检测到 Homebrew 安装，但未找到 brew 命令"})
			return
		}

		startArgs := resolveStartArgs()
		c.JSON(http.StatusAccepted, gin.H{
			"message":        "已触发 Homebrew 升级，服务即将重启",
			"currentVersion": currentVersion,
		})

		go func() {
			defer func() {
				if r := recover(); r != nil {
					h.logger.Error("升级过程异常: %v", r)
					h.setUpgradeInProgress(false)
				}
			}()

			time.Sleep(800 * time.Millisecond)

			upgradeCtx, cancelUpgrade := context.WithTimeout(context.Background(), 10*time.Minute)
			defer cancelUpgrade()

			if err := performBrewUpgrade(upgradeCtx, startArgs, os.Environ()); err != nil {
				h.logger.Error("Homebrew 升级失败: %v", err)
				h.setUpgradeInProgress(false)
				return
			}

			time.Sleep(800 * time.Millisecond)
			os.Exit(0)
		}()
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 10*time.Second)
	defer cancel()

	release, err := fetchLatestRelease(ctx)
	if err != nil {
		h.setUpgradeInProgress(false)
		c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("获取最新版本失败: %v", err)})
		return
	}

	latestVersion := strings.TrimPrefix(release.TagName, "v")
	if latestVersion == "" {
		h.setUpgradeInProgress(false)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "最新版本号为空"})
		return
	}

	if currentVersion == latestVersion {
		h.setUpgradeInProgress(false)
		c.JSON(http.StatusOK, gin.H{
			"message":        "当前已是最新版本",
			"currentVersion": currentVersion,
			"latestVersion":  latestVersion,
		})
		return
	}

	osName, archName, ext, err := resolveRuntimeTarget()
	if err != nil {
		h.setUpgradeInProgress(false)
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	assetName := fmt.Sprintf("kwdb-playground-%s-%s%s", osName, archName, ext)
	downloadURL, err := findAssetDownloadURL(release, assetName)
	if err != nil {
		h.setUpgradeInProgress(false)
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	startArgs := resolveStartArgs()

	c.JSON(http.StatusAccepted, gin.H{
		"message":        "升级已开始，服务即将重启",
		"currentVersion": currentVersion,
		"latestVersion":  latestVersion,
	})

	go func() {
		defer func() {
			if r := recover(); r != nil {
				h.logger.Error("升级过程异常: %v", r)
				h.setUpgradeInProgress(false)
			}
		}()

		time.Sleep(800 * time.Millisecond)

		upgradeCtx, cancelUpgrade := context.WithTimeout(context.Background(), 5*time.Minute)
		defer cancelUpgrade()

		if err := performUpgrade(upgradeCtx, downloadURL, exePath, startArgs, os.Environ()); err != nil {
			h.logger.Error("升级失败: %v", err)
			h.setUpgradeInProgress(false)
			return
		}

		time.Sleep(800 * time.Millisecond)
		os.Exit(0)
	}()
}

func isDockerDeploy() bool {
	return strings.EqualFold(os.Getenv("DOCKER_DEPLOY"), "true") || os.Getenv("DOCKER_DEPLOY") == "1"
}

func resolveExecutablePath() (string, error) {
	exePath, err := os.Executable()
	if err != nil {
		return "", err
	}
	if resolved, err := filepath.EvalSymlinks(exePath); err == nil {
		exePath = resolved
	}
	return exePath, nil
}

func resolveStartArgs() []string {
	startArgs := os.Args[1:]
	if len(startArgs) == 0 {
		startArgs = []string{"start", "--no-daemon"}
	}
	if os.Getenv("DAEMON_MODE") == "1" {
		startArgs = []string{"start", "--daemon", "--no-open"}
	}
	return startArgs
}

func withUpgradeRestartEnv(env []string) []string {
	envKey := "KWDB_UPGRADE_RESTART"
	envPrefix := envKey + "="
	merged := make([]string, 0, len(env)+1)
	for _, item := range env {
		if strings.HasPrefix(item, envPrefix) {
			continue
		}
		merged = append(merged, item)
	}
	return append(merged, envPrefix+"1")
}

func isBrewInstall(exePath string) bool {
	return strings.Contains(exePath, "/Cellar/kwdb-playground/")
}

func isBrewAvailable() bool {
	_, err := exec.LookPath("brew")
	return err == nil
}

func performBrewUpgrade(ctx context.Context, startArgs []string, env []string) error {
	cmd := exec.CommandContext(ctx, "brew", "upgrade", "kwdb-playground")
	cmd.Env = env
	if err := cmd.Run(); err != nil {
		return err
	}

	startCmd := exec.Command("kwdb-playground", startArgs...)
	startCmd.Env = withUpgradeRestartEnv(env)
	if err := startCmd.Start(); err != nil {
		return fmt.Errorf("启动新版本失败: %w", err)
	}
	return nil
}

func (h *Handler) checkUpgrade(c *gin.Context) {
	currentVersion := strings.TrimPrefix(config.Version, "v")
	if currentVersion == "" {
		currentVersion = "dev"
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 10*time.Second)
	defer cancel()

	release, err := fetchLatestRelease(ctx)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("获取最新版本失败: %v", err)})
		return
	}

	latestVersion := strings.TrimPrefix(release.TagName, "v")
	if latestVersion == "" {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "最新版本号为空"})
		return
	}

	resp := upgradeCheckResponse{
		CurrentVersion: currentVersion,
		LatestVersion:  latestVersion,
		DockerDeploy:   isDockerDeploy(),
	}
	resp.HasUpdate = currentVersion != latestVersion

	if currentVersion == "dev" {
		resp.CanUpgrade = false
		if resp.HasUpdate {
			resp.Message = fmt.Sprintf("发现新版本 v%s（开发模式仅提示）", latestVersion)
		} else {
			resp.Message = "当前已是最新版本"
		}
		c.JSON(http.StatusOK, resp)
		return
	}

	if runtime.GOOS == "windows" {
		resp.CanUpgrade = false
		if resp.HasUpdate {
			resp.Message = fmt.Sprintf("发现新版本 v%s（Windows 暂不支持在线升级）", latestVersion)
		} else {
			resp.Message = "当前已是最新版本"
		}
		c.JSON(http.StatusOK, resp)
		return
	}

	if resp.HasUpdate {
		if exePath, err := resolveExecutablePath(); err == nil && isBrewInstall(exePath) {
			if isBrewAvailable() {
				resp.CanUpgrade = true
				resp.Message = fmt.Sprintf("发现新版本 v%s，可通过 Homebrew 升级", latestVersion)
			} else {
				resp.CanUpgrade = false
				resp.Message = fmt.Sprintf("发现新版本 v%s，但未检测到 brew 命令", latestVersion)
			}
			c.JSON(http.StatusOK, resp)
			return
		}
	}

	if currentVersion == latestVersion {
		resp.CanUpgrade = false
		resp.Message = "当前已是最新版本"
		c.JSON(http.StatusOK, resp)
		return
	}

	resp.CanUpgrade = true
	resp.Message = fmt.Sprintf("发现新版本 v%s，可执行升级", latestVersion)
	c.JSON(http.StatusOK, resp)
}

func (h *Handler) upgradeDocker(c *gin.Context) {
	if runtime.GOOS == "windows" {
		h.setUpgradeInProgress(false)
		c.JSON(http.StatusConflict, gin.H{"error": "Windows 暂不支持 Docker 在线升级"})
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 20*time.Second)
	defer cancel()

	cli, err := client.NewClientWithOpts(client.FromEnv, client.WithAPIVersionNegotiation())
	if err != nil {
		h.setUpgradeInProgress(false)
		c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("连接 Docker 失败: %v", err)})
		return
	}
	defer cli.Close()

	hostname, err := os.Hostname()
	if err != nil {
		h.setUpgradeInProgress(false)
		c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("获取容器标识失败: %v", err)})
		return
	}

	inspectResult, err := cli.ContainerInspect(ctx, hostname, client.ContainerInspectOptions{})
	if err != nil {
		h.setUpgradeInProgress(false)
		c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("读取容器信息失败: %v", err)})
		return
	}

	inspect := inspectResult.Container

	if inspect.Config == nil || inspect.HostConfig == nil {
		h.setUpgradeInProgress(false)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "容器配置不完整，无法升级"})
		return
	}

	imageName := strings.TrimSpace(inspect.Config.Image)
	if imageName == "" {
		h.setUpgradeInProgress(false)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "当前镜像名为空，无法升级"})
		return
	}

	helperImage := "docker:27-cli"
	if err := pullDockerImage(ctx, cli, helperImage); err != nil {
		h.setUpgradeInProgress(false)
		c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("准备升级工具失败: %v", err)})
		return
	}

	script, err := buildDockerUpgradeScript(inspect)
	if err != nil {
		h.setUpgradeInProgress(false)
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	helperName := fmt.Sprintf("kwdb-playground-upgrader-%d", time.Now().Unix())
	helperConfig := &container.Config{
		Image: helperImage,
		Cmd:   []string{"/bin/sh", "-c", script},
	}
	helperHost := &container.HostConfig{
		Binds:      []string{"/var/run/docker.sock:/var/run/docker.sock"},
		AutoRemove: true,
	}
	helperNet := &network.NetworkingConfig{}

	helperResp, err := cli.ContainerCreate(ctx, client.ContainerCreateOptions{
		Name:             helperName,
		Config:           helperConfig,
		HostConfig:       helperHost,
		NetworkingConfig: helperNet,
	})
	if err != nil {
		h.setUpgradeInProgress(false)
		c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("创建升级任务失败: %v", err)})
		return
	}

	if _, err := cli.ContainerStart(ctx, helperResp.ID, client.ContainerStartOptions{}); err != nil {
		h.setUpgradeInProgress(false)
		c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("启动升级任务失败: %v", err)})
		return
	}

	time.AfterFunc(2*time.Minute, func() {
		h.setUpgradeInProgress(false)
	})

	c.JSON(http.StatusAccepted, gin.H{
		"message": "已触发 Docker 在线升级，容器将自动重启",
		"image":   imageName,
	})
}

func pullDockerImage(ctx context.Context, cli *client.Client, image string) error {
	reader, err := cli.ImagePull(ctx, image, client.ImagePullOptions{})
	if err != nil {
		return err
	}
	defer reader.Close()
	_, _ = io.Copy(io.Discard, reader)
	return nil
}

func buildDockerUpgradeScript(inspect container.InspectResponse) (string, error) {
	containerName := strings.TrimPrefix(inspect.Name, "/")
	if containerName == "" {
		return "", fmt.Errorf("容器名称为空")
	}

	imageName := strings.TrimSpace(inspect.Config.Image)
	if imageName == "" {
		return "", fmt.Errorf("镜像名称为空")
	}

	runArgs := buildDockerRunArgs(inspect)
	runCmd := "docker run -d " + joinShellArgs(runArgs)

	parts := []string{
		"set -e",
		"docker pull " + shellQuote(imageName),
		"docker stop " + shellQuote(containerName) + " || true",
		"docker rm " + shellQuote(containerName) + " || true",
		runCmd,
	}

	return strings.Join(parts, "\n"), nil
}

func buildDockerRunArgs(inspect container.InspectResponse) []string {
	cfg := inspect.Config
	host := inspect.HostConfig

	args := []string{"--name", strings.TrimPrefix(inspect.Name, "/")}

	if cfg.Hostname != "" {
		args = append(args, "--hostname", cfg.Hostname)
	}

	restartName := string(host.RestartPolicy.Name)
	if restartName != "" && restartName != "no" {
		if restartName == "on-failure" && host.RestartPolicy.MaximumRetryCount > 0 {
			args = append(args, "--restart", fmt.Sprintf("on-failure:%d", host.RestartPolicy.MaximumRetryCount))
		} else {
			args = append(args, "--restart", restartName)
		}
	}

	networkMode := string(host.NetworkMode)
	if networkMode != "" && networkMode != "default" {
		args = append(args, "--network", networkMode)
	}

	for _, bind := range host.Binds {
		if strings.TrimSpace(bind) != "" {
			args = append(args, "-v", bind)
		}
	}

	for _, env := range cfg.Env {
		if strings.TrimSpace(env) != "" {
			args = append(args, "-e", env)
		}
	}

	for port, bindings := range host.PortBindings {
		containerPort := fmt.Sprintf("%d", port.Num())
		if port.Proto() != network.TCP {
			containerPort = containerPort + "/" + string(port.Proto())
		}
		if len(bindings) == 0 {
			args = append(args, "-p", containerPort)
			continue
		}
		for _, binding := range bindings {
			hostMapping := ""
			if binding.HostIP.IsValid() {
				hostMapping = binding.HostIP.String() + ":"
			}
			if binding.HostPort != "" {
				hostMapping += binding.HostPort + ":" + containerPort
			} else {
				hostMapping += containerPort
			}
			args = append(args, "-p", hostMapping)
		}
	}

	args = append(args, cfg.Image)
	if len(cfg.Cmd) > 0 {
		args = append(args, cfg.Cmd...)
	}

	return args
}

func joinShellArgs(args []string) string {
	parts := make([]string, 0, len(args))
	for _, arg := range args {
		parts = append(parts, shellQuote(arg))
	}
	return strings.Join(parts, " ")
}

func shellQuote(value string) string {
	if value == "" {
		return "''"
	}
	return "'" + strings.ReplaceAll(value, "'", "'\"'\"'") + "'"
}

func fetchLatestRelease(ctx context.Context) (githubRelease, error) {
	release, err := fetchReleaseFromGitHub(ctx)
	if err == nil {
		return release, nil
	}
	return fetchReleaseFromAtomGit(ctx)
}

func fetchReleaseFromGitHub(ctx context.Context) (githubRelease, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, "https://api.github.com/repos/KWDB/playground/releases/latest", nil)
	if err != nil {
		return githubRelease{}, err
	}
	req.Header.Set("Accept", "application/vnd.github+json")
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return githubRelease{}, err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return githubRelease{}, fmt.Errorf("GitHub 返回状态 %d: %s", resp.StatusCode, strings.TrimSpace(string(body)))
	}
	var release githubRelease
	if err := json.NewDecoder(resp.Body).Decode(&release); err != nil {
		return githubRelease{}, err
	}
	return release, nil
}

func fetchReleaseFromAtomGit(ctx context.Context) (githubRelease, error) {
	url := "https://atomgit.com/KWDB/playground.git/info/refs?service=git-upload-pack"
	return fetchReleaseFromAtomGitWithURL(ctx, url)
}

func fetchReleaseFromAtomGitWithURL(ctx context.Context, url string) (githubRelease, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return githubRelease{}, fmt.Errorf("创建请求失败: %w", err)
	}

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return githubRelease{}, fmt.Errorf("连接 AtomGit 失败: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return githubRelease{}, fmt.Errorf("AtomGit 返回状态: %d", resp.StatusCode)
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return githubRelease{}, fmt.Errorf("读取响应失败: %w", err)
	}

	var tags []string
	scanner := bufio.NewScanner(strings.NewReader(string(body)))
	for scanner.Scan() {
		line := scanner.Text()
		if len(line) < 4 {
			continue
		}

		content := line[4:]
		if len(content) == 0 {
			continue
		}

		if idx := strings.Index(content, "refs/tags/"); idx != -1 {
			ref := content[idx:]
			ref = strings.TrimSuffix(ref, "^{}")
			tag := strings.TrimPrefix(ref, "refs/tags/")
			if tag != "" {
				tags = append(tags, tag)
			}
		}
	}

	if len(tags) == 0 {
		return githubRelease{}, fmt.Errorf("未找到 AtomGit tags")
	}

	sort.Slice(tags, func(i, j int) bool {
		return compareVersions(tags[i], tags[j])
	})

	latestTag := tags[len(tags)-1]

	release := githubRelease{
		TagName: latestTag,
		Assets:  []githubAsset{},
	}

	targets := []struct {
		os   string
		arch string
		ext  string
	}{
		{"linux", "amd64", ""},
		{"linux", "arm64", ""},
		{"darwin", "amd64", ""},
		{"darwin", "arm64", ""},
		{"windows", "amd64", ".exe"},
	}

	for _, t := range targets {
		name := fmt.Sprintf("kwdb-playground-%s-%s%s", t.os, t.arch, t.ext)
		url := fmt.Sprintf("https://atomgit.com/KWDB/playground/releases/download/%s/%s", latestTag, name)
		release.Assets = append(release.Assets, githubAsset{
			Name:               name,
			BrowserDownloadURL: url,
		})
	}
	return release, nil
}

func compareVersions(v1, v2 string) bool {
	v1 = strings.TrimPrefix(v1, "v")
	v2 = strings.TrimPrefix(v2, "v")

	parts1 := strings.Split(v1, ".")
	parts2 := strings.Split(v2, ".")

	len1 := len(parts1)
	len2 := len(parts2)
	maxLen := len1
	if len2 > maxLen {
		maxLen = len2
	}

	for i := 0; i < maxLen; i++ {
		n1 := 0
		if i < len1 {
			fmt.Sscanf(parts1[i], "%d", &n1)
		}
		n2 := 0
		if i < len2 {
			fmt.Sscanf(parts2[i], "%d", &n2)
		}

		if n1 != n2 {
			return n1 < n2
		}
	}

	return len1 < len2
}

func resolveRuntimeTarget() (string, string, string, error) {
	var osName string
	switch runtime.GOOS {
	case "linux", "darwin", "windows":
		osName = runtime.GOOS
	default:
		return "", "", "", fmt.Errorf("不支持的系统类型: %s", runtime.GOOS)
	}

	var archName string
	switch runtime.GOARCH {
	case "amd64", "arm64":
		archName = runtime.GOARCH
	default:
		return "", "", "", fmt.Errorf("不支持的架构类型: %s", runtime.GOARCH)
	}

	ext := ""
	if runtime.GOOS == "windows" {
		ext = ".exe"
	}

	return osName, archName, ext, nil
}

func findAssetDownloadURL(release githubRelease, assetName string) (string, error) {
	for _, asset := range release.Assets {
		if asset.Name == assetName {
			return asset.BrowserDownloadURL, nil
		}
	}
	return "", fmt.Errorf("未找到匹配的发布包: %s", assetName)
}

func performUpgrade(ctx context.Context, downloadURL, exePath string, startArgs []string, env []string) error {
	dir := filepath.Dir(exePath)
	tmpFile, err := os.CreateTemp(dir, "kwdb-playground-upgrade-*")
	if err != nil {
		return fmt.Errorf("创建临时文件失败: %w", err)
	}
	tmpPath := tmpFile.Name()
	defer os.Remove(tmpPath)

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, downloadURL, nil)
	if err != nil {
		_ = tmpFile.Close()
		return err
	}

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		_ = tmpFile.Close()
		return fmt.Errorf("下载升级包失败: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		_ = tmpFile.Close()
		return fmt.Errorf("下载失败，状态 %d: %s", resp.StatusCode, strings.TrimSpace(string(body)))
	}

	if _, err := io.Copy(tmpFile, resp.Body); err != nil {
		_ = tmpFile.Close()
		return fmt.Errorf("写入升级包失败: %w", err)
	}
	if err := tmpFile.Close(); err != nil {
		return fmt.Errorf("关闭临时文件失败: %w", err)
	}
	if err := os.Chmod(tmpPath, 0o755); err != nil {
		return fmt.Errorf("设置升级包权限失败: %w", err)
	}

	backupPath := exePath + ".bak-" + time.Now().Format("20060102150405")
	if err := os.Rename(exePath, backupPath); err != nil {
		return fmt.Errorf("备份当前版本失败: %w", err)
	}
	if err := os.Rename(tmpPath, exePath); err != nil {
		_ = os.Rename(backupPath, exePath)
		return fmt.Errorf("替换可执行文件失败: %w", err)
	}

	cmd := exec.Command(exePath, startArgs...)
	cmd.Env = withUpgradeRestartEnv(env)
	if err := cmd.Start(); err != nil {
		_ = os.Rename(backupPath, exePath)
		return fmt.Errorf("启动新版本失败: %w", err)
	}

	return nil
}
