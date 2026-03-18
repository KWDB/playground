package check

import (
	"embed"
	"net"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"testing"
	"time"

	"kwdb-playground/internal/config"
	"kwdb-playground/internal/course"
)

func TestParseFixScope(t *testing.T) {
	all, err := parseFixScope("all")
	if err != nil {
		t.Fatalf("parse all failed: %v", err)
	}
	if !all["progress"] || !all["docker"] || !all["image-sources"] || !all["process-file"] || !all["executable"] || !all["service"] {
		t.Fatalf("all scope missing expected keys: %#v", all)
	}

	selected, err := parseFixScope("progress,image-sources")
	if err != nil {
		t.Fatalf("parse selected failed: %v", err)
	}
	if !selected["progress"] || !selected["image-sources"] || selected["docker"] {
		t.Fatalf("unexpected selected scope: %#v", selected)
	}

	if _, err := parseFixScope("bad-scope"); err == nil {
		t.Fatalf("expected invalid scope error")
	}
}

func TestApplyFixesOnlyReturnsSelectedFailedItems(t *testing.T) {
	summary := Summary{
		OK: false,
		Items: []Item{
			{Name: ItemNameProgress, OK: false, Message: "broken"},
			{Name: ItemNameDockerEnv, OK: true, Message: "ok"},
		},
	}
	results, err := ApplyFixes(embed.FS{}, &config.Config{
		Course: config.CourseConfig{
			Dir:      "./courses",
			UseEmbed: false,
		},
	}, summary, FixOptions{
		DryRun:   true,
		FixScope: "all",
	})
	if err != nil {
		t.Fatalf("apply fixes failed: %v", err)
	}
	if len(results) != 1 {
		t.Fatalf("expected only one fix result for failed progress, got: %+v", results)
	}
	if results[0].Name != ItemNameProgress {
		t.Fatalf("unexpected fix target: %+v", results[0])
	}
}

func TestApplyFixesDockerAutoFix(t *testing.T) {
	summary := Summary{
		OK: false,
		Items: []Item{
			{Name: ItemNameDockerEnv, OK: false, Message: "Docker 不可用"},
		},
	}
	results, err := ApplyFixes(embed.FS{}, &config.Config{
		Course: config.CourseConfig{
			Dir:      "./courses",
			UseEmbed: false,
		},
	}, summary, FixOptions{
		DryRun:   false,
		FixScope: "docker",
	})
	if err != nil {
		t.Fatalf("apply fixes failed: %v", err)
	}
	if len(results) != 1 {
		t.Fatalf("expected one docker suggestion result, got: %+v", results)
	}
	if results[0].Name != ItemNameDockerEnv {
		t.Fatalf("unexpected docker result: %+v", results[0])
	}
	if results[0].Status != "已修复" && results[0].Status != "失败" {
		t.Fatalf("unexpected docker auto-fix status: %+v", results[0])
	}
	if !strings.Contains(results[0].Details, "建议操作:") {
		t.Fatalf("docker suggestion missing actions: %+v", results[0])
	}
}

func TestApplyFixesDockerDryRunProvidesSuggestion(t *testing.T) {
	summary := Summary{
		OK: false,
		Items: []Item{
			{Name: ItemNameDockerEnv, OK: false, Message: "Docker 不可用"},
		},
	}
	results, err := ApplyFixes(embed.FS{}, &config.Config{
		Course: config.CourseConfig{
			Dir:      "./courses",
			UseEmbed: false,
		},
	}, summary, FixOptions{
		DryRun:   true,
		FixScope: "docker",
	})
	if err != nil {
		t.Fatalf("apply fixes failed: %v", err)
	}
	if len(results) != 1 || results[0].Name != ItemNameDockerEnv {
		t.Fatalf("expected docker suggestion on dry-run, got: %+v", results)
	}
	if !strings.Contains(results[0].Message, "已生成 Docker 本地诊断建议") {
		t.Fatalf("expected docker dry-run suggestion, got: %+v", results[0])
	}
}

