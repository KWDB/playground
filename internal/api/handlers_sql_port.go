package api

import (
	"context"
	"strconv"
	"strings"

	"kwdb-playground/internal/course"
	"kwdb-playground/internal/docker"
)

func resolveSQLPortByRuntime(courseObj *course.Course, container *docker.ContainerInfo, dockerDeploy bool) int {
	if courseObj == nil {
		return 0
	}

	fallbackPort := courseObj.Backend.Port
	if fallbackPort <= 0 {
		return fallbackPort
	}

	containerPort := courseObj.Backend.ContainerPort
	if containerPort <= 0 {
		containerPort = 26257
	}

	if dockerDeploy {
		return containerPort
	}

	if container == nil || len(container.Ports) == 0 {
		return fallbackPort
	}

	candidateKeys := []string{
		strconv.Itoa(containerPort),
		strconv.Itoa(fallbackPort),
	}

	for _, key := range candidateKeys {
		hostPort, ok := container.Ports[key]
		if !ok {
			continue
		}
		parsedPort, err := strconv.Atoi(strings.TrimSpace(hostPort))
		if err == nil && parsedPort > 0 {
			return parsedPort
		}
	}

	return fallbackPort
}

func (h *Handler) resolveSQLRuntimePort(ctx context.Context, courseObj *course.Course) int {
	if courseObj == nil {
		return 0
	}

	dockerDeploy := false
	if h.cfg != nil {
		dockerDeploy = h.cfg.Course.DockerDeploy
	}

	var containerInfo *docker.ContainerInfo
	if !dockerDeploy {
		container, err := h.findContainerByCourseID(ctx, courseObj.ID)
		if err == nil {
			containerInfo = container
		}
	}

	return resolveSQLPortByRuntime(courseObj, containerInfo, dockerDeploy)
}
