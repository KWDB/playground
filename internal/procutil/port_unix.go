//go:build !windows

package procutil

import (
	"fmt"
	"os/exec"
	"strconv"
	"strings"
)

func ResolveRunningPIDByPort(port int) (int, string, error) {
	out, err := exec.Command("lsof", "-i", fmt.Sprintf(":%d", port), "-sTCP:LISTEN", "-n", "-P", "-Fp", "-Fc").CombinedOutput()
	if err != nil {
		return 0, "", fmt.Errorf("lsof 查询监听进程失败: %v", err)
	}
	pid, cmd := ParseListenerPIDAndCommand(string(out))
	if pid <= 0 {
		return 0, "", fmt.Errorf("未在端口 %d 上发现监听进程", port)
	}
	if strings.Contains(strings.ToLower(cmd), "kwdb") {
		return pid, fmt.Sprintf("监听端口进程（%s）", cmd), nil
	}
	return pid, fmt.Sprintf("监听端口进程（%s）", cmd), nil
}

func ParseListenerPIDAndCommand(raw string) (int, string) {
	lines := strings.Split(raw, "\n")
	currentPID := 0
	currentCmd := ""
	fallbackPID := 0
	fallbackCmd := ""
	for _, line := range lines {
		line = strings.TrimSpace(line)
		if strings.HasPrefix(line, "p") && len(line) > 1 {
			if currentPID > 0 {
				if strings.Contains(strings.ToLower(currentCmd), "kwdb") {
					return currentPID, currentCmd
				}
				if fallbackPID == 0 {
					fallbackPID, fallbackCmd = currentPID, currentCmd
				}
			}
			p, err := strconv.Atoi(strings.TrimSpace(line[1:]))
			if err != nil || p <= 0 {
				currentPID = 0
				currentCmd = ""
				continue
			}
			currentPID = p
			currentCmd = ""
			continue
		}
		if strings.HasPrefix(line, "c") && len(line) > 1 {
			currentCmd = strings.TrimSpace(line[1:])
		}
	}
	if currentPID > 0 {
		if strings.Contains(strings.ToLower(currentCmd), "kwdb") {
			return currentPID, currentCmd
		}
		if fallbackPID == 0 {
			return currentPID, currentCmd
		}
	}
	return fallbackPID, fallbackCmd
}
