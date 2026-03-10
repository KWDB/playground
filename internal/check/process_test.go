package check

import (
	"encoding/json"
	"net"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"testing"
)

func TestProcessFileHealthWhenPIDFileMissing(t *testing.T) {
	tmp := t.TempDir()
	pidPath := filepath.Join(tmp, "kwdb-playground.pid")
	ok, msg, details := ProcessFileHealth(pidPath)
	if !ok {
		t.Fatalf("expected ok=true, got false, msg=%s", msg)
	}
	if !strings.Contains(msg, "PID 文件不存在") {
		t.Fatalf("unexpected message: %s", msg)
	}
	if !strings.Contains(details, "PID 文件路径:") {
		t.Fatalf("expected pid path in details: %s", details)
	}
}

func TestProcessFileHealthWhenPIDFileInvalid(t *testing.T) {
	tmp := t.TempDir()
	pidPath := filepath.Join(tmp, "kwdb-playground.pid")
	if err := os.WriteFile(pidPath, []byte("not-a-pid"), 0644); err != nil {
		t.Fatalf("write pid failed: %v", err)
	}
	ok, msg, _ := ProcessFileHealth(pidPath)
	if ok {
		t.Fatalf("expected ok=false for invalid pid")
	}
	if !strings.Contains(msg, "PID 文件内容非法") {
		t.Fatalf("unexpected message: %s", msg)
	}
}

func TestExecutablePathHealth(t *testing.T) {
	tmp := t.TempDir()
	pidPath := filepath.Join(tmp, "kwdb-playground.pid")
	if err := os.WriteFile(pidPath, []byte("bad-pid"), 0644); err != nil {
		t.Fatalf("write pid failed: %v", err)
	}
	ok, msg, details := ExecutablePathHealth(pidPath, "127.0.0.1", 65531)
	if !ok {
		t.Fatalf("expected fallback result ok, msg=%s details=%s", msg, details)
	}
	if !strings.Contains(msg, "未检测到运行中的 kwdb-playground 进程") {
		t.Fatalf("unexpected message: %s", msg)
	}
	if !strings.Contains(details, "PID 文件路径:") {
		t.Fatalf("expected pid path in details: %s", details)
	}
}

func TestExecutablePathHealthWithCurrentPID(t *testing.T) {
	tmp := t.TempDir()
	pidPath := filepath.Join(tmp, "kwdb-playground.pid")
	if err := os.WriteFile(pidPath, []byte(strconv.Itoa(os.Getpid())), 0644); err != nil {
		t.Fatalf("write pid failed: %v", err)
	}
	ok, msg, details := ExecutablePathHealth(pidPath, "127.0.0.1", 65531)
	if !ok {
		t.Fatalf("expected executable path health ok, msg=%s, details=%s", msg, details)
	}
	if !strings.Contains(details, "程序可执行文件:") {
		t.Fatalf("expected executable path in details: %s", details)
	}
}

func TestParseListenerPIDAndCommand(t *testing.T) {
	raw := "p123\nckwdb-playground\np456\ncother\n"
	pid, cmd := parseListenerPIDAndCommand(raw)
	if pid != 123 || cmd != "kwdb-playground" {
		t.Fatalf("unexpected parse result: pid=%d cmd=%s", pid, cmd)
	}

	rawFallback := "p456\ncother\n"
	pid, cmd = parseListenerPIDAndCommand(rawFallback)
	if pid != 456 || cmd != "other" {
		t.Fatalf("unexpected fallback result: pid=%d cmd=%s", pid, cmd)
	}
}

func TestHealthProbeHostsForWildcard(t *testing.T) {
	hosts := healthProbeHosts("0.0.0.0")
	got := strings.Join(hosts, ",")
	if !strings.Contains(got, "127.0.0.1") {
		t.Fatalf("expected loopback host, got: %s", got)
	}
	if !strings.Contains(got, "localhost") {
		t.Fatalf("expected localhost host, got: %s", got)
	}
}

func TestNormalizeProbeHost(t *testing.T) {
	if normalizeProbeHost("[::1]") != "::1" {
		t.Fatalf("expected trimmed ipv6 brackets")
	}
	if normalizeProbeHost(" 127.0.0.1 ") != "127.0.0.1" {
		t.Fatalf("expected trimmed spaces")
	}
}

func TestIsPortUsedByCurrentServiceFallbackHost(t *testing.T) {
	ln, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatalf("listen failed: %v", err)
	}
	defer ln.Close()
	mux := http.NewServeMux()
	mux.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		_ = json.NewEncoder(w).Encode(map[string]string{
			"status":  "ok",
			"message": "KWDB Playground running",
		})
	})
	server := &http.Server{Handler: mux}
	defer server.Close()
	go func() {
		_ = server.Serve(ln)
	}()
	port := ln.Addr().(*net.TCPAddr).Port
	if !IsPortUsedByCurrentService("0.0.0.0", port) {
		t.Fatalf("expected fallback host probe success")
	}
}