func TestApplyFixesDockerDryRunDoesNotAttemptStart(t *testing.T) {
	summary := Summary{
		OK: false,
		Items: []Item{
			{Name: ItemNameDockerEnv, OK: false, Message: "Docker 不可用"},
		},
	}
	results, err := ApplyFixes(embed.FS{}, &config.Config{
		Course: config.CourseConfig{
			Dir:      "./courses",
			UseEmbed: false,
		},
	}, summary, FixOptions{
		DryRun:   true,
		FixScope: "docker",
	})
	if err != nil {
		t.Fatalf("apply fixes failed: %v", err)
	}
	if len(results) != 1 || results[0].Name != ItemNameDockerEnv {
		t.Fatalf("expected one docker result, got: %+v", results)
	}
	if strings.Contains(results[0].Details, "已触发启动 Docker Desktop") {
		t.Fatalf("dry-run should not attempt start docker desktop: %+v", results[0])
	}
}

func TestParsePortProcesses(t *testing.T) {
	raw := "COMMAND   PID USER   FD   TYPE DEVICE SIZE/OFF NODE NAME\n" +
		"Python   123 me    10u  IPv4 0x01      0t0  TCP *:3006 (LISTEN)\n" +
		"Python   123 me    11u  IPv6 0x02      0t0  TCP *:3006 (LISTEN)\n" +
		"node     456 me    20u  IPv4 0x03      0t0  TCP *:3007 (LISTEN)\n"
	got := parsePortProcesses(raw)
	if len(got) != 2 {
		t.Fatalf("expected 2 unique pids, got: %+v", got)
	}
	if got[0].PID != 123 || got[0].Command != "Python" {
		t.Fatalf("unexpected first process: %+v", got[0])
	}
	if got[1].PID != 456 || got[1].Command != "node" {
		t.Fatalf("unexpected second process: %+v", got[1])
	}
}

func TestApplyFixesPortSuggestionOnDryRun(t *testing.T) {
	summary := Summary{
		OK: false,
		Items: []Item{
			{
				Name:    "端口占用 (0.0.0.0:3006)",
				OK:      false,
				Message: "端口已被占用",
				Details: "COMMAND   PID USER   FD   TYPE DEVICE SIZE/OFF NODE NAME\npython3 999 me 10u IPv4 0x01 0t0 TCP *:3006 (LISTEN)\n",
			},
		},
	}
	results, err := ApplyFixes(embed.FS{}, &config.Config{
		Server: config.ServerConfig{
			Host: "0.0.0.0",
			Port: 3006,
		},
		Course: config.CourseConfig{
			Dir:      "./courses",
			UseEmbed: false,
		},
	}, summary, FixOptions{
		DryRun:   true,
		FixScope: "port",
	})
	if err != nil {
		t.Fatalf("apply fixes failed: %v", err)
	}
	if len(results) != 1 || results[0].Name != "端口占用" {
		t.Fatalf("unexpected results: %+v", results)
	}
	if !strings.Contains(results[0].Details, "PID=999 COMMAND=python3") {
		t.Fatalf("expected process details in fix suggestion: %+v", results[0])
	}
}

