package api

import (
	"context"
	"fmt"
	"net/http"
	"strconv"
	"strings"

	"kwdb-playground/internal/docker"

	"github.com/gin-gonic/gin"
)

func (h *Handler) getAllContainers(c *gin.Context) {
	ctx := c.Request.Context()
	containers, err := h.dockerController.ListContainers(ctx)
	if err != nil {
		h.logger.Error("获取容器列表失败: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("failed to list containers: %v", err)})
		return
	}

	c.JSON(http.StatusOK, containers)
}

func (h *Handler) cleanupAllContainers(c *gin.Context) {
	ctx := c.Request.Context()

	result, err := h.dockerController.CleanupAllContainers(ctx)
	if err != nil {
		h.logger.Error("清理所有容器失败: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("failed to cleanup containers: %v", err)})
		return
	}

	if !result.Success {
		c.JSON(http.StatusPartialContent, result)
		return
	}

	c.JSON(http.StatusOK, result)
}

func (h *Handler) getContainerStatus(c *gin.Context) {
	id := c.Param("id")
	h.logger.Debug("=== 获取容器状态请求 === 容器ID: %s", id)

	if strings.TrimSpace(id) == "" {
		h.logger.Error("容器ID为空，返回400错误")
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "容器ID不能为空",
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
	h.logger.Debug("开始获取容器信息: %s", id)
	containerInfo, err := h.dockerController.GetContainer(ctx, id)
	if err != nil {
		h.logger.Debug("直接获取容器失败: %v，尝试通过列表查找并兜底", err)
		containers, listErr := h.dockerController.ListContainers(ctx)
		if listErr == nil {
			h.logger.Debug("在容器列表中查找匹配的容器，总数: %d", len(containers))
			var foundContainer *docker.ContainerInfo
			for _, container := range containers {
				h.logger.Debug("检查容器: ID=%s, 状态=%s", container.ID, container.State)
				if container.ID == id || strings.HasPrefix(container.ID, id) || strings.Contains(container.ID, id) {
					foundContainer = container
					h.logger.Debug("找到匹配的容器: %s", container.ID)
					break
				}
			}
			if foundContainer != nil {
				containerInfo = foundContainer
			}
		}
		if containerInfo == nil {
			h.logger.Error("未找到匹配的容器，可能尚未注册到内存或已被清理: %s", id)
			c.JSON(http.StatusNotFound, gin.H{
				"error": "容器不存在或尚未就绪，请稍后重试",
			})
			return
		}
	} else {
		h.logger.Debug("直接获取容器成功: ID=%s, 状态=%s", containerInfo.ID, containerInfo.State)
	}

	h.logger.Debug("返回容器状态: ID=%s, 状态=%s", containerInfo.ID, containerInfo.State)
	c.JSON(http.StatusOK, gin.H{
		"status":      containerInfo.State,
		"containerId": id,
		"info": gin.H{
			"id":        containerInfo.ID,
			"courseId":  containerInfo.CourseID,
			"dockerId":  containerInfo.DockerID,
			"image":     containerInfo.Image,
			"startedAt": containerInfo.StartedAt,
			"ports":     containerInfo.Ports,
			"env":       containerInfo.Env,
		},
	})
}

func (h *Handler) getContainerLogs(c *gin.Context) {
	id := c.Param("id")
	h.logger.Debug("[getContainerLogs] 获取容器日志，容器ID: %s", id)

	if strings.TrimSpace(id) == "" {
		h.logger.Error("[getContainerLogs] 错误: 容器ID为空")
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "容器ID不能为空",
		})
		return
	}

	linesStr := c.DefaultQuery("lines", "100")
	lines, err := strconv.Atoi(linesStr)
	if err != nil || lines <= 0 {
		lines = 100
	}

	follow := c.DefaultQuery("follow", "false") == "true"

	if h.dockerController == nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{
			"error": "Docker服务暂不可用",
		})
		return
	}

	ctx := context.Background()
	logs, err := h.dockerController.GetContainerLogs(ctx, id, lines, follow)
	if err != nil {
		h.logger.Error("[getContainerLogs] 获取容器日志失败: %v", err)
		if strings.Contains(err.Error(), "No such container") {
			c.JSON(http.StatusNotFound, gin.H{
				"error": "容器不存在",
			})
		} else {
			c.JSON(http.StatusInternalServerError, gin.H{
				"error": fmt.Sprintf("获取容器日志失败: %v", err),
			})
		}
		return
	}

	h.logger.Debug("[getContainerLogs] 容器日志获取成功")

	c.JSON(http.StatusOK, gin.H{
		"logs":        logs,
		"containerId": id,
		"lines":       lines,
		"follow":      follow,
	})
}

