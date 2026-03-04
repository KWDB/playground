package api

import (
	"context"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"strings"

	"kwdb-playground/internal/docker"

	"github.com/gin-gonic/gin"
)

type startCourseRequest struct {
	Image string `json:"image"`
}

func (h *Handler) beginCourseStart(courseID string) bool {
	h.courseStartMu.Lock()
	defer h.courseStartMu.Unlock()

	if h.courseStartInProgress == nil {
		h.courseStartInProgress = map[string]bool{}
	}

	if h.courseStartInProgress[courseID] {
		return false
	}

	h.courseStartInProgress[courseID] = true
	return true
}

func (h *Handler) finishCourseStart(courseID string) {
	h.courseStartMu.Lock()
	defer h.courseStartMu.Unlock()

	if h.courseStartInProgress == nil {
		return
	}
	delete(h.courseStartInProgress, courseID)
}

func parseStartCourseRequest(c *gin.Context) startCourseRequest {
	var requestBody startCourseRequest
	_ = c.ShouldBindJSON(&requestBody)
	return requestBody
}

func resolveStartCourseImage(requestImage string, backendImage string) string {
	imageName := "kwdb/kwdb:latest"
	if requestImage != "" {
		return requestImage
	}
	if backendImage != "" {
		return backendImage
	}
	return imageName
}

func normalizeCourseCmd(cmd []string) []string {
	defaultCmd := []string{"/bin/bash", "-c", "while true; do sleep 3600; done"}
	if cmd == nil {
		return defaultCmd
	}
	if len(cmd) == 1 {
		single := strings.TrimSpace(cmd[0])
		if strings.Contains(single, " ") {
			return []string{"/bin/bash", "-lc", single}
		}
		return cmd
	}
	return cmd
}

