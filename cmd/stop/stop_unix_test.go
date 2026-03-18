//go:build !windows

package stop

import (
	"net"
	"strings"
	"testing"

	"kwdb-playground/internal/procutil"
)

func TestParseListenerPIDAndCommand(t *testing.T) {
	raw := "p123\nckwdb-playground\np456\ncother\n"
	pid, cmd := procutil.ParseListenerPIDAndCommand(raw)
	if pid != 123 || cmd != "kwdb-playground" {
		t.Fatalf("unexpected parse result: pid=%d cmd=%s", pid, cmd)
	}

	rawFallback := "p456\ncother\n"
	pid, cmd = procutil.ParseListenerPIDAndCommand(rawFallback)
	if pid != 456 || cmd != "other" {
		t.Fatalf("unexpected fallback result: pid=%d cmd=%s", pid, cmd)
	}
}

func TestResolveRunningPIDByPort(t *testing.T) {
	ln, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatalf("listen failed: %v", err)
	}
	defer ln.Close()

	port := ln.Addr().(*net.TCPAddr).Port
	pid, source, err := procutil.ResolveRunningPIDByPort(port)
	if err != nil {
		t.Fatalf("resolve pid by port failed: %v", err)
	}
	if pid <= 0 {
		t.Fatalf("expected positive pid, got: %d", pid)
	}
	if !strings.Contains(source, "监听端口进程") {
		t.Fatalf("unexpected source: %s", source)
	}
}
