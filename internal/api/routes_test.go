package api

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestCompareVersions(t *testing.T) {
	tests := []struct {
		v1       string
		v2       string
		expected bool // v1 < v2
	}{
		{"v0.5.0", "v0.6.0", true},
		{"0.5.0", "0.6.0", true},
		{"v0.6.0", "v0.5.0", false},
		{"v0.5.0", "v0.5.0", false},
		{"v0.5.0", "v0.5.1", true},
		{"v0.5.1", "v0.5.0", false},
		{"v1.0.0", "v0.9.9", false},
		{"v0.9.9", "v1.0.0", true},
		{"v0.6.0", "v0.10.0", true}, // Numeric sort check
		{"v0.10.0", "v0.6.0", false},
		{"v1.0", "v1.0.0", true}, // Currently implementation: 2 parts < 3 parts
		{"v1.0.0", "v1.0", false},
	}

	for _, tt := range tests {
		result := compareVersions(tt.v1, tt.v2)
		if result != tt.expected {
			t.Errorf("compareVersions(%s, %s) = %v; expected %v", tt.v1, tt.v2, result, tt.expected)
		}
	}
}

func TestFetchReleaseFromAtomGit(t *testing.T) {
	// Create a mock server that simulates AtomGit's info/refs response
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/KWDB/playground.git/info/refs" {
			t.Errorf("Unexpected path: %s", r.URL.Path)
			w.WriteHeader(http.StatusNotFound)
			return
		}

		// Mock response body for git-upload-pack
		// Format: <4-hex-len><content>
		// We simulate a response with multiple tags
		response := ""
		response += "001e# service=git-upload-pack\n"
		response += "0000"
		response += "003f7d8f96e5d7d7a7f7d7d7d7d7d7d7d7d7d7d7d refs/tags/v0.5.0\n"
		response += "003f7d8f96e5d7d7a7f7d7d7d7d7d7d7d7d7d7d7d refs/tags/v0.6.0\n"
		response += "00427d8f96e5d7d7a7f7d7d7d7d7d7d7d7d7d7d7d refs/tags/v0.6.0^{}\n" // Peeled tag
		response += "003f7d8f96e5d7d7a7f7d7d7d7d7d7d7d7d7d7d7d refs/tags/v0.4.0\n"
		response += "0000"

		w.Header().Set("Content-Type", "application/x-git-upload-pack-advertisement")
		w.WriteHeader(http.StatusOK)
		w.Write([]byte(response))
	}))
	defer server.Close()

	// Temporarily redirect the fetch function to use our mock server
	// Since fetchReleaseFromAtomGit uses hardcoded URL, we need to make it configurable or inject the URL.
	// We refactored the implementation to expose fetchReleaseFromAtomGitWithURL for testing.

	ctx := context.Background()
	release, err := fetchReleaseFromAtomGitWithURL(ctx, server.URL+"/KWDB/playground.git/info/refs?service=git-upload-pack")
	if err != nil {
		t.Fatalf("fetchReleaseFromAtomGitWithURL failed: %v", err)
	}

	// We expect the latest tag to be v0.6.0 because v0.6.0 > v0.5.0 > v0.4.0
	// Note: Our mock returns v0.6.0 twice (once as peeled), logic should handle it.
	expectedTag := "v0.6.0"
	if release.TagName != expectedTag {
		t.Errorf("Expected tag %s, got %s", expectedTag, release.TagName)
	}

	// Verify assets
	if len(release.Assets) == 0 {
		t.Error("Expected assets to be populated, got 0")
	}

	foundDarwinArm64 := false
	for _, asset := range release.Assets {
		if asset.Name == "kwdb-playground-darwin-arm64" {
			foundDarwinArm64 = true
			expectedURL := "https://atomgit.com/KWDB/playground/releases/download/v0.6.0/kwdb-playground-darwin-arm64"
			if asset.BrowserDownloadURL != expectedURL {
				t.Errorf("Expected asset URL %s, got %s", expectedURL, asset.BrowserDownloadURL)
			}
		}
	}
	if !foundDarwinArm64 {
		t.Error("Expected to find kwdb-playground-darwin-arm64 asset")
	}
}

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
