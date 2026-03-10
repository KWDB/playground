package check

import (
	"strings"
	"testing"
)

func TestRenderSummaryCLI(t *testing.T) {
	summary := Summary{
		OK: false,
		Items: []Item{
			{Name: ItemNameDockerEnv, OK: true, Message: "Docker 客户端与守护进程连接正常（API v1.53，要求 ≥ v1.41）"},
			{Name: ItemNameProcessFile, OK: false, Message: "PID 文件格式正常（PID=444）", Details: "PID 文件路径: /tmp/kwdb-playground.pid\nPID 文件内容: 444"},
			{Name: ItemNameExecutablePath, OK: true, Message: "已定位运行中 kwdb-playground 的可执行文件", Details: "程序可执行文件: /usr/local/bin/kwdb-playground"},
			{Name: "服务健康检查 (0.0.0.0:3006)", OK: true, Message: "服务正在运行且健康（/health 返回 200）"},
		},
	}

	out := RenderSummaryCLI(summary)
	if !strings.Contains(out, "KWDB Playground 环境诊断报告") {
		t.Fatalf("missing header: %s", out)
	}
	if !strings.Contains(out, "结果: 失败 (3/4)") {
		t.Fatalf("missing summary count: %s", out)
	}
	if !strings.Contains(out, "Docker 环境") {
		t.Fatalf("missing docker chinese title: %s", out)
	}
	if !strings.Contains(out, "\033[32m●\033[0m Docker 环境") {
		t.Fatalf("missing docker green bullet: %q", out)
	}
	if strings.Contains(out, "[ 通过 ]") || strings.Contains(out, "[ 未运行 ]") || strings.Contains(out, "[ 失败 ]") {
		t.Fatalf("status bracket should be removed: %q", out)
	}
	if !strings.Contains(out, "连接状态: 已连接（API v1.53，要求 ≥ v1.41）") {
		t.Fatalf("missing docker chinese details: %s", out)
	}
	if !strings.Contains(out, "进程管理 (PID: 444)") {
		t.Fatalf("missing process section: %s", out)
	}
	if !strings.Contains(out, "可执行文件路径") {
		t.Fatalf("missing executable path section: %s", out)
	}
	if !strings.Contains(out, "路径: /usr/local/bin/kwdb-playground") {
		t.Fatalf("missing executable detail: %s", out)
	}
	if !strings.Contains(out, "⚠️ 结论: 检测到异常，请按提示修复失败项。") {
		t.Fatalf("missing failed conclusion: %s", out)
	}
	if !strings.Contains(out, "建议: 运行 kwdb-playground doctor --fix") {
		t.Fatalf("missing fix suggestion: %s", out)
	}
}

func TestRenderFixResults(t *testing.T) {
	results := []FixResult{
		{Name: "进度文件", Status: "已修复", Message: "完成"},
		{Name: "Docker 自动修复", Status: "跳过", Message: "未启用"},
		{Name: "课程文件", Status: "失败", Message: "失败"},
	}
	out := RenderFixResults(results)
	if !strings.Contains(out, "自动修复结果") {
		t.Fatalf("missing fix header: %s", out)
	}
	if !strings.Contains(out, "已修复: 1") || !strings.Contains(out, "失败: 1") || !strings.Contains(out, "跳过: 1") {
		t.Fatalf("missing fix counts: %s", out)
	}
}

func TestRenderSummaryCLINotRunningStatus(t *testing.T) {
	summary := Summary{
		OK: true,
		Items: []Item{
			{Name: ItemNameProcessFile, OK: true, Message: "PID 文件不存在（服务未以守护进程运行或尚未启动）", Details: "PID 文件路径: /tmp/kwdb-playground.pid"},
			{Name: ItemNameExecutablePath, OK: true, Message: "未检测到运行中的 kwdb-playground 进程", Details: "程序可执行文件: /Users/demo/bin/kwdb-playground"},
		},
	}
	out := RenderSummaryCLI(summary)
	if !strings.Contains(out, "\033[33m●\033[0m 进程管理") {
		t.Fatalf("missing process yellow bullet: %q", out)
	}
	if !strings.Contains(out, "\033[33m●\033[0m 可执行文件路径") {
		t.Fatalf("missing executable yellow bullet: %q", out)
	}
	if !strings.Contains(out, "\033[33m状态: 未找到 kwdb-playground 进程\033[0m") {
		t.Fatalf("missing process not-running detail: %q", out)
	}
	if !strings.Contains(out, "\033[33m路径: /Users/demo/bin/kwdb-playground\033[0m") {
		t.Fatalf("missing executable path detail: %q", out)
	}
}

func TestRenderSummaryCLIPartialUnavailableYellowBullet(t *testing.T) {
	summary := Summary{
		OK: true,
		Items: []Item{
			{
				Name:    ItemNameImageSources,
				OK:      true,
				Message: "可用：Docker Hub；不可用：ghcr.io",
				Details: "Docker Hub: 可用\nghcr.io: 不可用（timeout）",
			},
		},
	}
	out := RenderSummaryCLI(summary)
	if !strings.Contains(out, "\033[33m●\033[0m 镜像源可用性") {
		t.Fatalf("missing image-source yellow bullet: %q", out)
	}
}
