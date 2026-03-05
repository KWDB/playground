package update

import (
	"context"
	"errors"
	"os"
	"strings"
	"testing"

	"kwdb-playground/internal/upgrade"
)

func TestUpdateNoUpdate(t *testing.T) {
	originPrepare := prepareUpgradePlan
	originBrew := performBrewUpgrade
	originPerform := performUpgrade
	originDocker := os.Getenv("DOCKER_DEPLOY")
	t.Cleanup(func() {
		prepareUpgradePlan = originPrepare
		performBrewUpgrade = originBrew
		performUpgrade = originPerform
		_ = os.Setenv("DOCKER_DEPLOY", originDocker)
	})
	_ = os.Setenv("DOCKER_DEPLOY", "")

	prepareUpgradePlan = func(ctx context.Context, currentVersion string) (upgrade.Plan, error) {
		return upgrade.Plan{
			Mode:           upgrade.ModeNoUpdate,
			CurrentVersion: "1.0.0",
			LatestVersion:  "1.0.0",
		}, nil
	}

	cmd := NewCommand()
	cmd.SetContext(context.Background())
	if err := cmd.RunE(cmd, nil); err != nil {
		t.Fatalf("expected nil error, got %v", err)
	}
}

func TestUpdateUnsupported(t *testing.T) {
	originPrepare := prepareUpgradePlan
	originDocker := os.Getenv("DOCKER_DEPLOY")
	t.Cleanup(func() {
		prepareUpgradePlan = originPrepare
		_ = os.Setenv("DOCKER_DEPLOY", originDocker)
	})
	_ = os.Setenv("DOCKER_DEPLOY", "")

	prepareUpgradePlan = func(ctx context.Context, currentVersion string) (upgrade.Plan, error) {
		return upgrade.Plan{
			Mode:    upgrade.ModeUnsupported,
			Message: "开发模式不支持在线升级",
		}, nil
	}

	cmd := NewCommand()
	cmd.SetContext(context.Background())
	err := cmd.RunE(cmd, nil)
	if err == nil || !strings.Contains(err.Error(), "开发模式不支持在线升级") {
		t.Fatalf("expected unsupported error, got %v", err)
	}
}

func TestUpdateBinaryMode(t *testing.T) {
	originPrepare := prepareUpgradePlan
	originPerform := performUpgrade
	originDocker := os.Getenv("DOCKER_DEPLOY")
	t.Cleanup(func() {
		prepareUpgradePlan = originPrepare
		performUpgrade = originPerform
		_ = os.Setenv("DOCKER_DEPLOY", originDocker)
	})
	_ = os.Setenv("DOCKER_DEPLOY", "")

	called := false
	prepareUpgradePlan = func(ctx context.Context, currentVersion string) (upgrade.Plan, error) {
		return upgrade.Plan{
			Mode:           upgrade.ModeBinary,
			CurrentVersion: "1.0.0",
			LatestVersion:  "1.1.0",
			DownloadURL:    "http://example.com/bin",
			ExecutablePath: "/tmp/kwdb-playground",
		}, nil
	}
	performUpgrade = func(ctx context.Context, downloadURL, exePath string, startArgs []string, env []string) error {
		called = true
		if downloadURL == "" || exePath == "" {
			return errors.New("invalid args")
		}
		if len(startArgs) != 0 {
			return errors.New("start args should be empty")
		}
		return nil
	}

	cmd := NewCommand()
	cmd.SetContext(context.Background())
	if err := cmd.RunE(cmd, nil); err != nil {
		t.Fatalf("expected nil error, got %v", err)
	}
	if !called {
		t.Fatal("performUpgrade should be called")
	}
}
