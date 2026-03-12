package api

import (
	"context"
	"fmt"
	"kwdb-playground/internal/course"
	"kwdb-playground/internal/docker"
	"net/http"
	"sort"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
)

type preloadCourseImagesRequest struct {
	CourseIDs      []string          `json:"courseIds"`
	ImageOverrides map[string]string `json:"imageOverrides"`
}

type preloadCourseImageResult struct {
	CourseID  string `json:"courseId"`
	Title     string `json:"title"`
	ImageName string `json:"imageName"`
	Status    string `json:"status"`
	Message   string `json:"message"`
}

type courseImageDiagnosticResult struct {
	CourseID    string    `json:"courseId"`
	Title       string    `json:"title"`
	ImageName   string    `json:"imageName"`
	Available   bool      `json:"available"`
	LocalCached bool      `json:"localCached"`
	Message     string    `json:"message"`
	CheckedAt   time.Time `json:"checkedAt"`
	SourceHint  string    `json:"sourceHint"`
}

type cleanupCourseImagesRequest struct {
	ImageNames   []string `json:"imageNames"`
	SourcePrefix string   `json:"sourcePrefix"`
}

func buildImageWithSource(originImageName string, sourcePrefix string) string {
	imageName := strings.TrimSpace(originImageName)
	prefix := strings.TrimSpace(sourcePrefix)
	if imageName == "" || prefix == "" {
		return imageName
	}
	firstSegment := strings.Split(imageName, "/")[0]
	hasRegistryPrefix := strings.Contains(imageName, "/") &&
		(strings.Contains(firstSegment, ".") || strings.Contains(firstSegment, ":") || firstSegment == "localhost")
	normalizedPrefix := prefix
	if !strings.HasSuffix(normalizedPrefix, "/") {
		normalizedPrefix += "/"
	}
	if hasRegistryPrefix {
		segments := strings.Split(imageName, "/")
		if len(segments) <= 1 {
			return normalizedPrefix + imageName
		}
		return normalizedPrefix + strings.Join(segments[1:], "/")
	}
	return normalizedPrefix + imageName
}

func collectTargetCourseIDs(courses map[string]*course.Course, input []string) []string {
	ids := make([]string, 0)
	if len(input) == 0 {
		for id := range courses {
			ids = append(ids, id)
		}
		sort.Strings(ids)
		return ids
	}

	seen := make(map[string]struct{}, len(input))
	for _, rawID := range input {
		id := strings.TrimSpace(rawID)
		if id == "" {
			continue
		}
		if _, exists := courses[id]; !exists {
			continue
		}
		if _, duplicated := seen[id]; duplicated {
			continue
		}
		seen[id] = struct{}{}
		ids = append(ids, id)
	}
	sort.Strings(ids)
	return ids
}

func collectCourseImages(courses map[string]*course.Course, input []string, sourcePrefix string) ([]string, map[string][]*course.Course) {
	imageToCourses := make(map[string][]*course.Course)
	for _, c := range courses {
		imageName := strings.TrimSpace(resolveStartCourseImage("", c.Backend.ImageID))
		imageName = buildImageWithSource(imageName, sourcePrefix)
		if imageName == "" {
			continue
		}
		imageToCourses[imageName] = append(imageToCourses[imageName], c)
	}

	for imageName := range imageToCourses {
		sort.Slice(imageToCourses[imageName], func(i, j int) bool {
			return imageToCourses[imageName][i].Title < imageToCourses[imageName][j].Title
		})
	}

	if len(input) == 0 {
		imageNames := make([]string, 0, len(imageToCourses))
		for imageName := range imageToCourses {
			imageNames = append(imageNames, imageName)
		}
		sort.Strings(imageNames)
		return imageNames, imageToCourses
	}

	seen := make(map[string]struct{}, len(input))
	imageNames := make([]string, 0, len(input))
	for _, rawImageName := range input {
		imageName := strings.TrimSpace(rawImageName)
		if imageName == "" {
			continue
		}
		if _, exists := imageToCourses[imageName]; !exists {
			continue
		}
		if _, duplicated := seen[imageName]; duplicated {
			continue
		}
		seen[imageName] = struct{}{}
		imageNames = append(imageNames, imageName)
	}
	sort.Strings(imageNames)
	return imageNames, imageToCourses
}

func buildLocalImageCleanupItem(imageName string, linkedCourses []*course.Course) docker.LocalImageCleanupItem {
	courseIDs := make([]string, 0, len(linkedCourses))
	courseTitles := make([]string, 0, len(linkedCourses))
	for _, linkedCourse := range linkedCourses {
		courseIDs = append(courseIDs, linkedCourse.ID)
		courseTitles = append(courseTitles, linkedCourse.Title)
	}
	return docker.LocalImageCleanupItem{
		ImageName:    imageName,
		CourseIDs:    courseIDs,
		CourseTitles: courseTitles,
	}
}

