package api

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"testing"

	"kwdb-playground/internal/config"
	"kwdb-playground/internal/course"
	"kwdb-playground/internal/logger"

	"github.com/gin-gonic/gin"
)

func makeJSONContext(method string, body string) (*gin.Context, *httptest.ResponseRecorder) {
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	req := httptest.NewRequest(method, "/test", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	c.Request = req
	return c, w
}

func decodeJSONMap(t *testing.T, w *httptest.ResponseRecorder) map[string]interface{} {
	t.Helper()
	var out map[string]interface{}
	if err := json.Unmarshal(w.Body.Bytes(), &out); err != nil {
		t.Fatalf("decode json failed: %v, body=%s", err, w.Body.String())
	}
	return out
}

func projectRootFromTestFile(t *testing.T) string {
	t.Helper()
	_, file, _, ok := runtime.Caller(0)
	if !ok {
		t.Fatal("runtime.Caller failed")
	}
	return filepath.Clean(filepath.Join(filepath.Dir(file), "..", ".."))
}

func TestCheckImageAvailabilityValidationAndUnavailable(t *testing.T) {
	gin.SetMode(gin.TestMode)
	h := &Handler{logger: logger.NewLogger(logger.ERROR)}

	c1, w1 := makeJSONContext(http.MethodPost, `{}`)
	h.checkImageAvailability(c1)
	if w1.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", w1.Code)
	}

	c2, w2 := makeJSONContext(http.MethodPost, `{"imageName":"kwdb/kwdb:latest"}`)
	h.checkImageAvailability(c2)
	if w2.Code != http.StatusServiceUnavailable {
		t.Fatalf("expected 503, got %d", w2.Code)
	}
}

func TestGetImageSources(t *testing.T) {
	gin.SetMode(gin.TestMode)
	h := &Handler{logger: logger.NewLogger(logger.ERROR)}
	c, w := makeJSONContext(http.MethodGet, ``)

	h.getImageSources(c)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}

	payload := decodeJSONMap(t, w)
	sources, ok := payload["sources"].([]interface{})
	if !ok {
		t.Fatalf("sources missing or invalid type: %#v", payload["sources"])
	}
	if len(sources) < 3 {
		t.Fatalf("unexpected sources len=%d", len(sources))
	}
}

