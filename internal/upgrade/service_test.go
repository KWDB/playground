package upgrade

import (
	"context"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"
)

func TestCompareVersions(t *testing.T) {
	tests := []struct {
		v1       string
		v2       string
		expected bool
	}{
		{"v0.5.0", "v0.6.0", true},
		{"0.5.0", "0.6.0", true},
		{"v0.6.0", "v0.5.0", false},
		{"v0.5.0", "v0.5.0", false},
		{"v0.5.0", "v0.5.1", true},
		{"v1.0", "v1.0.0", true},
		{"v1.0.0", "v1.0", false},
	}

	for _, tt := range tests {
		result := compareVersions(tt.v1, tt.v2)
		if result != tt.expected {
			t.Errorf("compareVersions(%s, %s) = %v; expected %v", tt.v1, tt.v2, result, tt.expected)
		}
	}
}

func TestFetchReleaseFromAtomGitWithURLNoTags(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte("001e# service=git-upload-pack\n0000"))
	}))
	defer server.Close()

	_, err := fetchReleaseFromAtomGitWithURL(context.Background(), server.URL)
	if err == nil {
		t.Fatal("fetchReleaseFromAtomGitWithURL should fail when no tags")
	}
}

func TestPrepareDockerMode(t *testing.T) {
	originDocker := os.Getenv("DOCKER_DEPLOY")
	t.Cleanup(func() {
		_ = os.Setenv("DOCKER_DEPLOY", originDocker)
	})
	_ = os.Setenv("DOCKER_DEPLOY", "true")

	plan, err := Prepare(context.Background(), "1.0.0")
	if err != nil {
		t.Fatalf("Prepare unexpected err: %v", err)
	}
	if plan.Mode != ModeDocker {
		t.Fatalf("expected ModeDocker, got %s", plan.Mode)
	}
}
