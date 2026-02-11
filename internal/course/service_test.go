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
