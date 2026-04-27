package api

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"testing/fstest"

	"github.com/gin-gonic/gin"

	"kwdb-playground/internal/config"
	"kwdb-playground/internal/course"
	"kwdb-playground/internal/docker"
	"kwdb-playground/internal/logger"
)

func TestCourseStartInProgressGuard(t *testing.T) {
	h := &Handler{}
	courseID := "sql"

	if ok := h.beginCourseStart(courseID); !ok {
		t.Fatal("first beginCourseStart should return true")
	}

	if ok := h.beginCourseStart(courseID); ok {
		t.Fatal("second beginCourseStart should return false while in progress")
	}

	h.finishCourseStart(courseID)

	if ok := h.beginCourseStart(courseID); !ok {
		t.Fatal("beginCourseStart should return true after finishCourseStart")
	}
}

func TestResolveStartCourseImage(t *testing.T) {
	tests := []struct {
		name         string
		requestImage string
		backendImage string
		want         string
	}{
		{name: "prefer request image", requestImage: "a:b", backendImage: "x:y", want: "a:b"},
		{name: "fallback backend image", requestImage: "", backendImage: "x:y", want: "x:y"},
		{name: "fallback default", requestImage: "", backendImage: "", want: "kwdb/kwdb:latest"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := resolveStartCourseImage(tt.requestImage, tt.backendImage)
			if got != tt.want {
				t.Fatalf("resolveStartCourseImage(%q,%q)=%q, want=%q", tt.requestImage, tt.backendImage, got, tt.want)
			}
		})
	}
}

func TestNormalizeCourseCmd(t *testing.T) {
	tests := []struct {
		name string
		in   []string
		want []string
	}{
		{name: "nil uses default", in: nil, want: []string{"/bin/bash", "-c", "while true; do sleep 3600; done"}},
		{name: "single token unchanged", in: []string{"postgres"}, want: []string{"postgres"}},
		{name: "single with spaces wrapped", in: []string{"python app.py"}, want: []string{"/bin/bash", "-lc", "python app.py"}},
		{name: "multiple unchanged", in: []string{"python", "app.py"}, want: []string{"python", "app.py"}},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := normalizeCourseCmd(tt.in)
			if len(got) != len(tt.want) {
				t.Fatalf("normalizeCourseCmd len=%d, want=%d", len(got), len(tt.want))
			}
			for i := range got {
				if got[i] != tt.want[i] {
					t.Fatalf("normalizeCourseCmd[%d]=%q, want=%q", i, got[i], tt.want[i])
				}
			}
		})
	}
}

