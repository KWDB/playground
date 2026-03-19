package api

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
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
