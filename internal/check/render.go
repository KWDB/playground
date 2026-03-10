package check

import (
	"fmt"
	"regexp"
	"strings"
	"time"

	"kwdb-playground/internal/config"
)

const (
	ansiReset  = "\033[0m"
	ansiGreen  = "\033[32m"
	ansiRed    = "\033[31m"
	ansiYellow = "\033[33m"
)

// RenderSummaryCLI 将环境检查结果渲染为适合 CLI 输出的文本。
// 保持与现有 CLI 输出一致的格式，包含开始/结束分隔与缩进的详情。
func RenderSummaryCLI(summary Summary) string {
	var b strings.Builder
	total := len(summary.Items)
	passed := 0
	for _, it := range summary.Items {
		if it.OK {
			passed++
		}
	}
	result := "通过"
	if !summary.OK {
		result = "失败"
	}
	version := strings.TrimSpace(config.Version)
	if version == "" {
		version = "dev"
	}
	b.WriteString("KWDB Playground 环境诊断报告\n")
	b.WriteString("------------------------------------------------------------\n")
	b.WriteString(fmt.Sprintf("结果: %s (%d/%d)  |  时间: %s  |  版本: %s\n\n", result, passed, total, time.Now().Format("2006-01-02 15:04"), version))

	type reportRow struct {
		left  string
		lines []string
	}
	rows := make([]reportRow, 0, len(summary.Items))
	for _, it := range summary.Items {
		state := resolveItemDisplayState(it)
		left := colorByState("●", state) + " " + renderTitle(it.Name, it.Message)
		lines := renderDetailLines(it, state)
		rows = append(rows, reportRow{
			left:  left,
			lines: lines,
		})
	}
	for _, row := range rows {
		b.WriteString(row.left)
		b.WriteString("\n")
		for i, line := range row.lines {
			branch := "├─"
			if i == len(row.lines)-1 {
				branch = "└─"
			}
			b.WriteString("  " + branch + " " + line + "\n")
		}
		b.WriteString("\n")
	}

	b.WriteString("------------------------------------------------------------\n")
	if summary.OK {
		b.WriteString("✨ 结论: 环境健康，开启你的 KWDB Playground 吧。")
	} else {
		b.WriteString("⚠️ 结论: 检测到异常，请按提示修复失败项。")
		b.WriteString("\n建议: 运行 kwdb-playground doctor --fix")
		b.WriteString("\n      预览修复可使用 --fix --dry-run")
	}
	return b.String()
}

func RenderFixResults(results []FixResult) string {
	var b strings.Builder
	statusCount := map[string]int{}
	for _, result := range results {
		statusCount[result.Status]++
	}
	b.WriteString("┌──────────────── 自动修复结果 ────────────────┐\n")
	b.WriteString(fmt.Sprintf("│ 已修复: %-2d  失败: %-2d  跳过: %-2d  其他: %-2d     │\n",
		statusCount["已修复"], statusCount["失败"], statusCount["跳过"], len(results)-statusCount["已修复"]-statusCount["失败"]-statusCount["跳过"]))
	b.WriteString("└──────────────────────────────────────────────┘\n")
	for _, result := range results {
		icon := "ℹ️"
		if result.Status == "已修复" {
			icon = "✅"
		}
		if result.Status == "失败" {
			icon = "❌"
		}
		if result.Status == "跳过" {
			icon = "⏭️"
		}
		b.WriteString(fmt.Sprintf("\n%s %s（%s）\n", icon, result.Name, result.Status))
		b.WriteString(fmt.Sprintf("  结果: %s\n", result.Message))
		if strings.TrimSpace(result.Details) != "" {
			b.WriteString(indent(result.Details, "  详情: "))
			if !strings.HasSuffix(result.Details, "\n") {
				b.WriteString("\n")
			}
		}
	}
	b.WriteString("\n")
	return b.String()
}

// indent 将多行文本缩进，便于在 CLI 中更清晰展示（内部使用）
func indent(s, prefix string) string {
	parts := strings.Split(s, "\n")
	continuation := strings.Repeat(" ", len(prefix))
	for i, part := range parts {
		if i == 0 {
			parts[i] = prefix + part
		} else {
			parts[i] = continuation + "• " + part
		}
	}
	return strings.Join(parts, "\n")
}

func renderTitle(name, message string) string {
	switch {
	case name == ItemNameDockerEnv:
		return "Docker 环境"
	case name == ItemNameImageSources:
		return "镜像源可用性"
	case strings.HasPrefix(name, "端口占用 ("):
		return "端口占用状态 " + strings.TrimPrefix(name, "端口占用 ")
	case name == ItemNameCourses:
		return "课程加载与完整性"
	case name == ItemNameProgress:
		return "进度数据"
	case name == ItemNameProcessFile:
		if pid := extractByRegexp(message, `PID=(\d+)`); pid != "" {
			return fmt.Sprintf("进程管理 (PID: %s)", pid)
		}
		return "进程管理"
	case name == ItemNameExecutablePath:
		return "可执行文件路径"
	case strings.HasPrefix(name, "服务健康检查 ("):
		return "服务健康检查 " + strings.TrimPrefix(name, "服务健康检查 ")
	default:
		return name
	}
}