func (h *Handler) startCourse(c *gin.Context) {
	id := c.Param("id")
	h.logger.Debug("[startCourse] 开始启动课程容器，课程ID: %s", id)

	if strings.TrimSpace(id) == "" {
		h.logger.Error("[startCourse] 错误: 课程ID为空")
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "课程ID不能为空",
		})
		return
	}

	if !h.beginCourseStart(id) {
		h.logger.Warn("[startCourse] 课程 %s 已有启动任务在进行中", id)
		c.JSON(http.StatusConflict, gin.H{
			"error": "课程容器正在启动中，请稍后重试",
		})
		return
	}
	defer h.finishCourseStart(id)

	requestBody := parseStartCourseRequest(c)
	ctx := context.Background()

	course, exists := h.courseService.GetCourse(id)
	if !exists {
		h.logger.Error("[startCourse] 错误: 课程不存在，课程ID: %s", id)
		c.JSON(http.StatusNotFound, gin.H{
			"error": "课程不存在",
		})
		return
	}

	h.logger.Debug("[startCourse] 找到课程: %s，标题: %s", id, course.Title)

	imageName := resolveStartCourseImage(requestBody.Image, course.Backend.ImageID)
	if requestBody.Image != "" {
		h.logger.Debug("[startCourse] 使用请求中指定的镜像: %s", imageName)
	} else if course.Backend.ImageID != "" {
		h.logger.Debug("[startCourse] 使用课程指定镜像: %s", imageName)
	} else {
		h.logger.Debug("[startCourse] 使用默认镜像: %s", imageName)
	}

	if h.dockerController == nil {
		h.logger.Error("[startCourse] 错误: Docker控制器未初始化")
		c.JSON(http.StatusServiceUnavailable, gin.H{
			"error": "Docker服务暂不可用",
		})
		return
	}

	workingDir := "/root"
	if course.Backend.Workspace != "" {
		workingDir = course.Backend.Workspace
		h.logger.Debug("[startCourse] 使用课程配置的工作目录: %s", workingDir)
	} else {
		h.logger.Debug("[startCourse] 使用默认工作目录: %s", workingDir)
	}

	cmd := normalizeCourseCmd(course.Backend.Cmd)
	if course.Backend.Cmd != nil {
		h.logger.Debug("[startCourse] 使用课程配置的Cmd(规范化后): %v", cmd)
	} else {
		h.logger.Debug("[startCourse] 使用默认Cmd: %v", cmd)
	}

	volumes := make(map[string]string)
	var filesToInject map[string][]byte

	if len(course.Backend.Volumes) > 0 && h.cfg.Course.DockerDeploy {
		filesToInject = make(map[string][]byte)
		for _, bind := range course.Backend.Volumes {
			b := strings.TrimSpace(bind)
			if b == "" {
				continue
			}
			parts := strings.SplitN(b, ":", 3)
			if len(parts) < 2 {
				h.logger.Warn("[startCourse] 无效的卷绑定: %s，期望格式 source:container[:opts]", b)
				continue
			}
			sourcePath := strings.TrimSpace(parts[0])
			containerPath := strings.TrimSpace(parts[1])

			if strings.HasPrefix(sourcePath, "./") {
				sourcePath = sourcePath[2:]
			}

			content, err := h.courseService.ReadCourseFile(course.ID, sourcePath)
			if err != nil {
				h.logger.Error("[startCourse] Docker模式读取课程文件失败: %s/%s: %v", course.ID, sourcePath, err)
				c.JSON(http.StatusInternalServerError, gin.H{
					"error": fmt.Sprintf("读取课程文件失败: %s: %v", sourcePath, err),
				})
				return
			}
			filesToInject[containerPath] = content
			h.logger.Debug("[startCourse] Docker模式准备注入文件: %s -> %s (%d bytes)", sourcePath, containerPath, len(content))
		}
	} else if len(course.Backend.Volumes) > 0 {
		baseDir := h.cfg.Course.Dir
		if !filepath.IsAbs(baseDir) {
			if absBase, err := filepath.Abs(baseDir); err == nil {
				baseDir = absBase
			} else {
				h.logger.Warn("[startCourse] 课程根目录解析绝对路径失败: %s, err: %v", baseDir, err)
			}
		}
		courseBase := filepath.Join(baseDir, course.ID)

		for _, bind := range course.Backend.Volumes {
			b := strings.TrimSpace(bind)
			if b == "" {
				continue
			}
			parts := strings.SplitN(b, ":", 3)
			if len(parts) < 2 {
				h.logger.Warn("[startCourse] 无效的卷绑定: %s，期望格式 host:container[:opts]", b)
				continue
			}

			hostPath := strings.TrimSpace(parts[0])
			containerPath := strings.TrimSpace(parts[1])
			if len(parts) == 3 && strings.TrimSpace(parts[2]) != "" {
				containerPath = containerPath + ":" + strings.TrimSpace(parts[2])
			}

			if hostPath == "~" || strings.HasPrefix(hostPath, "~/") {
				if home, herr := os.UserHomeDir(); herr == nil {
					hostPath = filepath.Join(home, strings.TrimPrefix(hostPath, "~"))
				} else {
					h.logger.Warn("[startCourse] 无法解析用户主目录用于卷绑定: %v", herr)
				}
			}

			if !filepath.IsAbs(hostPath) {
				hostPath = filepath.Join(courseBase, hostPath)
			}
			hostPath = filepath.Clean(hostPath)
			if absHost, err := filepath.Abs(hostPath); err == nil {
				hostPath = absHost
			}

			if _, err := os.Stat(hostPath); os.IsNotExist(err) {
				h.logger.Warn("[startCourse] 主机路径不存在: %s (课程: %s)", hostPath, course.ID)
			}

			if !strings.HasPrefix(containerPath, "/") {
				h.logger.Warn("[startCourse] 容器路径不是绝对路径: %s，建议以/开始", containerPath)
			}

			volumes[hostPath] = containerPath
		}
		h.logger.Debug("[startCourse] 已解析卷绑定(绝对路径): %v", volumes)
	}

	env := make(map[string]string)
	if len(course.Backend.Env) > 0 {
		for _, e := range course.Backend.Env {
			parts := strings.SplitN(e, "=", 2)
			if len(parts) == 2 {
				env[parts[0]] = parts[1]
			}
		}
		h.logger.Debug("[startCourse] 已解析环境变量: %v", env)
	}

	config := &docker.ContainerConfig{
		Image:       imageName,
		WorkingDir:  workingDir,
		Cmd:         cmd,
		Privileged:  course.Backend.Privileged,
		Ports:       map[string]string{"26257": fmt.Sprintf("%d", course.Backend.Port)},
		Volumes:     volumes,
		Env:         env,
		MemoryLimit: 512 * 1024 * 1024,
	}

	h.logger.Debug("[startCourse] 创建容器配置完成，镜像: %s，工作目录: %s，Cmd: %v, Privileged: %v",
		config.Image, config.WorkingDir, config.Cmd, config.Privileged)

	progressCallback := func(progress docker.ImagePullProgress) {
		h.logger.Debug("[startCourse] 镜像拉取进度: %s - %s", progress.ImageName, progress.Status)
		h.terminalManager.BroadcastImagePullProgress(progress)
	}

	h.logger.Debug("[startCourse] 开始创建容器...")

	containerInfo, err := h.dockerController.CreateContainerWithProgress(ctx, id, config, progressCallback)
	if err != nil {
		h.logger.Error("[startCourse] 容器创建失败: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": fmt.Sprintf("容器创建失败: %v", err),
		})
		return
	}

	h.logger.Info("[startCourse] 容器创建成功，容器ID: %s，DockerID: %s", containerInfo.ID, containerInfo.DockerID)

	if len(filesToInject) > 0 {
		h.logger.Debug("[startCourse] Docker模式注入 %d 个文件到容器 %s", len(filesToInject), containerInfo.ID)
		if err := h.dockerController.CopyFilesToContainer(ctx, containerInfo.ID, filesToInject); err != nil {
			h.logger.Error("[startCourse] 文件注入失败: %v，开始清理容器", err)
			if cleanupErr := h.dockerController.RemoveContainer(ctx, containerInfo.ID); cleanupErr != nil {
				h.logger.Warn("[startCourse] 清理容器失败: %v", cleanupErr)
			}
			c.JSON(http.StatusInternalServerError, gin.H{
				"error": fmt.Sprintf("文件注入失败: %v", err),
			})
			return
		}
		h.logger.Info("[startCourse] 文件注入完成")
	}

	h.logger.Debug("[startCourse] 开始启动容器: %s", containerInfo.ID)
	err = h.dockerController.StartContainer(ctx, containerInfo.ID)
	if err != nil {
		h.logger.Error("[startCourse] 容器启动失败: %v，开始清理容器", err)
		if cleanupErr := h.dockerController.RemoveContainer(ctx, containerInfo.ID); cleanupErr != nil {
			h.logger.Warn("[startCourse] 清理容器失败: %v", cleanupErr)
		}
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": fmt.Sprintf("容器启动失败: %v", err),
		})
		return
	}

	h.logger.Info("[startCourse] 容器启动成功，课程ID: %s，容器ID: %s，镜像: %s", id, containerInfo.ID, imageName)
	c.JSON(http.StatusOK, gin.H{
		"message":     "课程容器启动成功",
		"courseId":    id,
		"containerId": containerInfo.ID,
		"image":       imageName,
	})
}

