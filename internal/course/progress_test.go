package course

import (
	"encoding/json"
	"os"
	"path/filepath"
	"testing"
	"time"

	"kwdb-playground/internal/logger"
)

func TestGetProgress_FileNotExist_ReturnsEmpty(t *testing.T) {
	tmpDir := t.TempDir()
	progressFile := filepath.Join(tmpDir, "progress.json")

	loggerInstance := logger.NewLogger(logger.INFO)
	manager := NewProgressManager(progressFile, loggerInstance)

	progress, exists, err := manager.GetProgress("user1", "course1")
	if err != nil {
		t.Fatalf("GetProgress() error: %v", err)
	}

	if exists {
		t.Errorf("GetProgress() exists = %v, want false", exists)
	}

	if progress == nil {
		t.Error("GetProgress() progress should not be nil")
	}
}

func TestSaveProgress_CreatesFileAndPersists(t *testing.T) {
	tmpDir := t.TempDir()
	progressFile := filepath.Join(tmpDir, "progress.json")

	loggerInstance := logger.NewLogger(logger.INFO)
	manager := NewProgressManager(progressFile, loggerInstance)

	userID := "user1"
	courseID := "course1"
	step := 5
	completed := false

	err := manager.SaveProgress(userID, courseID, step, completed)
	if err != nil {
		t.Fatalf("SaveProgress() error: %v", err)
	}

	if _, err := os.Stat(progressFile); os.IsNotExist(err) {
		t.Error("SaveProgress() should create progress file")
	}

	progress, exists, err := manager.GetProgress(userID, courseID)
	if err != nil {
		t.Fatalf("GetProgress() error: %v", err)
	}

	if !exists {
		t.Error("GetProgress() exists = false, want true")
	}

	if progress.UserID != userID {
		t.Errorf("GetProgress() UserID = %q, want %q", progress.UserID, userID)
	}

	if progress.CourseID != courseID {
		t.Errorf("GetProgress() CourseID = %q, want %q", progress.CourseID, courseID)
	}

	if progress.CurrentStep != step {
		t.Errorf("GetProgress() CurrentStep = %d, want %d", progress.CurrentStep, step)
	}

	if progress.Completed != completed {
		t.Errorf("GetProgress() Completed = %v, want %v", progress.Completed, completed)
	}

	if progress.StartedAt.IsZero() {
		t.Error("GetProgress() StartedAt should be set")
	}

	if progress.CompletedAt != nil {
		t.Errorf("GetProgress() CompletedAt = %v, want nil", progress.CompletedAt)
	}
}

func TestSaveProgress_UpdatesCompletedTimestamp(t *testing.T) {
	tmpDir := t.TempDir()
	progressFile := filepath.Join(tmpDir, "progress.json")

	loggerInstance := logger.NewLogger(logger.INFO)
	manager := NewProgressManager(progressFile, loggerInstance)

	userID := "user1"
	courseID := "course1"

	err := manager.SaveProgress(userID, courseID, 3, false)
	if err != nil {
		t.Fatalf("SaveProgress() error: %v", err)
	}

	progress1, _, err := manager.GetProgress(userID, courseID)
	if err != nil {
		t.Fatalf("GetProgress() error: %v", err)
	}

	if progress1.CompletedAt != nil {
		t.Error("GetProgress() CompletedAt should be nil for incomplete progress")
	}

	time.Sleep(10 * time.Millisecond)

	err = manager.SaveProgress(userID, courseID, 5, true)
	if err != nil {
		t.Fatalf("SaveProgress() error on update: %v", err)
	}

	progress2, exists, err := manager.GetProgress(userID, courseID)
	if err != nil {
		t.Fatalf("GetProgress() error: %v", err)
	}

	if !exists {
		t.Error("GetProgress() exists = false, want true")
	}

	if !progress2.Completed {
		t.Error("GetProgress() Completed = false, want true")
	}

	if progress2.CompletedAt == nil {
		t.Error("GetProgress() CompletedAt should be set for completed progress")
	}

	if !progress1.StartedAt.Equal(progress2.StartedAt) {
		t.Errorf("GetProgress() StartedAt changed: %v -> %v, want same", progress1.StartedAt, progress2.StartedAt)
	}

	if progress2.CurrentStep != 5 {
		t.Errorf("GetProgress() CurrentStep = %d, want 5", progress2.CurrentStep)
	}
}

func TestResetProgress_RemovesEntry(t *testing.T) {
	tmpDir := t.TempDir()
	progressFile := filepath.Join(tmpDir, "progress.json")

	loggerInstance := logger.NewLogger(logger.INFO)
	manager := NewProgressManager(progressFile, loggerInstance)

	userID := "user1"
	courseID := "course1"

	err := manager.SaveProgress(userID, courseID, 3, false)
	if err != nil {
		t.Fatalf("SaveProgress() error: %v", err)
	}

	_, exists, err := manager.GetProgress(userID, courseID)
	if err != nil {
		t.Fatalf("GetProgress() error: %v", err)
	}
	if !exists {
		t.Error("GetProgress() exists = false, want true")
	}

	err = manager.ResetProgress(userID, courseID)
	if err != nil {
		t.Fatalf("ResetProgress() error: %v", err)
	}

	_, exists, err = manager.GetProgress(userID, courseID)
	if err != nil {
		t.Fatalf("GetProgress() error after reset: %v", err)
	}
	if exists {
		t.Error("GetProgress() exists = true after reset, want false")
	}
}

