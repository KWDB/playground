package api

import (
	"context"
	"net/http"
	"net/http/httptest"
	"os"
	"reflect"
	"strings"
	"testing"

	"github.com/moby/moby/api/types/container"
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
		{"v0.5.1", "v0.5.0", false},
		{"v1.0.0", "v0.9.9", false},
		{"v0.9.9", "v1.0.0", true},
		{"v0.6.0", "v0.10.0", true},
		{"v0.10.0", "v0.6.0", false},
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

func TestFetchReleaseFromAtomGit(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/KWDB/playground.git/info/refs" {
			t.Errorf("Unexpected path: %s", r.URL.Path)
			w.WriteHeader(http.StatusNotFound)
			return
		}

		response := ""
		response += "001e# service=git-upload-pack\n"
		response += "0000"
		response += "003f7d8f96e5d7d7a7f7d7d7d7d7d7d7d7d7d7d7d refs/tags/v0.5.0\n"
		response += "003f7d8f96e5d7d7a7f7d7d7d7d7d7d7d7d7d7d7d refs/tags/v0.6.0\n"
		response += "00427d8f96e5d7d7a7f7d7d7d7d7d7d7d7d7d7d7d refs/tags/v0.6.0^{}\n"
		response += "003f7d8f96e5d7d7a7f7d7d7d7d7d7d7d7d7d7d7d refs/tags/v0.4.0\n"
		response += "0000"

		w.Header().Set("Content-Type", "application/x-git-upload-pack-advertisement")
		w.WriteHeader(http.StatusOK)
		w.Write([]byte(response))
	}))
	defer server.Close()

	ctx := context.Background()
	release, err := fetchReleaseFromAtomGitWithURL(ctx, server.URL+"/KWDB/playground.git/info/refs?service=git-upload-pack")
	if err != nil {
		t.Fatalf("fetchReleaseFromAtomGitWithURL failed: %v", err)
	}

	expectedTag := "v0.6.0"
	if release.TagName != expectedTag {
		t.Errorf("Expected tag %s, got %s", expectedTag, release.TagName)
	}

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

func TestIsDockerDeploy(t *testing.T) {
	original := os.Getenv("DOCKER_DEPLOY")
	defer os.Setenv("DOCKER_DEPLOY", original)

	_ = os.Setenv("DOCKER_DEPLOY", "true")
	if !isDockerDeploy() {
		t.Fatal("DOCKER_DEPLOY=true should be true")
	}

	_ = os.Setenv("DOCKER_DEPLOY", "1")
	if !isDockerDeploy() {
		t.Fatal("DOCKER_DEPLOY=1 should be true")
	}

	_ = os.Setenv("DOCKER_DEPLOY", "false")
	if isDockerDeploy() {
		t.Fatal("DOCKER_DEPLOY=false should be false")
	}
}

func TestResolveStartArgs(t *testing.T) {
	origArgs := os.Args
	origDaemon := os.Getenv("DAEMON_MODE")
	defer func() {
		os.Args = origArgs
		_ = os.Setenv("DAEMON_MODE", origDaemon)
	}()

	os.Args = []string{"kwdb-playground"}
	_ = os.Setenv("DAEMON_MODE", "")
	if got, want := resolveStartArgs(), []string{"start", "--no-daemon"}; !reflect.DeepEqual(got, want) {
		t.Fatalf("resolveStartArgs()=%v, want=%v", got, want)
	}

	os.Args = []string{"kwdb-playground", "start", "--daemon"}
	_ = os.Setenv("DAEMON_MODE", "")
	if got, want := resolveStartArgs(), []string{"start", "--daemon"}; !reflect.DeepEqual(got, want) {
		t.Fatalf("resolveStartArgs()=%v, want=%v", got, want)
	}

	os.Args = []string{"kwdb-playground", "start", "--no-daemon"}
	_ = os.Setenv("DAEMON_MODE", "1")
	if got, want := resolveStartArgs(), []string{"start", "--no-daemon"}; !reflect.DeepEqual(got, want) {
		t.Fatalf("resolveStartArgs()=%v, want=%v", got, want)
	}
}

func TestWithUpgradeRestartEnv(t *testing.T) {
	env := []string{"PATH=/bin", "KWDB_UPGRADE_RESTART=0", "X=1"}
	got := withUpgradeRestartEnv(env)

	if len(got) != 3 {
		t.Fatalf("withUpgradeRestartEnv len=%d, want=3", len(got))
	}

	found := false
	for _, e := range got {
		if e == "KWDB_UPGRADE_RESTART=1" {
			found = true
		}
		if e == "KWDB_UPGRADE_RESTART=0" {
			t.Fatal("old upgrade env should be removed")
		}
	}
	if !found {
		t.Fatal("new upgrade env should be appended")
	}
}