func (h *Handler) resolveDBHost(ctx context.Context, courseID string) string {
	if !h.cfg.Course.DockerDeploy {
		return "localhost"
	}
	container, err := h.findContainerByCourseID(ctx, courseID)
	if err != nil {
		h.logger.Warn("resolveDBHost: 查找容器失败，回退到localhost: %v", err)
		return "localhost"
	}
	ip, err := h.dockerController.GetContainerIP(ctx, container.ID)
	if err != nil {
		h.logger.Warn("resolveDBHost: 获取容器IP失败，回退到localhost: %v", err)
		return "localhost"
	}
	return ip
}

func (h *Handler) findCourseContainerByState(ctx context.Context, courseID string, preferredStates ...docker.ContainerState) (*docker.ContainerInfo, error) {
	if strings.TrimSpace(courseID) == "" {
		return nil, fmt.Errorf("课程ID不能为空")
	}

	if h.dockerController == nil {
		return nil, fmt.Errorf("Docker服务不可用")
	}

	coursePrefix := fmt.Sprintf("kwdb-playground-%s-", courseID)
	containers, err := h.dockerController.ListContainers(ctx)
	if err != nil {
		return nil, fmt.Errorf("获取容器列表失败: %v", err)
	}

	var target *docker.ContainerInfo
	for _, container := range containers {
		if !strings.HasPrefix(container.ID, coursePrefix) {
			continue
		}
		for _, preferredState := range preferredStates {
			if container.State == preferredState {
				return container, nil
			}
		}
		if target == nil || container.StartedAt.After(target.StartedAt) {
			target = container
		}
	}

	if target == nil {
		return nil, fmt.Errorf("未找到课程 %s 的容器", courseID)
	}

	return target, nil
}

func (h *Handler) findContainerByCourseID(ctx context.Context, courseID string) (*docker.ContainerInfo, error) {
	return h.findCourseContainerByState(ctx, courseID)
}