func TestReadProgressFile_CorruptedJSON_ResetsToEmptyStore(t *testing.T) {
	tmpDir := t.TempDir()
	progressFile := filepath.Join(tmpDir, "progress.json")

	badJSON := []byte(`{"version": "1.0", "progress": {invalid json}`)
	err := os.WriteFile(progressFile, badJSON, 0o644)
	if err != nil {
		t.Fatalf("WriteFile() error: %v", err)
	}

	loggerInstance := logger.NewLogger(logger.INFO)
	manager := NewProgressManager(progressFile, loggerInstance)

	progress, exists, err := manager.GetProgress("user1", "course1")
	if err != nil {
		t.Fatalf("GetProgress() error: %v", err)
	}

	if exists {
		t.Error("GetProgress() exists = true for corrupted file, want false")
	}

	if progress == nil {
		t.Error("GetProgress() progress should not be nil")
	}
}

func TestSaveProgress_MultipleUsers(t *testing.T) {
	tmpDir := t.TempDir()
	progressFile := filepath.Join(tmpDir, "progress.json")

	loggerInstance := logger.NewLogger(logger.INFO)
	manager := NewProgressManager(progressFile, loggerInstance)

	users := []struct {
		userID   string
		courseID string
		step     int
	}{
		{"user1", "course1", 3},
		{"user2", "course1", 5},
		{"user1", "course2", 2},
	}

	for _, u := range users {
		err := manager.SaveProgress(u.userID, u.courseID, u.step, false)
		if err != nil {
			t.Fatalf("SaveProgress() error for %s:%s: %v", u.userID, u.courseID, err)
		}
	}

	for _, u := range users {
		progress, exists, err := manager.GetProgress(u.userID, u.courseID)
		if err != nil {
			t.Fatalf("GetProgress() error for %s:%s: %v", u.userID, u.courseID, err)
		}

		if !exists {
			t.Errorf("GetProgress() exists = false for %s:%s, want true", u.userID, u.courseID)
		}

		if progress.CurrentStep != u.step {
			t.Errorf("GetProgress() CurrentStep = %d for %s:%s, want %d",
				progress.CurrentStep, u.userID, u.courseID, u.step)
		}
	}
}

func TestProgressManager_ConcurrentAccess(t *testing.T) {
	tmpDir := t.TempDir()
	progressFile := filepath.Join(tmpDir, "progress.json")

	loggerInstance := logger.NewLogger(logger.INFO)
	manager := NewProgressManager(progressFile, loggerInstance)

	done := make(chan bool, 10)
	for i := 0; i < 10; i++ {
		go func(userID string) {
			err := manager.SaveProgress(userID, "course1", 1, false)
			if err != nil {
				t.Errorf("SaveProgress() concurrent error: %v", err)
			}
			done <- true
		}(string(rune('A' + i)))
	}

	for i := 0; i < 10; i++ {
		<-done
	}

	data, err := os.ReadFile(progressFile)
	if err != nil {
		t.Fatalf("ReadFile() error: %v", err)
	}

	var store ProgressStore
	if err := json.Unmarshal(data, &store); err != nil {
		t.Fatalf("json.Unmarshal() error: %v", err)
	}

	if len(store.Progress) != 10 {
		t.Errorf("Progress count = %d, want 10", len(store.Progress))
	}
}

func TestResetProgress_NonexistentProgress(t *testing.T) {
	tmpDir := t.TempDir()
	progressFile := filepath.Join(tmpDir, "progress.json")

	loggerInstance := logger.NewLogger(logger.INFO)
	manager := NewProgressManager(progressFile, loggerInstance)

	err := manager.ResetProgress("nonexistent", "course1")
	if err != nil {
		t.Errorf("ResetProgress() error for nonexistent progress: %v", err)
	}
}

func TestSaveProgress_PreservesOtherUserData(t *testing.T) {
	tmpDir := t.TempDir()
	progressFile := filepath.Join(tmpDir, "progress.json")

	loggerInstance := logger.NewLogger(logger.INFO)
	manager := NewProgressManager(progressFile, loggerInstance)

	err := manager.SaveProgress("user1", "course1", 3, false)
	if err != nil {
		t.Fatalf("SaveProgress() error: %v", err)
	}

	err = manager.SaveProgress("user2", "course1", 5, false)
	if err != nil {
		t.Fatalf("SaveProgress() error: %v", err)
	}

	err = manager.SaveProgress("user1", "course1", 4, false)
	if err != nil {
		t.Fatalf("SaveProgress() error: %v", err)
	}

	progress, exists, err := manager.GetProgress("user2", "course1")
	if err != nil {
		t.Fatalf("GetProgress() error: %v", err)
	}

	if !exists {
		t.Error("GetProgress() user2 progress should exist")
	}

	if progress.CurrentStep != 5 {
		t.Errorf("GetProgress() user2 CurrentStep = %d, want 5", progress.CurrentStep)
	}
}
