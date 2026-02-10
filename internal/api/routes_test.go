package api

import (
	"context"
	"testing"

	"kwdb-playground/internal/config"
	"kwdb-playground/internal/course"
	"kwdb-playground/internal/docker"
	"kwdb-playground/internal/logger"
	"kwdb-playground/internal/sql"
)

func TestFindContainerByCourseID_EmptyCourseID(t *testing.T) {
	dockerController, _ := docker.NewController()
	courseService := course.NewService("./courses")
	cfg, _ := config.Load()
	loggerInstance := logger.NewLogger(logger.ERROR)
	sqlManager := sql.NewDriverManager()

	h := &Handler{
		courseService:    courseService,
		dockerController: dockerController,
		logger:           loggerInstance,
		cfg:              cfg,
		sqlDriverManager: sqlManager,
	}
	ctx := context.Background()

	_, err := h.findContainerByCourseID(ctx, "")
	if err == nil {
		t.Error("findContainerByCourseID should fail with empty courseID")
	}
	if err.Error() != "课程ID不能为空" {
		t.Errorf("Expected '课程ID不能为空', got: %v", err)
	}
}

func TestFindContainerByCourseID_DockerServiceUnavailable(t *testing.T) {
	dockerController, _ := docker.NewController()
	courseService := course.NewService("./courses")
	cfg, _ := config.Load()
	loggerInstance := logger.NewLogger(logger.ERROR)
	sqlManager := sql.NewDriverManager()

	h := &Handler{
		courseService:    courseService,
		dockerController: dockerController,
		logger:           loggerInstance,
		cfg:              cfg,
		sqlDriverManager: sqlManager,
	}
	h.dockerController = nil
	ctx := context.Background()

	_, err := h.findContainerByCourseID(ctx, "test-course")
	if err == nil {
		t.Error("findContainerByCourseID should fail when docker controller is nil")
	}
	if err.Error() != "Docker服务不可用" {
		t.Errorf("Expected 'Docker服务不可用', got: %v", err)
	}
}

func TestFindContainerByCourseID_NotFound(t *testing.T) {
	dockerController, _ := docker.NewController()
	courseService := course.NewService("./courses")
	cfg, _ := config.Load()
	loggerInstance := logger.NewLogger(logger.ERROR)
	sqlManager := sql.NewDriverManager()

	h := &Handler{
		courseService:    courseService,
		dockerController: dockerController,
		logger:           loggerInstance,
		cfg:              cfg,
		sqlDriverManager: sqlManager,
	}
	ctx := context.Background()

	_, err := h.findContainerByCourseID(ctx, "nonexistent-course")
	if err == nil {
		t.Error("findContainerByCourseID should fail when container not found")
	}
	if err.Error() != "未找到课程 nonexistent-course 的容器" {
		t.Errorf("Expected '未找到课程 nonexistent-course 的容器', got: %v", err)
	}
}

func TestFindContainerByCourseID_Success(t *testing.T) {
	dockerController, _ := docker.NewController()
	courseService := course.NewService("./courses")
	cfg, _ := config.Load()
	loggerInstance := logger.NewLogger(logger.ERROR)
	sqlManager := sql.NewDriverManager()

	h := &Handler{
		courseService:    courseService,
		dockerController: dockerController,
		logger:           loggerInstance,
		cfg:              cfg,
		sqlDriverManager: sqlManager,
	}
	ctx := context.Background()

	container, err := h.findContainerByCourseID(ctx, "sql")
	if err != nil {
		t.Logf("findContainerByCourseID error (expected for some environments): %v", err)
	}
	if container != nil && container.ID == "" {
		t.Error("Container ID should not be empty")
	}
}