func (h *Handler) buildCourseImageDiagnostic(ctx context.Context, courseID string, title string, imageName string) courseImageDiagnosticResult {
	result := courseImageDiagnosticResult{
		CourseID:  courseID,
		Title:     title,
		ImageName: imageName,
		CheckedAt: time.Now(),
	}
	if strings.TrimSpace(imageName) == "" {
		result.Available = false
		result.Message = "课程未配置有效镜像"
		result.SourceHint = "请在课程配置中补充 backend.imageid"
		return result
	}

	localCached, err := h.dockerController.IsImageLocal(ctx, imageName)
	if err != nil {
		result.Available = false
		result.LocalCached = false
		result.Message = fmt.Sprintf("本地镜像检查失败: %v", err)
		result.SourceHint = "请检查 Docker 服务状态后重试"
		return result
	}

	result.Available = localCached
	result.LocalCached = localCached
	if localCached {
		result.Message = "镜像在本地可用"
		result.SourceHint = "镜像已在本地缓存，可直接执行清理或启动课程"
	} else {
		result.Message = "镜像未在本地缓存"
		result.SourceHint = "可先执行预拉取到本地后再启动课程"
	}
	return result
}

func (h *Handler) getCourseImageDiagnostics(c *gin.Context) {
	if h.dockerController == nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{
			"error": "Docker服务暂不可用",
		})
		return
	}

	courses := h.courseService.GetCourses()
	ids := collectTargetCourseIDs(courses, nil)
	results := make([]courseImageDiagnosticResult, 0, len(ids))
	ctx := context.Background()
	sourcePrefix := strings.TrimSpace(c.Query("sourcePrefix"))

	for _, id := range ids {
		course := courses[id]
		imageName := resolveStartCourseImage("", course.Backend.ImageID)
		imageName = buildImageWithSource(imageName, sourcePrefix)
		results = append(results, h.buildCourseImageDiagnostic(ctx, course.ID, course.Title, imageName))
	}

	c.JSON(http.StatusOK, gin.H{
		"results": results,
	})
}

func (h *Handler) preloadCourseImages(c *gin.Context) {
	if h.dockerController == nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{
			"error": "Docker服务暂不可用",
		})
		return
	}

	var req preloadCourseImagesRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "请求参数格式错误",
		})
		return
	}

	courses := h.courseService.GetCourses()
	targetIDs := collectTargetCourseIDs(courses, req.CourseIDs)
	if len(targetIDs) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "未匹配到可预载的课程",
		})
		return
	}

	ctx := context.Background()
	resultsByCourseID := make(map[string]preloadCourseImageResult, len(targetIDs))
	successCount := 0
	imageToCourseIDs := make(map[string][]string, len(targetIDs))

	for _, id := range targetIDs {
		currentCourse := courses[id]
		override := strings.TrimSpace(req.ImageOverrides[id])
		imageName := resolveStartCourseImage(override, currentCourse.Backend.ImageID)

		if strings.TrimSpace(imageName) == "" {
			resultsByCourseID[id] = preloadCourseImageResult{
				CourseID:  id,
				Title:     currentCourse.Title,
				ImageName: imageName,
				Status:    "failed",
				Message:   "课程镜像为空，无法预拉取到本地",
			}
			continue
		}
		imageToCourseIDs[imageName] = append(imageToCourseIDs[imageName], id)
	}

	imageNames := make([]string, 0, len(imageToCourseIDs))
	for imageName := range imageToCourseIDs {
		imageNames = append(imageNames, imageName)
	}
	sort.Strings(imageNames)

	for _, imageName := range imageNames {
		courseIDs := imageToCourseIDs[imageName]

		localExists, localErr := h.dockerController.IsImageLocal(ctx, imageName)
		if localErr != nil {
			for _, courseID := range courseIDs {
				currentCourse := courses[courseID]
				resultsByCourseID[courseID] = preloadCourseImageResult{
					CourseID:  courseID,
					Title:     currentCourse.Title,
					ImageName: imageName,
					Status:    "failed",
					Message:   fmt.Sprintf("检查本地镜像失败: %v", localErr),
				}
			}
			continue
		}

		if localExists {
			for _, courseID := range courseIDs {
				currentCourse := courses[courseID]
				resultsByCourseID[courseID] = preloadCourseImageResult{
					CourseID:  courseID,
					Title:     currentCourse.Title,
					ImageName: imageName,
					Status:    "cached",
					Message:   "镜像已在本地缓存，跳过预拉取",
				}
				successCount++
			}
			continue
		}

		if err := h.dockerController.PullImage(ctx, imageName); err != nil {
			for _, courseID := range courseIDs {
				currentCourse := courses[courseID]
				resultsByCourseID[courseID] = preloadCourseImageResult{
					CourseID:  courseID,
					Title:     currentCourse.Title,
					ImageName: imageName,
					Status:    "failed",
					Message:   fmt.Sprintf("预拉取失败: %v", err),
				}
			}
			continue
		}

		for _, courseID := range courseIDs {
			currentCourse := courses[courseID]
			resultsByCourseID[courseID] = preloadCourseImageResult{
				CourseID:  courseID,
				Title:     currentCourse.Title,
				ImageName: imageName,
				Status:    "pulled",
				Message:   "镜像预拉取完成，已缓存到本地",
			}
			successCount++
		}
	}

	results := make([]preloadCourseImageResult, 0, len(targetIDs))
	for _, id := range targetIDs {
		result, exists := resultsByCourseID[id]
		if !exists {
			currentCourse := courses[id]
			result = preloadCourseImageResult{
				CourseID:  id,
				Title:     currentCourse.Title,
				ImageName: resolveStartCourseImage(strings.TrimSpace(req.ImageOverrides[id]), currentCourse.Backend.ImageID),
				Status:    "failed",
				Message:   "预拉取结果丢失，请重试",
			}
		}
		results = append(results, result)
	}

	c.JSON(http.StatusOK, gin.H{
		"total":        len(results),
		"successCount": successCount,
		"results":      results,
	})
}

