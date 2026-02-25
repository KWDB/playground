package stop

import (
	"fmt"
	"os"
	"strconv"
	"strings"
	"syscall"
	"time"

	"github.com/spf13/cobra"
)

const (
	pidFilePath = "tmp/kwdb-playground.pid"
)

// isProcessRunning 检查给定 PID 的进程是否仍在运行
func isProcessRunning(pid int) bool {
	if pid <= 0 {
		return false
	}
	return syscall.Kill(pid, 0) == nil
}

// readPIDFromFile 从 PID 文件读取进程号
func readPIDFromFile(filePath string) (int, bool) {
	data, err := os.ReadFile(filePath)
	if err != nil || len(data) == 0 {
		return 0, false
	}
	pid, err := strconv.Atoi(strings.TrimSpace(string(data)))
	if err != nil {
		return 0, false
	}
	return pid, true
}

// NewCommand 创建 stop 子命令
func NewCommand() *cobra.Command {
	cmd := &cobra.Command{
		Use:   "stop",
		Short: "停止 KWDB Playground 守护进程",
		Long:  "读取 PID 文件并终止对应的 KWDB Playground 进程",
		RunE: func(cmd *cobra.Command, _ []string) error {
			pid, ok := readPIDFromFile(pidFilePath)
			if !ok {
				fmt.Printf("未找到 PID 文件: %s\n", pidFilePath)
				fmt.Println("可能守护进程未运行")
				os.Exit(1)
			}

			if !isProcessRunning(pid) {
				fmt.Printf("进程 %d 不在运行中，清理 PID 文件\n", pid)
				_ = os.Remove(pidFilePath)
				os.Exit(0)
			}

			// 发送 SIGTERM 信号
			if err := syscall.Kill(pid, syscall.SIGTERM); err != nil {
				fmt.Printf("终止进程失败: %v\n", err)
				os.Exit(1)
			}

			// 等待进程退出
			fmt.Printf("已发送终止信号到进程 %d，等待退出...\n", pid)

			// 等待进程退出
			for i := 0; i < 10; i++ {
				if !isProcessRunning(pid) {
					_ = os.Remove(pidFilePath)
					fmt.Println("Playground 进程已停止")
					return nil
				}
				time.Sleep(500 * time.Millisecond)
				fmt.Print(".")
			}
			fmt.Println()

			// 强制终止
			fmt.Printf("进程 %d 未响应 SIGTERM，发送 SIGKILL\n", pid)
			if err := syscall.Kill(pid, syscall.SIGKILL); err != nil {
				fmt.Printf("强制终止失败: %v\n", err)
				os.Exit(1)
			}

			_ = os.Remove(pidFilePath)
			fmt.Println("守护进程已强制停止")
			return nil
		},
	}

	return cmd
}
