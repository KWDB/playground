package api

import (
	"fmt"
	"net/http"

	"kwdb-playground/internal/check"
	"kwdb-playground/internal/config"

	"github.com/gin-gonic/gin"
)

func (h *Handler) healthCheck(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"status":  "ok",
		"message": "KWDB Playground is running",
	})
}

func (h *Handler) getVersion(c *gin.Context) {
	version := "dev"
	if h.cfg != nil {
		version = config.Version
	}
	c.JSON(http.StatusOK, gin.H{
		"version": version,
	})
}

func (h *Handler) envCheck(c *gin.Context) {
	if h.logger != nil {
		h.logger.Info("Handling /api/check request")
	}
	if h.cfg == nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "配置未初始化"})
		return
	}
	items := make([]check.Item, 0, 4)

	dockerOK, dockerMsg, dockerDetails := check.DockerEnv()
	items = append(items, check.Item{Name: "Docker 环境", OK: dockerOK, Message: dockerMsg, Details: dockerDetails})

	imageOK, imageMsg, imageDetails := check.ImageSourcesAvailability()
	items = append(items, check.Item{Name: "镜像源可用性", OK: imageOK, Message: imageMsg, Details: imageDetails})

	coursesOK, coursesMsg := check.CoursesIntegrity(h.courseService)
	items = append(items, check.Item{Name: "课程加载与完整性", OK: coursesOK, Message: coursesMsg})

	serviceOK, serviceMsg := check.ServiceHealth(h.cfg.Server.Host, h.cfg.Server.Port)
	items = append(items, check.Item{Name: fmt.Sprintf("服务健康检查 (%s:%d)", h.cfg.Server.Host, h.cfg.Server.Port), OK: serviceOK, Message: serviceMsg})

	ok := true
	for _, it := range items {
		if !it.OK {
			ok = false
		}
	}
	c.JSON(http.StatusOK, check.Summary{OK: ok, Items: items})
}
