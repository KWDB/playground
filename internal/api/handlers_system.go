package api

import (
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
		h.logger.Info("Handling /api/doctor request")
	}
	if h.cfg == nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "配置未初始化"})
		return
	}
	summary := check.RunFromService(h.courseService, h.cfg.Server.Host, h.cfg.Server.Port)
	c.JSON(http.StatusOK, summary)
}