func TestParseStartCourseRequest(t *testing.T) {
	gin.SetMode(gin.TestMode)

	makeCtx := func(body string) *gin.Context {
		w := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(w)
		req := httptest.NewRequest(http.MethodPost, "/api/courses/sql/start", strings.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
		c.Request = req
		return c
	}

	c1 := makeCtx(`{"image":"ghcr.io/kwdb/kwdb:latest"}`)
	got1 := parseStartCourseRequest(c1)
	if got1.Image != "ghcr.io/kwdb/kwdb:latest" {
		t.Fatalf("parseStartCourseRequest image=%q", got1.Image)
	}
	if got1.HostPort != nil {
		t.Fatalf("parseStartCourseRequest hostPort should be nil, got %v", *got1.HostPort)
	}

	cPort := makeCtx(`{"hostPort":3000}`)
	gotPort := parseStartCourseRequest(cPort)
	if gotPort.HostPort == nil || *gotPort.HostPort != 3000 {
		t.Fatalf("parseStartCourseRequest hostPort=%v", gotPort.HostPort)
	}

	c2 := makeCtx(``)
	got2 := parseStartCourseRequest(c2)
	if got2.Image != "" {
		t.Fatalf("empty body should produce empty image, got %q", got2.Image)
	}
	if got2.HostPort != nil {
		t.Fatalf("empty body should produce nil hostPort, got %v", *got2.HostPort)
	}
}

func TestResolveCoursePorts(t *testing.T) {
	got := resolveCoursePorts(26257, 26257)
	if got == nil {
		t.Fatal("resolveCoursePorts(26257,26257) should not be nil")
	}
	if len(got) != 1 {
		t.Fatalf("resolveCoursePorts(26257,26257) len=%d, want=1", len(got))
	}
	if got["26257"] != "26257" {
		t.Fatalf(`resolveCoursePorts(26257,26257)["26257"]=%q, want="26257"`, got["26257"])
	}

	mapped := resolveCoursePorts(3000, 9090)
	if mapped["9090"] != "3000" {
		t.Fatalf(`resolveCoursePorts(3000,9090)["9090"]=%q, want="3000"`, mapped["9090"])
	}

	defaultContainer := resolveCoursePorts(3000, 0)
	if defaultContainer["26257"] != "3000" {
		t.Fatalf(`resolveCoursePorts(3000,0)["26257"]=%q, want="3000"`, defaultContainer["26257"])
	}

	if got := resolveCoursePorts(0, 26257); got != nil {
		t.Fatalf("resolveCoursePorts(0,26257)=%v, want nil", got)
	}
	if got := resolveCoursePorts(-1, 26257); got != nil {
		t.Fatalf("resolveCoursePorts(-1,26257)=%v, want nil", got)
	}
}

func TestResolveStartHostPort(t *testing.T) {
	requestPort := 3000
	got, err := resolveStartHostPort(&requestPort, 26257)
	if err != nil {
		t.Fatalf("resolveStartHostPort returned error: %v", err)
	}
	if got != 3000 {
		t.Fatalf("resolveStartHostPort got=%d, want=3000", got)
	}

	gotBackend, err := resolveStartHostPort(nil, 26257)
	if err != nil {
		t.Fatalf("resolveStartHostPort backend error: %v", err)
	}
	if gotBackend != 26257 {
		t.Fatalf("resolveStartHostPort backend got=%d, want=26257", gotBackend)
	}

	invalid := 70000
	if _, err := resolveStartHostPort(&invalid, 26257); err == nil {
		t.Fatal("resolveStartHostPort invalid port should return error")
	}
}

type mockDockerController struct {
	docker.Controller
	filesCopied map[string]map[string][]byte
}

func (m *mockDockerController) CreateContainerWithProgress(ctx context.Context, courseID string, config *docker.ContainerConfig, progressCallback docker.ImagePullProgressCallback) (*docker.ContainerInfo, error) {
	return &docker.ContainerInfo{
		ID:       "mock-container-id",
		DockerID: "mock-docker-id",
		State:    docker.StateCreating,
	}, nil
}

func (m *mockDockerController) CopyFilesToContainer(ctx context.Context, containerID string, files map[string][]byte) error {
	if m.filesCopied == nil {
		m.filesCopied = make(map[string]map[string][]byte)
	}
	m.filesCopied[containerID] = files
	return nil
}

func (m *mockDockerController) StartContainer(ctx context.Context, containerID string) error {
	return nil
}

func (m *mockDockerController) ListContainers(ctx context.Context) ([]*docker.ContainerInfo, error) {
	return nil, nil
}

func TestStartCourse_FileInjection(t *testing.T) {
	gin.SetMode(gin.TestMode)

	mockDocker := &mockDockerController{}

	memFS := fstest.MapFS{
		"courses/mock-course/index.yaml": {Data: []byte(`
title: Mock Course
backend:
  imageid: kwdb/kwdb
  volumes:
    - ./rdb.tar.gz:/kaiwudb/bin/rdb.tar.gz
`)},
		"courses/mock-course/rdb.tar.gz": {Data: []byte("mock-rdb-data")},
	}

	courseSvc := course.NewServiceFromFS(memFS, "courses")
	courseSvc.LoadCourses()

	cfg := &config.Config{
		Course: config.CourseConfig{
			DockerDeploy: true,
			UseEmbed:     true,
		},
	}

	loggerInstance := logger.NewLogger(logger.ERROR)
	handler := &Handler{
		courseService:         courseSvc,
		dockerController:      mockDocker,
		logger:                loggerInstance,
		cfg:                   cfg,
		courseStartInProgress: make(map[string]bool),
	}

	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	req := httptest.NewRequest("POST", "/api/courses/mock-course/start", strings.NewReader(`{}`))
	req.Header.Set("Content-Type", "application/json")
	c.Request = req
	c.Params = gin.Params{{Key: "id", Value: "mock-course"}}

	handler.startCourse(c)

	if w.Code != http.StatusOK {
		t.Fatalf("Expected status 200, got %d. Body: %s", w.Code, w.Body.String())
	}

	files, ok := mockDocker.filesCopied["mock-container-id"]
	if !ok {
		t.Fatal("Expected files to be copied to container, but none were")
	}

	content, ok := files["/kaiwudb/bin/rdb.tar.gz"]
	if !ok || string(content) != "mock-rdb-data" {
		t.Errorf("Expected rdb.tar.gz to be injected with content 'mock-rdb-data', got %q", string(content))
	}
}
