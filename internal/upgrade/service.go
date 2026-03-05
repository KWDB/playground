package upgrade

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
)

type githubAsset struct {
	Name               string `json:"name"`
	BrowserDownloadURL string `json:"browser_download_url"`
}

type githubRelease struct {
	TagName string        `json:"tag_name"`
	Assets  []githubAsset `json:"assets"`
}

type CheckResult struct {
	CurrentVersion string
	LatestVersion  string
	HasUpdate      bool
	CanUpgrade     bool
	Message        string
	DockerDeploy   bool
}

type Mode string

const (
	ModeNoUpdate    Mode = "no_update"
	ModeBrew        Mode = "brew"
	ModeBinary      Mode = "binary"
	ModeUnsupported Mode = "unsupported"
	ModeDocker      Mode = "docker"
)

type Plan struct {
	Mode           Mode
	CurrentVersion string
	LatestVersion  string
	Message        string
	DownloadURL    string
	ExecutablePath string
}

func IsDockerDeploy() bool {
	return strings.EqualFold(os.Getenv("DOCKER_DEPLOY"), "true") || os.Getenv("DOCKER_DEPLOY") == "1"
}

func Check(ctx context.Context, currentVersion string) (CheckResult, error) {
	current := strings.TrimPrefix(currentVersion, "v")
	if current == "" {
		current = "dev"
	}

	release, err := fetchLatestRelease(ctx)
	if err != nil {
		return CheckResult{}, fmt.Errorf("获取最新版本失败: %w", err)
	}

	latest := strings.TrimPrefix(release.TagName, "v")
	if latest == "" {
		return CheckResult{}, fmt.Errorf("最新版本号为空")
	}

	resp := CheckResult{
		CurrentVersion: current,
		LatestVersion:  latest,
		DockerDeploy:   IsDockerDeploy(),
		HasUpdate:      current != latest,
	}

	if current == "dev" {
		resp.CanUpgrade = false
		if resp.HasUpdate {
			resp.Message = fmt.Sprintf("发现新版本 v%s（开发模式仅提示）", latest)
		} else {
			resp.Message = "当前已是最新版本"
		}
		return resp, nil
	}

	if runtime.GOOS == "windows" {
		resp.CanUpgrade = false
		if resp.HasUpdate {
			resp.Message = fmt.Sprintf("发现新版本 v%s（Windows 暂不支持在线升级）", latest)
		} else {
			resp.Message = "当前已是最新版本"
		}
		return resp, nil
	}

	if resp.HasUpdate {
		if exePath, err := ResolveExecutablePath(); err == nil && IsBrewInstall(exePath) {
			if IsBrewAvailable() {
				resp.CanUpgrade = true
				resp.Message = fmt.Sprintf("发现新版本 v%s，可通过 Homebrew 升级", latest)
			} else {
				resp.CanUpgrade = false
				resp.Message = fmt.Sprintf("发现新版本 v%s，但未检测到 brew 命令", latest)
			}
			return resp, nil
		}
	}

	if current == latest {
		resp.CanUpgrade = false
		resp.Message = "当前已是最新版本"
		return resp, nil
	}

	resp.CanUpgrade = true
	resp.Message = fmt.Sprintf("发现新版本 v%s，可执行升级", latest)
	return resp, nil
}

func Prepare(ctx context.Context, currentVersion string) (Plan, error) {
	current := strings.TrimPrefix(currentVersion, "v")
	if current == "" {
		current = "dev"
	}

	if IsDockerDeploy() {
		return Plan{
			Mode:           ModeDocker,
			CurrentVersion: current,
			Message:        "Docker 部署请使用在线升级接口",
		}, nil
	}

	if runtime.GOOS == "windows" {
		return Plan{
			Mode:           ModeUnsupported,
			CurrentVersion: current,
			Message:        "Windows 暂不支持在线升级",
		}, nil
	}

	if current == "dev" {
		return Plan{
			Mode:           ModeUnsupported,
			CurrentVersion: current,
			Message:        "开发模式不支持在线升级",
		}, nil
	}

	release, err := fetchLatestRelease(ctx)
	if err != nil {
		return Plan{}, fmt.Errorf("获取最新版本失败: %w", err)
	}

	latest := strings.TrimPrefix(release.TagName, "v")
	if latest == "" {
		return Plan{}, fmt.Errorf("最新版本号为空")
	}
	if current == latest {
		return Plan{
			Mode:           ModeNoUpdate,
			CurrentVersion: current,
			LatestVersion:  latest,
			Message:        "当前已是最新版本",
		}, nil
	}

	exePath, err := ResolveExecutablePath()
	if err != nil {
		return Plan{}, fmt.Errorf("获取当前可执行文件失败: %w", err)
	}
	if IsBrewInstall(exePath) {
		if !IsBrewAvailable() {
			return Plan{}, fmt.Errorf("检测到 Homebrew 安装，但未找到 brew 命令")
		}
		return Plan{
			Mode:           ModeBrew,
			CurrentVersion: current,
			LatestVersion:  latest,
			Message:        "可通过 Homebrew 升级",
			ExecutablePath: exePath,
		}, nil
	}

	osName, archName, ext, err := resolveRuntimeTarget()
	if err != nil {
		return Plan{}, err
	}
	assetName := fmt.Sprintf("kwdb-playground-%s-%s%s", osName, archName, ext)
	downloadURL, err := findAssetDownloadURL(release, assetName)
	if err != nil {
		return Plan{}, err
	}

	return Plan{
		Mode:           ModeBinary,
		CurrentVersion: current,
		LatestVersion:  latest,
		Message:        "可执行升级",
		DownloadURL:    downloadURL,
		ExecutablePath: exePath,
	}, nil
}

func ResolveExecutablePath() (string, error) {
	exePath, err := os.Executable()
	if err != nil {
		return "", err
	}
	if resolved, err := filepath.EvalSymlinks(exePath); err == nil {
		exePath = resolved
	}
	return exePath, nil
}

func IsBrewInstall(exePath string) bool {
	return strings.Contains(exePath, "/Cellar/kwdb-playground/")
}

func IsBrewAvailable() bool {
	_, err := exec.LookPath("brew")
	return err == nil
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

func PerformBrewUpgrade(ctx context.Context, startArgs []string, env []string) error {
	cmd := exec.CommandContext(ctx, "brew", "upgrade", "kwdb-playground")
	cmd.Env = env
	if err := cmd.Run(); err != nil {
		return err
	}

	if len(startArgs) == 0 {
		return nil
	}

	startCmd := exec.Command("kwdb-playground", startArgs...)
	startCmd.Env = withUpgradeRestartEnv(env)
	if err := startCmd.Start(); err != nil {
		return fmt.Errorf("启动新版本失败: %w", err)
	}
	return nil
}

func PerformUpgrade(ctx context.Context, downloadURL, exePath string, startArgs []string, env []string) error {
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

	if len(startArgs) == 0 {
		return nil
	}

	cmd := exec.Command(exePath, startArgs...)
	cmd.Env = withUpgradeRestartEnv(env)
	if err := cmd.Start(); err != nil {
		_ = os.Rename(backupPath, exePath)
		return fmt.Errorf("启动新版本失败: %w", err)
	}

	return nil
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
