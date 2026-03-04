package api

import (
	"fmt"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
)

func (h *Handler) getProgress(c *gin.Context) {
	courseID := c.Param("courseId")
	userID := c.DefaultQuery("userId", "")

	if strings.TrimSpace(courseID) == "" {
		h.logger.Error("[getProgress] 错误: 课程ID为空")
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "课程ID不能为空",
		})
		return
	}

	progress, exists, err := h.courseService.GetProgress(userID, courseID)
	if err != nil {
		h.logger.Error("[getProgress] 获取进度失败: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": fmt.Sprintf("获取进度失败: %v", err),
		})
		return
	}

	h.logger.Debug("[getProgress] 获取进度成功: courseID=%s, exists=%v", courseID, exists)

	if !exists {
		c.JSON(http.StatusOK, gin.H{
			"exists": false,
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"progress": progress,
		"exists":   exists,
	})
}

func (h *Handler) saveProgress(c *gin.Context) {
	courseID := c.Param("courseId")
	userID := c.DefaultQuery("userId", "")

	if strings.TrimSpace(courseID) == "" {
		h.logger.Error("[saveProgress] 错误: 课程ID为空")
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "课程ID不能为空",
		})
		return
	}

	var req struct {
		CurrentStep int  `json:"currentStep"`
		Completed   bool `json:"completed"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		h.logger.Error("[saveProgress] 请求体格式错误: %v", err)
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "请求体格式错误",
		})
		return
	}

	err := h.courseService.SaveProgress(userID, courseID, req.CurrentStep, req.Completed)
	if err != nil {
		h.logger.Error("[saveProgress] 保存进度失败: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": fmt.Sprintf("保存进度失败: %v", err),
		})
		return
	}

	h.logger.Info("[saveProgress] 进度保存成功: courseID=%s, step=%d, completed=%v", courseID, req.CurrentStep, req.Completed)
	c.JSON(http.StatusOK, gin.H{
		"message":  "进度保存成功",
		"courseId": courseID,
	})
}

func (h *Handler) resetProgress(c *gin.Context) {
	courseID := c.Param("courseId")
	userID := c.DefaultQuery("userId", "")

	if strings.TrimSpace(courseID) == "" {
		h.logger.Error("[resetProgress] 错误: 课程ID为空")
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "课程ID不能为空",
		})
		return
	}

	err := h.courseService.ResetProgress(userID, courseID)
	if err != nil {
		h.logger.Error("[resetProgress] 重置进度失败: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": fmt.Sprintf("重置进度失败: %v", err),
		})
		return
	}

	h.logger.Info("[resetProgress] 进度已重置: courseID=%s", courseID)
	c.JSON(http.StatusOK, gin.H{
		"message":  "进度已重置",
		"courseId": courseID,
	})
}

func (h *Handler) resetAllProgress(c *gin.Context) {
	userID := c.DefaultQuery("userId", "")

	err := h.courseService.ResetAllProgress(userID)
	if err != nil {
		h.logger.Error("[resetAllProgress] 重置全部进度失败: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": fmt.Sprintf("重置全部进度失败: %v", err),
		})
		return
	}

	h.logger.Info("[resetAllProgress] 全部进度已重置")
	c.JSON(http.StatusOK, gin.H{
		"message": "全部进度已重置",
	})
}
