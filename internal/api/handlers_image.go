package api

import (
	"context"
	"fmt"
	"net/http"

	"github.com/gin-gonic/gin"
)

func (h *Handler) checkImageAvailability(c *gin.Context) {
	var req struct {
		ImageName string `json:"imageName" binding:"required"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		h.logger.Error("[checkImageAvailability] 参数解析失败: %v", err)
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "镜像名称不能为空",
		})
		return
	}

	h.logger.Info("[checkImageAvailability] 检查镜像可用性: %s", req.ImageName)

	if h.dockerController == nil {
		h.logger.Error("[checkImageAvailability] Docker控制器未初始化")
		c.JSON(http.StatusServiceUnavailable, gin.H{
			"error": "Docker服务暂不可用",
		})
		return
	}

	ctx := context.Background()
	availability, err := h.dockerController.CheckImageAvailability(ctx, req.ImageName)
	if err != nil {
		h.logger.Error("[checkImageAvailability] 检查失败: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": fmt.Sprintf("检查镜像可用性失败: %v", err),
		})
		return
	}

	h.logger.Info("[checkImageAvailability] 检查完成: %s, 可用: %v", req.ImageName, availability.Available)

	c.JSON(http.StatusOK, availability)
}

func (h *Handler) getImageSources(c *gin.Context) {
	h.logger.Info("[getImageSources] 获取镜像源列表")

	sources := []gin.H{
		{
			"id":          "docker-hub",
			"name":        "Docker Hub (默认)",
			"prefix":      "",
			"description": "Docker官方镜像仓库",
			"example":     "kwdb/kwdb:latest",
		},
		{
			"id":          "ghcr",
			"name":        "GitHub Container Registry",
			"prefix":      "ghcr.io/",
			"description": "GitHub 容器镜像仓库",
			"example":     "ghcr.io/kwdb/kwdb:latest",
		},
		{
			"id":          "aliyun",
			"name":        "阿里云 ACR",
			"prefix":      "registry.cn-hangzhou.aliyuncs.com/",
			"description": "阿里云容器镜像服务",
			"example":     "registry.cn-hangzhou.aliyuncs.com/kwdb/kwdb:latest",
		},
		{
			"id":          "custom",
			"name":        "自定义源",
			"prefix":      "",
			"description": "使用自定义的镜像仓库地址",
			"example":     "your-registry.com/kwdb/kwdb:latest",
		},
	}

	c.JSON(http.StatusOK, gin.H{
		"sources": sources,
	})
}
