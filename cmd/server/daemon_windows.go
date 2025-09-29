//go:build windows

package server

import "fmt"

// isProcessRunning（Windows）
// 简化为始终返回 false，以避免依赖不可用的信号语义。
// Windows 下建议通过任务管理器或服务管理查询进程状态。
func isProcessRunning(_ int) bool {
	return false
}

// runAsDaemon（Windows）
// Windows 平台不支持 Unix 风格的 Setsid 守护模式，这里返回明确错误提示。
func runAsDaemon(_ string, _ string, _ []string) error {
	return fmt.Errorf("守护进程模式在 Windows 未实现；请在 Windows 下以服务或计划任务方式运行")
}