func TestProgressFixFlow(t *testing.T) {
	tmp := t.TempDir()
	oldWD, err := os.Getwd()
	if err != nil {
		t.Fatalf("getwd failed: %v", err)
	}
	t.Cleanup(func() {
		_ = os.Chdir(oldWD)
	})
	if err := os.Chdir(tmp); err != nil {
		t.Fatalf("chdir failed: %v", err)
	}

	coursesDir := filepath.Join(tmp, "courses")
	if err := os.MkdirAll(filepath.Join(coursesDir, "demo"), 0755); err != nil {
		t.Fatalf("mkdir courses failed: %v", err)
	}
	if err := os.WriteFile(filepath.Join(coursesDir, "demo", "index.yaml"), []byte(`
title: Demo
details:
  intro:
    text: intro.md
  steps:
    - title: Step1
      text: step1.md
  finish:
    text: finish.md
backend:
  imageid: kwdb/kwdb:latest
`), 0644); err != nil {
		t.Fatalf("write index failed: %v", err)
	}
	if err := os.WriteFile(filepath.Join(coursesDir, "demo", "intro.md"), []byte("intro"), 0644); err != nil {
		t.Fatalf("write intro failed: %v", err)
	}
	if err := os.WriteFile(filepath.Join(coursesDir, "demo", "step1.md"), []byte("step"), 0644); err != nil {
		t.Fatalf("write step failed: %v", err)
	}
	if err := os.WriteFile(filepath.Join(coursesDir, "demo", "finish.md"), []byte("finish"), 0644); err != nil {
		t.Fatalf("write finish failed: %v", err)
	}

	svc := course.NewService(coursesDir)
	if err := svc.LoadCourses(); err != nil {
		t.Fatalf("load courses failed: %v", err)
	}
	if err := os.MkdirAll("data", 0755); err != nil {
		t.Fatalf("mkdir data failed: %v", err)
	}
	if err := os.WriteFile("data/progress.json", []byte(`{"broken":`), 0644); err != nil {
		t.Fatalf("write broken progress failed: %v", err)
	}

	ok, msg, _ := ProgressStoreHealth(svc, "data/progress.json")
	if ok {
		t.Fatalf("expected invalid progress file, msg=%s", msg)
	}

	result := fixProgressStore(svc, "data/progress.json", false)
	if result.Status != "已修复" {
		t.Fatalf("expected fixed status, got %+v", result)
	}
	if !strings.Contains(result.Details, "已写入修复后的 progress.json") {
		t.Fatalf("unexpected fix details: %s", result.Details)
	}

	ok, msg, _ = ProgressStoreHealth(svc, "data/progress.json")
	if !ok {
		t.Fatalf("expected healthy progress after fix, msg=%s", msg)
	}
}

func TestSanitizeProgressStore(t *testing.T) {
	now := time.Now()
	done := now
	store := &course.ProgressStore{
		Version: "",
		Progress: map[string]course.UserProgress{
			"default-user:demo": {
				UserID:      "default-user",
				CourseID:    "demo",
				CurrentStep: 99,
				Completed:   false,
				CompletedAt: &done,
			},
			"default-user:ghost": {
				UserID:   "default-user",
				CourseID: "ghost",
			},
		},
	}
	courses := map[string]*course.Course{
		"demo": {
			ID: "demo",
			Details: course.CourseDetail{
				Steps: []course.CourseStep{{Title: "A", Text: "a.md"}},
			},
		},
	}
	sanitized, changed := sanitizeProgressStore(store, courses)
	if !changed {
		t.Fatalf("expected changed=true")
	}
	if sanitized.Version != "1.0" {
		t.Fatalf("expected version fixed")
	}
	if len(sanitized.Progress) != 1 {
		t.Fatalf("expected ghost record removed")
	}
	progress := sanitized.Progress["default-user:demo"]
	if progress.CurrentStep != 0 {
		t.Fatalf("expected step clamped to 0, got %d", progress.CurrentStep)
	}
	if progress.CompletedAt != nil {
		t.Fatalf("expected completed_at nil when completed=false")
	}
}

