package course

import (
	"os"
	"path/filepath"
	"testing"
	"testing/fstest"
)

func TestReadCourseFile_FromFS(t *testing.T) {
	memFS := fstest.MapFS{
		"courses/smart-meter/data/rdb.tar.gz":  {Data: []byte("fake-rdb-data")},
		"courses/smart-meter/data/tsdb.tar.gz": {Data: []byte("fake-tsdb-data")},
		"courses/smart-meter/index.yaml":       {Data: []byte("title: test")},
	}

	svc := NewServiceFromFS(memFS, "courses")

	t.Run("read existing file", func(t *testing.T) {
		data, err := svc.ReadCourseFile("smart-meter", "data/rdb.tar.gz")
		if err != nil {
			t.Fatalf("ReadCourseFile() error: %v", err)
		}
		if string(data) != "fake-rdb-data" {
			t.Errorf("ReadCourseFile() = %q, want %q", string(data), "fake-rdb-data")
		}
	})

	t.Run("read another file", func(t *testing.T) {
		data, err := svc.ReadCourseFile("smart-meter", "data/tsdb.tar.gz")
		if err != nil {
			t.Fatalf("ReadCourseFile() error: %v", err)
		}
		if string(data) != "fake-tsdb-data" {
			t.Errorf("ReadCourseFile() = %q, want %q", string(data), "fake-tsdb-data")
		}
	})

	t.Run("file not found", func(t *testing.T) {
		_, err := svc.ReadCourseFile("smart-meter", "nonexistent.txt")
		if err == nil {
			t.Error("ReadCourseFile() should fail for nonexistent file")
		}
	})

	t.Run("course not found", func(t *testing.T) {
		_, err := svc.ReadCourseFile("nonexistent-course", "data/rdb.tar.gz")
		if err == nil {
			t.Error("ReadCourseFile() should fail for nonexistent course")
		}
	})
}

func TestReadCourseFile_FromDisk(t *testing.T) {
	tmpDir := t.TempDir()
	courseDir := filepath.Join(tmpDir, "test-course")
	dataDir := filepath.Join(courseDir, "data")
	if err := os.MkdirAll(dataDir, 0o755); err != nil {
		t.Fatalf("MkdirAll() error: %v", err)
	}

	testContent := []byte("disk-file-content")
	if err := os.WriteFile(filepath.Join(dataDir, "test.txt"), testContent, 0o644); err != nil {
		t.Fatalf("WriteFile() error: %v", err)
	}

	svc := NewService(tmpDir)

	t.Run("read existing file from disk", func(t *testing.T) {
		data, err := svc.ReadCourseFile("test-course", "data/test.txt")
		if err != nil {
			t.Fatalf("ReadCourseFile() error: %v", err)
		}
		if string(data) != "disk-file-content" {
			t.Errorf("ReadCourseFile() = %q, want %q", string(data), "disk-file-content")
		}
	})

	t.Run("file not found on disk", func(t *testing.T) {
		_, err := svc.ReadCourseFile("test-course", "data/missing.txt")
		if err == nil {
			t.Error("ReadCourseFile() should fail for missing file")
		}
	})
}

func TestReadCourseFile_FSPriority(t *testing.T) {
	tmpDir := t.TempDir()
	courseDir := filepath.Join(tmpDir, "my-course")
	if err := os.MkdirAll(courseDir, 0o755); err != nil {
		t.Fatalf("MkdirAll() error: %v", err)
	}
	if err := os.WriteFile(filepath.Join(courseDir, "file.txt"), []byte("from-disk"), 0o644); err != nil {
		t.Fatalf("WriteFile() error: %v", err)
	}

	memFS := fstest.MapFS{
		"courses/my-course/file.txt": {Data: []byte("from-embed")},
	}

	svc := NewServiceFromFS(memFS, "courses")

	data, err := svc.ReadCourseFile("my-course", "file.txt")
	if err != nil {
		t.Fatalf("ReadCourseFile() error: %v", err)
	}
	if string(data) != "from-embed" {
		t.Errorf("ReadCourseFile() = %q, want %q (should prefer FS over disk)", string(data), "from-embed")
	}
}

func TestLoadCourses_ParseBackendResourceLimits(t *testing.T) {
	memFS := fstest.MapFS{
		"courses/compile/index.yaml": {Data: []byte(`
title: compile
description: compile test
details:
  intro:
    text: intro.md
  steps:
    - title: step
      text: step1.md
  finish:
    text: finish.md
backend:
  imageid: kwdb/ubuntu:20.04
  memory: "4Gi"
  cpuLimit: "1.5"
`)},
		"courses/compile/intro.md":  {Data: []byte("intro")},
		"courses/compile/step1.md":  {Data: []byte("step")},
		"courses/compile/finish.md": {Data: []byte("finish")},
		"courses/legacy/index.yaml": {Data: []byte(`
title: legacy
description: legacy test
details:
  intro:
    text: intro.md
  steps:
    - title: step
      text: step1.md
  finish:
    text: finish.md
backend:
  imageid: kwdb/ubuntu:20.04
  memoryLimit: 4 * 1024 * 1024 * 1024
  cpu: "2"
`)},
		"courses/legacy/intro.md":  {Data: []byte("intro")},
		"courses/legacy/step1.md":  {Data: []byte("step")},
		"courses/legacy/finish.md": {Data: []byte("finish")},
	}

	svc := NewServiceFromFS(memFS, "courses")
	if err := svc.LoadCourses(); err != nil {
		t.Fatalf("LoadCourses() error: %v", err)
	}

	c, exists := svc.GetCourse("compile")
	if !exists {
		t.Fatalf("course not loaded")
	}

	if c.Backend.MemoryLimit != 4*1024*1024*1024 {
		t.Fatalf("memoryLimit = %d, want %d", c.Backend.MemoryLimit, int64(4*1024*1024*1024))
	}

	if c.Backend.CPULimit != 1.5 {
		t.Fatalf("cpuLimit = %v, want 1.5", c.Backend.CPULimit)
	}

	legacy, exists := svc.GetCourse("legacy")
	if !exists {
		t.Fatalf("legacy course not loaded")
	}

	if legacy.Backend.MemoryLimit != 4*1024*1024*1024 {
		t.Fatalf("legacy memoryLimit = %d, want %d", legacy.Backend.MemoryLimit, int64(4*1024*1024*1024))
	}

	if legacy.Backend.CPULimit != 2 {
		t.Fatalf("legacy cpuLimit = %v, want 2", legacy.Backend.CPULimit)
	}
}
