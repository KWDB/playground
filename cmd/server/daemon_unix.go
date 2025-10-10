//go:build !windows

package server

import (
	"fmt"
	"os"
	"os/exec"
	"syscall"
)

// isProcessRunning 检查给定 PID 的进程是否仍在运行（Unix）
func isProcessRunning(pid int) bool {
	if pid <= 0 {
		return false
	}
	return syscall.Kill(pid, 0) == nil
}

// runAsDaemon 以守护进程模式启动自身（Unix）
func runAsDaemon(pidFile, logFile string, args []string) error {
	exePath, err := os.Executable()
	if err != nil {
		return fmt.Errorf("无法获取可执行文件路径: %w", err)
	}

	childArgs := append([]string{"server"}, filterDaemonFlags(args)...)

	if err = ensureDirForFile(logFile); err != nil {
		return fmt.Errorf("创建日志目录失败: %w", err)
	}

	logFH, err := os.OpenFile(logFile, os.O_CREATE|os.O_APPEND|os.O_WRONLY, 0o644)
	if err != nil {
		return fmt.Errorf("打开日志文件失败: %w", err)
	}
	defer logFH.Close()

	devNull, err := os.OpenFile(os.DevNull, os.O_RDWR, 0)
	if err != nil {
		return fmt.Errorf("打开 /dev/null 失败: %w", err)
	}
	defer devNull.Close()

	cmd := exec.Command(exePath, childArgs...)
	cmd.Stdout = logFH
	cmd.Stderr = logFH
	cmd.Stdin = devNull
	cmd.SysProcAttr = &syscall.SysProcAttr{Setsid: true}
	cmd.Env = append(os.Environ(), "DAEMON_MODE=1")

	if err := cmd.Start(); err != nil {
		return fmt.Errorf("守护子进程启动失败: %w", err)
	}

	if err := writePID(pidFile, cmd.Process.Pid); err != nil {
		return fmt.Errorf("写入 PID 文件失败: %w", err)
	}

	fmt.Printf("守护进程启动成功，PID=%d，日志=%s，PID文件=%s\n", cmd.Process.Pid, logFile, pidFile)
	return nil
}