func TestApplyFixesProcessFileRepairExpiredPID(t *testing.T) {
	ln, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatalf("listen failed: %v", err)
	}
	defer ln.Close()

	server := &http.Server{Handler: http.NewServeMux()}
	defer server.Close()
	go func() {
		_ = server.Serve(ln)
	}()
	port := ln.Addr().(*net.TCPAddr).Port

	tmp := t.TempDir()
	oldWD, err := os.Getwd()
	if err != nil {
		t.Fatalf("getwd failed: %v", err)
	}
	t.Cleanup(func() {
		_ = os.Chdir(oldWD)
	})
	if err := os.Chdir(tmp); err != nil {
		t.Fatalf("chdir failed: %v", err)
	}
	if err := os.MkdirAll("tmp", 0755); err != nil {
		t.Fatalf("mkdir tmp failed: %v", err)
	}
	if err := os.WriteFile("tmp/kwdb-playground.pid", []byte("999999"), 0644); err != nil {
		t.Fatalf("write stale pid failed: %v", err)
	}

	summary := Summary{
		OK: true,
		Items: []Item{
			{Name: ItemNameProcessFile, OK: true, Message: "PID 文件记录已过期，已识别当前运行进程（PID=123）"},
		},
	}

	results, err := ApplyFixes(embed.FS{}, &config.Config{
		Server: config.ServerConfig{
			Host: "127.0.0.1",
			Port: port,
		},
		Course: config.CourseConfig{
			Dir:      "./courses",
			UseEmbed: false,
		},
	}, summary, FixOptions{
		DryRun:   false,
		FixScope: "process-file",
	})
	if err != nil {
		t.Fatalf("apply fixes failed: %v", err)
	}
	if len(results) != 1 {
		t.Fatalf("expected one process-file result, got: %+v", results)
	}
	if results[0].Name != ItemNameProcessFile {
		t.Fatalf("unexpected fix target: %+v", results[0])
	}
	if results[0].Status != "已修复" {
		t.Fatalf("expected repaired status, got: %+v", results[0])
	}

	raw, err := os.ReadFile("tmp/kwdb-playground.pid")
	if err != nil {
		t.Fatalf("read fixed pid file failed: %v", err)
	}
	gotPID, err := strconv.Atoi(strings.TrimSpace(string(raw)))
	if err != nil {
		t.Fatalf("parse fixed pid failed: %v", err)
	}
	if gotPID != os.Getpid() {
		t.Fatalf("expected pid file rewritten to current pid %d, got %d", os.Getpid(), gotPID)
	}
}

func TestApplyFixesExecutableRepairWithExpiredPID(t *testing.T) {
	ln, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatalf("listen failed: %v", err)
	}
	defer ln.Close()

	server := &http.Server{Handler: http.NewServeMux()}
	defer server.Close()
	go func() {
		_ = server.Serve(ln)
	}()
	port := ln.Addr().(*net.TCPAddr).Port

	tmp := t.TempDir()
	oldWD, err := os.Getwd()
	if err != nil {
		t.Fatalf("getwd failed: %v", err)
	}
	t.Cleanup(func() {
		_ = os.Chdir(oldWD)
	})
	if err := os.Chdir(tmp); err != nil {
		t.Fatalf("chdir failed: %v", err)
	}
	if err := os.MkdirAll("tmp", 0755); err != nil {
		t.Fatalf("mkdir tmp failed: %v", err)
	}
	if err := os.WriteFile("tmp/kwdb-playground.pid", []byte("999999"), 0644); err != nil {
		t.Fatalf("write stale pid failed: %v", err)
	}

	summary := Summary{
		OK: false,
		Items: []Item{
			{
				Name:    ItemNameExecutablePath,
				OK:      false,
				Message: "无法定位 PID=999999 的可执行文件",
				Details: "PID 文件内容: 999999（已过期）",
			},
		},
	}

	results, err := ApplyFixes(embed.FS{}, &config.Config{
		Server: config.ServerConfig{
			Host: "127.0.0.1",
			Port: port,
		},
		Course: config.CourseConfig{
			Dir:      "./courses",
			UseEmbed: false,
		},
	}, summary, FixOptions{
		DryRun:   false,
		FixScope: "executable",
	})
	if err != nil {
		t.Fatalf("apply fixes failed: %v", err)
	}
	if len(results) != 1 {
		t.Fatalf("expected one executable result, got: %+v", results)
	}
	if results[0].Name != ItemNameExecutablePath {
		t.Fatalf("unexpected fix target: %+v", results[0])
	}
	if results[0].Status != "已修复" {
		t.Fatalf("expected repaired executable status, got: %+v", results[0])
	}
	if !strings.Contains(results[0].Details, "路径校验结果:") {
		t.Fatalf("expected executable health details, got: %+v", results[0])
	}

	raw, err := os.ReadFile("tmp/kwdb-playground.pid")
	if err != nil {
		t.Fatalf("read fixed pid file failed: %v", err)
	}
	gotPID, err := strconv.Atoi(strings.TrimSpace(string(raw)))
	if err != nil {
		t.Fatalf("parse fixed pid failed: %v", err)
	}
	if gotPID != os.Getpid() {
		t.Fatalf("expected pid file rewritten to current pid %d, got %d", os.Getpid(), gotPID)
	}
}
