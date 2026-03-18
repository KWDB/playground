//go:build windows

package procutil

import (
	"encoding/csv"
	"fmt"
	"os/exec"
	"strconv"
	"strings"
)

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

func ResolveRunningPIDByPort(port int) (int, string, error) {
	out, err := exec.Command("netstat", "-ano", "-p", "tcp").CombinedOutput()
	if err != nil {
		return 0, "", fmt.Errorf("netstat 查询监听进程失败: %v", err)
	}
	lines := strings.Split(string(out), "\n")
	for _, line := range lines {
		fields := strings.Fields(strings.TrimSpace(line))
		if len(fields) < 5 {
			continue
		}
		state := strings.ToUpper(fields[3])
		if state != "LISTENING" {
			continue
		}
		if !addressMatchesPort(fields[1], port) {
			continue
		}
		pid, err := strconv.Atoi(fields[4])
		if err != nil || pid <= 0 {
			continue
		}
		cmdName, _ := resolveCommandByPID(pid)
		if cmdName == "" {
			cmdName = "unknown"
		}
		return pid, fmt.Sprintf("监听端口进程（%s）", cmdName), nil
	}
	return 0, "", fmt.Errorf("未在端口 %d 上发现监听进程", port)
}

func addressMatchesPort(address string, port int) bool {
	idx := strings.LastIndex(address, ":")
	if idx < 0 || idx+1 >= len(address) {
		return false
	}
	p, err := strconv.Atoi(strings.TrimSpace(address[idx+1:]))
	if err != nil {
		return false
	}
	return p == port
}

func resolveCommandByPID(pid int) (string, error) {
	out, err := exec.Command("tasklist", "/FI", fmt.Sprintf("PID eq %d", pid), "/FO", "CSV", "/NH").CombinedOutput()
	if err != nil {
		return "", err
	}
	line := strings.TrimSpace(string(out))
	if line == "" || strings.Contains(line, "No tasks are running") || strings.Contains(line, "没有运行的任务") {
		return "", fmt.Errorf("tasklist 无进程输出")
	}
	reader := csv.NewReader(strings.NewReader(line))
	record, err := reader.Read()
	if err != nil || len(record) == 0 {
		return "", fmt.Errorf("tasklist 输出解析失败")
	}
	return strings.TrimSpace(record[0]), nil
}
