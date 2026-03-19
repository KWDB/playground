package course

import (
	"testing"

	"gopkg.in/yaml.v3"
)

func TestBackendPortUnmarshalInt(t *testing.T) {
	var b Backend
	err := yaml.Unmarshal([]byte("port: 3000"), &b)
	if err != nil {
		t.Fatalf("unmarshal failed: %v", err)
	}
	if b.Port != 3000 {
		t.Fatalf("port=%d, want=3000", b.Port)
	}
	if b.ContainerPort != 26257 {
		t.Fatalf("containerPort=%d, want=26257", b.ContainerPort)
	}
}

func TestBackendPortUnmarshalMapping(t *testing.T) {
	var b Backend
	err := yaml.Unmarshal([]byte("port: 3000:3000"), &b)
	if err != nil {
		t.Fatalf("unmarshal failed: %v", err)
	}
	if b.Port != 3000 {
		t.Fatalf("port=%d, want=3000", b.Port)
	}
	if b.ContainerPort != 3000 {
		t.Fatalf("containerPort=%d, want=3000", b.ContainerPort)
	}
}

func TestBackendPortUnmarshalInvalid(t *testing.T) {
	var b Backend
	err := yaml.Unmarshal([]byte("port: abc"), &b)
	if err == nil {
		t.Fatal("expected error for invalid port")
	}
}