func (h *Handler) restartContainer(c *gin.Context) {
	id := c.Param("id")
	h.logger.Info("[restartContainer] 重启容器，容器ID: %s", id)

	if strings.TrimSpace(id) == "" {
		h.logger.Error("[restartContainer] 错误: 容器ID为空")
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "容器ID不能为空",
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
	err := h.dockerController.RestartContainer(ctx, id)
	if err != nil {
		h.logger.Error("[restartContainer] 重启容器失败: %v", err)
		if strings.Contains(err.Error(), "No such container") {
			c.JSON(http.StatusNotFound, gin.H{
				"error": "容器不存在",
			})
		} else {
			c.JSON(http.StatusInternalServerError, gin.H{
				"error": fmt.Sprintf("容器重启失败: %v", err),
			})
		}
		return
	}

	h.logger.Info("[restartContainer] 容器重启成功，容器ID: %s", id)
	c.JSON(http.StatusOK, gin.H{
		"message":     "容器重启成功",
		"containerId": id,
	})
}

func (h *Handler) stopContainerByID(c *gin.Context) {
	id := c.Param("id")
	h.logger.Info("[stopContainerByID] 开始停止容器，容器ID: %s", id)

	if strings.TrimSpace(id) == "" {
		h.logger.Error("[stopContainerByID] 错误: 容器ID为空")
		c.JSON(http.StatusBadRequest, gin.H{"error": "容器ID不能为空"})
		return
	}

	if h.dockerController == nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "Docker服务暂不可用"})
		return
	}

	ctx := context.Background()
	if err := h.dockerController.StopContainer(ctx, id); err != nil {
		h.logger.Warn("[stopContainerByID] 停止容器失败，继续删除: %v", err)
	}

	if err := h.dockerController.RemoveContainer(ctx, id); err != nil {
		h.logger.Error("[stopContainerByID] 删除容器失败: %v", err)
		if strings.Contains(err.Error(), "not found") || strings.Contains(err.Error(), "No such container") {
			c.JSON(http.StatusNotFound, gin.H{"error": "容器不存在"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("容器操作失败: %v", err)})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "容器停止成功", "containerId": id})
}

func (h *Handler) pauseContainer(c *gin.Context) {
	id := c.Param("id")
	h.logger.Info("[pauseContainer] 暂停容器，容器ID: %s", id)

	if strings.TrimSpace(id) == "" {
		h.logger.Error("[pauseContainer] 错误: 容器ID为空")
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "容器ID不能为空",
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
	err := h.dockerController.PauseContainer(ctx, id)
	if err != nil {
		h.logger.Error("[pauseContainer] 暂停容器失败: %v", err)
		if strings.Contains(err.Error(), "No such container") || strings.Contains(err.Error(), "not found") {
			c.JSON(http.StatusNotFound, gin.H{
				"error": "容器不存在",
			})
		} else {
			c.JSON(http.StatusInternalServerError, gin.H{
				"error": fmt.Sprintf("容器暂停失败: %v", err),
			})
		}
		return
	}

	h.logger.Info("[pauseContainer] 容器暂停成功，容器ID: %s", id)
	c.JSON(http.StatusOK, gin.H{
		"message":     "容器暂停成功",
		"containerId": id,
	})
}

func (h *Handler) unpauseContainer(c *gin.Context) {
	id := c.Param("id")
	h.logger.Info("[unpauseContainer] 恢复容器，容器ID: %s", id)

	if strings.TrimSpace(id) == "" {
		h.logger.Error("[unpauseContainer] 错误: 容器ID为空")
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "容器ID不能为空",
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
	err := h.dockerController.UnpauseContainer(ctx, id)
	if err != nil {
		h.logger.Error("[unpauseContainer] 恢复容器失败: %v", err)
		if strings.Contains(err.Error(), "No such container") || strings.Contains(err.Error(), "not found") {
			c.JSON(http.StatusNotFound, gin.H{
				"error": "容器不存在",
			})
		} else {
			c.JSON(http.StatusInternalServerError, gin.H{
				"error": fmt.Sprintf("容器恢复失败: %v", err),
			})
		}
		return
	}

	h.logger.Info("[unpauseContainer] 容器恢复成功，容器ID: %s", id)
	c.JSON(http.StatusOK, gin.H{
		"message":     "容器恢复成功",
		"containerId": id,
	})
}
