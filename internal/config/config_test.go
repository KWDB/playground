package config

import (
	"os"
	"testing"

	"kwdb-playground/internal/logger"
)

func TestLoadConfig(t *testing.T) {
	os.Setenv("COURSES_USE_EMBED", "true")
	defer os.Unsetenv("COURSES_USE_EMBED")

	os.Setenv("SERVER_PORT", "3006")
	os.Setenv("SERVER_HOST", "0.0.0.0")
	os.Setenv("COURSE_DIR", "./courses")
	os.Setenv("COURSES_RELOAD", "true")
	os.Setenv("DOCKER_TIMEOUT", "30")
	os.Setenv("LOG_LEVEL", "info")
	os.Setenv("LOG_FORMAT", "json")
	defer func() {
		os.Unsetenv("SERVER_PORT")
		os.Unsetenv("SERVER_HOST")
		os.Unsetenv("COURSE_DIR")
		os.Unsetenv("COURSES_RELOAD")
		os.Unsetenv("DOCKER_TIMEOUT")
		os.Unsetenv("LOG_LEVEL")
		os.Unsetenv("LOG_FORMAT")
	}()

	cfg, err := Load()
	if err != nil {
		t.Fatalf("Load() failed: %v", err)
	}

	if cfg.Server.Port != 3006 {
		t.Errorf("Server.Port = %d, want 3006", cfg.Server.Port)
	}
	if cfg.Server.Host != "0.0.0.0" {
		t.Errorf("Server.Host = %s, want 0.0.0.0", cfg.Server.Host)
	}
	if cfg.Course.Dir != "./courses" {
		t.Errorf("Course.Dir = %s, want ./courses", cfg.Course.Dir)
	}
	if cfg.Course.Reload != true {
		t.Error("Course.Reload should be true")
	}
	if cfg.Course.UseEmbed != true {
		t.Error("Course.UseEmbed should be true (set in test)")
	}
	if cfg.Docker.Timeout != 30 {
		t.Errorf("Docker.Timeout = %d, want 30", cfg.Docker.Timeout)
	}
	if cfg.Log.Level != "info" {
		t.Errorf("Log.Level = %s, want info", cfg.Log.Level)
	}
	if cfg.Log.Format != "json" {
		t.Errorf("Log.Format = %s, want json", cfg.Log.Format)
	}
}

func TestLoadConfig_InvalidPort(t *testing.T) {
	os.Setenv("SERVER_PORT", "70000")
	defer os.Unsetenv("SERVER_PORT")

	_, err := Load()
	if err == nil {
		t.Error("Load() should fail with invalid port")
	}
}

func TestLoadConfig_InvalidDockerTimeout(t *testing.T) {
	os.Setenv("DOCKER_TIMEOUT", "-1")
	defer os.Unsetenv("DOCKER_TIMEOUT")

	_, err := Load()
	if err == nil {
		t.Error("Load() should fail with invalid docker timeout")
	}
}

func TestLoadConfig_InvalidLogLevel(t *testing.T) {
	os.Setenv("LOG_LEVEL", "invalid")
	defer os.Unsetenv("LOG_LEVEL")

	_, err := Load()
	if err == nil {
		t.Error("Load() should fail with invalid log level")
	}
}

func TestLoadConfig_InvalidLogFormat(t *testing.T) {
	os.Setenv("LOG_FORMAT", "invalid")
	defer os.Unsetenv("LOG_FORMAT")

	_, err := Load()
	if err == nil {
		t.Error("Load() should fail with invalid log format")
	}
}

func TestLoadConfig_NonexistentCourseDir(t *testing.T) {
	os.Setenv("COURSES_USE_EMBED", "false")
	os.Setenv("COURSE_DIR", "/nonexistent/path")
	defer func() {
		os.Unsetenv("COURSES_USE_EMBED")
		os.Unsetenv("COURSE_DIR")
	}()

	_, err := Load()
	if err == nil {
		t.Error("Load() should fail with nonexistent course directory")
	}
}

func TestLoadConfig_InvalidDockerHost(t *testing.T) {
	os.Setenv("DOCKER_HOST", "http://invalid-host")
	defer os.Unsetenv("DOCKER_HOST")

	_, err := Load()
	if err == nil {
		t.Error("Load() should fail with invalid docker host")
	}
}

func TestLoadConfig_InvalidSessionLimit(t *testing.T) {
	os.Setenv("SESSION_LIMIT", "-5")
	defer os.Unsetenv("SESSION_LIMIT")

	_, err := Load()
	if err == nil {
		t.Error("Load() should fail with negative session limit")
	}
}

func TestValidateConfig(t *testing.T) {
	cfg := &Config{
		Server: ServerConfig{
			Host:         "0.0.0.0",
			Port:         3006,
			SessionLimit: 1,
		},
		Docker: DockerConfig{
			Host:    "",
			Timeout: 30,
		},
		Course: CourseConfig{
			Dir:      "./courses",
			Reload:   true,
			UseEmbed: true,
		},
		Log: LogConfig{
			Level:  "info",
			Format: "json",
		},
	}

	testLogger := logger.NewLogger(logger.ERROR)
	err := validateConfig(cfg, testLogger)
	if err != nil {
		t.Errorf("validateConfig() failed: %v", err)
	}
}

