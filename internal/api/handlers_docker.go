package api

import (
	"fmt"

	"kwdb-playground/internal/docker"
)

var newDockerControllerWithTerminalManager = docker.NewControllerWithTerminalManager

func (h *Handler) ensureDockerController() (docker.Controller, error) {
	h.dockerControllerMu.Lock()
	defer h.dockerControllerMu.Unlock()

	if h.dockerController != nil {
		return h.dockerController, nil
	}

	controller, err := newDockerControllerWithTerminalManager(h.terminalManager)
	if err != nil {
		return nil, fmt.Errorf("初始化 Docker 控制器失败: %w", err)
	}

	if h.cfg != nil && h.cfg.Course.DockerNetwork != "" {
		controller.SetNetworkName(h.cfg.Course.DockerNetwork)
	}

	h.dockerController = controller
	return controller, nil
}
