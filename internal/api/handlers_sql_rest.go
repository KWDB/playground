package api

import (
	"context"
	"fmt"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
)

func (h *Handler) sqlInfo(c *gin.Context) {
	courseID := c.Query("courseId")
	if courseID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "缺少 courseId"})
		return
	}
	courseObj, exists := h.courseService.GetCourse(courseID)
	if !exists {
		c.JSON(http.StatusNotFound, gin.H{"error": "课程不存在"})
		return
	}
	port := h.resolveSQLRuntimePort(c.Request.Context(), courseObj)
	if port <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "课程未配置 backend.port"})
		return
	}
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	courseForConnect := *courseObj
	courseForConnect.Backend.Port = port
	if err := h.sqlDriverManager.EnsureReady(ctx, &courseForConnect, h.resolveDBHost(ctx, courseID)); err != nil {
		c.JSON(http.StatusOK, gin.H{
			"connected": false,
			"port":      port,
			"version":   "",
			"arch":      "",
			"buildTime": "",
			"message":   fmt.Sprintf("KWDB未就绪: %v", err),
		})
		return
	}
	pool := h.sqlDriverManager.Pool(courseID)
	var version string
	var arch string
	var buildTime string
	if err := pool.QueryRow(ctx, "SELECT version()").Scan(&version); err == nil {
	} else {
		_ = err
	}
	c.JSON(http.StatusOK, gin.H{
		"version":   version,
		"port":      port,
		"arch":      arch,
		"buildTime": buildTime,
		"connected": true,
	})
}

func (h *Handler) sqlHealth(c *gin.Context) {
	courseID := c.Query("courseId")
	if courseID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "缺少 courseId"})
		return
	}
	courseObj, exists := h.courseService.GetCourse(courseID)
	if !exists {
		c.JSON(http.StatusNotFound, gin.H{"error": "课程不存在"})
		return
	}
	port := h.resolveSQLRuntimePort(c.Request.Context(), courseObj)
	if port <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "课程未配置 backend.port"})
		return
	}
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	courseForConnect := *courseObj
	courseForConnect.Backend.Port = port
	if err := h.sqlDriverManager.EnsureReady(ctx, &courseForConnect, h.resolveDBHost(ctx, courseID)); err != nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{"status": "down", "message": err.Error(), "port": port})
		return
	}
	start := time.Now()
	var one int
	if err := h.sqlDriverManager.Pool(courseID).QueryRow(ctx, "SELECT 1").Scan(&one); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"status": "error", "message": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"status": "ok", "latency": time.Since(start).String()})
}