func TestIsBrewInstall(t *testing.T) {
	if !isBrewInstall("/usr/local/Cellar/kwdb-playground/0.1.0/bin/kwdb-playground") {
		t.Fatal("brew path should be detected")
	}
	if isBrewInstall("/usr/local/bin/kwdb-playground") {
		t.Fatal("non-brew path should not be detected")
	}
}

func TestShellQuoteAndJoin(t *testing.T) {
	if got := shellQuote("abc"); got != "'abc'" {
		t.Fatalf("shellQuote simple=%s", got)
	}
	if got := shellQuote("a'b"); got != "'a'\"'\"'b'" {
		t.Fatalf("shellQuote quote=%s", got)
	}

	joined := joinShellArgs([]string{"docker", "run", "a b"})
	if joined != "'docker' 'run' 'a b'" {
		t.Fatalf("joinShellArgs=%s", joined)
	}
}

func TestFindAssetDownloadURL(t *testing.T) {
	release := githubRelease{
		TagName: "v0.6.0",
		Assets: []githubAsset{
			{Name: "kwdb-playground-darwin-arm64", BrowserDownloadURL: "u1"},
		},
	}

	got, err := findAssetDownloadURL(release, "kwdb-playground-darwin-arm64")
	if err != nil {
		t.Fatalf("findAssetDownloadURL unexpected err: %v", err)
	}
	if got != "u1" {
		t.Fatalf("findAssetDownloadURL got=%q", got)
	}

	_, err = findAssetDownloadURL(release, "not-exist")
	if err == nil {
		t.Fatal("findAssetDownloadURL should return error for missing asset")
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

func TestBuildDockerUpgradeScriptAndRunArgs(t *testing.T) {
	inspect := container.InspectResponse{
		Name: "/kwdb-playground",
		Config: &container.Config{
			Image:    "kwdb/kwdb:latest",
			Hostname: "kwdb-host",
			Env:      []string{"A=B"},
			Cmd:      []string{"bash", "-lc", "echo hi"},
		},
		HostConfig: &container.HostConfig{
			Binds:         []string{"/tmp:/tmp"},
			RestartPolicy: container.RestartPolicy{Name: "always"},
		},
	}

	args := buildDockerRunArgs(inspect)
	all := strings.Join(args, " ")
	mustContain := []string{
		"--name kwdb-playground",
		"--hostname kwdb-host",
		"--restart always",
		"-v /tmp:/tmp",
		"-e A=B",
		"kwdb/kwdb:latest",
		"bash -lc echo hi",
	}
	for _, token := range mustContain {
		if !strings.Contains(all, token) {
			t.Fatalf("buildDockerRunArgs missing token %q in %q", token, all)
		}
	}

	script, err := buildDockerUpgradeScript(inspect)
	if err != nil {
		t.Fatalf("buildDockerUpgradeScript err: %v", err)
	}
	if !strings.Contains(script, "docker pull 'kwdb/kwdb:latest'") {
		t.Fatalf("unexpected script pull: %s", script)
	}
	if !strings.Contains(script, "docker stop 'kwdb-playground' || true") {
		t.Fatalf("unexpected script stop: %s", script)
	}
	if !strings.Contains(script, "docker run -d ") {
		t.Fatalf("unexpected script run: %s", script)
	}
}

func TestBuildDockerUpgradeScriptErrorCases(t *testing.T) {
	inspectEmptyName := container.InspectResponse{
		Name: "",
		Config: &container.Config{
			Image: "kwdb/kwdb:latest",
		},
		HostConfig: &container.HostConfig{},
	}
	if _, err := buildDockerUpgradeScript(inspectEmptyName); err == nil {
		t.Fatal("empty container name should return error")
	}

	inspectEmptyImage := container.InspectResponse{
		Name: "/kwdb-playground",
		Config: &container.Config{
			Image: "",
		},
		HostConfig: &container.HostConfig{},
	}
	if _, err := buildDockerUpgradeScript(inspectEmptyImage); err == nil {
		t.Fatal("empty image should return error")
	}
}

func TestBuildDockerRunArgsOnFailurePolicy(t *testing.T) {
	inspect := container.InspectResponse{
		Name: "/kwdb-playground",
		Config: &container.Config{
			Image: "kwdb/kwdb:latest",
		},
		HostConfig: &container.HostConfig{
			RestartPolicy: container.RestartPolicy{
				Name:              "on-failure",
				MaximumRetryCount: 3,
			},
		},
	}

	args := buildDockerRunArgs(inspect)
	all := strings.Join(args, " ")
	if !strings.Contains(all, "--restart on-failure:3") {
		t.Fatalf("expected on-failure restart policy in args: %q", all)
	}
}