func (h *Handler) cleanupCourseImages(c *gin.Context) {
	if h.dockerController == nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{
			"error": "Docker服务暂不可用",
		})
		return
	}

	var req cleanupCourseImagesRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "请求参数格式错误",
		})
		return
	}

	courses := h.courseService.GetCourses()
	targetImages, imageToCourses := collectCourseImages(courses, req.ImageNames, req.SourcePrefix)
	if len(targetImages) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "未匹配到可清理的课程镜像",
		})
		return
	}

	result := h.executeLocalImageCleanup(c.Request.Context(), targetImages, imageToCourses)
	statusCode := http.StatusOK
	if !result.Success {
		statusCode = http.StatusPartialContent
	}
	c.JSON(statusCode, result)
}

func (h *Handler) cleanupAllCourseImages(c *gin.Context) {
	if h.dockerController == nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{
			"error": "Docker服务暂不可用",
		})
		return
	}

	courses := h.courseService.GetCourses()
	sourcePrefix := strings.TrimSpace(c.Query("sourcePrefix"))
	targetImages, imageToCourses := collectCourseImages(courses, nil, sourcePrefix)
	if len(targetImages) == 0 {
		c.JSON(http.StatusOK, docker.LocalImageCleanupResult{
			Success:      true,
			Message:      "当前课程未配置可清理镜像",
			Total:        0,
			SuccessCount: 0,
			FailureCount: 0,
			Results:      []docker.LocalImageCleanupItem{},
		})
		return
	}

	result := h.executeLocalImageCleanup(c.Request.Context(), targetImages, imageToCourses)
	statusCode := http.StatusOK
	if !result.Success {
		statusCode = http.StatusPartialContent
	}
	c.JSON(statusCode, result)
}

func (h *Handler) executeLocalImageCleanup(
	ctx context.Context,
	targetImages []string,
	imageToCourses map[string][]*course.Course,
) docker.LocalImageCleanupResult {
	results := make([]docker.LocalImageCleanupItem, 0, len(targetImages))
	successCount := 0
	failureCount := 0

	for _, imageName := range targetImages {
		item := buildLocalImageCleanupItem(imageName, imageToCourses[imageName])

		exists, err := h.dockerController.IsImageLocal(ctx, imageName)
		if err != nil {
			item.Status = "failed"
			item.Message = fmt.Sprintf("检查本地镜像失败: %v", err)
			results = append(results, item)
			failureCount++
			continue
		}

		if !exists {
			item.Status = "skipped"
			item.Message = "本地镜像不存在，无需清理"
			results = append(results, item)
			successCount++
			continue
		}

		if err := h.dockerController.RemoveLocalImage(ctx, imageName); err != nil {
			item.Status = "failed"
			item.Message = err.Error()
			results = append(results, item)
			failureCount++
			continue
		}

		item.Status = "removed"
		item.Message = "本地镜像已删除"
		results = append(results, item)
		successCount++
	}

	resultMessage := fmt.Sprintf("镜像清理完成：成功 %d，失败 %d。", successCount, failureCount)
	if len(targetImages) == 0 {
		resultMessage = "未匹配到可清理镜像"
	}
	return docker.LocalImageCleanupResult{
		Success:      failureCount == 0,
		Message:      resultMessage,
		Total:        len(targetImages),
		SuccessCount: successCount,
		FailureCount: failureCount,
		Results:      results,
	}
}

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