func TestProgressHandlersValidationAndFlow(t *testing.T) {
	gin.SetMode(gin.TestMode)

	root := projectRootFromTestFile(t)
	coursesDir := filepath.Join(root, "courses")

	oldWD, err := os.Getwd()
	if err != nil {
		t.Fatalf("getwd failed: %v", err)
	}
	tmpWD := t.TempDir()
	if err := os.Chdir(tmpWD); err != nil {
		t.Fatalf("chdir temp failed: %v", err)
	}
	t.Cleanup(func() {
		_ = os.Chdir(oldWD)
	})

	svc := course.NewService(coursesDir)
	h := &Handler{
		logger:        logger.NewLogger(logger.ERROR),
		courseService: svc,
	}

	cBad, wBad := makeJSONContext(http.MethodGet, ``)
	cBad.Params = gin.Params{{Key: "courseId", Value: ""}}
	h.getProgress(cBad)
	if wBad.Code != http.StatusBadRequest {
		t.Fatalf("getProgress empty courseID expected 400, got %d", wBad.Code)
	}

	cSaveBad, wSaveBad := makeJSONContext(http.MethodPost, `not-json`)
	cSaveBad.Params = gin.Params{{Key: "courseId", Value: "sql-basic"}}
	h.saveProgress(cSaveBad)
	if wSaveBad.Code != http.StatusBadRequest {
		t.Fatalf("saveProgress bad json expected 400, got %d", wSaveBad.Code)
	}

	cSave, wSave := makeJSONContext(http.MethodPost, `{"currentStep":2,"completed":false}`)
	cSave.Params = gin.Params{{Key: "courseId", Value: "sql-basic"}}
	h.saveProgress(cSave)
	if wSave.Code != http.StatusOK {
		t.Fatalf("saveProgress expected 200, got %d", wSave.Code)
	}

	cGet, wGet := makeJSONContext(http.MethodGet, ``)
	cGet.Params = gin.Params{{Key: "courseId", Value: "sql-basic"}}
	h.getProgress(cGet)
	if wGet.Code != http.StatusOK {
		t.Fatalf("getProgress expected 200, got %d", wGet.Code)
	}
	gotProgress := decodeJSONMap(t, wGet)
	if exists, ok := gotProgress["exists"].(bool); !ok || !exists {
		t.Fatalf("expected exists=true, got %#v", gotProgress["exists"])
	}

	cReset, wReset := makeJSONContext(http.MethodPost, ``)
	cReset.Params = gin.Params{{Key: "courseId", Value: "sql-basic"}}
	h.resetProgress(cReset)
	if wReset.Code != http.StatusOK {
		t.Fatalf("resetProgress expected 200, got %d", wReset.Code)
	}

	cGet2, wGet2 := makeJSONContext(http.MethodGet, ``)
	cGet2.Params = gin.Params{{Key: "courseId", Value: "sql-basic"}}
	h.getProgress(cGet2)
	if wGet2.Code != http.StatusOK {
		t.Fatalf("getProgress after reset expected 200, got %d", wGet2.Code)
	}
	gotAfter := decodeJSONMap(t, wGet2)
	if exists, ok := gotAfter["exists"].(bool); !ok || exists {
		t.Fatalf("expected exists=false after reset, got %#v", gotAfter["exists"])
	}
}

func TestSystemHandlers(t *testing.T) {
	gin.SetMode(gin.TestMode)

	h := &Handler{
		logger: logger.NewLogger(logger.ERROR),
	}

	cHealth, wHealth := makeJSONContext(http.MethodGet, ``)
	h.healthCheck(cHealth)
	if wHealth.Code != http.StatusOK {
		t.Fatalf("healthCheck expected 200, got %d", wHealth.Code)
	}
	health := decodeJSONMap(t, wHealth)
	if health["status"] != "ok" {
		t.Fatalf("health status expected ok, got %#v", health["status"])
	}

	cVer1, wVer1 := makeJSONContext(http.MethodGet, ``)
	h.getVersion(cVer1)
	if wVer1.Code != http.StatusOK {
		t.Fatalf("getVersion(nil cfg) expected 200, got %d", wVer1.Code)
	}
	v1 := decodeJSONMap(t, wVer1)
	if v1["version"] != "dev" {
		t.Fatalf("getVersion(nil cfg) expected dev, got %#v", v1["version"])
	}

	h.cfg = &config.Config{}
	cVer2, wVer2 := makeJSONContext(http.MethodGet, ``)
	h.getVersion(cVer2)
	if wVer2.Code != http.StatusOK {
		t.Fatalf("getVersion(cfg) expected 200, got %d", wVer2.Code)
	}
	v2 := decodeJSONMap(t, wVer2)
	if v2["version"] != config.Version {
		t.Fatalf("getVersion(cfg) expected %q, got %#v", config.Version, v2["version"])
	}

	h2 := &Handler{logger: logger.NewLogger(logger.ERROR), cfg: nil}
	cEnv, wEnv := makeJSONContext(http.MethodGet, ``)
	h2.envCheck(cEnv)
	if wEnv.Code != http.StatusInternalServerError {
		t.Fatalf("envCheck(nil cfg) expected 500, got %d", wEnv.Code)
	}

	cPageEnv, wPageEnv := makeJSONContext(http.MethodGet, ``)
	h2.pageEnvCheck(cPageEnv)
	if wPageEnv.Code != http.StatusInternalServerError {
		t.Fatalf("pageEnvCheck(nil cfg) expected 500, got %d", wPageEnv.Code)
	}
}
