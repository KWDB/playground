package main

import (
	"testing"

	"kwdb-playground/internal/config"
)

func TestSyncRuntimeVersionFallback(t *testing.T) {
	originMainVersion := Version
	originConfigVersion := config.Version
	t.Cleanup(func() {
		Version = originMainVersion
		config.Version = originConfigVersion
	})

	Version = "1.2.3"
	config.Version = "dev"
	syncRuntimeVersion()
	if config.Version != "1.2.3" {
		t.Fatalf("expected config.Version to fallback to main Version, got %q", config.Version)
	}
}

func TestSyncRuntimeVersionKeepInjectedConfigVersion(t *testing.T) {
	originMainVersion := Version
	originConfigVersion := config.Version
	t.Cleanup(func() {
		Version = originMainVersion
		config.Version = originConfigVersion
	})

	Version = "2.0.0"
	config.Version = "1.9.0"
	syncRuntimeVersion()
	if config.Version != "1.9.0" {
		t.Fatalf("expected config.Version unchanged, got %q", config.Version)
	}
}