func TestIsValidDockerHost(t *testing.T) {
	tests := []struct {
		host  string
		valid bool
	}{
		{"", true},
		{"unix:///var/run/docker.sock", true},
		{"unix:///run/docker.sock", true},
		{"tcp://localhost:2375", true},
		{"tcp://192.168.1.100:2375", true},
		{"invalid", false},
		{"http://localhost:2375", true},
		{"https://localhost:2376", true},
	}

	for _, tt := range tests {
		got := isValidDockerHost(tt.host)
		if got != tt.valid {
			t.Errorf("isValidDockerHost(%q) = %v, want %v", tt.host, got, tt.valid)
		}
	}
}

func TestGetEnv(t *testing.T) {
	os.Setenv("TEST_KEY", "test_value")
	defer os.Unsetenv("TEST_KEY")

	got := getEnv("TEST_KEY", "default")
	if got != "test_value" {
		t.Errorf("getEnv() = %s, want test_value", got)
	}

	got = getEnv("NONEXISTENT_KEY", "default")
	if got != "default" {
		t.Errorf("getEnv() = %s, want default", got)
	}
}

func TestGetEnvInt(t *testing.T) {
	os.Setenv("TEST_INT", "42")
	defer os.Unsetenv("TEST_INT")

	got := getEnvInt("TEST_INT", 0)
	if got != 42 {
		t.Errorf("getEnvInt() = %d, want 42", got)
	}

	got = getEnvInt("NONEXISTENT_INT", 10)
	if got != 10 {
		t.Errorf("getEnvInt() = %d, want 10", got)
	}

	got = getEnvInt("INVALID_INT", 5)
	if got != 5 {
		t.Errorf("getEnvInt() = %d, want 5", got)
	}
}

func TestGetEnvBool(t *testing.T) {
	tests := []struct {
		key      string
		value    string
		expected bool
	}{
		{"TEST_BOOL1", "true", true},
		{"TEST_BOOL2", "false", false},
		{"TEST_BOOL3", "1", true},
		{"TEST_BOOL4", "0", false},
		{"TEST_BOOL5", "TRUE", true},
		{"TEST_BOOL6", "FALSE", false},
	}

	for _, tt := range tests {
		os.Setenv(tt.key, tt.value)
		defer os.Unsetenv(tt.key)

		got := getEnvBool(tt.key, !tt.expected)
		if got != tt.expected {
			t.Errorf("getEnvBool(%s=%s) = %v, want %v", tt.key, tt.value, got, tt.expected)
		}
	}

	got := getEnvBool("NONEXISTENT_BOOL", true)
	if got != true {
		t.Errorf("getEnvBool() = %v, want true", got)
	}
}

func TestLoadConfig_DockerDeploy(t *testing.T) {
	os.Setenv("COURSES_USE_EMBED", "true")
	defer os.Unsetenv("COURSES_USE_EMBED")

	t.Run("default is false", func(t *testing.T) {
		os.Unsetenv("DOCKER_DEPLOY")
		cfg, err := Load()
		if err != nil {
			t.Fatalf("Load() failed: %v", err)
		}
		if cfg.Course.DockerDeploy != false {
			t.Errorf("DockerDeploy = %v, want false", cfg.Course.DockerDeploy)
		}
	})

	t.Run("set to true", func(t *testing.T) {
		os.Setenv("DOCKER_DEPLOY", "true")
		defer os.Unsetenv("DOCKER_DEPLOY")

		cfg, err := Load()
		if err != nil {
			t.Fatalf("Load() failed: %v", err)
		}
		if cfg.Course.DockerDeploy != true {
			t.Errorf("DockerDeploy = %v, want true", cfg.Course.DockerDeploy)
		}
	})

	t.Run("set to 1", func(t *testing.T) {
		os.Setenv("DOCKER_DEPLOY", "1")
		defer os.Unsetenv("DOCKER_DEPLOY")

		cfg, err := Load()
		if err != nil {
			t.Fatalf("Load() failed: %v", err)
		}
		if cfg.Course.DockerDeploy != true {
			t.Errorf("DockerDeploy = %v, want true (from '1')", cfg.Course.DockerDeploy)
		}
	})

	t.Run("set to false", func(t *testing.T) {
		os.Setenv("DOCKER_DEPLOY", "false")
		defer os.Unsetenv("DOCKER_DEPLOY")

		cfg, err := Load()
		if err != nil {
			t.Fatalf("Load() failed: %v", err)
		}
		if cfg.Course.DockerDeploy != false {
			t.Errorf("DockerDeploy = %v, want false", cfg.Course.DockerDeploy)
		}
	})
}

func TestValidateConfig_DockerDeployField(t *testing.T) {
	testLogger := logger.NewLogger(logger.ERROR)

	cfg := &Config{
		Server: ServerConfig{Host: "0.0.0.0", Port: 3006, SessionLimit: 1},
		Docker: DockerConfig{Host: "", Timeout: 30},
		Course: CourseConfig{Dir: "./courses", Reload: true, UseEmbed: true, DockerDeploy: true},
		Log:    LogConfig{Level: "info", Format: "json"},
	}

	err := validateConfig(cfg, testLogger)
	if err != nil {
		t.Errorf("validateConfig() should accept DockerDeploy=true, got: %v", err)
	}
}