func renderDetailLines(item Item, state itemDisplayState) []string {
	switch {
	case item.Name == ItemNameDockerEnv:
		return []string{colorByState("连接状态: "+dockerMessageCN(item.Message), state)}
	case item.Name == ItemNameImageSources:
		lines := parseLines(item.Details)
		if len(lines) == 0 {
			return []string{colorByState("结果: "+strings.TrimSpace(item.Message), state)}
		}
		out := make([]string, 0, len(lines))
		for _, line := range lines {
			out = append(out, colorMirrorDetail(line))
		}
		return out
	case strings.HasPrefix(item.Name, "端口占用 ("):
		return []string{colorByState("服务状态: "+strings.TrimSpace(item.Message), state)}
	case item.Name == ItemNameCourses:
		return []string{colorByState("统计: "+strings.TrimSpace(item.Message), state)}
	case item.Name == ItemNameProgress:
		return []string{colorByState("记录: "+strings.TrimSpace(item.Message), state)}
	case item.Name == ItemNameProcessFile:
		if state == stateNotRunning {
			return []string{colorByState("状态: 未找到 kwdb-playground 进程", state)}
		}
		filePath := extractPrefix(item.Details, "PID 文件路径:")
		if filePath == "" {
			filePath = "tmp/kwdb-playground.pid"
		}
		return []string{colorByState("文件: "+filePath, state)}
	case item.Name == ItemNameExecutablePath:
		execPath := extractPrefix(item.Details, "程序可执行文件:")
		if execPath == "" {
			return []string{colorByState("状态: "+strings.TrimSpace(item.Message), state)}
		}
		return []string{colorByState("路径: "+execPath, state)}
	case strings.HasPrefix(item.Name, "服务健康检查 ("):
		return []string{colorByState("状态: "+strings.TrimSpace(item.Message), state)}
	default:
		lines := []string{colorByState("结果: "+strings.TrimSpace(item.Message), state)}
		details := parseLines(item.Details)
		for _, line := range details {
			lines = append(lines, colorByState(line, state))
		}
		return lines
	}
}

func parseLines(s string) []string {
	raw := strings.Split(strings.TrimSpace(s), "\n")
	out := make([]string, 0, len(raw))
	for _, line := range raw {
		line = strings.TrimSpace(line)
		if line == "" {
			continue
		}
		out = append(out, line)
	}
	return out
}

func extractPrefix(details, prefix string) string {
	for _, line := range parseLines(details) {
		if strings.HasPrefix(line, prefix) {
			return strings.TrimSpace(strings.TrimPrefix(line, prefix))
		}
	}
	return ""
}

func extractByRegexp(s, pattern string) string {
	re := regexp.MustCompile(pattern)
	m := re.FindStringSubmatch(s)
	if len(m) >= 2 {
		return m[1]
	}
	return ""
}

func formatDottedLine(left, right string, width int) string {
	gap := width - visibleRuneLen(left) - visibleRuneLen(right) - 2
	if gap < 1 {
		gap = 1
	}
	return left + " " + strings.Repeat(".", gap) + " " + right
}

func visibleRuneLen(s string) int {
	s = ansiRegexp.ReplaceAllString(s, "")
	return len([]rune(s))
}

func dockerMessageCN(s string) string {
	api := extractByRegexp(s, `API v([0-9.]+)`)
	required := extractByRegexp(s, `要求\s*≥\s*v([0-9.]+)`)
	if strings.Contains(s, "连接正常") && api != "" && required != "" {
		return fmt.Sprintf("已连接（API v%s，要求 ≥ v%s）", api, required)
	}
	if strings.Contains(s, "连接正常") {
		return "已连接"
	}
	return strings.TrimSpace(s)
}

func colorByStatus(text string, ok bool) string {
	if ok {
		return ansiGreen + text + ansiReset
	}
	return ansiRed + text + ansiReset
}

type itemDisplayState string

const (
	statePass       itemDisplayState = "pass"
	stateFail       itemDisplayState = "fail"
	stateNotRunning itemDisplayState = "not_running"
)

func resolveItemDisplayState(item Item) itemDisplayState {
	if !item.OK {
		return stateFail
	}
	message := strings.TrimSpace(item.Message)
	details := strings.TrimSpace(item.Details)
	if strings.Contains(message, "未运行") || strings.Contains(message, "未检测到运行中的") || strings.Contains(message, "尚未启动") || strings.Contains(message, "不存在") {
		return stateNotRunning
	}
	if item.Name == ItemNameImageSources && (strings.Contains(message, "不可用") || strings.Contains(details, "不可用")) {
		return stateNotRunning
	}
	return statePass
}

func colorByState(text string, state itemDisplayState) string {
	switch state {
	case statePass:
		return ansiGreen + text + ansiReset
	case stateNotRunning:
		return ansiYellow + text + ansiReset
	default:
		return ansiRed + text + ansiReset
	}
}

func colorMirrorDetail(text string) string {
	trimmed := strings.TrimSpace(text)
	switch {
	case strings.Contains(trimmed, "不可用"):
		return colorByStatus(trimmed, false)
	case strings.Contains(trimmed, "可用"):
		return colorByStatus(trimmed, true)
	default:
		return trimmed
	}
}

var ansiRegexp = regexp.MustCompile(`\x1b\[[0-9;]*m`)