func (h *Handler) stopCourse(c *gin.Context) {
	id := c.Param("id")
	h.logger.Info("[stopCourse] 开始停止课程容器，课程ID: %s", id)

	if strings.TrimSpace(id) == "" {
		h.logger.Error("[stopCourse] 错误: 课程ID为空")
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "课程ID不能为空",
		})
		return
	}

	if h.dockerController == nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{
			"error": "Docker服务暂不可用",
		})
		return
	}

	ctx := context.Background()
	target, err := h.findCourseContainerByState(ctx, id, docker.StateRunning, docker.StateStarting)
	if err != nil {
		h.logger.Error("[stopCourse] %v", err)
		c.JSON(http.StatusNotFound, gin.H{
			"error": "未找到课程对应的容器",
		})
		return
	}

	h.logger.Debug("[stopCourse] 正在停止容器: %s", target.ID)
	err = h.dockerController.StopContainer(ctx, target.ID)
	if err != nil {
		h.logger.Warn("[stopCourse] 停止容器失败，将继续尝试删除容器: %v", err)
	} else {
		h.logger.Info("[stopCourse] 容器停止成功: %s", target.ID)
	}

	h.logger.Debug("[stopCourse] 正在删除容器: %s", target.ID)
	err = h.dockerController.RemoveContainer(ctx, target.ID)
	if err != nil {
		h.logger.Error("[stopCourse] 删除容器失败: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": fmt.Sprintf("容器删除失败: %v", err),
		})
		return
	}
	h.logger.Debug("[stopCourse] 容器删除成功: %s", target.ID)

	c.JSON(http.StatusOK, gin.H{
		"message":     "课程容器停止成功",
		"courseId":    id,
		"containerId": target.ID,
	})
}

func (h *Handler) pauseCourse(c *gin.Context) {
	id := c.Param("id")
	h.logger.Info("[pauseCourse] 开始暂停课程容器，课程ID: %s", id)

	if strings.TrimSpace(id) == "" {
		h.logger.Error("[pauseCourse] 错误: 课程ID为空")
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "课程ID不能为空",
		})
		return
	}

	if h.dockerController == nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{
			"error": "Docker服务暂不可用",
		})
		return
	}

	ctx := context.Background()
	target, err := h.findCourseContainerByState(ctx, id, docker.StateRunning)
	if err != nil {
		h.logger.Error("[pauseCourse] %v", err)
		c.JSON(http.StatusNotFound, gin.H{
			"error": "未找到课程对应的容器",
		})
		return
	}

	if target.State != docker.StateRunning {
		h.logger.Warn("[pauseCourse] 容器状态不是运行中: %s, 状态: %s", target.ID, target.State)
		c.JSON(http.StatusBadRequest, gin.H{
			"error": fmt.Sprintf("容器状态为 %s，只能暂停运行中的容器", target.State),
		})
		return
	}

	h.logger.Debug("[pauseCourse] 正在暂停容器: %s", target.ID)
	err = h.dockerController.PauseContainer(ctx, target.ID)
	if err != nil {
		h.logger.Error("[pauseCourse] 暂停容器失败: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": fmt.Sprintf("容器暂停失败: %v", err),
		})
		return
	}

	h.logger.Info("[pauseCourse] 容器暂停成功: %s", target.ID)
	c.JSON(http.StatusOK, gin.H{
		"message":     "课程容器暂停成功",
		"courseId":    id,
		"containerId": target.ID,
	})
}

func (h *Handler) resumeCourse(c *gin.Context) {
	id := c.Param("id")
	h.logger.Info("[resumeCourse] 开始恢复课程容器，课程ID: %s", id)

	if strings.TrimSpace(id) == "" {
		h.logger.Error("[resumeCourse] 错误: 课程ID为空")
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "课程ID不能为空",
		})
		return
	}

	if h.dockerController == nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{
			"error": "Docker服务暂不可用",
		})
		return
	}

	ctx := context.Background()
	target, err := h.findCourseContainerByState(ctx, id, docker.StatePaused)
	if err != nil {
		h.logger.Error("[resumeCourse] %v", err)
		c.JSON(http.StatusNotFound, gin.H{
			"error": "未找到课程对应的容器",
		})
		return
	}

	if target.State != docker.StatePaused {
		h.logger.Warn("[resumeCourse] 容器状态不是暂停: %s, 状态: %s", target.ID, target.State)
		c.JSON(http.StatusBadRequest, gin.H{
			"error": fmt.Sprintf("容器状态为 %s，只能恢复暂停的容器", target.State),
		})
		return
	}

	h.logger.Debug("[resumeCourse] 正在恢复容器: %s", target.ID)
	err = h.dockerController.UnpauseContainer(ctx, target.ID)
	if err != nil {
		h.logger.Error("[resumeCourse] 恢复容器失败: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": fmt.Sprintf("容器恢复失败: %v", err),
		})
		return
	}

	h.logger.Info("[resumeCourse] 容器恢复成功: %s", target.ID)
	c.JSON(http.StatusOK, gin.H{
		"message":     "课程容器恢复成功",
		"courseId":    id,
		"containerId": target.ID,
	})
}
